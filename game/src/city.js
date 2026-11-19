// SOLBAY — procedural coastal city: road grid, buildings, beach, marina, props.
// City plan: 7 roads each way (pitch 56 m), blocks of 40 m, beach + sea to the south.
// All geometry is original; names are fictional (Solbay, Palm Row, Marina Bay).
import * as THREE from 'three';
import { rand, randInt, pick, clamp } from './util.js';
import {
  makeBuildingTextures, makeRoadTexture, makeSidewalkTexture,
  makeGrassTexture, makeSandTexture, makePlazaTexture,
} from './textures.js';

export const ROAD_PITCH = 56;
export const ROAD_AT = [-168, -112, -56, 0, 56, 112, 168];
export const CITY_HALF = 196;

function box(w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

function makePalm(THREE, s = 1) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 5.5 * s, 7), trunkMat);
  trunk.position.y = 2.75 * s; trunk.castShadow = true;
  trunk.rotation.z = 0.08;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 3.2 * s, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1 * s, 5.6 * s, Math.sin(a) * 1.1 * s);
    leaf.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    leaf.castShadow = true;
    g.add(leaf);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 }));
  nuts.position.y = 5.3 * s;
  g.add(nuts);
  return g;
}

function makeStreetlight(THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 8), mat);
  pole.position.y = 3; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), mat);
  arm.rotation.z = Math.PI / 2; arm.position.set(1.0, 5.9, 0); g.add(arm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.7 }));
  lamp.position.set(2.0, 5.85, 0); g.add(lamp);
  return g;
}

function makeTrafficLight(THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.6, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.5, 8), mat);
  pole.position.y = 2.75; pole.castShadow = true; g.add(pole);
  const head = box(0.5, 1.3, 0.5, mat, 0, 5.6, 0);
  g.add(head);
  const colors = [0xff3b30, 0xffcc00, 0x34c759];
  colors.forEach((c, i) => {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i === 1 ? 1.2 : 0.25 }));
    lamp.position.set(0, 5.95 - i * 0.38, 0.28); g.add(lamp);
  });
  return g;
}

