import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

let modelPromise;
function loadGarment() {
  modelPromise ??= new GLTFLoader().loadAsync('/shirt.glb').catch(error => {
    modelPromise = undefined;
    throw error;
  });
  return modelPromise;
}

export async function createViewer(container, state, { hero = false } = {}) {
  // Load before replacing the fallback, so a failed download never leaves a blank canvas.
  const asset = await loadGarment();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 100);
  const initial = new THREE.Vector3(hero ? .42 : .22, .05, hero ? 5.7 : 5.9);
  camera.position.copy(initial);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label', 'Polera 3D en blanco. Arrastra para ver frente, costados y espalda.');
  container.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a859b, 1.55));
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
  controls.autoRotate = false;

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
  const shirt = new THREE.Mesh(geometry, cloth);
  group.add(shirt);

  const printMaterial = new THREE.MeshStandardMaterial({
    transparent: true, roughness: .98, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -4,
    depthWrite: false, side: THREE.FrontSide
  });
  let print, currentImage = '', generation = 0;
  const ray = new THREE.Raycaster(new THREE.Vector3(0, .15, 3), new THREE.Vector3(0, 0, -1));
  shirt.updateMatrixWorld(true);
  const frontZ = ray.intersectObject(shirt)[0]?.point.z ?? .4;

  async function update(next) {
    cloth.color.set(next.color);
    group.scale.set(next.kind === 'over' ? 1.1 : next.kind === 'kids' ? .85 : 1, next.kind === 'kids' ? .87 : 1, 1);
    const url = next.image || '';
    if (url === currentImage) return;
    currentImage = url;
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
      const width = Math.min(.95, 1.12 * aspect);
      const height = width / aspect;
      // Project onto the actual cloth mesh, including wrinkles. Never a floating rectangle.
      const previousScale = group.scale.clone();
      group.scale.setScalar(1);
      group.updateMatrixWorld(true);
      const decal = new DecalGeometry(shirt, new THREE.Vector3(0, .15, frontZ + .045), new THREE.Euler(), new THREE.Vector3(width, height, .34));
      group.scale.copy(previousScale);
      group.updateMatrixWorld(true);
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
    reset() { camera.position.set(0, .05, initial.z); controls.target.set(0, 0, 0); controls.update(); }
  };
}
