import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createGarmentCut } from './garment-cuts.js';

// Read only the mesh buffers from the real asset: no browser or texture loader
// is required for these topology and proportion regressions.
function loadBaseGeometry() {
  const glb = readFileSync(new URL('../public/shirt.glb', import.meta.url));
  assert.equal(glb.readUInt32LE(0), 0x46546c67);
  assert.equal(glb.readUInt32LE(4), 2);
  let document, binary;
  for (let offset = 12; offset < glb.length;) {
    const length = glb.readUInt32LE(offset), type = glb.readUInt32LE(offset + 4);
    const data = glb.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) document = JSON.parse(data.toString('utf8'));
    if (type === 0x004e4942) binary = data;
    offset += length + 8;
  }
  assert.ok(document && binary, 'The fixture must contain JSON and mesh data.');
  const meshNode = document.nodes.find(node => node.mesh !== undefined);
  const primitive = document.meshes[meshNode.mesh].primitives[0];
  assert.equal(primitive.mode ?? 4, 4, 'The source mesh must contain triangles.');

  function attribute(accessorId) {
    const accessor = document.accessors[accessorId];
    const view = document.bufferViews[accessor.bufferView];
    const itemSize = { SCALAR: 1, VEC2: 2, VEC3: 3 }[accessor.type];
    const format = {
      5123: { ArrayType: Uint16Array, bytes: 2, read: 'readUInt16LE' },
      5125: { ArrayType: Uint32Array, bytes: 4, read: 'readUInt32LE' },
      5126: { ArrayType: Float32Array, bytes: 4, read: 'readFloatLE' }
    }[accessor.componentType];
    assert.ok(itemSize && format && !accessor.sparse, 'Unsupported fixture accessor.');
    const values = new format.ArrayType(accessor.count * itemSize);
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? itemSize * format.bytes;
    for (let i = 0; i < accessor.count; i++) {
      for (let component = 0; component < itemSize; component++) {
        values[i * itemSize + component] = binary[format.read](offset + i * stride + component * format.bytes);
      }
    }
    return new THREE.BufferAttribute(values, itemSize, accessor.normalized ?? false);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', attribute(primitive.attributes.POSITION));
  geometry.setAttribute('normal', attribute(primitive.attributes.NORMAL));
  geometry.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0));
  geometry.setIndex(attribute(primitive.indices));
  // The source scene has a single mesh node and no transform hierarchy.
  assert.equal(document.nodes.length, 1);
  const transform = meshNode.matrix
    ? new THREE.Matrix4().fromArray(meshNode.matrix)
    : new THREE.Matrix4().compose(
      new THREE.Vector3(...(meshNode.translation ?? [0, 0, 0])),
      new THREE.Quaternion(...(meshNode.rotation ?? [0, 0, 0, 1])),
      new THREE.Vector3(...(meshNode.scale ?? [1, 1, 1]))
    );
  geometry.applyMatrix4(transform);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const scale = 2.65 / geometry.boundingBox.getSize(new THREE.Vector3()).y;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  return geometry;
}

function size(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox.getSize(new THREE.Vector3());
}

function torsoWidth(geometry, low, high) {
  const height = size(geometry).y, bottom = geometry.boundingBox.min.y;
  const positions = geometry.attributes.position;
  let left = Infinity, right = -Infinity, count = 0;
  for (let i = 0; i < positions.count; i++) {
    const t = (positions.getY(i) - bottom) / height;
    if (t < low || t > high) continue;
    // Long sleeves now reach the waist band; measure only original torso vertices.
    if (high < .45 && Math.abs(base.attributes.position.getX(i)) > .74) continue;
    left = Math.min(left, positions.getX(i));
    right = Math.max(right, positions.getX(i));
    count++;
  }
  assert.ok(count > 20, 'The body measurement must contain enough mesh vertices.');
  return right - left;
}

function torsoDepth(geometry, low, high) {
  const height = size(geometry).y, bottom = geometry.boundingBox.min.y;
  const positions = geometry.attributes.position;
  // Restrict measurements to the central panels, excluding the sleeve volume.
  let front = -Infinity, back = Infinity, count = 0;
  for (let i = 0; i < positions.count; i++) {
    const t = (positions.getY(i) - bottom) / height;
    if (t < low || t > high || Math.abs(positions.getX(i)) > .40) continue;
    front = Math.max(front, positions.getZ(i));
    back = Math.min(back, positions.getZ(i));
    count++;
  }
  assert.ok(count > 20, 'The depth measurement must contain enough central-panel vertices.');
  return front - back;
}

