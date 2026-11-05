import {beginUploadFeedback} from './upload-feedback.js';
export const IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

// Las fotos editoriales se muestran a gran tamaño en pantallas densas. Conserva
// suficiente resolución y reduce calidad antes de bajar innecesariamente a 800 px.
export const CATALOG_IMAGE_POLICY = Object.freeze({ sourceMaxBytes: 25 * 1024 * 1024, maxDimension: 2400, minDimension: 1200, targetBytes: 900 * 1024, qualitySteps: Object.freeze([0.9, 0.82, 0.74, 0.66, 0.58, 0.5]), allowJpegFallback: true });
export const CATALOG_ARTWORK_POLICY = Object.freeze({ ...CATALOG_IMAGE_POLICY, maxDimension: 2400, minDimension: 1200, targetBytes: 3 * 1024 * 1024 });
export const CUSTOMER_IMAGE_POLICY = Object.freeze({ sourceMaxBytes: 12 * 1024 * 1024, maxDimension: 3000, minDimension: 960, targetBytes: 3 * 1024 * 1024, qualitySteps: Object.freeze([0.92, 0.86, 0.78]) });

export function imageFileError(file, policy) {
  if (!file?.size) return 'Selecciona una imagen.';
  if (!IMAGE_TYPES.includes(file.type)) return 'Usa un archivo JPG, PNG o WebP.';
  if (file.size > policy.sourceMaxBytes) return `El archivo supera el máximo de ${Math.round(policy.sourceMaxBytes / 1024 / 1024)} MB.`;
  return '';
}

const canvasBlob = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));
const basename = value => String(value || 'imagen').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'imagen';
const imageExtension = Object.freeze({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' });

function imageDataHasTransparency(imageData) {
  const pixels = imageData.data;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 255) return true;
  return false;
}

async function wasmWebpBlob(imageData, quality) {
  const { default: encode } = await import('@jsquash/webp/encode.js');
  return new Blob([await encode(imageData, { quality: Math.round(quality * 100), alpha_quality: 100 })], { type: 'image/webp' });
}

export async function optimizeImage(file, { policy = CUSTOMER_IMAGE_POLICY, baseName = file?.name } = {}) {
  const error = imageFileError(file, policy);
  if (error) throw new Error(error);
  const feedback=beginUploadFeedback(file.name);
  let url;
  try {
    url = URL.createObjectURL(file);
    const image = new Image();
    await new Promise(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(()=>resolve()):resolve());
    image.src = url;
    await image.decode();
    feedback.update('Optimizando imagen');
    let scale = Math.min(1, policy.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    let best = null;
    const minDimension=Math.max(1,Number(policy.minDimension)||1);
    while (true) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Tu navegador no pudo preparar la imagen.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Canvas may silently return PNG when WebP encoding is unavailable. Never
      // relabel that PNG as WebP; JPEG is a safe fallback only for opaque images.
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const hasTransparency = imageDataHasTransparency(imageData);
      const formats = policy.allowJpegFallback ? ['image/webp', hasTransparency ? 'image/png' : 'image/jpeg'] : ['image/webp'];
      for (const type of formats) {
        for (const quality of type === 'image/png' ? [undefined] : policy.qualitySteps) {
          let blob = await canvasBlob(canvas, type, quality);
          if (type === 'image/webp' && blob?.type !== type) {
            // Safari can silently export PNG instead of WebP. Use libwebp for
            // transparent printable artwork rather than sacrificing resolution.
            try { blob = await wasmWebpBlob(imageData, quality); } catch { break; }
          }
          if (!blob || blob.type !== type) break;
          if (!best || blob.size < best.blob.size) best = { blob, width: canvas.width, height: canvas.height };
          if (blob.size <= policy.targetBytes) return { file: new File([blob], `${basename(baseName)}.${imageExtension[type]}`, { type, lastModified: Date.now() }), width: canvas.width, height: canvas.height, optimized: true };
        }
      }
      const nextScale=scale*0.78;
      if (Math.max(image.naturalWidth*nextScale,image.naturalHeight*nextScale)<minDimension) break;
      scale=nextScale;
    }
    throw new Error(best ? `No pudimos reducir la imagen bajo ${Math.round(policy.targetBytes / 1024)} KB (mínimo ${minDimension} px). Prueba con una imagen más simple o recortada.` : 'Este navegador no pudo codificar la imagen en un formato compatible.');
  } finally { if(url)URL.revokeObjectURL(url);feedback.done(); }
}
