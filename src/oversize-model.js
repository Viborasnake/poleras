import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

let modelPromise;
export function loadOversizeModel(){
 modelPromise??=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  .loadAsync('/models/oversized-tshirt/oversized_tshirt.glb')
  .then(asset=>{
   asset.scene.updateMatrixWorld(true);
   let source;
   asset.scene.traverse(node=>{if(node.isMesh&&!source)source=node});
   if(!source)throw new Error('El modelo oversize no contiene una prenda.');
   return source;
  }).catch(error=>{modelPromise=undefined;throw error});
 return modelPromise;
}

export function normalizedOversizeGeometry(source){
 const geometry=source.geometry.clone();
 // Decode quantized coordinates before transforming: integer attributes would
 // clamp the centered/scaled positions and flatten the imported garment.
 const positions=geometry.getAttribute('position');
 const decoded=new Float32Array(positions.count*3);
 for(let i=0;i<positions.count;i++){
  decoded[i*3]=positions.getX(i);decoded[i*3+1]=positions.getY(i);decoded[i*3+2]=positions.getZ(i);
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(decoded,3));
 geometry.applyMatrix4(source.matrixWorld);
 geometry.computeBoundingBox();
 const center=geometry.boundingBox.getCenter(new THREE.Vector3());
 const scale=2.65/geometry.boundingBox.getSize(new THREE.Vector3()).y;
 geometry.translate(-center.x,-center.y,-center.z);
 geometry.scale(scale,scale,scale);
 geometry.rotateY(Math.PI); // The source faces -Z; the studio front is +Z.
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 return geometry;
}
