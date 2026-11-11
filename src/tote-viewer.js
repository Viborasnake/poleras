import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { visibleAlphaBounds } from './artwork-fit.js';

function preparedArtwork(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const analysis = document.createElement('canvas');
  const scale = Math.min(1, 768 / Math.max(width, height));
  analysis.width = Math.max(1, Math.round(width * scale));
  analysis.height = Math.max(1, Math.round(height * scale));
  const context = analysis.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, analysis.width, analysis.height);
  const bounds = visibleAlphaBounds(context.getImageData(0, 0, analysis.width, analysis.height).data, analysis.width, analysis.height, 1);
  if (!bounds) return { image, aspect: width / height };
  const margin = Math.round(Math.max(bounds.width, bounds.height) * .08);
  const left = Math.max(0, bounds.x - margin);
  const top = Math.max(0, bounds.y - margin);
  const cropWidth = Math.min(analysis.width - left, bounds.x + bounds.width + margin - left);
  const cropHeight = Math.min(analysis.height - top, bounds.y + bounds.height + margin - top);
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(cropWidth / scale));
  output.height = Math.max(1, Math.round(cropHeight / scale));
  output.getContext('2d').drawImage(image, left / scale, top / scale, output.width, output.height, 0, 0, output.width, output.height);
  return { image: output, aspect: output.width / output.height };
}

// Two cloth panels joined at the sides and bottom, with an open mouth.
export function toteSurface(x, y) {
  const u = x / .75;
  const v = Math.max(0, Math.min(1, (y + .99) / 1.71));
  const envelope = Math.max(0, 1 - u * u);
  const lower = 1 - THREE.MathUtils.smoothstep(v, .08, .53);
  const side = THREE.MathUtils.smoothstep(Math.abs(u), .38, .82);
  const verticalFold = .014 * Math.sin(17 * x + 4 * y) + .008 * Math.sin(29 * x - 9 * y);
  const lowerFold = .018 * Math.sin(23 * x + 8 * y) * side * lower;
  // The side seam stays slim while the closed base gains a soft, tapered volume.
  return .008 + .014 * lower + envelope * (.023 + .019 * Math.sin(Math.PI * v) + .058 * lower + verticalFold * side * lower + lowerFold);
}

export const TOTE_PRINT_CENTER_Y=-.11;
export const TOTE_CAMERA_TARGET_Y=TOTE_PRINT_CENTER_Y;

export function totePrintDimensions(aspect=1,size='M'){
  const scale=size==='L'?1.1:1;
  const safeAspect=Number.isFinite(aspect)&&aspect>0?aspect:1;
  const width=Math.min(1.27*scale,1.35*scale*safeAspect);
  return {width,height:width/safeAspect};
}

const TOTE_FOV=33;
export function toteCameraDistance(aspect=1,size='M'){
  const safeAspect=Math.max(.45,Number(aspect)||1);
  const scale=size==='L'?1.1:1;
  const bodyWidth=1.5*scale;
  const horizontalFit=bodyWidth*1.06/(2*Math.tan(THREE.MathUtils.degToRad(TOTE_FOV)/2)*safeAspect);
  return Math.max(4.15,horizontalFit);
}

export function totePrintSurface(x,y,scale=1,side='front'){
  return toteSurface((side==='back'?-x:x)/scale,y/scale)+.0012;
}

export function createToteGeometry(size = 'M') {
  const positions = [], uvs = [], indices = [];
  const nx = 64, ny = 72;
  for (const side of [1, -1]) {
    for (let j = 0; j <= ny; j++) {
      const v = j / ny;
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const x = (u - .5) * 1.5;
        const y = -.99 + v * 1.71 + .009 * Math.sin(u * Math.PI) * Math.cos(v * Math.PI);
        positions.push(x, y, side * toteSurface(x, y));
        uvs.push(u, v);
      }
    }
  }
  const panel = (nx + 1) * (ny + 1);
  for (let side = 0; side < 2; side++) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = side * panel + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      indices.push(...(side ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
    }
  }
  const join = (a, b) => indices.push(a, a + panel, b, b, a + panel, b + panel);
  for (let i = 0; i < nx; i++) join(i + 1, i);
  for (let j = 0; j < ny; j++) {
    join(j * (nx + 1), (j + 1) * (nx + 1));
    join((j + 1) * (nx + 1) + nx, j * (nx + 1) + nx);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (size === 'L') geometry.scale(1.1, 1.1, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createToteHandleGeometry(side = 1) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.27, .62, side * .037),
    new THREE.Vector3(-.245, 1.15, side * .05),
    new THREE.Vector3(-.18, 1.86, side * .065),
    new THREE.Vector3(0, 2.07, side * .07),
    new THREE.Vector3(.18, 1.86, side * .065),
    new THREE.Vector3(.245, 1.15, side * .05),
    new THREE.Vector3(.27, .62, side * .037),
  ]);
  const positions = [], uvs = [], indices = [];
  const steps = 100;
  // A flat woven ribbon, with a thin solid edge instead of a round tube.
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, point = curve.getPoint(t), tangent = curve.getTangent(t);
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const twist = Math.PI * .46 * Math.sin(Math.PI * t) ** 8;
    for (const [width, depth] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      positions.push(point.x + normal.x * width * .043 * Math.cos(twist), point.y + normal.y * width * .043 * Math.cos(twist), point.z + width * .043 * Math.sin(twist) + depth * .003);
      uvs.push((width + 1) / 2, t * 12);
    }
    if (i < steps) {
      const a = i * 4;
      for (const [l, r] of [[0, 1], [3, 2], [2, 0], [1, 3]]) indices.push(a+l, a+r, a+l+4, a+r, a+r+4, a+l+4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function canvasWeave() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(256, 256);
  let seed = 19;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 232 + ((x % 4 < 2) !== (y % 4 < 2) ? 8 : -8) + (seed / 4294967296 - .5) * 20;
    const i = (y * 256 + x) * 4;
    pixels.data.set([value, value, value, 255], i);
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 8);
  return texture;
}

