import test from 'node:test';
import assert from 'node:assert/strict';
import { createToteGeometry,toteSurface,totePrintSurface,toteCameraDistance,totePrintDimensions,TOTE_CAMERA_TARGET_Y,TOTE_PRINT_CENTER_Y } from './tote-viewer.js';

test('la tote L conserva la forma y escala por encima de M', () => {
  const medium = createToteGeometry('M');
  const large = createToteGeometry('L');
  medium.computeBoundingBox();
  large.computeBoundingBox();
  const mediumWidth = medium.boundingBox.max.x - medium.boundingBox.min.x;
  const largeWidth = large.boundingBox.max.x - large.boundingBox.min.x;
  const mediumHeight = medium.boundingBox.max.y - medium.boundingBox.min.y;
  const largeHeight = large.boundingBox.max.y - large.boundingBox.min.y;
  assert.ok(largeWidth > mediumWidth);
  assert.ok(largeHeight > mediumHeight);
  assert.ok(large.boundingBox.min.z < 0 && large.boundingBox.max.z > 0);
  medium.dispose();
  large.dispose();
});

test('la base y los lados ganan volumen sin romper la continuidad del panel',()=>{
 const geometry=createToteGeometry('M'),positions=geometry.getAttribute('position');
 assert.equal(positions.count,9490);
 assert.equal(geometry.index.count/3,18848);
 assert.ok(toteSurface(0,-.98)>.09,'Base center has textile volume.');
 assert.ok(toteSurface(.75,-.98)>.018,'Side seam has lower depth.');
 assert.ok(toteSurface(0,-.98)>toteSurface(0,-.1)*1.8,'Base is fuller than the print panel.');
 let maximumNeighborStep=0;
 for(let j=0;j<=72;j++)for(let i=0;i<64;i++)maximumNeighborStep=Math.max(maximumNeighborStep,Math.abs(positions.getZ(j*65+i+1)-positions.getZ(j*65+i)));
 for(let j=0;j<72;j++)for(let i=0;i<=64;i++)maximumNeighborStep=Math.max(maximumNeighborStep,Math.abs(positions.getZ((j+1)*65+i)-positions.getZ(j*65+i)));
 assert.ok(maximumNeighborStep<.02,'Adjacent vertices should not form a crease or gap.');
 for(const attribute of ['position','normal'])assert.ok(geometry.getAttribute(attribute).array.every(Number.isFinite));
 assert.ok(Number.isFinite(geometry.boundingSphere.radius));
 geometry.dispose();
});

test('arte y tela comparten la superficie en M y L, delante y detrás',()=>{
 for(const scale of [1,1.1])for(const side of ['front','back'])for(const x of [-.35,0,.35])for(const y of [-.45,TOTE_PRINT_CENTER_Y,.25]){
  const localZ=totePrintSurface(x*scale,y*scale,scale,side);
  const clothZ=toteSurface(side==='back'?-x:x,y);
  assert.ok(Math.abs(localZ-clothZ-.0012)<1e-10);
 }
});

test('encuadre prioriza estampado y conserva bolsa completa mediante zoom',()=>{
 assert.equal(TOTE_CAMERA_TARGET_Y,TOTE_PRINT_CENTER_Y);
 for(const aspect of [1.5,.8,.6,.45])for(const size of ['M','L']){
  const distance=toteCameraDistance(aspect,size),scale=size==='L'?1.1:1;
  const halfHeight=distance*Math.tan(33*Math.PI/360);
  assert.ok(halfHeight*aspect>1.5*scale/2,'Whole body width should fit.');
  assert.ok(halfHeight>.88*scale,'Print and bag body should fit vertically.');
  assert.ok(distance<=9,'User can zoom out further to inspect handles.');
 }
 assert.ok(toteCameraDistance(.6)>toteCameraDistance(1.5),'Narrow aspect needs more distance.');
});


test('el estampado cuadrado ocupa más cara y conserva márgenes en ambas tallas',()=>{
 for(const size of ['M','L']){
  const scale=size==='L'?1.1:1;
  for(const aspect of [.25,.8,1,1.2,4]){
   const {width,height}=totePrintDimensions(aspect,size);
   assert.ok(Math.abs(width/height-aspect)<1e-10,'No deforma el arte.');
   assert.ok(width/2<.75*scale-.1*scale,'Conserva margen lateral.');
   assert.ok(TOTE_PRINT_CENTER_Y*scale+height/2<.72*scale-.1*scale);
   assert.ok(TOTE_PRINT_CENTER_Y*scale-height/2>-.99*scale+.1*scale);
  }
  const square=totePrintDimensions(1,size);
  assert.ok(square.width/(1.5*scale)>.84,'El cuadrado cubre más del 84% del ancho.');
  assert.ok(square.width*square.height>(.97*scale)**2*1.7,'Gana al menos 70% de área.');
 }
});
