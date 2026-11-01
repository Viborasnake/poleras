import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {createBodyGeometry, addBodyDetails} from './body-geometry.js';
import {garmentPrintArea} from './garment.js';

function fixture() {
  const geometry = createBodyGeometry();
  const material = new THREE.MeshStandardMaterial({color: '#ffffff'});
  const mesh = new THREE.Mesh(geometry, material);
  const ray = new THREE.Raycaster();
  return {
    mesh, geometry,
    hit(x, y, back = false) {
      ray.set(new THREE.Vector3(x, y, back ? -2 : 2), new THREE.Vector3(0, 0, back ? 1 : -1));
      return ray.intersectObject(mesh, false)[0];
    },
    dispose() {
      mesh.children.forEach(child => { child.geometry.dispose(); child.material.dispose(); });
      geometry.dispose(); material.dispose();
    },
  };
}

test('reference body has long sleeves, envelope shoulders and attached closure details', () => {
  const body = fixture();
  try {
    const positions = body.geometry.getAttribute('position');
    assert.ok([...positions.array, ...body.geometry.getAttribute('normal').array].every(Number.isFinite));
    assert.ok(body.geometry.boundingSphere.radius > 0);
    addBodyDetails(body.mesh);
    assert.ok(body.hit(0, .25), 'front print panel');
    assert.ok(body.hit(0, .25, true), 'back print panel');
    assert.equal(body.hit(0, 1.08), undefined, 'above the collar');
    assert.equal(body.hit(-.45, -.83), undefined, 'left leg opening');
    assert.equal(body.hit(.45, -.83), undefined, 'right leg opening');
    assert.ok(body.hit(0, -.905), 'crotch closure tab');
    assert.equal(body.hit(0, -1.08), undefined, 'no long rectangular tail');
    const snaps = body.mesh.children.filter(child => child.name === 'closure-snap');
    assert.equal(snaps.length, 3);
    for (const snap of snaps) {
      const surface = body.hit(snap.position.x, snap.position.y);
      assert.ok(surface, 'snap stays within the closure');
      assert.ok(Math.abs(snap.position.z - surface.point.z) < .012, 'snap rests on fabric');
    }
    for (const name of ['collar-binding', 'left-cuff-binding', 'right-cuff-binding', 'left-leg-binding', 'right-leg-binding', 'closure-tab', 'left-envelope-shoulder', 'right-envelope-shoulder']) {
      assert.ok(body.mesh.getObjectByName(name), name);
    }
    for (const x of [-.9, .9]) {
      const front = body.hit(x, -.25), back = body.hit(x, -.25, true);
      assert.ok(front && back, 'long sleeve reaches toward the hip');
      assert.ok(front.point.z > 0 && back.point.z < 0, 'sleeve normals face outward');
    }
  } finally { body.dispose(); }
});

