export const MAX_CATALOG_VIDEO_BYTES = 3 * 1024 * 1024;
const videoPath = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*-video-[a-z0-9][a-z0-9-]*\.mp4$/i;
export const isCatalogVideoPath = path => typeof path === 'string' && path.length <= 500 && videoPath.test(path);
export const isCatalogMp4 = buffer => {
 const data = new Uint8Array(buffer);
 if (data.length < 24 || data[4] !== 102 || data[5] !== 116 || data[6] !== 121 || data[7] !== 112) return false;
 const headerSize = new DataView(buffer).getUint32(0);
 return headerSize >= 16 && headerSize < data.byteLength;
};
