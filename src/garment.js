import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { createGarmentCut } from './garment-cuts.js';
import { garmentOpenings } from './garment-edges.js';

let modelPromise;
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
    polygonOffset: true, polygonOffsetFactor: -4,
    depthWrite: false, side: THREE.FrontSide
  });
  let print, currentImage = '', generation = 0;
  const ray = new THREE.Raycaster();

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
    const requestedScale = next.printScale || 1;
    const maxScale = next.assessment?.printWidth && next.assessment?.printHeight
      ? Math.min(1.35, 28 / next.assessment.printWidth, 40 / next.assessment.printHeight)
      : 1.35;
    const printScale = Math.min(requestedScale, Math.max(.55, maxScale));
    const key = url ? url + '|' + next.kind + '|' + (back ? 'back' : 'front') + '|' + printScale.toFixed(2) : '';
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
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const aspect = texture.image.width / texture.image.height;
      const printArea = next.kind === 'kids' ? { width: .82, height: 1.15, y: .12 } : next.kind === 'over' ? { width: 1.12, height: 1.40, y: .10 } : { width: .95, height: 1.357, y: .15 };
      const width = Math.min(printArea.width, printArea.height * aspect) * printScale;
      const height = width / aspect;
      // Project onto the active cloth mesh so the artwork follows the fabric instead of floating.
      group.updateMatrixWorld(true);
      ray.set(new THREE.Vector3(0, printArea.y, back ? -3 : 3), new THREE.Vector3(0, 0, back ? 1 : -1));
      const targetZ = ray.intersectObject(shirt, false)[0]?.point.z ?? (back ? -.4 : .4);
      const decal = new DecalGeometry(shirt, new THREE.Vector3(0, printArea.y, targetZ), new THREE.Euler(0, back ? Math.PI : 0, 0), new THREE.Vector3(width, height, .5));
      printMaterial.map = texture;
      printMaterial.needsUpdate = true;
      print = new THREE.Mesh(decal, printMaterial);
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
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  new ResizeObserver(resize).observe(container);
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(container);
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const dialog = container.closest('dialog');
    if (dialog && !dialog.open) return;
    controls.update();
    renderer.render(scene, camera);
  });
  await update(state);
  resize();
  return {
    update, resize,
    turn(angle = 0) { group.rotation.y = angle; },
    face(side) { camera.position.set(0, .05, side === 'back' ? -initial.z : initial.z); controls.target.set(0, 0, 0); controls.update(); },
    reset() { camera.position.set(0, .05, initial.z); controls.target.set(0, 0, 0); controls.update(); }
  };
}
