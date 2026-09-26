export const DESIGN_BUCKET = 'customer-designs';
export const DESIGN_MAX_BYTES = 50 * 1024 * 1024;
const extensions = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' });

export function designObjectPath(userId, side, file, uploadId = crypto.randomUUID()) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Debes iniciar sesión para guardar el diseño.');
  if (!['front', 'back'].includes(side)) throw new Error('Cara de impresión no válida.');
  if (!extensions[file?.type] || !file.size || file.size > DESIGN_MAX_BYTES) throw new Error('Usa JPG, PNG o WEBP de hasta 50 MB.');
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw new Error('Identificador de carga no válido.');
  return `${userId}/${side}/${uploadId}.${extensions[file.type]}`;
}

export async function uploadPrivateDesign(supabase, projectUrl, userId, side, file, onProgress = () => {}) {
  const path = designObjectPath(userId, side, file);
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token || session.user?.id !== userId) throw new Error('Inicia sesión para guardar tu diseño.');
  const host = new URL(projectUrl).hostname;
  if (!host.endsWith('.supabase.co')) throw new Error('Proyecto de Supabase no válido.');
  const endpoint = `https://${host.replace(/\.supabase\.co$/, '.storage.supabase.co')}/storage/v1/upload/resumable`;
  const { Upload } = await import('tus-js-client');
  await new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      headers: { authorization: `Bearer ${session.access_token}` },
      metadata: { bucketName: DESIGN_BUCKET, objectName: path, contentType: file.type, cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      onProgress(sent, total) { onProgress(Math.round(sent / total * 100)); },
      onError: reject,
      onSuccess: resolve,
    });
    // Each save uses a new private object path. Reusing a prior TUS fingerprint
    // could resume into another path while reporting this new one as saved.
    upload.start();
  });
  return path;
}

export async function latestPrivateDesign(supabase, userId, side) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !['front', 'back'].includes(side)) throw new Error('Sesión no válida.');
  const folder = `${userId}/${side}`;
  const { data, error } = await supabase.storage.from(DESIGN_BUCKET).list(folder, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw error;
  const latest = data?.find(item => item.name && !item.name.startsWith('.'));
  if (!latest) return null;
  const path = `${folder}/${latest.name}`;
  const result = await supabase.storage.from(DESIGN_BUCKET).download(path);
  if (result.error) throw result.error;
  const mime = Object.entries(extensions).find(([, extension]) => latest.name.endsWith(`.${extension}`))?.[0];
  if (!mime) throw new Error('El diseño guardado tiene un formato no compatible.');
  const file = new File([result.data], latest.name, { type: mime });
  return { path, file };
}