const base = loadBaseGeometry();
const originalPositions = base.attributes.position.array.slice();
const originalUVs = base.attributes.uv.array.slice();
const originalIndices = base.index.array.slice();
const cuts = Object.fromEntries(['over', 'kids'].map(kind => [kind, createGarmentCut(base, kind)]));

test('creating both cuts leaves the original shirt and its texture coordinates untouched', () => {
  assert.deepEqual(base.attributes.position.array, originalPositions);
  assert.deepEqual(base.attributes.uv.array, originalUVs);
  assert.deepEqual(base.index.array, originalIndices);
  assert.notEqual(cuts.over.attributes.position.array.buffer, base.attributes.position.array.buffer);
  assert.notEqual(cuts.kids.attributes.position.array.buffer, base.attributes.position.array.buffer);
});

for (const [kind, cut] of Object.entries(cuts)) {
  test(`${kind} preserves triangle connectivity and UVs with finite geometry`, () => {
    assert.equal(cut.attributes.position.count, base.attributes.position.count);
    assert.deepEqual(cut.attributes.uv.array, originalUVs);
    assert.deepEqual(cut.index.array, originalIndices);
    for (const attribute of ['position', 'normal']) {
      assert.ok(cut.attributes[attribute].array.every(Number.isFinite), `${kind} has a non-finite ${attribute}.`);
    }
    assert.ok(Number.isFinite(cut.boundingSphere.radius) && cut.boundingSphere.radius > 0);
  });
}

test('Over retains adult length and gains body room without excessive wingspan', () => {
  const adult = size(base), over = size(cuts.over);
  assert.ok(over.y / adult.y > .9 && over.y / adult.y < 1.2, 'Over should retain a wearable adult length.');
  assert.ok(over.x / adult.x > .98 && over.x / adult.x < 1.28, 'Over shoulder/sleeve span must remain controlled.');
  assert.ok(torsoWidth(cuts.over, .22, .38) > torsoWidth(base, .22, .38) * 1.05, 'Over should add real torso room.');
});

test('Over releases gradually from the waist toward the hem', () => {
  const hem = torsoWidth(cuts.over, .04, .12);
  const waist = torsoWidth(cuts.over, .24, .38);
  assert.ok(waist / hem > .86 && waist / hem < .98, 'Lower fabric should open toward the hem without a balloon waist.');
});

test('Over keeps a continuous side profile from the lower torso to the chest', () => {
  const lowerBody = torsoDepth(cuts.over, .22, .38);
  const chest = torsoDepth(cuts.over, .62, .76);
  const ratio = chest / lowerBody;
  assert.ok(ratio > 1 && ratio < 1.85,
    `Chest depth should transition naturally from the lower body (ratio ${ratio.toFixed(2)}).`);
});

test('Kid has a shorter body and narrower sleeves with its own proportions', () => {
  const adult = size(base), kid = size(cuts.kids);
  const heightRatio = kid.y / adult.y, widthRatio = kid.x / adult.x;
  assert.ok(heightRatio > .60 && heightRatio < .88, 'Kid must have a shorter torso.');
  assert.ok(widthRatio > .64 && widthRatio < .97, 'Kid must have a smaller shoulder/sleeve span.');
  const bodyRatio = torsoWidth(cuts.kids, .22, .38) / torsoWidth(base, .22, .38);
  assert.ok(bodyRatio > widthRatio + .02, 'Kid should retain body room while shortening the sleeve span.');
});

test('Over retains adult proportions with ease at the hem', () => {
  const over = size(cuts.over);
  const waist = torsoWidth(cuts.over, .24, .38);
  assert.ok(waist / over.y > .50 && waist / over.y < .60, `Body width must balance the adult length: ${waist / over.y}`);
  assert.ok(over.y < size(base).y * 1.03, 'Reference cut should retain an adult body length.');
});

test('Over preserves the worn chest volume of the basic shirt', () => {
  const ratio = torsoDepth(cuts.over, .62, .76) / torsoDepth(base, .62, .76);
  assert.ok(ratio > .86 && ratio < 1.08, 'Chest volume must remain comparable to the underlying adult body.');
});

test('Over adds lower fabric width without inflating the abdomen', () => {
  // Loose fabric opens toward the hem in profile as well as from the front.
  // A fixed reduction from Basic would reintroduce the pinched abdomen.
  assert.ok(torsoDepth(cuts.over, .22, .38) < torsoDepth(cuts.over, .04, .12) * 1.03);
  assert.ok(torsoDepth(cuts.over, .22, .38) < torsoDepth(base, .22, .38));
  assert.ok(torsoWidth(cuts.over, .04, .12) > torsoWidth(base, .04, .12) * 1.06);
});
