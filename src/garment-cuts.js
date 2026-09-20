import * as THREE from 'three';
import { relaxSleeveOpenings } from './garment-edges.js';

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
function relaxFabric(geometry) {
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
  for (let pass = 0; pass < 10; pass++) {
    const previous = positions.array.slice();
    for (let i = 0; i < positions.count; i++) {
      const adjacent = neighbors[i]; if (!adjacent.size) continue;
      const t = (previous[i * 3 + 1] + 1.325) / 2.65;
      const weight = .48 * smooth(t, .04, .14) * (1 - smooth(t, .76, .92));
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
  if (kind === 'over') relaxFabric(geometry);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const side = Math.abs(x), t = (y + 1.325) / 2.65;
    const sleeve = smooth(side, .64, 1.08) * smooth(t, .45, .58);
    const neck = (1 - smooth(side, .30, .53)) * smooth(t, .82, .95);
    let nx = x, ny = y, nz = z;
    if (kind === 'over') {
      // Broad rectangular torso, but a controlled sleeve span. Widening the
      // entire upper mesh creates batwing sleeves rather than the reference cut.
      const bodyX = x * (.77 / torsoHalfWidth(t));
      const upperX = Math.sign(x) * (side <= .36 ? side : .36 + (side - .36) * 1.08);
      nx = THREE.MathUtils.lerp(bodyX, upperX, smooth(t, .44, .68));
      // The reference's sleeve hangs from a defined shoulder, ending near
      // mid-torso. Extend below that anchor instead of lowering the shoulder.
      const sleevePanel = smooth(side, .57, .74) * smooth(t, .44, .55);
      const shoulderSupport = smooth(side, .40, .72) * (1 - smooth(side, .88, 1.06)) * smooth(t, .72, .90);
      ny = y + .025 * shoulderSupport - Math.max(0, .92 - y) * .35 * sleevePanel;
      // Loose, flatter chest with subdued folds, instead of the adult fitted
      // chest and pinched waist. Keep the neck and sleeve openings untouched.
      const torso = (1 - smooth(t, .47, .77)) * (1 - sleevePanel);
      const theta = Math.atan2(z / .43, x / torsoHalfWidth(t));
      const cosine = Math.cos(theta), sine = Math.sin(theta);
      // A softly rectangular cross-section removes the pinched waist on both
      // front and back. Its small folds run down the body rather than across it.
      const bodyWidth = .77 + .009 * Math.sin(theta * 7 + t * 3);
      const boxX = bodyWidth * Math.sign(cosine) * Math.pow(Math.abs(cosine), .58);
      const foldWeight = .65 + .35 * Math.pow(Math.abs(cosine), .7);
      const folds = foldWeight * (
        .028 * Math.cos(theta * 9 + t * 2.1) +
        .018 * Math.sin(theta * 13 - t * 2.8 + .6)
      ) * (.65 + .35 * smooth(t, .01, .16));
      // A little ease through the body and gently wandering folds keep the
      // loose panels from becoming a constant-depth extrusion or a flat board.
      const bodyDepth = .32 + .035 * Math.sin(Math.PI * smooth(t, 0, .72));
      // Two broad, slightly wandering creases give the cotton a used, lived-in
      // fall. They are vertical and sparse so the print stays readable and
      // the silhouette remains the same.
      const useArea = smooth(t, .12, .24) * (1 - smooth(t, .72, .88));
      const creaseA = Math.exp(-Math.pow((boxX - (.27 + .028 * Math.sin(t * 3.6))) / .115, 2));
      const creaseB = Math.exp(-Math.pow((boxX - (-.34 + .022 * Math.cos(t * 3.1 + .7))) / .145, 2));
      const usedCreases = useArea * (
        .022 * Math.sin(t * 5.2 + 1.1) * creaseA +
        .015 * Math.sin(t * 4.3 + .4) * creaseB
      ) * (.3 + .7 * Math.pow(Math.abs(sine), .55));
      // Add a quiet two-lobe chest under the front panel, like a semi-muscular
      // wearer inside the loose shirt. It fades before the hem and never adds
      // volume to the back, shoulders or waist.
      const lateral = THREE.MathUtils.clamp(x / torsoHalfWidth(t), -1, 1);
      const chestWindow = smooth(t, .42, .56) * (1 - smooth(t, .72, .84));
      const chestFront = Math.pow(Math.max(sine, 0), .72);
      const chestLobes = Math.exp(-Math.pow((lateral - .34) / .30, 2)) +
        Math.exp(-Math.pow((lateral + .34) / .30, 2));
      const sternumEase = 1 - .32 * Math.exp(-Math.pow(lateral / .12, 2));
      const chestBulge = .058 * chestWindow * chestFront * chestLobes * sternumEase;
      const boxZ = (bodyDepth + folds + usedCreases + chestBulge) * Math.sign(sine) * Math.pow(Math.abs(sine), .68);
      nx = THREE.MathUtils.lerp(nx, boxX, torso);
      // The adult source has a mannequin-shaped chest/back, almost twice as
      // deep as our loose lower panel. Compress that volume before blending
      // into the straight body; retain room inside the sleeves and neckline.
      const upperDepth = THREE.MathUtils.lerp(THREE.MathUtils.lerp(.67, .78, sleevePanel), .85, neck);
      nz = THREE.MathUtils.lerp(z * upperDepth, boxZ, torso);
      // Project the front panel itself, instead of relying only on the blended
      // cross-section above. The extra depth is what makes a relaxed shirt
      // read over a real chest in profile, while the sternum stays softer.
      const chestProjection = .075 * chestWindow * chestFront * chestLobes * sternumEase;
      nz += Math.sign(sine) * chestProjection * (.4 + .6 * Math.pow(Math.abs(sine), .45));
      // The side panels should carry the chest's volume down into the hem.
      // Broad, low-frequency movement reads as worn cotton instead of a rigid
      // cylinder, while staying inside the oversize outline.
      const sidePanel = smooth(Math.abs(cosine), .52, .92) * smooth(t, .12, .82);
      const sideDrape = sidePanel * (
        .016 * Math.sin(t * 4.6 + (x > 0 ? .55 : 1.4)) +
        .009 * Math.sin(t * 8.1 - .35)
      );
      nx += Math.sign(x) * sideDrape;
      nz += Math.sign(sine) * sidePanel * .008 * Math.sin(t * 3.8 + .9) * Math.pow(Math.abs(sine), .35);
      // Release the fitted shirt's pinched armhole without widening its outline.
      // Only the front/back surface near the sleeve root is relaxed.
      const armhole = Math.exp(-Math.pow((side - .69) / .17, 2) - Math.pow((t - .62) / .15, 2));
      const surface = smooth(Math.abs(z), .025, .24) * (1 - smooth(Math.abs(z), .42, .68));
      nz = THREE.MathUtils.lerp(nz, boxZ, .22 * armhole * surface);
      const underarmFill = Math.exp(-Math.pow((side - .68) / .22, 2) - Math.pow((t - .61) / .17, 2));
      nz += Math.sign(sine) * .018 * underarmFill * Math.pow(Math.abs(sine), .4);
      nx *= 1 - .18 * neck;
      nz *= 1 - .14 * neck;
      ny += .045 * neck;
      const hem = 1 - smooth(t, .025, .10);
      ny = THREE.MathUtils.lerp(ny, -1.29 + (y + 1.29) * .25, hem);
      ny += hem * (.012 * Math.sin(theta * 3 + .4) + .006 * Math.cos(theta * 5));
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
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
