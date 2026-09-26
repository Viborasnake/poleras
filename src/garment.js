import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { createGarmentCut } from './garment-cuts.js';
import { garmentOpenings } from './garment-edges.js';
import { automaticPrintScale, visibleAlphaBounds } from './artwork-fit.js';

let modelPromise;

function withArtworkSafetyMargin(image, width = image.naturalWidth || image.width, height = image.naturalHeight || image.height, marginRatio = .08) {
  const padding = Math.max(8, Math.round(Math.max(width, height) * marginRatio));
  const outputScale = Math.min(1, 1600 / Math.max(width + padding * 2, height + padding * 2));
  const framed = document.createElement('canvas');
  framed.width = Math.max(1, Math.round((width + padding * 2) * outputScale));
  framed.height = Math.max(1, Math.round((height + padding * 2) * outputScale));
  const inset = padding * outputScale;
  framed.getContext('2d').drawImage(image, 0, 0, width, height, inset, inset, width * outputScale, height * outputScale);
  return { image: framed, aspect: framed.width / framed.height };
}

function fittedArtworkImage(image, marginRatio = .08) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return { image, aspect: 1 };
  try {
    // Preserve delicate halftones and soft edge details before trimming transparent padding.
    const analysisScale = Math.min(1, 768 / Math.max(sourceWidth, sourceHeight));
    const analysis = document.createElement('canvas');
    analysis.width = Math.max(1, Math.round(sourceWidth * analysisScale));
    analysis.height = Math.max(1, Math.round(sourceHeight * analysisScale));
    const analysisContext = analysis.getContext('2d', { willReadFrequently: true });
    analysisContext.drawImage(image, 0, 0, analysis.width, analysis.height);
    const bounds = visibleAlphaBounds(analysisContext.getImageData(0, 0, analysis.width, analysis.height).data, analysis.width, analysis.height, 1);
    if (!bounds) return { image, aspect: sourceWidth / sourceHeight };

    const padding = Math.max(6, Math.round(Math.max(bounds.width, bounds.height) * .08));
    const left = Math.max(0, bounds.x - padding);
    const top = Math.max(0, bounds.y - padding);
    const right = Math.min(analysis.width, bounds.x + bounds.width + padding);
    const bottom = Math.min(analysis.height, bounds.y + bounds.height + padding);
    const coverage = ((right - left) * (bottom - top)) / (analysis.width * analysis.height);
    // Even a full-bleed PNG needs a small transparent gutter. DecalGeometry can
    // trim its outer vertices along fabric seams; the gutter keeps artwork corners intact.
    if (coverage > .97) return withArtworkSafetyMargin(image, sourceWidth, sourceHeight, marginRatio);

    const sourceX = left / analysisScale;
    const sourceY = top / analysisScale;
    const cropWidth = (right - left) / analysisScale;
    const cropHeight = (bottom - top) / analysisScale;
    const outputScale = Math.min(1, 1600 / Math.max(cropWidth, cropHeight));
    const cropped = document.createElement('canvas');
    cropped.width = Math.max(1, Math.round(cropWidth * outputScale));
    cropped.height = Math.max(1, Math.round(cropHeight * outputScale));
    cropped.getContext('2d').drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropped.width, cropped.height);
    return withArtworkSafetyMargin(cropped, cropped.width, cropped.height, marginRatio);
  } catch {
    // A third-party image without CORS cannot be inspected, but it can still be shown.
    return { image, aspect: sourceWidth / sourceHeight };
  }
}

export function isPrintableFacing(normalZ, back = false, threshold = .52) {
  const facing = back ? -1 : 1;
  return normalZ * facing >= threshold;
}

export function printVisibilityForFacing(facing, fadeStart = .16, fullyVisible = .42) {
  if (facing <= fadeStart) return 0;
  if (facing >= fullyVisible) return 1;
  const progress = (facing - fadeStart) / (fullyVisible - fadeStart);
  // Smooth the transition so rotating the garment never produces a visible pop.
  return progress * progress * (3 - 2 * progress);
}

