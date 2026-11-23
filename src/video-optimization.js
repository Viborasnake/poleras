import {MAX_CATALOG_VIDEO_BYTES} from '../supabase/functions/_shared/catalog-video.js';

export const CATALOG_VIDEO_SOURCE_MB = 80;
export const CATALOG_VIDEO_SECONDS = 15;
export const CATALOG_VIDEO_SIDE = 1080;
export const CATALOG_VIDEO_ACCEPT = '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm';

export function catalogVideoFileError(file) {
 if (!file?.size) return 'Selecciona un video válido.';
 if (!/\.(mp4|mov|webm)$/i.test(file.name)) return 'Usa un archivo MP4, MOV o WebM.';
 if (file.size > CATALOG_VIDEO_SOURCE_MB * 1024 ** 2) return `El archivo supera los ${CATALOG_VIDEO_SOURCE_MB} MB.`;
 return '';
}

export function catalogVideoDimensions(width, height, limit = CATALOG_VIDEO_SIDE) {
 const scale = Math.min(1, limit / Math.max(width, height));
 return {width:Math.max(2, Math.floor(width * scale / 2) * 2),height:Math.max(2, Math.floor(height * scale / 2) * 2)};
}

export async function optimizeCatalogVideo(file, baseName, onProgress = () => {}) {
 const error = catalogVideoFileError(file);
 if (error) throw new Error(error);
 if (!globalThis.VideoEncoder || !globalThis.VideoDecoder) {
  throw new Error('Abre el panel en una versión reciente de Chrome, Edge o Safari para optimizar el video.');
 }
 const {BlobSource, BufferTarget, Conversion, Input, MP4, QTFF, WEBM, Mp4OutputFormat, Output, canEncodeVideo} = await import('mediabunny');
 const input = new Input({source:new BlobSource(file), formats:[MP4, QTFF, WEBM]});
 try {
  const track = await input.getPrimaryVideoTrack().catch(()=>{throw new Error('No pudimos leer ese archivo. Prueba con un MP4, MOV o WebM que se reproduzca correctamente.')});
  if (!track) throw new Error('El archivo no contiene un video.');
  const [duration,firstTimestamp,sourceWidth,sourceHeight] = await Promise.all([
   track.computeDuration(),track.getFirstTimestamp(),track.getDisplayWidth(),track.getDisplayHeight(),
  ]);
  const seconds = duration - Math.max(0,firstTimestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('No pudimos leer la duración del video.');
  if (seconds > CATALOG_VIDEO_SECONDS + .05) throw new Error(`El video debe durar hasta ${CATALOG_VIDEO_SECONDS} segundos.`);
  if (!sourceWidth || !sourceHeight || Math.max(sourceWidth,sourceHeight) > 4320) throw new Error('Usa un video con resolución de hasta 4K.');
  if (!await track.canDecode()) throw new Error('Este navegador no puede leer el códec del video. Prueba con un MP4 en H.264.');
  const sourceBitrate = Math.max(120000, Math.floor(file.size * 8 / seconds * .82));
  const limitBitrate = Math.floor((MAX_CATALOG_VIDEO_BYTES - 65536) * 8 / seconds * .85);
  const bitrate = Math.min(1150000, sourceBitrate, limitBitrate);

  for (const [index,{limit,quality}] of [{limit:CATALOG_VIDEO_SIDE,quality:bitrate},{limit:720,quality:Math.round(bitrate * .65)}].entries()) {
   const {width,height} = catalogVideoDimensions(sourceWidth,sourceHeight,limit);
   if (!await canEncodeVideo('avc',{width,height,bitrate:quality})) continue;
   const target = new BufferTarget();
   const output = new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target});
   const conversion = await Conversion.init({
    input,output,
    video: candidate => candidate.id === track.id
     ? {codec:'avc',width,height,fit:'contain',frameRate:24,bitrate:quality,forceTranscode:true,allowTransformationMetadata:false}
     : {discard:true},
    audio:{discard:true},trim:{start:Math.max(0,firstTimestamp),end:duration},tags:{},showWarnings:false,
   });
   if (!conversion.isValid) continue;
   conversion.onProgress = value => onProgress(Math.min(99, Math.round(value * 100)),index + 1);
   await conversion.execute();
   const buffer = target.buffer;
   if (buffer?.byteLength && buffer.byteLength <= MAX_CATALOG_VIDEO_BYTES) {
    return {file:new File([buffer],`${baseName}.mp4`,{type:'video/mp4'}),width,height,seconds};
   }
  }
  throw new Error('No pudimos generar un MP4 de hasta 3 MB. Intenta con un clip más corto o abre el panel en Chrome.');
 } finally {
  input.dispose();
 }
}
