// SOLBAY — story missions: a 4-job chain for Dario Cole, driver-for-hire in Solbay.
// Each mission is a list of objectives; a marker beacon + HUD text guide the player.
// Rewards pay in dollars; finishing the chain opens free roam.
import * as THREE from 'three';
import { createCar } from './vehicles.js';

const MISSIONS = [
  {
    id: 'first-fare',
    title: 'Mission 1 — First Fare',
    briefing: 'Mama Rosa needs a driver. Pick up the taxi on Palm Row and take the client to the Marina.',
    reward: 300,
    objectives: [
      { type: 'goto', text: 'Go to the taxi on Palm Row', x: 0, z: 168, r: 6 },
      { type: 'enterCar', text: 'Get in the taxi', carId: 'taxi' },
      { type: 'driveTo', text: 'Drive the client to the Marina', x: 84, z: 230, r: 9, needCar: true },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Mission 2 — Hot Wheels',
    briefing: 'A red Comet sports car is parked at the lot on 5th Ave. Lift it and bring it to the garage — no questions asked.',
    reward: 800,
    objectives: [
      { type: 'enterCar', text: 'Steal the red Comet from the parking lot', carId: 'comet' },
      { type: 'driveTo', text: 'Deliver the Comet to the garage', x: 140, z: -28, r: 9, needCar: true },
    ],
  },
  {
    id: 'heat',
    title: 'Mission 3 — Heat',
    briefing: 'The garage job tripped an alarm. The whole Solbay PD is on you — lose them, then lay low at the safehouse.',
    reward: 500,
    objectives: [
      { type: 'loseCops', text: 'Lose the cops (stay clean until the stars fade)' },
      { type: 'goto', text: 'Reach the safehouse', x: -140, z: -84, r: 7 },
    ],
  },
  {
    id: 'big-score',
    title: 'Mission 4 — The Big Score',
    briefing: 'One last job: the Harbor crew is guarding a package at the Port. Take them out, grab it, and deliver it to the yacht.',
    reward: 2500,
    objectives: [
      { type: 'goto', text: 'Go to the Port', x: 148, z: -148, r: 10 },
      { type: 'eliminate', text: 'Take out the Harbor crew', count: 4 },
      { type: 'goto', text: 'Grab the package', x: 152, z: -152, r: 5 },
      { type: 'goto', text: 'Deliver the package to the yacht at the Marina', x: 84, z: 230, r: 9 },
    ],
  },
];

export class MissionSystem {
  constructor(scene, audio, hooks) {
    this.scene = scene;
    this.audio = audio;
    this.hooks = hooks; // { police, combat, onMissionComplete, onStoryComplete, onObjective }
    this.index = 0;
    this.objIndex = 0;
    this.active = false;
    this.done = false;
    this.specialCars = [];
    this._marker = null;
    this._spawnSpecialCars();
  }

  _spawnSpecialCars() {
    // the mission taxi, parked on Palm Row
    const taxi = createCar('taxi', 0xf1c40f);
    taxi.group.position.set(2, 0, 168);
    taxi.group.rotation.y = Math.PI / 2;
    this.scene.add(taxi.group);
    this.specialCars.push({ id: 'taxi', car: taxi, taken: false });
    // the red Comet sports car at the parking lot
    const comet = createCar('sport', 0xff2e4d);
    comet.group.position.set(-28, 0, 140);
    comet.group.rotation.y = -Math.PI / 2;
    this.scene.add(comet.group);
    this.specialCars.push({ id: 'comet', car: comet, taken: false });
  }

  specialCarById(id) { return this.specialCars.find(s => s.id === id); }

  currentMission() { return MISSIONS[this.index] ?? null; }
  currentObjective() {
    const m = this.currentMission();
    return m ? m.objectives[this.objIndex] ?? null : null;
  }

  start() {
    this.active = true;
    this.index = 0;
    this.objIndex = 0;
    this._enterObjective();
  }

  restore(index) {
    this.index = Math.min(index, MISSIONS.length - 1);
    this.objIndex = 0;
    this.active = true;
    this._enterObjective();
  }

  _enterObjective() {
    const obj = this.currentObjective();
    this._clearMarker();
    if (!obj) { this._completeMission(); return; }
    if (obj.type === 'goto' || obj.type === 'driveTo') this._placeMarker(obj.x, obj.z);
    if (obj.type === 'eliminate' && this.hooks.combat) {
      const spots = [[146, -146], [152, -142], [144, -154], [156, -150]];
      for (const [x, z] of spots) this.hooks.combat.spawnEnemy(x, z);
      this._placeMarker(150, -150);
    }
    if (this.index === 2 && this.objIndex === 0) {
      // the Heat mission starts with the cops already on the player
      this.hooks.police.addWanted(2, 'alarm');
    }
    this.hooks.onObjective?.(this.currentMission(), obj);
  }

  _placeMarker(x, z) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 30;
    g.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4),
      new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb300, emissiveIntensity: 1.6 }));
    diamond.position.y = 7;
    g.add(diamond);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
    g.add(ring);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this._marker = { group: g, diamond, x, z };
  }

  _clearMarker() {
    if (this._marker) { this.scene.remove(this._marker.group); this._marker = null; }
  }

  _nextObjective() {
    this.objIndex++;
    this.audio.pickup();
    this._enterObjective();
  }

  _completeMission() {
    const m = this.currentMission();
    this._clearMarker();
    this.audio.missionDone();
    this.hooks.onMissionComplete?.(m);
    this.index++;
    this.objIndex = 0;
    if (this.index >= MISSIONS.length) {
      this.done = true;
      this.active = false;
      this.hooks.onStoryComplete?.();
    } else {
      this._enterObjective();
    }
  }

  // called when the player enters a car
  onEnterCar(carId) {
    const obj = this.currentObjective();
    if (!obj || obj.type !== 'enterCar') return;
    if (carId && obj.carId === carId) this._nextObjective();
  }

  update(dt, player, time) {
    if (!this.active || this.done) return;
    if (this._marker) {
      this._marker.diamond.rotation.y = time * 1.5;
      this._marker.diamond.position.y = 7 + Math.sin(time * 2) * 0.5;
    }
    const obj = this.currentObjective();
    if (!obj) return;
    const px = player.pos.x, pz = player.pos.z;
    if (obj.type === 'goto') {
      if (Math.hypot(px - obj.x, pz - obj.z) < obj.r) this._nextObjective();
    } else if (obj.type === 'driveTo') {
      if (player.inCar && Math.hypot(px - obj.x, pz - obj.z) < obj.r) this._nextObjective();
    } else if (obj.type === 'loseCops') {
      if (this.hooks.police.wanted === 0) this._nextObjective();
    } else if (obj.type === 'eliminate') {
      if (this.hooks.combat.aliveEnemies().length === 0) this._nextObjective();
    }
  }

  objectiveText() {
    const m = this.currentMission();
    const o = this.currentObjective();
    if (!m || !o) return this.done ? 'Story complete — free roam Solbay!' : '';
    let text = o.text;
    if (o.type === 'eliminate') {
      const left = this.hooks.combat.aliveEnemies().length;
      text = `Take out the Harbor crew (${4 - left}/4)`;
    }
    return text;
  }

  objectiveDistance(player) {
    const o = this.currentObjective();
    if (!o || o.x === undefined) return null;
    return Math.round(Math.hypot(player.pos.x - o.x, player.pos.z - o.z));
  }
}
