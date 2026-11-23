import {MAX_CATALOG_VIDEO_BYTES} from '../supabase/functions/_shared/catalog-video.js';

export const CATALOG_VIDEO_SOURCE_MB = 80;
export const CATALOG_VIDEO_SECONDS = 15;
export const CATALOG_VIDEO_SIDE = 1920;
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
  async function convert(options, width, height, trim, attempt) {
   const target = new BufferTarget();
   const output = new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target});
   const conversion = await Conversion.init({
    input,output,video:candidate=>candidate.id===track.id?options:{discard:true},
    audio:{discard:true},trim,tags:{},showWarnings:false,
   });
   if (!conversion.isValid) return null;
   conversion.onProgress = value => onProgress(Math.min(99, Math.round(value * 100)),attempt);
   await conversion.execute();
   if (!target.buffer?.byteLength || target.buffer.byteLength > MAX_CATALOG_VIDEO_BYTES) return null;
   return {file:new File([target.buffer],`${baseName}.mp4`,{type:'video/mp4'}),width,height,seconds};
  }

  if (file.size <= MAX_CATALOG_VIDEO_BYTES && Math.max(sourceWidth,sourceHeight) <= CATALOG_VIDEO_SIDE &&
      await track.getCodec() === 'avc') {
   const original = await convert({},sourceWidth,sourceHeight,undefined,1);
   if (original) return original;
  }
  if (!globalThis.VideoEncoder || !globalThis.VideoDecoder) {
   throw new Error('Abre el panel en una versión reciente de Chrome, Edge o Safari para optimizar el video.');
  }
  if (!await track.canDecode()) throw new Error('Este navegador no puede leer el códec del video. Prueba con un MP4 en H.264.');

  const limitBitrate = Math.floor((MAX_CATALOG_VIDEO_BYTES - 65536) * 8 / seconds * .85);
  const trim = {start:Math.max(0,firstTimestamp),end:duration};
  for (const [index,{limit,budget}] of [{limit:CATALOG_VIDEO_SIDE,budget:1},{limit:1280,budget:.72}].entries()) {
   const {width,height} = catalogVideoDimensions(sourceWidth,sourceHeight,limit);
   const bitrate = Math.min(5000000, Math.round(width * height * 3), Math.round(limitBitrate * budget));
   if (!await canEncodeVideo('avc',{width,height,bitrate})) continue;
   const converted = await convert(
    {codec:'avc',width,height,fit:'contain',frameRate:30,bitrate,forceTranscode:true,allowTransformationMetadata:false},
    width,height,trim,index + 1,
   );
   if (converted) return converted;
  }
  throw new Error(`No pudimos generar un MP4 de hasta ${MAX_CATALOG_VIDEO_BYTES / 1024 ** 2} MB. Intenta con un clip más corto o abre el panel en Chrome.`);
 } finally {
  input.dispose();
 }
}