export function responsiveCameraDistance(distance, aspect, hero = false) {
  if (!hero) return distance;
  // A perspective camera preserves vertical FOV. On tall mobile cards the
  // horizontal FOV becomes too narrow, so move back enough to keep sleeves in frame.
  const safeAspect = Math.max(.5, Number(aspect) || 1);
  return distance * Math.max(1, .96 / safeAspect);
}

function keepForwardFacingDecal(geometry, back = false, threshold = .52) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  if (!position || !normal || !uv) return geometry;
  const positions = [], normals = [], uvs = [];
  for (let index = 0; index < position.count; index += 3) {
    const averageZ = (normal.getZ(index) + normal.getZ(index + 1) + normal.getZ(index + 2)) / 3;
    // Do not let a front print wrap around the side panels. At grazing angles
    // that wrap reads like a separate floating card instead of ink on fabric.
    if (!isPrintableFacing(averageZ, back, threshold)) continue;
    for (let vertex = index; vertex < index + 3; vertex += 1) {
      positions.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
      normals.push(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
      uvs.push(uv.getX(vertex), uv.getY(vertex));
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function settleDecalOnFabric(geometry, distance = .0012) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!position || !normal) return geometry;
  for (let index = 0; index < position.count; index += 1) {
    position.setXYZ(
      index,
      position.getX(index) + normal.getX(index) * distance,
      position.getY(index) + normal.getY(index) * distance,
      position.getZ(index) + normal.getZ(index) * distance,
    );
  }
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
// Follow the garment's actual open edges, including its folds and sleeve angle.
function addGarmentHems(mesh, kind = 'basic') {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox, height = bounds.max.y - bounds.min.y;
  for (const points of garmentOpenings(geometry)) {
    const averageY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const relativeY = (averageY - bounds.min.y) / height;
    const bottomHem = relativeY < .3;
    const collar = relativeY > .8;
    const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    const shade = collar && kind === 'over' ? .97 : .94;
    const material = new THREE.MeshStandardMaterial({
      color: mesh.material.color.clone().multiplyScalar(shade), roughness: 1, metalness: 0
    });
    const collarRadius = kind === 'over' ? .0034 : .0032;
    const hem = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 2, height * (collar ? collarRadius : .0018), 8, true), material);
    hem.name = collar ? 'Cuello · ribete' : bottomHem ? 'Basta inferior' : 'Manga · basta';
    hem.userData.garmentHem = true;
    hem.userData.fabricShade = shade;
    mesh.add(hem);
  }
}
function loadGarment() {
  modelPromise ??= new GLTFLoader().loadAsync('/shirt.glb').catch(error => {
    modelPromise = undefined;
    throw error;
  });
  return modelPromise;
}

