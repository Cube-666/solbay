// SOLBAY — humanoid character factory: third-person player + pedestrians.
// Built from boxes/capsules with pivoting limbs, so walk/run animation is cheap.
import * as THREE from 'three';
import { rand, pick } from './util.js';

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const SHIRTS = [0x2e86c1, 0xc0392b, 0x27ae60, 0x8e44ad, 0xe67e22, 0x16a085, 0xecf0f1, 0x2c3e50];
const PANTS = [0x2c3e50, 0x34495e, 0x5d4037, 0x1a1a1a, 0x4a6741];

function limb(w, h, d, mat, px, py) {
  const pivot = new THREE.Group();
  pivot.position.set(px, py, 0);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = -h / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

export function createHumanoid(opts = {}) {
  const skin = opts.skin ?? pick(SKINS);
  const shirt = opts.shirt ?? pick(SHIRTS);
  const pants = opts.pants ?? pick(PANTS);
  const hairColor = opts.hair ?? pick([0x1a1a1a, 0x4a2f1a, 0x888888, 0x2a1a0a]);
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });

  // torso (slightly tapered box) + jacket stripe
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.36),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 }));
  stripe.position.y = 1.32; g.add(stripe);
  // head + hair + cap/hat option
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skinMat);
  head.position.y = 1.78; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.81; g.add(hair);
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.09, 12),
      new THREE.MeshStandardMaterial({ color: opts.cap, roughness: 0.8 }));
    cap.position.y = 1.95; g.add(cap);
  }
  // arms pivot at shoulders, legs at hips
  const armL = limb(0.17, 0.62, 0.17, shirtMat, -0.4, 1.48); g.add(armL);
  const armR = limb(0.17, 0.62, 0.17, shirtMat, 0.4, 1.48); g.add(armR);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), skinMat);
  handL.position.y = -0.62; armL.add(handL);
  const handR = handL.clone(); armR.add(handR);
  const legL = limb(0.21, 0.72, 0.21, pantsMat, -0.16, 0.82); g.add(legL);
  const legR = limb(0.21, 0.72, 0.21, pantsMat, 0.16, 0.82); g.add(legR);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  for (const leg of [legL, legR]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.34), shoeMat);
    shoe.position.set(0, -0.74, 0.05); leg.add(shoe);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return {
    group: g,
    parts: { armL, armR, legL, legR, head, torso },
    // walkPhase advances with speed; swing limbs, bob body, lean forward when running
    animate(phase, speed, running) {
      const swing = Math.min(1, speed / 6) * (running ? 0.85 : 0.55);
      legL.rotation.x = Math.sin(phase) * swing;
      legR.rotation.x = -Math.sin(phase) * swing;
      armL.rotation.x = -Math.sin(phase) * swing * 0.8;
      armR.rotation.x = Math.sin(phase) * swing * 0.8;
      torso.position.y = 1.18 + Math.abs(Math.sin(phase)) * 0.03 * Math.min(1, speed / 6);
      torso.rotation.x = running ? 0.12 : 0.03;
    },
    idle(t) {
      legL.rotation.x = 0; legR.rotation.x = 0;
      armL.rotation.x = Math.sin(t * 1.4) * 0.05;
      armR.rotation.x = -Math.sin(t * 1.4) * 0.05;
      torso.position.y = 1.18 + Math.sin(t * 2) * 0.012;
      torso.rotation.x = 0;
    },
  };
}

export function createPlayerHumanoid() {
  // The hero: Dario Cole — teal jacket, dark jeans, sneakers, short dark hair.
  return createHumanoid({ shirt: 0x0f766e, pants: 0x1f2937, skin: 0xe8b98a, hair: 0x1a1a1a });
}
