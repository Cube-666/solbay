// SOLBAY — car factory: sedans, taxis, sports cars, trucks, police cruisers.
// Body + cabin + wheels + glass + lights, all from boxes/cylinders (no assets).
import * as THREE from 'three';
import { rand, pick } from './util.js';

const PAINTS = [0xc0392b, 0x2471a3, 0xf1c40f, 0xecf0f1, 0x2c3e50, 0x7d3c98, 0xe67e22, 0x16a085, 0xbdc3c7, 0x922b21];
const SPORT_PAINTS = [0xff2e4d, 0xffa500, 0x00c2ff, 0x9d00ff, 0xf5f5f0];

function makeWheel() {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }));
  tire.rotation.z = Math.PI / 2; tire.castShadow = true; g.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10),
    new THREE.MeshStandardMaterial({ color: 0xc0c4c8, roughness: 0.3, metalness: 0.8 }));
  hub.rotation.z = Math.PI / 2; g.add(hub);
  return g;
}

export function createCar(type = 'sedan', color = null) {
  const g = new THREE.Group();
  const paint = color ?? (type === 'sport' ? pick(SPORT_PAINTS) : pick(PAINTS));
  const bodyMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: 0.12, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  const dims = {
    sedan: { l: 4.4, w: 1.9, bodyH: 0.72, cabinL: 2.2 },
    taxi: { l: 4.4, w: 1.9, bodyH: 0.72, cabinL: 2.2 },
    sport: { l: 4.6, w: 2.0, bodyH: 0.55, cabinL: 1.9 },
    truck: { l: 5.6, w: 2.1, bodyH: 1.1, cabinL: 1.6 },
    police: { l: 4.5, w: 1.95, bodyH: 0.72, cabinL: 2.2 },
  }[type] || { l: 4.4, w: 1.9, bodyH: 0.72, cabinL: 2.2 };
  const { l, w, bodyH, cabinL } = dims;

  // lower body + hood/trunk shaping via a second slab
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, l), bodyMat);
  body.position.y = 0.55; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, bodyH * 0.55, 0.7), bodyMat);
  nose.position.set(0, 0.48, l / 2 - 0.2); nose.castShadow = true; g.add(nose);
  // cabin with glass
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.62, cabinL), glassMat);
  cabin.position.set(0, 0.55 + bodyH / 2 + 0.28, -l * 0.05); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.08, cabinL * 0.92), bodyMat);
  roof.position.set(0, 0.55 + bodyH / 2 + 0.62, -l * 0.05); roof.castShadow = true; g.add(roof);
  // bumpers + grille + lights
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.3), darkMat);
  bumperF.position.set(0, 0.32, l / 2); g.add(bumperF);
  const bumperR = bumperF.clone(); bumperR.position.z = -l / 2; g.add(bumperR);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), lightMat);
    hl.position.set(sx * (w / 2 - 0.35), 0.62, l / 2 + 0.01); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xaa1111, emissiveIntensity: 0.7 }));
    tl.position.set(sx * (w / 2 - 0.35), 0.62, -l / 2 - 0.01); g.add(tl);
  }
  // wheels (front steer, rear drive)
  const wheels = [];
  const wy = 0.36;
  for (const [wx, wz, steer] of [[-w / 2 + 0.1, l / 2 - 0.85, true], [w / 2 - 0.1, l / 2 - 0.85, true], [-w / 2 + 0.1, -l / 2 + 0.85, false], [w / 2 - 0.1, -l / 2 + 0.85, false]]) {
    const wh = makeWheel();
    wh.position.set(wx, wy, wz);
    g.add(wh);
    wheels.push({ mesh: wh, steer });
  }

  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xf5d76e, emissive: 0xf5d76e, emissiveIntensity: 0.8 }));
    sign.position.set(0, 0.55 + bodyH / 2 + 0.7, -l * 0.05); g.add(sign);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.16, l * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }));
    stripe.position.set(0, 0.62, 0); g.add(stripe);
  }
  if (type === 'police') {
    bodyMat.color.setHex(0xf2f2f2);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
    door.position.set(w / 2 + 0.01, 0.6, 0); g.add(door);
    const door2 = door.clone(); door2.position.x = -w / 2 - 0.01; g.add(door2);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.3), darkMat);
    bar.position.set(0, 0.55 + bodyH / 2 + 0.7, -l * 0.05); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    red.position.set(-0.32, 0.55 + bodyH / 2 + 0.72, -l * 0.05); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 2 }));
    blue.position.set(0.32, 0.55 + bodyH / 2 + 0.72, -l * 0.05); g.add(blue);
    g.userData.lightBar = { red, blue };
  }
  if (type === 'sport') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.07, 0.4), darkMat);
    spoiler.position.set(0, 1.05, -l / 2 + 0.25); spoiler.castShadow = true; g.add(spoiler);
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.35), darkMat);
    finL.position.set(-w / 2 + 0.15, 0.95, -l / 2 + 0.25); g.add(finL);
    const finR = finL.clone(); finR.position.x = w / 2 - 0.15; g.add(finR);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.5, l * 0.42),
      new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.7, metalness: 0.4 }));
    bed.position.set(0, 0.95, -l * 0.24); bed.castShadow = true; g.add(bed);
  }

  return {
    group: g, wheels, type, paint,
    length: l, width: w,
    // top speed (m/s) and accel per type
    topSpeed: { sedan: 26, taxi: 24, sport: 38, truck: 20, police: 32 }[type] || 26,
    accel: { sedan: 14, taxi: 13, sport: 20, truck: 10, police: 18 }[type] || 14,
  };
}