export function buildCity(scene) {
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const addCollider = (x, z, hw, hd) => colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });

  const tex = {
    building: makeBuildingTextures(THREE),
    road: makeRoadTexture(THREE),
    sidewalk: makeSidewalkTexture(THREE),
    grass: makeGrassTexture(THREE),
    sand: makeSandTexture(THREE),
    plaza: makePlazaTexture(THREE),
  };

  // ---- ground: grass base, roads, beach, sea ----
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.05, 60);
  grass.receiveShadow = true; scene.add(grass);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(900, 60),
    new THREE.MeshStandardMaterial({ map: tex.sand, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 226);
  sand.receiveShadow = true; scene.add(sand);

  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1e7fa8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 320), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.05, 420);
  sea.receiveShadow = true; scene.add(sea);

  // road strips (asphalt) + sidewalks
  const roadMat = new THREE.MeshStandardMaterial({ map: tex.road, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ map: tex.sidewalk, roughness: 1 });
  for (const a of ROAD_AT) {
    for (const len of [420]) {
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(len, 10), roadMat);
      rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.06, a); rx.receiveShadow = true; scene.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(10, len), roadMat);
      rz.rotation.x = -Math.PI / 2; rz.position.set(a, 0.06, 0); rz.receiveShadow = true; scene.add(rz);
      // sidewalks bordering each road
      for (const off of [-8, 8]) {
        const sx = new THREE.Mesh(new THREE.PlaneGeometry(len, 3), walkMat);
        sx.rotation.x = -Math.PI / 2; sx.position.set(0, 0.04, a + off); sx.receiveShadow = true; scene.add(sx);
        const sz = new THREE.Mesh(new THREE.PlaneGeometry(3, len), walkMat);
        sz.rotation.x = -Math.PI / 2; sz.position.set(a + off, 0.04, 0); sz.receiveShadow = true; scene.add(sz);
      }
    }
  }
  // simple crosswalks: white bars across roads at intersections
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 });
  for (const a of ROAD_AT) for (const b of ROAD_AT) {
    for (let i = -2; i <= 2; i++) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 9), stripeMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(b + i * 2.2, 0.08, a + 7.5); scene.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), stripeMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(a + 7.5, 0.08, b + i * 2.2); scene.add(s2);
    }
  }

  // ---- blocks ----
  const blockCenters = [-140, -84, -28, 28, 84, 140];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 1 });
  const neonColors = [0xff5ea8, 0x37e0c8, 0xffb347, 0x7ab8ff];
  const parks = new Set(['-140,-140', '140,-84', '-84,140']);
  const plazaBlock = '28,28';
  const parkingBlock = '-28,140';
  let buildingCount = 0;

  for (const bx of blockCenters) for (const bz of blockCenters) {
    const key = `${bx},${bz}`;
    const distCenter = Math.hypot(bx, bz);
    if (key === plazaBlock) {
      const plaza = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ map: tex.plaza, roughness: 1 }));
      plaza.rotation.x = -Math.PI / 2; plaza.position.set(bx, 0.07, bz); plaza.receiveShadow = true; scene.add(plaza);
      // fountain
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.9, 20),
        new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.9 }));
      rim.position.set(bx, 0.45, bz); rim.castShadow = true; rim.receiveShadow = true; scene.add(rim);
      const water = new THREE.Mesh(new THREE.CircleGeometry(3.6, 20),
        new THREE.MeshStandardMaterial({ color: 0x3fa8d8, roughness: 0.15, metalness: 0.2 }));
      water.rotation.x = -Math.PI / 2; water.position.set(bx, 0.85, bz); scene.add(water);
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 }));
      jet.position.set(bx, 1.4, bz); scene.add(jet);
      addCollider(bx, bz, 4.5, 4.5);
      continue;
    }
    if (parks.has(key)) {
      // park: trees + benches
      for (let i = 0; i < 7; i++) {
        const palm = makePalm(THREE, rand(0.9, 1.3));
        palm.position.set(bx + rand(-16, 16), 0, bz + rand(-16, 16));
        scene.add(palm);
        addCollider(palm.position.x, palm.position.z, 0.5, 0.5);
      }
      const bench = box(3, 0.5, 1, new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 }), bx, 0.5, bz + 8);
      scene.add(bench); addCollider(bx, bz + 8, 1.6, 0.6);
      continue;
    }
    if (key === parkingBlock) {
      // parking lot with painted bays
      const lot = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 1 }));
      lot.rotation.x = -Math.PI / 2; lot.position.set(bx, 0.07, bz); lot.receiveShadow = true; scene.add(lot);
      continue;
    }
    // buildings: 1 tower or 2-4 mid blocks
    const downtown = distCenter < 90;
    const n = downtown && Math.random() < 0.5 ? 1 : randInt(2, 4);
    const spots = n === 1 ? [[0, 0, 26, 26]] : [
      [-10, -10, 16, 16], [10, -10, 16, 16], [-10, 10, 16, 16], [10, 10, 16, 16],
    ].slice(0, n);
    for (const [ox, oz, w, d] of spots) {
      const h = downtown ? rand(28, 85) : rand(12, 34);
      const t = pick(tex.building).clone();
      t.needsUpdate = true;
      t.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 16)));
      const side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
      const mats = [side, side, roofMat, roofMat, side, side];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      b.position.set(bx + ox, h / 2, bz + oz);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      buildingCount++;
      addCollider(bx + ox, bz + oz, w / 2 + 0.3, d / 2 + 0.3);
      // rooftop props
      if (Math.random() < 0.6) {
        const ac = box(rand(2, 4), 1.2, rand(2, 3), roofMat, bx + ox + rand(-w / 4, w / 4), h + 0.6, bz + oz + rand(-d / 4, d / 4));
        scene.add(ac);
      }
      if (Math.random() < 0.3) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 6), roofMat);
        ant.position.set(bx + ox, h + 3, bz + oz); scene.add(ant);
      }
      // neon sign on some buildings
      if (Math.random() < 0.35) {
        const neon = new THREE.Mesh(new THREE.PlaneGeometry(rand(6, 10), 1.1),
          new THREE.MeshStandardMaterial({ color: pick(neonColors), emissive: pick(neonColors), emissiveIntensity: 1.4 }));
        neon.position.set(bx + ox, rand(6, Math.min(h - 2, 18)), bz + oz + d / 2 + 0.06);
        scene.add(neon);
      }
    }
  }

  // ---- Solbay Tower (landmark, centre) ----
  {
    const t = tex.building[0].clone(); t.needsUpdate = true; t.repeat.set(3, 8);
    const side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(30, 110, 30), [side, side, roofMat, roofMat, side, side]);
    tower.position.set(0, 55, -140); tower.castShadow = true; tower.receiveShadow = true;
    scene.add(tower);
    const crown = box(32, 3, 32, new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x37e0c8, emissiveIntensity: 0.5 }), 0, 111, -140);
    scene.add(crown);
    addCollider(0, -140, 15.5, 15.5);
    buildingCount++;
  }

  // ---- streetlights + traffic lights + palms along beach road ----
  for (const a of ROAD_AT) {
    for (const b of [-168, -84, 0, 84, 168]) {
      const sl = makeStreetlight(THREE);
      sl.position.set(b + 8.5, 0, a + 8.5); sl.rotation.y = Math.PI; scene.add(sl);
      const sl2 = makeStreetlight(THREE);
      sl2.position.set(b - 8.5, 0, a - 8.5); scene.add(sl2);
    }
    const tl = makeTrafficLight(THREE);
    tl.position.set(a + 7, 0, 168 + 7); scene.add(tl);
  }
  for (let x = -180; x <= 180; x += 24) {
    const palm = makePalm(THREE, rand(1, 1.4));
    palm.position.set(x, 0, 182); scene.add(palm); addCollider(x, 182, 0.5, 0.5);
    const palm2 = makePalm(THREE, rand(1, 1.3));
    palm2.position.set(x + 12, 0, 210); scene.add(palm2); addCollider(x + 12, 210, 0.5, 0.5);
  }

  // ---- marina pier + yacht ----
  {
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x9a7f5e, roughness: 1 });
    const pier = box(10, 1, 46, pierMat, 84, 0.5, 252);
    scene.add(pier);
    for (let z = 236; z <= 268; z += 8) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), pierMat);
      post.position.set(84 - 4.5, 0, z); scene.add(post);
      const post2 = post.clone(); post2.position.x = 84 + 4.5; scene.add(post2);
    }
    // yacht: white hull + cabin
    const yacht = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 18),
      new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35, metalness: 0.2 }));
    hull.position.y = 0.6; hull.castShadow = true; yacht.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2, 9),
      new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.4 }));
    cabin.position.y = 2.6; cabin.castShadow = true; yacht.add(cabin);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e3a4e, roughness: 0.15, metalness: 0.6 }));
    glass.position.y = 3.2; yacht.add(glass);
    yacht.position.set(104, 0.1, 276); yacht.rotation.y = 0.4;
    scene.add(yacht);
  }

  // ---- port containers (east side) ----
  const containerColors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
  for (let i = 0; i < 8; i++) {
    const c = box(6, 2.6, 2.6, new THREE.MeshStandardMaterial({ color: pick(containerColors), roughness: 0.8, metalness: 0.3 }),
      150 + (i % 2) * 8, 1.3 + Math.floor(i / 2) % 2 * 2.7, -150 + Math.floor(i / 4) * 10);
    c.rotation.y = 0.15; scene.add(c);
    addCollider(c.position.x, c.position.z, 3.2, 1.6);
  }

  // ---- parked cars (static props, some stealable) ----
  const parkedSpots = [];
  for (let i = 0; i < 10; i++) {
    const road = pick(ROAD_AT);
    const along = pick(ROAD_AT);
    parkedSpots.push({ x: road + (Math.random() < 0.5 ? 6.8 : -6.8), z: along + rand(-40, 40), angle: Math.random() < 0.5 ? 0 : Math.PI });
  }

  return {
    colliders, buildingCount,
    roads: ROAD_AT.map(a => ({ axis: 'x', at: a, from: -CITY_HALF, to: CITY_HALF }))
      .concat(ROAD_AT.map(a => ({ axis: 'z', at: a, from: -CITY_HALF, to: CITY_HALF }))),
    parkedSpots,
    landmarks: {
      garage: { x: -28, z: 140, label: 'Garage' },
      safehouse: { x: -140, z: -84, label: 'Safehouse' },
      port: { x: 150, z: -150, label: 'Port' },
      marina: { x: 84, z: 252, label: 'Marina' },
      tower: { x: 0, z: -140, label: 'Solbay Tower' },
      hospital: { x: 140, z: 28, label: 'Hospital' },
      beach: { x: 0, z: 210, label: 'Palm Beach' },
    },
    sea,
  };
}
