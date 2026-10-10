import * as THREE from 'three';

// Weld UV duplicates before tracing the actual open edges of the cloth.
export function garmentOpenings(geometry) {
  const position = geometry.attributes.position;
  geometry.computeBoundingBox();
  const height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
  const vertices = [], ids = [], welded = new Map(), edges = new Map();
  const tolerance = height * 1e-5;
  for (let i = 0; i < position.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i);
    const key = point.toArray().map(value => Math.round(value / tolerance)).join(',');
    if (!welded.has(key)) { welded.set(key, vertices.length); vertices.push(point); }
    ids.push(welded.get(key));
  }
  const index = geometry.index;
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    for (let side = 0; side < 3; side++) {
      const a = ids[index ? index.getX(i + side) : i + side];
      const b = ids[index ? index.getX(i + (side + 1) % 3) : i + (side + 1) % 3];
      if (a === b) continue;
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const adjacency = new Map();
  for (const [key, count] of edges) {
    if (count !== 1) continue;
    const [a, b] = key.split(',').map(Number);
    for (const [from, to] of [[a, b], [b, a]]) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push(to);
    }
  }
  const visited = new Set(), loops = [];
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const points = []; let current = start;
    while (!visited.has(current)) {
      visited.add(current); points.push(vertices[current]);
      const next = adjacency.get(current)?.find(id => !visited.has(id));
      if (next === undefined) break;
      current = next;
    }
    if (points.length >= 24 && adjacency.get(current)?.includes(start)) loops.push(points);
  }
  return loops;
}

export function relaxSleeveOpenings(geometry) {
  const loops = garmentOpenings(geometry);
  const bounds = geometry.boundingBox, height = bounds.max.y - bounds.min.y;
  const position = geometry.attributes.position, point = new THREE.Vector3();
  for (const points of loops) {
    const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(points.length);
    const relativeY = (center.y - bounds.min.y) / height;
    if (relativeY < .3 || relativeY > .8 || Math.abs(center.x) < .7) continue;
    // Fit the existing cuff angle, then relax its irregular lip into that
    // plane. Nearby fabric follows the correction so there is no sharp rim.
    let xx = 0, zz = 0, xz = 0, xy = 0, zy = 0;
    for (const p of points) {
      const x = p.x - center.x, y = p.y - center.y, z = p.z - center.z;
      xx += x * x; zz += z * z; xz += x * z; xy += x * y; zy += z * y;
    }
    const determinant = xx * zz - xz * xz;
    if (Math.abs(determinant) < 1e-10) continue;
    const a = (xy * zz - zy * xz) / determinant;
    const b = (zy * xx - xy * xz) / determinant;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      if (Math.abs(point.x - center.x) > .4 || Math.abs(point.y - center.y) > .3) continue;
      let distance = Infinity;
      for (const rim of points) distance = Math.min(distance, point.distanceToSquared(rim));
      const weight = .9 * Math.exp(-distance / (.07 * .07));
      const planeY = center.y + a * (point.x - center.x) + b * (point.z - center.z);
      position.setY(i, THREE.MathUtils.lerp(point.y, planeY, weight));
    }
  }
}

// UV islands duplicate vertices at seams. Share the lighting normal without
// welding the UVs, so the fabric does not acquire a hard crease at each island.
export function smoothGarmentNormals(geometry) {
  geometry.computeVertexNormals();
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  const sum = new THREE.Vector3(), value = new THREE.Vector3();
  for (const ids of groups.values()) {
    sum.set(0, 0, 0);
    for (const id of ids) sum.add(value.fromBufferAttribute(normal, id));
    sum.normalize();
    for (const id of ids) normal.setXYZ(id, sum.x, sum.y, sum.z);
  }
  normal.needsUpdate = true;
}

// Tint the existing folded band on the cloth itself. An overlapping ribbon
// can intersect the returned lip and flicker as the garment rotates.
export function foldedGarmentEdges(geometry) {
  const position = geometry.attributes.position;
  const openings = garmentOpenings(geometry);
  const bounds = geometry.boundingBox, height = bounds.max.y - bounds.min.y;
  const colors = new Float32Array(position.count * 3).fill(1);
  const point = new THREE.Vector3();
  const distanceToEdge = new Float32Array(position.count).fill(Infinity);
  for (const points of openings) {
    const relativeY = (points.reduce((sum, p) => sum + p.y, 0) / points.length - bounds.min.y) / height;
    // The original collar already has its own raised band.
    if (relativeY > .8) continue;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      let distance = Infinity;
      for (const edge of points) distance = Math.min(distance, point.distanceToSquared(edge));
      distanceToEdge[i] = Math.min(distanceToEdge[i], Math.sqrt(distance));
    }
  }
  const width = height * .024;
  for (let i = 0; i < position.count; i++) {
    const distance = distanceToEdge[i];
    if (distance > width * 1.3) continue;
    const band = 1 - THREE.MathUtils.smoothstep(distance, width * .85, width * 1.15);
    colors.fill(1 - .045 * band, i * 3, i * 3 + 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
