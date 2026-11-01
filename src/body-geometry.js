import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// Original mockup based on the user's front / side / back reference.
// Viewer units describe appearance, not garment or manufacturing measurements.
const COLS = 96, LOWER_ROWS = 40, ARM_ROWS = 32, SLEEVE_ROWS = 48;
const NECK = .625, CROTCH = 1 / 3;
const smooth = THREE.MathUtils.smoothstep;
const mix = THREE.MathUtils.lerp;

function lowerEdge(u) {
  return -1 + .5 * smooth(Math.abs(u), .24, 1);
}

function upperEdge(u, side) {
  const a = Math.abs(u);
  if (a >= NECK) return 1.05 - .06 * smooth(a, NECK, 1);
  return mix(side === 1 ? .84 : .96, 1.05, (a / NECK) ** 2);
}

function torsoPoint(u, v, side = 1) {
  const y = mix(lowerEdge(u), upperEdge(u, side), v);
  const width = .49 + .012 * Math.sin((y + .5) * 2) * (1 - smooth(y, .2, .47));
  const x = u * width;
  // Cloth supported by an invisible infant: chest, belly and diaper seat
  // have distinct volumes, tapering into the lower closure.
  const chest = Math.exp(-((y - .45) ** 2) / .16);
  const belly = Math.exp(-((y + .18) ** 2) / .20);
  const seat = Math.exp(-((y + .48) ** 2) / .14);
  const closure = smooth(-y, .55, 1);
  const volume = side === 1
    ? .16 + .035 * chest + .08 * belly - .045 * closure
    : .145 + .025 * chest + .045 * seat - .025 * closure;
  const armY = THREE.MathUtils.clamp((y - .73) / .26, -1, 1);
  const armDepth = y >= .47 ? .125 * Math.sqrt(Math.max(0, 1 - armY * armY)) : 0;
  const edge = Math.abs(u) ** 3;
  const folds = .009 * Math.sin(y * 12 + Math.abs(u) * 9)
    * Math.exp(-(((Math.abs(u) - .8) / .12) ** 2)) * (1 - edge);
  const z = side * (volume * Math.sqrt(Math.max(0, 1 - edge)) + armDepth * edge + folds);
  return new THREE.Vector3(x, y, z);
}

// Rows meet the bottom and top of the oval armhole exactly. Front, back and
// sleeve share these vertices, so there is no capped tube or intersecting seam.
function torsoV(row) {
  const y = row <= LOWER_ROWS
    ? mix(-.5, .47, row / LOWER_ROWS)
    : mix(.47, .99, (row - LOWER_ROWS) / ARM_ROWS);
  return (y + .5) / 1.49;
}

function sleevePoint(hand, t, ring) {
  const q = ring <= ARM_ROWS ? -1 + 2 * ring / ARM_ROWS : 3 - 2 * ring / ARM_ROWS;
  const front = ring <= ARM_ROWS ? 1 : -1;
  const tilt = 1.24 * smooth(t, 0, .7);
  const radius = mix(.26, .107, smooth(t, 0, .8));
  const depth = mix(.125, .083, smooth(t, 0, 1));
  const fold = .003 * Math.sin(t * 27) * Math.sin(Math.PI * t) ** 2;
  const centerX = .49 + .42 * t + .05 * Math.sin(Math.PI * t);
  const centerY = .73 - 1.03 * t ** 1.65;
  return new THREE.Vector3(
    hand * (centerX + (radius + fold) * q * Math.sin(tilt)),
    centerY + (radius + fold) * q * Math.cos(tilt),
    -.008 * t + front * (depth + fold) * Math.sqrt(Math.max(0, 1 - q * q)),
  );
}

function bridgePoint(u, t, shoulder) {
  const front = torsoPoint(u, shoulder ? 1 : 0, 1);
  const back = torsoPoint(u, shoulder ? 1 : 0, -1);
  const point = front.lerp(back, t);
  point.y += (shoulder ? .018 * (1 - smooth(Math.abs(u), .8, 1)) : -.055) * Math.sin(Math.PI * t);
  return point;
}

function surfaceBuilder() {
  const positions = [], indices = [];
  function patch(columns, rows, point, reverse = false) {
    const offset = positions.length / 3;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= columns; i++) positions.push(...point(i / columns, j / rows).toArray());
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const a = offset + j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
        indices.push(...(reverse ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
      }
    }
  }
  function finish() {
    const raw = new THREE.BufferGeometry();
    raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    raw.setIndex(indices);
    const geometry = mergeVertices(raw, .000001);
    raw.dispose();
    const position = geometry.getAttribute('position');
    const clean = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < geometry.index.count; i += 3) {
      const ids = [0, 1, 2].map(j => geometry.index.getX(i + j));
      a.fromBufferAttribute(position, ids[0]);
      b.fromBufferAttribute(position, ids[1]);
      c.fromBufferAttribute(position, ids[2]);
      // Shoulder tips converge into a fan. Discard collapsed grid cells there.
      if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) clean.push(...ids);
    }
    geometry.setIndex(clean);
    const uv = [];
    for (let i = 0; i < position.count; i++) uv.push((position.getX(i) + 1.1) / 2.2, (position.getY(i) + 1.1) / 2.2);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
  return {patch, finish};
}

