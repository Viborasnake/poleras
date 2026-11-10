import * as THREE from 'three';
import {garmentOpenings} from './garment-edges.js';

const sleeveAreas=new WeakMap();
const bounded=value=>Math.max(-2,Math.min(2,Number(value)||0));

export function sleevePrintFrame(geometry,placement,offsetX=0,offsetY=0){
 if(!sleeveAreas.has(geometry)){
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox,height=bounds.max.y-bounds.min.y;
  const cuffs=garmentOpenings(geometry).map(points=>({
   center:points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(points.length),
   size:new THREE.Box3().setFromPoints(points).getSize(new THREE.Vector3()),
  })).filter(item=>Math.abs(item.center.x)>(bounds.max.x-bounds.min.x)*.27&&item.center.y>bounds.min.y+height*.3&&item.center.y<bounds.max.y-height*.18);
  // Some imported shirts have closed, folded cuffs. Locate their sleeve band
  // from the outermost vertices instead of requiring an open boundary loop.
  for(const sign of [-1,1])if(!cuffs.some(item=>Math.sign(item.center.x)===sign)){
   const position=geometry.attributes.position,outer=[];
   const limit=Math.abs(sign<0?bounds.min.x:bounds.max.x)*.72;
   for(let i=0;i<position.count;i++)if(position.getX(i)*sign>limit)outer.push(new THREE.Vector3().fromBufferAttribute(position,i));
   if(!outer.length)continue;
   const sleeveBounds=new THREE.Box3().setFromPoints(outer);
   const band=outer.filter(point=>point.y<sleeveBounds.min.y+height*.15);
   const bandBounds=new THREE.Box3().setFromPoints(band);
   const center=bandBounds.getCenter(new THREE.Vector3());center.y=sleeveBounds.min.y+height*.02;
   cuffs.push({center,size:bandBounds.getSize(new THREE.Vector3())});
  }
  sleeveAreas.set(geometry,{cuffs,height});
 }
 const {cuffs,height}=sleeveAreas.get(geometry);
 // Preserve the studio's coordinate convention. Target the sleeve itself,
 // rather than a fixed point on the front chest panel.
 const sign=placement==='sleeve_left'?-1:1;
 const cuff=cuffs.filter(item=>Math.sign(item.center.x)===sign).sort((a,b)=>Math.abs(b.center.x)-Math.abs(a.center.x))[0];
 if(!cuff)throw new Error('No pudimos ubicar la manga en este modelo.');
 const normal=new THREE.Vector3(sign,0,.25).normalize();
 const up=new THREE.Vector3(0,1,0),right=up.clone().cross(normal).normalize();
 const origin=cuff.center.clone().addScaledVector(up,height*.12)
  .addScaledVector(right,bounded(offsetX)*height*.012)
  .addScaledVector(up,-bounded(offsetY)*height*.012);
 return {origin,normal,up,right,width:Math.min(cuff.size.z*.8,height*.14),height:height*.16,depth:Math.max(.18,cuff.size.z*.8)};
}

export function facingDecalGeometry(geometry,normal,threshold=.15){
 const position=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
 const positions=[],directions=[],uvs=[];
 for(let i=0;i<position.count;i+=3){
  const facing=[i,i+1,i+2].reduce((sum,index)=>sum+normals.getX(index)*normal.x+normals.getY(index)*normal.y+normals.getZ(index)*normal.z,0)/3;
  if(facing<threshold)continue;
  for(let j=i;j<i+3;j++){positions.push(position.getX(j),position.getY(j),position.getZ(j));directions.push(normals.getX(j),normals.getY(j),normals.getZ(j));uvs.push(uv.getX(j),uv.getY(j));}
 }
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(directions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 return geometry;
}