export async function createToteViewer(container, state, { minDistance } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(TOTE_FOV, 1, .1, 100);
  let currentSize=state.size==='L'?'L':'M';
  let homeDistance=toteCameraDistance(1,currentSize);
  camera.position.set(0,TOTE_CAMERA_TARGET_Y,homeDistance);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.classList.add('viewer-canvas');
  renderer.domElement.setAttribute('aria-label', 'Tote bag 3D. Arrastra para ver frente, costados y espalda.');
  container.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x898294, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe5dcff, 1.5);
  rim.position.set(3, 2, -4);
  scene.add(rim);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = minDistance ?? 3.6;
  controls.maxDistance = 9;
  controls.target.set(0,TOTE_CAMERA_TARGET_Y,0);
  controls.minPolarAngle = Math.PI * .25;
  controls.maxPolarAngle = Math.PI * .75;

  const group = new THREE.Group();
  scene.add(group);
  const weave = canvasWeave();
  const cloth = new THREE.MeshStandardMaterial({ map: weave, bumpMap: weave, bumpScale: .007, color: 0xe8e0cf, roughness: .98, metalness: 0, side: THREE.DoubleSide });
  const seam = new THREE.LineBasicMaterial({ color: 0xbdb5a4 });
  const printMaterial = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: .98, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const bodies = new Map();
  const handles = [];
  function stitchLine(points) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), seam);
    group.add(line);
    handles.push(line);
  }
  for (const side of [1, -1]) {
    const handle = new THREE.Mesh(createToteHandleGeometry(side), cloth);
    group.add(handle);
    handles.push(handle);
    // Folded top band follows the panel; stitching remains fine and tonal.
    const hem = new THREE.PlaneGeometry(1.5, .12, 64, 4);
    const vertices = hem.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i) + .655;
      vertices.setXYZ(i, x, y, side * (toteSurface(x, y) + .002));
    }
    hem.computeVertexNormals();
    const band = new THREE.Mesh(hem, cloth);
    group.add(band);
    handles.push(band);
    for (const y of [.601, .705]) {
      stitchLine(Array.from({ length: 65 }, (_, i) => {
        const x = -.745 + i / 64 * 1.49;
        return new THREE.Vector3(x, y, side * (toteSurface(x, y) + .003));
      }));
    }
    for (const x of [-.27, .27]) {
      const points = [[-.033, .61], [.033, .61], [.033, .704], [-.033, .704], [-.033, .61], [.033, .704], [-.033, .704], [.033, .61]];
      stitchLine(points.map(([dx, y]) => new THREE.Vector3(x + dx, y, side * .043)));
    }
  }
  const print = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 48, 48), printMaterial);
  group.add(print);
  let generation = 0;
  let currentImage = '';
  let printSide = 'front';
  function bodyFor(size) {
    if (!bodies.has(size)) {
      const body = new THREE.Mesh(createToteGeometry(size), cloth);
      body.name = `Tote bag ${size}`;
      group.add(body);
      bodies.set(size, body);
    }
    return bodies.get(size);
  }
  async function update(next) {
    const size = next.size === 'L' ? 'L' : 'M';
    if(size!==currentSize){
      const offset=camera.position.clone().sub(controls.target).normalize();
      currentSize=size;
      homeDistance=toteCameraDistance(camera.aspect,currentSize);
      controls.target.set(0,TOTE_CAMERA_TARGET_Y,0);
      camera.position.copy(controls.target).addScaledVector(offset,homeDistance);
      controls.update();
    }
    const color = next.color || '#d9c7a4';
    cloth.color.set(color);
    seam.color.set(color).multiplyScalar(.8);
    const body = bodyFor(size);
    bodies.forEach(item => { item.visible = item === body; });
    const scale = size === 'L' ? 1.1 : 1;
    handles.forEach(handle => { handle.scale.set(scale, scale, 1); });
    const url = next.image || '';
    const side = next.printSide === 'back' ? 'back' : 'front';
    printSide = side;
    const layout=next.catalogDesign?next.catalogPrintLayout:null;
    const imageKey = `${url}|${size}|${side}|${next.printScale || 1}|${layout?.size}|${layout?.x}|${layout?.y}`;
    if (imageKey === currentImage) return;
    const previousImage = currentImage;
    currentImage = imageKey;
    const token = ++generation;
    if (!url) {
      print.visible = false;
      printMaterial.map?.dispose();
      printMaterial.map = null;
      return;
    }
    try {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      if (token !== generation) { texture.dispose(); return; }
      const fitted = preparedArtwork(texture.image);
      texture.image = fitted.image;
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const {width,height} = totePrintDimensions(fitted.aspect,size);
      const vertices = print.geometry.attributes.position;
      const uv = print.geometry.attributes.uv;
      for (let i = 0; i < vertices.count; i++) {
        const x = (uv.getX(i) - .5) * width * (layout?.size??1)+(layout?.x??0);
        const y = (uv.getY(i) - .5) * height * (layout?.size??1) + TOTE_PRINT_CENTER_Y * scale+(layout?.y??0);
        vertices.setXYZ(i,x,y,totePrintSurface(x,y,scale,side));
      }
      vertices.needsUpdate = true;
      print.geometry.computeVertexNormals();
      print.geometry.computeBoundingBox();
      print.geometry.computeBoundingSphere();
      print.rotation.y = side === 'back' ? Math.PI : 0;
      printMaterial.map?.dispose();
      printMaterial.map = texture;
      printMaterial.needsUpdate = true;
      print.visible = true;
      renderer.domElement.setAttribute('aria-label', 'Tote bag 3D con el diseño aplicado. Arrastra para girar.');
    } catch (error) {
      if (generation === token) currentImage = previousImage;
      container.dispatchEvent(new CustomEvent('preview-error', { detail: error }));
    }
  }
  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const atHome=Math.abs(camera.position.distanceTo(controls.target)-homeDistance)<.02&&Math.abs(camera.position.x)<.02&&Math.abs(camera.position.y-TOTE_CAMERA_TARGET_Y)<.02;
    camera.aspect = width / height;
    const nextDistance=toteCameraDistance(camera.aspect,currentSize);
    if(atHome)camera.position.set(0,TOTE_CAMERA_TARGET_Y,camera.position.z<0?-nextDistance:nextDistance);
    homeDistance=nextDistance;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  let visible = true;
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  visibilityObserver.observe(container);
  let initialSceneReady = false;
  let firstFrameShown = false;
  renderer.setAnimationLoop(() => {
    const dialog = container.closest('dialog');
    if (!visible || document.hidden || (dialog && !dialog.open)) return;
    controls.update();
    const localCamera = group.worldToLocal(camera.position.clone());
    print.visible = Boolean(printMaterial.map) && ((localCamera.z >= 0) === (printSide === 'front'));
    renderer.render(scene, camera);
    if(initialSceneReady&&!firstFrameShown){
      firstFrameShown=true;
      renderer.domElement.classList.add('is-ready');
      container.dispatchEvent(new CustomEvent('viewer-ready',{detail:{canvas:renderer.domElement}}));
    }
  });
  await update(state);
  resize();
  initialSceneReady=true;
  return {
    update, resize,
    snapshot() { controls.update(); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    face(side) { camera.position.set(0,TOTE_CAMERA_TARGET_Y,side === 'back' ? -homeDistance : homeDistance); controls.target.set(0,TOTE_CAMERA_TARGET_Y,0); controls.update(); },
    turn(angle = 0) { group.rotation.y = angle; },
    reset() { camera.position.set(0,TOTE_CAMERA_TARGET_Y,homeDistance); controls.target.set(0,TOTE_CAMERA_TARGET_Y,0); controls.update(); },
    zoomBy(amount = 0) {
      const offset = camera.position.clone().sub(controls.target);
      const distance = THREE.MathUtils.clamp(offset.length() + amount, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance));
      controls.update();
    },
    zoomPercent() {
      const span = controls.maxDistance - controls.minDistance;
      return Math.round(((controls.maxDistance - camera.position.distanceTo(controls.target)) / span) * 100);
    },
    dispose() {
      ++generation;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      controls.dispose();
      bodies.forEach(body => body.geometry.dispose());
      handles.forEach(handle => handle.geometry.dispose());
      print.geometry.dispose();
      printMaterial.map?.dispose();
      printMaterial.dispose();
      weave.dispose();
      cloth.dispose();
      seam.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
