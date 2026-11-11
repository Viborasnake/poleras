import {loadOversizeModel,normalizedOversizeGeometry} from './oversize-model.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { createGarmentCut } from './garment-cuts.js';
import { createBodyGeometry, addBodyDetails } from './body-geometry.js';
import { garmentOpenings, foldedGarmentEdges } from './garment-edges.js';
import { automaticPrintScale, visibleAlphaBounds, visibleAlphaEdgeSamples } from './artwork-fit.js';
import {garmentPrintLayers,createPrintLayerCollection} from './garment-print-layers.js';
import {sleevePrintFrame,facingDecalGeometry} from './garment-print-placement.js';

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

function artworkEdgeSamples(image) {
  try {
    const sample = document.createElement('canvas');
    sample.width = 96;
    sample.height = Math.max(1, Math.min(192, Math.round(96 * image.height / image.width)));
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, sample.width, sample.height);
    return visibleAlphaEdgeSamples(context.getImageData(0, 0, sample.width, sample.height).data, sample.width, sample.height);
  } catch {
    return [];
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

export function garmentPrintArea(kind) {
  if (kind === 'body') return { width: .62, height: .66, y: .30 };
  if (kind === 'woman') return { width: .86, height: 1.20, y: .14 };
  if (kind === 'kids') return { width: .82, height: 1.15, y: .12 };
  if (kind === 'over') return { width: 1.0, height: 1.18, y: .20 };
  return { width: .95, height: 1.357, y: .15 };
}

export function printPlacementCoordinates(placement, baseY, offsetX = 0, offsetY = 0) {
  const presets = {
    center: { x: 0, y: baseY },
    upper_back: { x: 0, y: baseY + .34 },
    chest_left: { x: -.28, y: baseY + .28 },
    chest_right: { x: .28, y: baseY + .28 },
    sleeve_left: { x: -.62, y: baseY + .43 },
    sleeve_right: { x: .62, y: baseY + .43 },
  };
  const selected = presets[placement] || presets.center;
  return {
    x: selected.x + Math.max(-2, Math.min(2, Number(offsetX) || 0)) * .07,
    y: selected.y - Math.max(-2, Math.min(2, Number(offsetY) || 0)) * .07,
  };
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
  if (kind === 'over') foldedGarmentEdges(geometry);
  for (const points of garmentOpenings(geometry)) {
    const averageY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const relativeY = (averageY - bounds.min.y) / height;
    const bottomHem = relativeY < .3;
    const collar = relativeY > .8;
    const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    const shade = kind === 'over' ? (collar ? .98 : .975) : .94;
    const material = new THREE.MeshStandardMaterial({
      color: mesh.material.color.clone().multiplyScalar(shade), roughness: 1, metalness: 0
    });
    const edgeRadius = kind === 'over'
      ? collar ? .0028 : .0020
      : collar ? .0032 : .0018;
    const hem = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 2, height * edgeRadius, 8, true), material);
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

export async function createViewer(container, state, { hero = false, viewAngle = 0, cameraDistance = 4.9, minDistance } = {}) {
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
  renderer.domElement.classList.add('viewer-canvas');
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
  controls.enableRotate = !hero;
  // Mantiene la prenda completa dentro del visor incluso después de hacer zoom.
  controls.minDistance = hero ? 4 : (minDistance ?? 4.65);
  controls.maxDistance = 8;
  controls.minPolarAngle = Math.PI * .25;
  controls.maxPolarAngle = Math.PI * .75;
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
  const cuts = {};
  let updateVersion=0,disposed=false;
  async function getCut(kind) {
    const oversize = kind === 'over' ? await loadOversizeModel() : null;
    if(disposed)return null;
    if (!cuts[kind]) {
      const material = (oversize ? oversize.material : cloth).clone();
      if (kind === 'body') {
        // The GLB's baked maps belong to an adult shirt UV layout.
        material.normalMap = null;
        material.aoMap = null;
        material.side = THREE.DoubleSide;
        // The body has a hollow neck, sleeves and legs: shade the inside of
        // the actual fabric so the openings remain readable while rotating.
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
            '#include <color_fragment>\n diffuseColor.rgb *= gl_FrontFacing ? 1.0 : .76;');
        };
        material.customProgramCacheKey = () => 'body-cloth-interior-v1';
      }
      if (oversize) {
        material.roughness = .96;
        material.metalness = 0;
        material.normalScale.set(.32,.32);
        material.side = THREE.DoubleSide;
      }
      const cut = new THREE.Mesh(oversize ? normalizedOversizeGeometry(oversize) : kind === 'body' ? createBodyGeometry() : kind === 'basic' ? geometry : createGarmentCut(geometry, kind), material);
      cut.name = kind === 'body' ? 'Body bebé' : `Polera ${kind}`;
      if (kind === 'body') addBodyDetails(cut);
      else if (!oversize) addGarmentHems(cut, kind);
      cuts[kind] = cut;
      group.add(cut);
    }
    return cuts[kind];
  }

  const localCameraPosition = new THREE.Vector3();
  const prints=createPrintLayerCollection({
    build:buildPrint,
    attach:({mesh})=>group.add(mesh),
    dispose:({mesh})=>{group.remove(mesh);mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();},
    onError:error=>container.dispatchEvent(new CustomEvent('preview-error',{detail:error})),
  });

  async function buildPrint(layer,next){
    const shirt=cuts[next.kind];
    const texture=await new THREE.TextureLoader().loadAsync(layer.image);
    let decal,material;
    try{
      const fitted=fittedArtworkImage(texture.image,next.catalogPreview ? .08 : hero ? .25 : next.catalogDesign ? .15 : .08);
      texture.image=fitted.image;texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      const aspect=fitted.aspect,back=layer.side==='back',sleeve=layer.placement.startsWith('sleeve_');
      const safeScale=automaticPrintScale(aspect),area=garmentPrintArea(next.kind);
      const maxScale=next.catalogPreview?2:next.catalogDesign?1.7:1.6;
      const layout=next.catalogDesign?next.catalogPrintLayout:null;
      let scale=Math.min(Number(layer.scale)||1,maxScale)*(layout?.size??1),flat=Boolean(next.catalogPreview||hero);
      const point=printPlacementCoordinates(layer.placement,area.y+(1-safeScale)*.35-(flat?0:.12)+(layout?.y??0),layer.offsetX,layer.offsetY);
      point.x+=layout?.x??0;
      const frame=sleeve?sleevePrintFrame(shirt.geometry,layer.placement,layer.offsetX,layer.offsetY):{
        origin:new THREE.Vector3(point.x,point.y,0),normal:new THREE.Vector3(0,0,back?-1:1),
        right:new THREE.Vector3(back?-1:1,0,0),up:new THREE.Vector3(0,1,0),width:area.width,height:area.height,depth:1.45,
      };
      if(sleeve){flat=false;scale=Math.min(1.35,scale/.55);}
      const baseWidth=Math.min(frame.width,frame.height*aspect)*(sleeve?1:safeScale);
      // Geometry and projection share garment-local coordinates. Rotating the
      // viewer while a file loads must not rotate the decal a second time.
      const surface=new THREE.Mesh(shirt.geometry,shirt.material);surface.updateMatrixWorld(true);
      const ray=new THREE.Raycaster();
      const cast=(x=0,y=0)=>{
        const origin=frame.origin.clone().addScaledVector(frame.right,x).addScaledVector(frame.up,y).addScaledVector(frame.normal,3);
        ray.set(origin,frame.normal.clone().negate());return ray.intersectObject(surface,false)[0];
      };
      const centerHit=cast();
      if(sleeve&&!centerHit)throw new Error('No pudimos proyectar el diseño sobre la manga.');
      const center=centerHit?centerHit.point.clone():frame.origin.clone().addScaledVector(frame.normal,.4);
      const threshold=sleeve ? .15 : next.kind==='over' ? .05 : next.catalogDesign ? .32 : layer.placement.startsWith('chest_') ? .22 : .52;
      if(!flat){
        const edges=artworkEdgeSamples(fitted.image);
        const fits=value=>edges.every(({u,v})=>{
          const hit=cast((u-.5)*baseWidth*value,(.5-v)*baseWidth*value/aspect);
          return hit&&hit.face.normal.dot(frame.normal)>=threshold&&Math.abs(hit.point.clone().sub(center).dot(frame.normal))<(sleeve?frame.depth*.5:.48);
        });
        if(edges.length&&!fits(scale)){
          let low=sleeve ? .18 : .3,high=scale;
          if(fits(low)){
            for(let attempt=0;attempt<7;attempt++){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}
            scale=Math.max(sleeve ? .18 : .3,low-.02);
          }else if(sleeve){scale=.18;}
          else {flat=true;scale=Math.min(scale,1);}
        }
      }
      const width=baseWidth*scale,height=width/aspect;
      const orientation=new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right,frame.up,frame.normal));
      if(flat)decal=new THREE.PlaneGeometry(width,height);
      else{
        decal=new DecalGeometry(surface,center,orientation,new THREE.Vector3(width,height,frame.depth));
        if(sleeve)facingDecalGeometry(decal,frame.normal,threshold);
        else if(next.kind!=='over')keepForwardFacingDecal(decal,back,threshold);
        settleDecalOnFabric(decal);
        if(!decal.attributes.position.count)throw new Error('No pudimos aplicar el estampado a la tela.');
      }
      material=new THREE.MeshStandardMaterial({map:texture,transparent:true,roughness:.98,metalness:0,depthWrite:false,depthTest:!flat,side:THREE.FrontSide});
      const mesh=new THREE.Mesh(decal,material);mesh.name=`Estampado ${layer.id}`;
      mesh.userData={printLayerId:layer.id,placement:layer.placement,normal:frame.normal,sleeve};
      if(flat){mesh.position.copy(center).addScaledVector(frame.normal,.08);mesh.rotation.copy(orientation);mesh.renderOrder=2;}
      return {mesh};
    }catch(error){decal?.dispose();material?.dispose();texture.dispose();throw error;}
  }

  async function update(next) {
    const version=++updateVersion;
    renderer.domElement.setAttribute('aria-label',`${next.kind==='body'?'Body de bebé':'Polera'} 3D. Arrastra para ver frente, costados y espalda.`);
    cloth.color.set(next.color);
    ambient.intensity=next.kind==='over'?1.05:1.55;fill.intensity=next.kind==='over' ? .5 : .85;
    const shirt=await getCut(next.kind);
    if(disposed||version!==updateVersion)return;
    shirt.material.color.set(next.color);
    Object.values(cuts).forEach(cut=>{cut.visible=cut===shirt;});
    shirt.children.forEach(hem=>hem.material.color.set(next.color).multiplyScalar(hem.userData.fabricShade??.94));
    await prints.update(garmentPrintLayers(next),{kind:next.kind,catalogPreview:Boolean(next.catalogPreview),catalogDesign:Boolean(next.catalogDesign),catalogPrintLayout:next.catalogPrintLayout});
    if(disposed||version!==updateVersion)return;
    const count=[...prints.entries.values()].filter(entry=>entry.resource).length;
    renderer.domElement.dataset.printCount=String(count);
    renderer.domElement.setAttribute('aria-label',`${next.kind==='body'?'Body de bebé':'Polera'} 3D con ${count} estampados aplicados a la tela. Arrastra para girar.`);
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
  let initialSceneReady = false;
  let firstFrameShown = false;
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const dialog = container.closest('dialog');
    if (dialog && !dialog.open) return;
    controls.update();
    group.updateMatrixWorld(true);
    camera.getWorldPosition(localCameraPosition);group.worldToLocal(localCameraPosition);
    const direction=localCameraPosition.clone().normalize();
    for(const entry of prints.entries.values())if(entry.resource){
      const mesh=entry.resource.mesh;
      const opacity=mesh.userData.sleeve?1:printVisibilityForFacing(direction.dot(mesh.userData.normal));
      mesh.material.opacity=opacity;mesh.visible=opacity>.001;
    }
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
    snapshot() {
      controls.update();
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    dispose() {
      disposed=true;
      ++updateVersion;
      prints.dispose();
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      controls.dispose();
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
    face(side,placement) { const arm=placement==='sleeve_left'?-1:placement==='sleeve_right'?1:0;group.rotation.y=0;camera.position.set(arm*distance*.85,.05,arm?distance*.53:side==='back'?-initial.z:initial.z);controls.target.set(0,0,0);controls.update(); },
    reset() { camera.position.set(0, .05, initial.z); controls.target.set(0, 0, 0); controls.update(); },
    zoomBy(amount = 0) {
      const offset = camera.position.clone().sub(controls.target);
      const distance = THREE.MathUtils.clamp(offset.length() + amount, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance));
      controls.update();
    },
    zoomPercent() {
      const span = controls.maxDistance - controls.minDistance;
      return Math.round(((controls.maxDistance - camera.position.distanceTo(controls.target)) / span) * 100);
    }
  };
}
