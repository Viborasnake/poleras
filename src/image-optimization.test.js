import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { init as initWebpEncoder } from '@jsquash/webp/encode.js';
import { CATALOG_ARTWORK_POLICY, CATALOG_IMAGE_POLICY, CUSTOMER_IMAGE_POLICY, imageFileError, optimizeImage } from './image-optimization.js';

test('image policies keep upload sources bounded before browser compression', () => {
  assert.equal(imageFileError({ type: 'image/jpeg', size: CATALOG_IMAGE_POLICY.sourceMaxBytes }, CATALOG_IMAGE_POLICY), '');
  assert.match(imageFileError({ type: 'image/jpeg', size: CATALOG_IMAGE_POLICY.sourceMaxBytes + 1 }, CATALOG_IMAGE_POLICY), /25 MB/);
  assert.equal(imageFileError({ type: 'image/webp', size: CUSTOMER_IMAGE_POLICY.sourceMaxBytes }, CUSTOMER_IMAGE_POLICY), '');
  assert.match(imageFileError({ type: 'image/png', size: CUSTOMER_IMAGE_POLICY.sourceMaxBytes + 1 }, CUSTOMER_IMAGE_POLICY), /12 MB/);
  assert.match(imageFileError({ type: 'image/svg+xml', size: 12 }, CUSTOMER_IMAGE_POLICY), /JPG/);
});

test('catalog retries compression at useful lower resolutions before rejecting a mockup', () => {
  assert.equal(CATALOG_IMAGE_POLICY.minDimension, 1200);
  assert.equal(CATALOG_IMAGE_POLICY.maxDimension, 2400);
  assert.deepEqual(CATALOG_IMAGE_POLICY.qualitySteps, [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]);
  assert.ok(CATALOG_IMAGE_POLICY.maxDimension > CATALOG_IMAGE_POLICY.minDimension);
  assert.equal(CATALOG_ARTWORK_POLICY.targetBytes, 3 * 1024 * 1024);
  assert.equal(CATALOG_ARTWORK_POLICY.maxDimension, 2400);
  assert.equal(CATALOG_ARTWORK_POLICY.minDimension, CATALOG_IMAGE_POLICY.minDimension);
});

async function withCanvasMocks({ transparent, encode, imageWidth = 1600, imageHeight = 1200 }, run) {
  const original = { Image: globalThis.Image, document: globalThis.document, createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
  globalThis.Image = class { naturalWidth = imageWidth; naturalHeight = imageHeight; async decode() {} };
  globalThis.document = { createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage() {}, getImageData: (_x, _y, width, height) => {
      const data = new Uint8ClampedArray(width * height * 4);
      data.fill(255);
      if (transparent) data[3] = 0;
      return { data, width, height };
    } }),
    toBlob(callback, type, quality) { callback(encode(type, quality)); },
  }) };
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  try { await run(); } finally {
    globalThis.Image = original.Image;
    globalThis.document = original.document;
    URL.createObjectURL = original.createObjectURL;
    URL.revokeObjectURL = original.revokeObjectURL;
  }
}

test('catalog uses JPEG fallback for an opaque image when canvas silently returns PNG for WebP', async () => {
  await withCanvasMocks({ transparent: false, encode: type => new Blob([new Uint8Array(type === 'image/jpeg' ? 700 * 1024 : 1200 * 1024)], { type: type === 'image/webp' ? 'image/png' : type }) }, async () => {
    const result = await optimizeImage(new File(['source'], 'mockup.png', { type: 'image/png' }), { policy: CATALOG_IMAGE_POLICY });
    assert.equal(result.file.type, 'image/jpeg');
    assert.equal(result.file.name, 'mockup.jpg');
    assert.ok(result.file.size <= CATALOG_IMAGE_POLICY.targetBytes);
  });
});

test('catalog keeps PNG transparency when WebP export is unsupported', async () => {
  await withCanvasMocks({ transparent: true, encode: type => new Blob([new Uint8Array(700 * 1024)], { type: 'image/png' }) }, async () => {
    const result = await optimizeImage(new File(['source'], 'artwork.png', { type: 'image/png' }), { policy: CATALOG_IMAGE_POLICY });
    assert.equal(result.file.type, 'image/png');
    assert.equal(result.file.name, 'artwork.png');
  });
});

test('transparent artwork uses real WebP encoding when canvas only exports PNG', async () => {
  const simdWasm = readFileSync(new URL('../node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm', import.meta.url));
  const wasm = WebAssembly.validate(simdWasm) ? simdWasm : readFileSync(new URL('../node_modules/@jsquash/webp/codec/enc/webp_enc.wasm', import.meta.url));
  await initWebpEncoder(new WebAssembly.Module(wasm));
  await withCanvasMocks({ transparent: true, imageWidth: 2, imageHeight: 2, encode: () => new Blob(['png'], { type: 'image/png' }) }, async () => {
    const result = await optimizeImage(new File(['source'], 'print.png', { type: 'image/png' }), { policy: CATALOG_ARTWORK_POLICY });
    assert.equal(result.file.type, 'image/webp');
    assert.equal(result.file.name, 'print.webp');
    assert.equal(result.width, 2);
    assert.deepEqual(new Uint8Array(await result.file.arrayBuffer()).slice(0, 4), Uint8Array.from([82, 73, 70, 70]));
  });
});
