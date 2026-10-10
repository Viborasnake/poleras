import * as THREE from 'three';
import { relaxSleeveOpenings, smoothGarmentNormals } from './garment-edges.js';

const smooth = (value, low, high) => THREE.MathUtils.smoothstep(value, low, high);

// Half-width of the source torso, below the sleeve opening. Matching this
// profile to a constant width removes the adult waist taper from the Over.
function torsoHalfWidth(t) {
  const profile = [[0, .705], [.10, .684], [.20, .688], [.30, .677], [.40, .654], [.49, .660]];
  for (let i = 1; i < profile.length; i++) {
    if (t <= profile[i][0]) {
      const [low, a] = profile[i - 1], [high, b] = profile[i];
      return THREE.MathUtils.lerp(a, b, smooth(t, low, high));
    }
  }
  return profile.at(-1)[1];
}

// A loose shirt hangs from the shoulders. Reduce the fitted model's tight,
// horizontal wrinkles before reshaping it, without changing its topology/UVs.
function relaxFabric(geometry, passes = 12) {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  const neighbors = Array.from({ length: positions.count }, () => new Set());
  const welded = new Map();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
    if (!welded.has(key)) welded.set(key, []);
    welded.get(key).push(i);
  }
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const triangle = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k);
    for (const a of triangle) for (const b of triangle) if (a !== b) neighbors[a].add(b);
  }
  for (const duplicates of welded.values()) {
    const shared = new Set(duplicates.flatMap(i => [...neighbors[i]]));
    duplicates.forEach(i => { neighbors[i] = shared; });
  }
  for (let pass = 0; pass < passes; pass++) {
    const previous = positions.array.slice();
    for (let i = 0; i < positions.count; i++) {
      const adjacent = neighbors[i]; if (!adjacent.size) continue;
      const t = (previous[i * 3 + 1] + 1.325) / 2.65;
      const lower = .48 * smooth(t, .02, .10) * (1 - smooth(t, .50, .68));
      const upper = .14 * smooth(t, .48, .64) * (1 - smooth(t, .84, .96));
      const weight = Math.max(lower, upper) * (1 - smooth(Math.abs(previous[i * 3]), .95, 1.16));
      for (let axis = 0; axis < 3; axis++) {
        let total = 0; for (const neighbor of adjacent) total += previous[neighbor * 3 + axis];
        positions.array[i * 3 + axis] = THREE.MathUtils.lerp(previous[i * 3 + axis], total / adjacent.size, weight);
      }
    }
  }
}

// Local pattern changes, not a uniform size multiplier. Keep the original UVs
// and fabric folds while giving each cut its own shoulders, sleeves and body.
export function createGarmentCut(base, kind) {
  const geometry = base.clone();
  if (kind === 'over') relaxFabric(geometry, 22);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const side = Math.abs(x), t = (y + 1.325) / 2.65;
    const sleeve = smooth(side, .64, 1.08) * smooth(t, .45, .58);
    const neck = (1 - smooth(side, .30, .53)) * smooth(t, .82, .95);
    let nx = x, ny = y, nz = z;
    if (kind === 'over') {
      // Multi-view reference: supported shoulders, nearly straight body,
      // long dropped sleeves and vertical folds released from the armholes.
      const lowerBody = 1 - smooth(t, .58, .79);
      const bodyWidth = THREE.MathUtils.lerp(.725, .805, 1 - smooth(t, .02, .65));
      nx = x * THREE.MathUtils.lerp(1.015, bodyWidth / torsoHalfWidth(t), lowerBody) * (1 - neck) + x * neck;
      nz = z * THREE.MathUtils.lerp(.90, .94, smooth(t, .40, .69)) * (1 - neck) + z * neck;
      // Release the fitted source's horizontal waist crease into a smooth
      // lower panel. Keep the chest and armhole volume from the source mesh.
      const theta = Math.atan2(z / .45, x / torsoHalfWidth(t));
      const panelDepth = THREE.MathUtils.lerp(.505, .465, smooth(t, .02, .62));
      const panelBlend = .90 * (1 - smooth(t, .50, .76)) * (1 - smooth(side, .68, .84));
      const straightPanelX = Math.sign(x) * bodyWidth * Math.pow(Math.abs(Math.cos(theta)), .82);
      const straightPanelZ = Math.sign(z) * panelDepth * Math.pow(Math.abs(Math.sin(theta)), .72);
      nx = THREE.MathUtils.lerp(nx, straightPanelX, panelBlend);
      nz = THREE.MathUtils.lerp(nz, straightPanelZ, panelBlend);
      // Lower the shoulder seam a little from the neck outwards. The transition
      // stays inside the torso so it reads as a dropped shoulder, never a wing.
      const shoulderDrop = smooth(side, .45, .70) * smooth(t, .66, .82);
      ny -= .045 * shoulderDrop;
      // Keep a compact, continuous shoulder line. The sleeve becomes longer
      // by falling from the armhole, rather than rotating and flaring outward.
      const sleeveWeight = smooth(side, .69, 1.00) * smooth(t, .43, .61);
      ny -= .11 * sleeveWeight;
      const armholeDrop = smooth(side, .50, .68) * (1 - smooth(side, .78, .96))
        * smooth(t, .42, .58) * (1 - smooth(t, .66, .84));
      ny -= .075 * armholeDrop;
      // Long shallow channels follow gravity from the axilla, fading before
      // the chest and leaving the central print panel continuous.
      const foldWindow = (.65 + .35 * smooth(t, .02, .18)) * (1 - smooth(t, .62, .79));
      const panel = 1 - smooth(side, .66, .88);
      const foldCenter = .40 + .14 * smooth(t, .10, .68) + .025 * Math.sign(x) * Math.sin(t * 5);
      const fold = -.078 * Math.exp(-Math.pow((Math.abs(nx) - foldCenter) / .14, 2))
        + .040 * Math.exp(-Math.pow((Math.abs(nx) - foldCenter + .16) / .16, 2));
      nz += Math.sign(z) * fold * foldWindow * panel * smooth(Math.abs(z), .08, .22);
      // Soft, asymmetric hem movement follows the long folds.
      ny += (1 - smooth(t, .02, .18)) * (.017 * Math.cos(nx * 7 + .5) + .008 * Math.sin(z * 9));
    } else if (kind === 'kids') {
      // Shorter body, narrower shoulder span and shorter sleeves; a relatively
      // generous neckline is retained instead of shrinking an adult neck.
      nx = x * THREE.MathUtils.lerp(.87, .98, neck);
      nx -= Math.sign(x) * .12 * sleeve;
      ny = y < .38 ? .38 + (y - .38) * .73 : .38 + (y - .38) * .88;
      ny += .085 * sleeve;
      nz = z * .84;
    }
    positions.setXYZ(i, nx, ny, nz);
  }
  if (kind === 'over') relaxSleeveOpenings(geometry);
  geometry.computeBoundingBox();
  // Center each new silhouette without normalizing its proportions away.
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  positions.needsUpdate = true;
  if (kind === 'over') smoothGarmentNormals(geometry);
  else geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