export async function createViewer(container, state, { hero = false, viewAngle = 0, cameraDistance = 4.9 } = {}) {
  // Load before replacing the fallback, so a failed download never leaves a blank canvas.
  const asset = await loadGarment();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 100);
  const distance = hero ? 4.75 : cameraDistance;
  const initial = new THREE.Vector3(Math.sin(viewAngle) * distance, .05, Math.cos(viewAngle) * distance);
  camera.position.copy(initial);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label', 'Polera 3D en blanco. Arrastra para ver frente, costados y espalda.');
  container.replaceChildren(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x8a859b, 1.55);
  scene.add(ambient);
  const softbox = new THREE.DirectionalLight(0xfff7ed, 2.6);
  softbox.position.set(-3, 4, 6);
  scene.add(softbox);
  const fill = new THREE.DirectionalLight(0xe6e7ff, .85);
  fill.position.set(4, 1, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.7);
  rim.position.set(2, 3, -4);
  scene.add(rim);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.enableZoom = !hero;
  controls.minDistance = 4;
  controls.maxDistance = 8;
  controls.minPolarAngle = Math.PI * .25;
  controls.maxPolarAngle = Math.PI * .75;
  // Keep the printable front visible on arrival; rotation is always user-controlled.
  controls.autoRotate = hero;
  controls.autoRotateSpeed = .65;
  if (hero) window.setTimeout(() => { controls.autoRotate = false; }, 1800);

  const group = new THREE.Group();
  scene.add(group);
  let sourceMesh;
  asset.scene.traverse(node => { if (node.isMesh && !sourceMesh) sourceMesh = node; });
  if (!sourceMesh) throw new Error('El modelo no contiene una prenda.');
  asset.scene.updateMatrixWorld(true);
  const geometry = sourceMesh.geometry.clone().applyMatrix4(sourceMesh.matrixWorld);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const modelScale = 2.65 / geometry.boundingBox.getSize(new THREE.Vector3()).y;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(modelScale, modelScale, modelScale);
  const cloth = sourceMesh.material.clone();
  cloth.color.set(state.color);
  cloth.roughness = .96;
  cloth.metalness = 0;
  cloth.normalScale.set(.32, .32);
  cloth.aoMapIntensity = .72;
  const cuts = {};
  function getCut(kind) {
    if (!cuts[kind]) {
      const material = cloth.clone();
      if (kind === 'over') {
        // The source normal map belongs to the fitted sample and creates the
        // dark vertical stripe seen under the Over's arm. Let this cut shade
        // from its own relaxed geometry instead.
        material.normalMap = null;
        material.normalScale.set(0, 0);
        material.aoMap = null;
        material.roughness = 1;
        material.needsUpdate = true;
      }
      const cut = new THREE.Mesh(kind === 'basic' ? geometry : createGarmentCut(geometry, kind), material);
      cut.name = `Polera ${kind}`;
      addGarmentHems(cut, kind);
      cuts[kind] = cut;
      group.add(cut);
    }
    return cuts[kind];
  }

  const printMaterial = new THREE.MeshStandardMaterial({
    transparent: true, roughness: .98, metalness: 0,
    depthWrite: false, side: THREE.FrontSide
  });
  let print, currentImage = '', generation = 0, printOnBack = false;
  const ray = new THREE.Raycaster();
  const localCameraPosition = new THREE.Vector3();

  async function update(next) {
    cloth.color.set(next.color);
    // Less fill allows the loose cotton's curved panels to read on white too.
    ambient.intensity = next.kind === 'over' ? 1.05 : 1.55;
    fill.intensity = next.kind === 'over' ? .5 : .85;
    const shirt = getCut(next.kind);
    shirt.material.color.set(next.color);
    Object.values(cuts).forEach(cut => { cut.visible = cut === shirt; });
    shirt.children.forEach(hem => hem.material.color.set(next.color).multiplyScalar(hem.userData.fabricShade ?? .94));
    const url = next.image || '';
    const back = next.printSide === 'back';
    printOnBack = back;
    const requestedScale = next.printScale || 1;
    const visualMaxScale = hero ? 1.9 : 1.35;
    const maxScale = next.assessment?.printWidth && next.assessment?.printHeight
      ? Math.min(visualMaxScale, 28 / next.assessment.printWidth, 40 / next.assessment.printHeight)
      : next.catalogPreview ? 1.5 : visualMaxScale;
    const printScale = Math.min(requestedScale, Math.max(.55, maxScale));
    const fitMode = next.catalogPreview ? 'catalog-fit-v2' : hero ? 'hero-safe-fit-v1' : 'safe-fit-v3';
    const key = url ? url + '|' + next.kind + '|' + (back ? 'back' : 'front') + '|' + printScale.toFixed(2) + '|' + fitMode : '';
    if (key === currentImage) return;
    currentImage = key;
    const token = ++generation;
    if (print) { group.remove(print); print.geometry.dispose(); print = undefined; }
    printMaterial.map?.dispose();
    printMaterial.map = null;
    if (!url) return;
    try {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      if (generation !== token) { texture.dispose(); return; }
      const fitted = fittedArtworkImage(texture.image, next.catalogPreview ? .08 : hero ? .18 : .08);
      texture.image = fitted.image;
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const aspect = fitted.aspect;
      const safeScale = automaticPrintScale(aspect);
      const printArea = next.kind === 'kids' ? { width: .82, height: 1.15, y: .12 } : next.kind === 'over' ? { width: 1.12, height: 1.40, y: .10 } : { width: .95, height: 1.357, y: .15 };
      const width = Math.min(printArea.width, printArea.height * aspect) * printScale * safeScale;
      const height = width / aspect;
      const placementY = printArea.y + (1 - safeScale) * .35;
      // Project onto the active cloth mesh so the artwork follows the fabric instead of floating.
      group.updateMatrixWorld(true);
      ray.set(new THREE.Vector3(0, placementY, back ? -3 : 3), new THREE.Vector3(0, 0, back ? 1 : -1));
      const targetZ = ray.intersectObject(shirt, false)[0]?.point.z ?? (back ? -.4 : .4);
      // Los previews editoriales deben mostrar el PNG completo. Un DecalGeometry se
      // recorta contra las curvaturas de hombros/torso y redondea esquinas del arte.
      // En hero y catálogo usamos una lámina frontal muy cercana a la tela; el estudio
      // conserva la proyección conformada para representar la impresión final.
      const useFlatPreview = next.catalogPreview || hero;
      const decal = useFlatPreview
        ? new THREE.PlaneGeometry(width, height)
        : settleDecalOnFabric(keepForwardFacingDecal(new DecalGeometry(shirt, new THREE.Vector3(0, placementY, targetZ), new THREE.Euler(0, back ? Math.PI : 0, 0), new THREE.Vector3(width, height, .18)), back, .52));
      printMaterial.map = texture;
      printMaterial.depthTest = !useFlatPreview;
      printMaterial.needsUpdate = true;
      print = new THREE.Mesh(decal, printMaterial);
      if (useFlatPreview) {
        print.position.set(0, placementY, targetZ + (back ? -.08 : .08));
        print.rotation.y = back ? Math.PI : 0;
        print.renderOrder = 2;
      }
      group.add(print);
      renderer.domElement.setAttribute('aria-label', 'Polera 3D con tu diseño aplicado a la tela. Arrastra para girar.');
    } catch (error) {
      currentImage = '';
      container.dispatchEvent(new CustomEvent('preview-error', { detail: error }));
    }
  }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    if (hero) camera.position.setLength(responsiveCameraDistance(distance, camera.aspect, true));
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  let visible = true;
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  visibilityObserver.observe(container);
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const dialog = container.closest('dialog');
    if (dialog && !dialog.open) return;
    controls.update();
    if (print) {
      group.updateMatrixWorld(true);
      camera.getWorldPosition(localCameraPosition);
      group.worldToLocal(localCameraPosition);
      const facing = (localCameraPosition.z / Math.max(localCameraPosition.length(), .0001)) * (printOnBack ? -1 : 1);
      const opacity = printVisibilityForFacing(facing);
      printMaterial.opacity = opacity;
      print.visible = opacity > .001;
    }
    renderer.render(scene, camera);
  });
  await update(state);
  resize();
  return {
    update, resize,
    snapshot() {
      controls.update();
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    dispose() {
      ++generation;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      controls.dispose();
      if (print) print.geometry.dispose();
      printMaterial.map?.dispose();
      printMaterial.dispose();
      Object.values(cuts).forEach(cut => {
        cut.geometry.dispose();
        cut.children.forEach(hem => { hem.geometry.dispose(); hem.material.dispose(); });
        cut.material.dispose();
      });
      cloth.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
    turn(angle = 0) { group.rotation.y = angle; },
    face(side) { camera.position.set(0, .05, side === 'back' ? -initial.z : initial.z); controls.target.set(0, 0, 0); controls.update(); },
    reset() { camera.position.set(0, .05, initial.z); controls.target.set(0, 0, 0); controls.update(); }
  };
}
