import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {normalizedOversizeGeometry} from './oversize-model.js';

test('decodifica posiciones cuantizadas antes de centrar y escalar el oversize',()=>{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Int16BufferAttribute([-32767,-32767,-8000,32767,32767,8000,0,0,0],3,true));
 const source=new THREE.Mesh(geometry);
 source.scale.setScalar(.31);source.position.set(2,3,4);source.updateMatrixWorld(true);
 const normalized=normalizedOversizeGeometry(source);
 const size=normalized.boundingBox.getSize(new THREE.Vector3());
 assert.ok(Math.abs(size.y-2.65)<1e-6);
 assert.ok(normalized.boundingBox.getCenter(new THREE.Vector3()).length()<1e-6);
 assert.ok(size.z>.6,'Conserva profundidad real tras decodificar.');
 assert.equal(geometry.getAttribute('position').array.constructor,Int16Array);
 normalized.dispose();geometry.dispose();source.material.dispose();
});