export function createBodyGeometry() {
  const fabric = surfaceBuilder();
  for (const side of [1, -1]) {
    fabric.patch(COLS, LOWER_ROWS + ARM_ROWS,
      (u, row) => torsoPoint(u * 2 - 1, torsoV(row * (LOWER_ROWS + ARM_ROWS)), side), side === -1);
  }
  for (const hand of [-1, 1]) {
    fabric.patch(18, 24, (u, t) => bridgePoint(hand * mix(NECK, 1, u), t, true), hand === -1);
    fabric.patch(ARM_ROWS * 2, SLEEVE_ROWS,
      (ring, t) => sleevePoint(hand, t, ring * ARM_ROWS * 2), hand === 1);
  }
  fabric.patch(32, 24, (u, t) => bridgePoint(mix(-CROTCH, CROTCH, u), t, false), true);
  // Only the neck, two cuffs and two leg openings remain unstitched.
  return fabric.finish();
}

export function addBodyDetails(mesh) {
  function add(geometry, name, shade = .97) {
    const material = new THREE.MeshStandardMaterial({
      color: mesh.material.color.clone().multiplyScalar(shade), roughness: .96, metalness: 0,
      side: THREE.DoubleSide,
    });
    const detail = new THREE.Mesh(geometry, material);
    detail.name = name;
    detail.userData.fabricShade = shade;
    mesh.add(detail);
    return detail;
  }
  function binding(name, draw) {
    const tape = surfaceBuilder();
    draw(tape);
    const geometry = tape.finish();
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    for (let i = 0; i < position.count; i++) {
      position.setXYZ(i, position.getX(i) + normal.getX(i) * .002,
        position.getY(i) + normal.getY(i) * .002, position.getZ(i) + normal.getZ(i) * .002);
    }
    position.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    add(geometry, name);
  }
  binding('collar-binding', tape => {
    for (const side of [1, -1]) {
      tape.patch(60, 4, (u, v) => torsoPoint(mix(-NECK, NECK, u), mix(.981, 1, v), side), side === -1);
    }
    for (const hand of [-1, 1]) {
      tape.patch(4, 24, (u, t) => bridgePoint(hand * mix(NECK, NECK + .05, u), t, true), hand === -1);
    }
  });
  for (const hand of [-1, 1]) {
    const label = hand === -1 ? 'left' : 'right';
    binding(`${label}-cuff-binding`, tape => {
      tape.patch(ARM_ROWS * 2, 4, (ring, v) => sleevePoint(hand, mix(.968, 1, v), ring * ARM_ROWS * 2), hand === 1);
    });
    binding(`${label}-leg-binding`, tape => {
      for (const side of [1, -1]) {
        tape.patch(32, 4, (u, v) => torsoPoint(hand * mix(CROTCH, 1, u), v * .018, side), side * hand === -1);
      }
      tape.patch(4, 24, (u, t) => bridgePoint(hand * mix(CROTCH - .05, CROTCH, u), t, false), hand === 1);
    });
    // Envelope shoulder overlaps follow the chest curvature and end at the
    // armhole, like the supplied baby garment, without crossing the print area.
    const overlap = surfaceBuilder();
    overlap.patch(24, 8, (u, v) => {
      const point = torsoPoint(hand * mix(NECK, 1, u), 1 - .15 * smooth(u, 0, 1) * v);
      point.z += .003;
      return point;
    }, hand === 1);
    add(overlap.finish(), `${label}-envelope-shoulder`, .99);
    const seam = Array.from({length: 33}, (_, i) => {
      const t = i / 32;
      const point = torsoPoint(hand * mix(NECK, 1, t), 1 - .15 * smooth(t, 0, 1));
      point.z += .006;
      return point;
    });
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam), 48, .0024, 6, false), `${label}-shoulder-stitch`, .93);
  }

  // A curved overlapping tab and small fabric-covered snaps at the front.
  const closure = surfaceBuilder();
  closure.patch(32, 8, (u, v) => {
    const x = mix(-CROTCH, CROTCH, u);
    const point = torsoPoint(x, v * (.019 + .047 * Math.sin(Math.PI * u)));
    point.z += .0035;
    return point;
  });
  add(closure.finish(), 'closure-tab', .98);
  const closureSeam = Array.from({length: 33}, (_, i) => {
    const u = i / 32;
    const point = torsoPoint(mix(-CROTCH, CROTCH, u), .019 + .047 * Math.sin(Math.PI * u));
    point.z += .006;
    return point;
  });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(closureSeam), 48, .0023, 6, false), 'closure-seam', .92);
  for (const u of [-.15, 0, .15]) {
    const point = torsoPoint(u, .047);
    point.z += .009;
    const snap = add(new THREE.SphereGeometry(.014, 20, 12), 'closure-snap', .88);
    snap.scale.z = .32;
    snap.position.copy(point);
  }
}