test('body fabric has exactly five real openings and no cracks at the arms or shoulders', () => {
  const body = fixture();
  try {
    const {geometry} = body;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const edges = new Map();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < geometry.index.count; i += 3) {
      const triangle = [0, 1, 2].map(j => geometry.index.getX(i + j));
      a.fromBufferAttribute(position, triangle[0]);
      b.fromBufferAttribute(position, triangle[1]);
      c.fromBufferAttribute(position, triangle[2]);
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-20, 'nonzero triangle area');
      for (let j = 0; j < 3; j++) {
        const u = triangle[j], v = triangle[(j + 1) % 3];
        const key = u < v ? `${u}:${v}` : `${v}:${u}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    assert.ok([...edges.values()].every(count => count <= 2), 'no non-manifold edges');
    const boundary = new Map();
    for (const [edge, count] of edges) {
      if (count !== 1) continue;
      const [u, v] = edge.split(':').map(Number);
      boundary.set(u, [...(boundary.get(u) || []), v]);
      boundary.set(v, [...(boundary.get(v) || []), u]);
    }
    assert.ok([...boundary.values()].every(neighbors => neighbors.length === 2), 'openings are continuous loops');
    const seen = new Set(), loops = [];
    for (const start of boundary.keys()) {
      if (seen.has(start)) continue;
      const queue = [start], box = new THREE.Box3();
      while (queue.length) {
        const vertex = queue.pop();
        if (seen.has(vertex)) continue;
        seen.add(vertex);
        box.expandByPoint(a.fromBufferAttribute(position, vertex));
        queue.push(...boundary.get(vertex));
      }
      loops.push(box);
    }
    assert.equal(loops.length, 5, 'neck, two cuffs and two legs only');
    assert.equal(loops.filter(box => box.min.y > .8).length, 1, 'neck');
    assert.equal(loops.filter(box => box.max.y < -.49).length, 2, 'legs');
    assert.equal(loops.filter(box => Math.abs(box.getCenter(a).x) > .8).length, 2, 'cuffs');
    for (let i = 0; i < normal.count; i++) {
      assert.ok(Math.abs(a.fromBufferAttribute(normal, i).length() - 1) < .0001, 'unit normals');
    }
    const center = body.hit(0, .25), nearSide = body.hit(.49, .25);
    assert.ok(center.point.z > .18 && center.point.z < .26, 'fabric supported by an infant torso');
    assert.ok(nearSide.point.z < center.point.z * .4, 'rounded side profile');
    const down = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
    body.mesh.material.side = THREE.DoubleSide;
    const inside = down.intersectObject(body.mesh, false)[0];
    assert.ok(inside && inside.point.y < -1, 'neck opens into the hollow body down to the crotch');
    const leg = new THREE.Raycaster(new THREE.Vector3(2, -.8, 0), new THREE.Vector3(-1, 0, 0));
    assert.equal(leg.intersectObject(body.mesh, false).length, 0, 'leg openings are hollow in profile');
  } finally { body.dispose(); }
});

test('body print area stays continuous with smooth normals and projects on both faces', () => {
  const body = fixture();
  const area = garmentPrintArea('body');
  try {
    assert.ok(area.y - area.height / 2 > -.1);
    assert.ok(area.y + area.height / 2 < .75);
    assert.ok(area.width < garmentPrintArea('kids').width);
    for (const back of [false, true]) {
      for (let row = 0; row <= 12; row++) {
        let previous;
        for (let col = 0; col <= 12; col++) {
          const hit = body.hit(-area.width / 2 + area.width * col / 12, area.y - area.height / 2 + area.height * row / 12, back);
          assert.ok(hit, 'no holes in the printable panel');
          assert.ok(hit.normal.z * (back ? -1 : 1) > .52, 'surface remains printable');
          if (previous) assert.ok(previous.dot(hit.normal) > .95, 'no sharp shading transitions');
          previous = hit.normal;
        }
      }
      const decal = new DecalGeometry(body.mesh, new THREE.Vector3(0, area.y, back ? -.15 : .15), new THREE.Euler(0, back ? Math.PI : 0, 0), new THREE.Vector3(area.width, area.height, .4));
      assert.ok(decal.getAttribute('position').count > 0);
      assert.ok([...decal.getAttribute('position').array].every(Number.isFinite));
      decal.dispose();
    }
  } finally { body.dispose(); }
});


test('el body conserva pecho, guatita y cadera sobre un bebé invisible',()=>{
 const body=fixture();
 try{
  const chest=body.hit(0,.48).point.z;
  const belly=body.hit(0,-.18).point.z;
  const closure=body.hit(0,-.9).point.z;
  assert.ok(belly>chest&&belly<chest*1.3,'Guatita suave, sin esfera uniforme.');
  assert.ok(closure<chest*.8,'El volumen se recoge hacia los broches.');
  for(const y of [-.4,-.18,.25,.65]){
   const depth=body.hit(0,y).point.z-body.hit(0,y,true).point.z;
   assert.ok(depth>.33&&depth<.46,'Volumen corporal visible de perfil.');
  }
  assert.ok(Math.abs(body.hit(0,-.48,true).point.z)>Math.abs(body.hit(0,-.9,true).point.z),'La cadera tiene espacio para el pañal.');
  for(const x of [-.9,.9]){
   const depth=body.hit(x,-.25).point.z-body.hit(x,-.25,true).point.z;
   assert.ok(depth>.1&&depth<.18,'Mangas con volumen de brazo.');
  }
 }finally{body.dispose()}
});
