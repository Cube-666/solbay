// SOLBAY — wanted system + police pursuit.
// Stars rise with crimes, fall when the player stays clean and far from the law.
// Police cruisers chase, ram, and bust the player on foot; getting wasted or busted
// respawns the player at the hospital with a fine.
import * as THREE from 'three';
import { clamp, angleLerp, dist2d } from './util.js';
import { createCar } from './vehicles.js';
import { ROAD_AT } from './city.js';

const WANTED_DECAY_SECONDS = 25;

export class PoliceSystem {
  constructor(scene, colliders, audio, onBusted) {
    this.scene = scene;
    this.colliders = colliders;
    this.audio = audio;
    this.onBusted = onBusted;
    this.wanted = 0;
    this.cruisers = [];
    this.cleanTimer = 0;
    this.bustTimer = 0;
    this._sirenTimer = 0;
    this.spawnCooldown = 0;
  }

  addWanted(n, reason) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, 5);
    if (this.wanted > before) {
      this.audio.wantedUp();
      this.cleanTimer = 0;
    }
    return this.wanted;
  }

  clearWanted() {
    this.wanted = 0;
    this.cleanTimer = 0;
    this.bustTimer = 0;
    this._despawnAll();
  }

  _despawnAll() {
    for (const c of this.cruisers) this.scene.remove(c.car.group);
    this.cruisers = [];
  }

  _spawnCruiserNear(x, z) {
    const car = createCar('police');
    // spawn on the nearest road, a little away from the player
    let best = null, bestD = Infinity;
    for (const a of ROAD_AT) {
      for (const [rx, rz] of [[a, z], [x, a]]) {
        const d = Math.hypot(rx - x, rz - z);
        if (d > 35 && d < bestD) { bestD = d; best = [rx, rz]; }
      }
    }
    const [sx, sz] = best || [x + 40, z];
    car.group.position.set(sx, 0, sz);
    car.group.rotation.y = Math.atan2(x - sx, z - sz);
    this.scene.add(car.group);
    this.cruisers.push({ car, speed: 0, bustTouch: 0 });
  }

  update(dt, player, time) {
    const px = player.pos.x, pz = player.pos.z;
    // desired cruiser count follows the wanted level
    const want = this.wanted === 0 ? 0 : Math.min(4, this.wanted + 1);
    this.spawnCooldown -= dt;
    if (this.cruisers.length < want && this.spawnCooldown <= 0) {
      this._spawnCruiserNear(px, pz);
      this.spawnCooldown = 2.5;
    }
    if (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.car.group);
    }
    // siren blips
    this._sirenTimer -= dt;
    if (this.cruisers.length > 0 && this._sirenTimer <= 0) {
      this.audio.sirenBlip();
      this._sirenTimer = 1.4;
    }
    // wanted decay: stay clean and keep the cops far away
    if (this.wanted > 0) {
      const nearest = this.cruisers.length
        ? Math.min(...this.cruisers.map(c => dist2d(c.car.group.position.x, c.car.group.position.z, px, pz)))
        : 999;
      if (nearest > 60) {
        this.cleanTimer += dt;
        if (this.cleanTimer > WANTED_DECAY_SECONDS) {
          this.wanted--;
          this.cleanTimer = 0;
        }
      } else {
        this.cleanTimer = 0;
      }
    }
    // chase + bust logic
    let touching = false;
    for (const c of this.cruisers) {
      const p = c.car.group.position;
      const dx = px - p.x, dz = pz - p.z;
      const d = Math.hypot(dx, dz);
      const targetYaw = Math.atan2(dx, dz);
      c.car.group.rotation.y = angleLerp(c.car.group.rotation.y, targetYaw, Math.min(1, dt * 2.2));
      const targetSpeed = d > 6 ? 30 : 12;
      c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.5);
      const nx = p.x + Math.sin(c.car.group.rotation.y) * c.speed * dt;
      const nz = p.z + Math.cos(c.car.group.rotation.y) * c.speed * dt;
      // cruisers slide around buildings (cheap: clamp to the same colliders)
      let blocked = false;
      for (const col of this.colliders) {
        if (nx > col.minX - 1.6 && nx < col.maxX + 1.6 && nz > col.minZ - 1.6 && nz < col.maxZ + 1.6) { blocked = true; break; }
      }
      if (!blocked) { p.x = nx; p.z = clamp(nz, -196, 236); }
      else c.speed *= 0.5;
      const spin = c.speed * dt / 0.36;
      for (const w of c.car.wheels) w.mesh.rotation.x += spin;
      // light bar flash
      const flash = Math.sin(time * 10) > 0;
      const bar = c.car.group.userData.lightBar;
      if (bar) {
        bar.red.material.emissiveIntensity = flash ? 2.5 : 0.2;
        bar.blue.material.emissiveIntensity = flash ? 0.2 : 2.5;
      }
      // ram the player's car / bust the player on foot
      if (d < 3.4) {
        touching = true;
        if (!player.inCar) c.bustTouch += dt;
        else if (c.speed > 10) { player.damage(dt * 3); }
      } else {
        c.bustTouch = Math.max(0, c.bustTouch - dt);
      }
    }
    if (touching && !player.inCar) {
      this.bustTimer += dt;
      if (this.bustTimer > 2.5) {
        this.bustTimer = 0;
        this.onBusted();
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }
}
