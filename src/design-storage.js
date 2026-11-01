// Las rutas se mantienen estables en la base de datos, pero los bytes viven en
// el bucket privado de Cloudflare R2. Nunca se expone una URL pública.
import { CUSTOMER_IMAGE_POLICY, optimizeImage } from './image-optimization.js';

export const DESIGN_BUCKET = 'droska-customer-designs';
// La compresión sucede antes de llegar aquí; esto vuelve a validar el resultado
// final para que una llamada manual no pueda llenar el bucket privado.
export const DESIGN_MAX_BYTES = 3 * 1024 * 1024;
const extensions = Object.freeze({ 'image/webp': 'webp' });

export function designObjectPath(userId, side, file, uploadId = crypto.randomUUID()) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Debes iniciar sesión para guardar el diseño.');
  if (!['front', 'back', 'reference'].includes(side)) throw new Error('Tipo de archivo no válido.');
  if (!extensions[file?.type] || !file.size || file.size > DESIGN_MAX_BYTES) throw new Error('Usa un WebP optimizado de hasta 3 MB.');
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw new Error('Identificador de carga no válido.');
  return `${userId}/${side}/${uploadId}.${extensions[file.type]}`;
}

export async function uploadPrivateDesign(supabase, userId, side, file, onProgress = () => {}) {
  // Esta es la última barrera del navegador antes de R2. Los flujos actuales
  // ya optimizan al seleccionar el archivo, pero hacerlo otra vez aquí evita
  // que un flujo futuro o un borrador antiguo pueda subir el original pesado.
  const optimized = await optimizeImage(file, { policy: CUSTOMER_IMAGE_POLICY, baseName: file?.name });
  file = optimized.file;
  const path = designObjectPath(userId, side, file);
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token || session.user?.id !== userId) throw new Error('Inicia sesión para guardar tu diseño.');
  onProgress(0);
  const { data, error: signError } = await supabase.functions.invoke('private-design-storage', { body: { action: 'create-upload', path, contentType: file.type, size: file.size } });
  if (signError || !data?.uploadUrl) throw new Error(data?.error || signError?.message || 'No pudimos preparar la carga segura.');
  const response = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!response.ok) throw new Error('No pudimos subir el diseño a Cloudflare. Intenta nuevamente.');
  onProgress(100);
  return path;
}

export async function latestPrivateDesign(supabase, userId, side) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !['front', 'back'].includes(side)) throw new Error('Sesión no válida.');
  const { data, error } = await supabase.functions.invoke('private-design-storage', { body: { action: 'latest', side } });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'No pudimos recuperar tu diseño.');
  if (!data?.design) return null;
  const result = await fetch(data.design.url);
  if (!result.ok) throw new Error('No pudimos descargar tu diseño.');
  const mime = Object.entries(extensions).find(([, extension]) => data.design.path.endsWith(`.${extension}`))?.[0];
  if (!mime) throw new Error('El diseño guardado tiene un formato no compatible.');
  const file = new File([await result.blob()], data.design.path.split('/').at(-1), { type: mime });
  return { path: data.design.path, file };
}

export async function sharePrivateDesign(supabase,path){
  if(!path)throw new Error('Falta el archivo que quieres compartir.');
  const {data,error}=await supabase.functions.invoke('private-design-storage',{body:{action:'share-download',path}});
  if(error||!data?.url)throw new Error(data?.error||error?.message||'No pudimos crear el enlace privado.');
  return data.url;
}
