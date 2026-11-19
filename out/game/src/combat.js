// SOLBAY — combat: pistol shooting (raycast + tracers), punching, armed enemies.
// Enemies are humanoids with health; they shoot back and close in to punch.
import * as THREE from 'three';
import { clamp } from './util.js';
import { createHumanoid } from './character.js';

export class CombatSystem {
  constructor(scene, audio, police, traffic) {
    this.scene = scene;
    this.audio = audio;
    this.police = police;
    this.traffic = traffic;
    this.enemies = [];
    this.tracers = [];
    this._ray = new THREE.Raycaster();
    this._shootCooldown = 0;
    this._punchCooldown = 0;
    this.muzzle = new THREE.PointLight(0xffcc66, 0, 12);
    this.scene.add(this.muzzle);
  }

  spawnEnemy(x, z, opts = {}) {
    const h = createHumanoid({ shirt: opts.shirt ?? 0x5b2c2c, pants: 0x1a1a1a, skin: 0xc98d5f });
    h.group.position.set(x, 0, z);
    this.scene.add(h.group);
    const e = {
      humanoid: h, health: 100, dead: false, deadTimer: 0,
      shootTimer: 1 + Math.random(), phase: Math.random() * 10,
    };
    this.enemies.push(e);
    return e;
  }

  aliveEnemies() { return this.enemies.filter(e => !e.dead); }

  _tracer(from, to, color = 0xffee88) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  _flash(pos) {
    this.muzzle.position.copy(pos);
    this.muzzle.intensity = 60;
    setTimeout(() => { this.muzzle.intensity = 0; }, 60);
  }

  playerShoot(camera, player) {
    if (this._shootCooldown > 0 || player.inCar) return false;
    this._shootCooldown = 0.28;
    this.audio.gunshot();
    this._ray.setFromCamera({ x: 0, y: 0 }, camera);
    this._ray.far = 70;
    const origin = camera.position.clone();
    // muzzle position: just in front of the player
    const muzzlePos = player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).add(
      new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading)).multiplyScalar(0.8));
    // hit enemies first
    let hitPoint = null;
    let bestD = 70;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const p = e.humanoid.group.position;
      const to = new THREE.Vector3(p.x - origin.x, 1.2 - origin.y, p.z - origin.z);
      const d = to.length();
      if (d > 70) continue;
      const dir = this._ray.ray.direction;
      const along = to.dot(dir);
      if (along < 0 || along > bestD) continue;
      const perp = to.clone().addScaledVector(dir, -along).length();
      if (perp < 1.1) { bestD = along; hitPoint = new THREE.Vector3(p.x, 1.2, p.z); this._damageEnemy(e, 34); }
    }
    // then pedestrians (a crime)
    if (!hitPoint) {
      for (const p of this.traffic.peds) {
        if (p.dead) continue;
        const g = p.humanoid.group.position;
        const to = new THREE.Vector3(g.x - origin.x, 1.2 - origin.y, g.z - origin.z);
        const d = to.length();
        if (d > 70) continue;
        const dir = this._ray.ray.direction;
        const along = to.dot(dir);
        if (along < 0 || along > bestD) continue;
        const perp = to.clone().addScaledVector(dir, -along).length();
        if (perp < 1.0) {
          bestD = along; hitPoint = new THREE.Vector3(g.x, 1.2, g.z);
          p.dead = true;
          p.humanoid.group.rotation.x = -Math.PI / 2;
          p.humanoid.group.position.y = 0.3;
          this.police.addWanted(1, 'ped shot');
          this.traffic.scarePeds(g.x, g.z, 25);
        }
      }
    }
    const end = hitPoint ?? origin.clone().addScaledVector(this._ray.ray.direction, 70);
    this._tracer(muzzlePos, end);
    this._flash(muzzlePos);
    this.traffic.scarePeds(player.pos.x, player.pos.z, 30);
    return true;
  }

  _damageEnemy(e, dmg) {
    e.health -= dmg;
    if (e.health <= 0 && !e.dead) {
      e.dead = true;
      e.deadTimer = 0;
      e.humanoid.group.rotation.x = -Math.PI / 2;
      e.humanoid.group.position.y = 0.3;
    }
  }

  playerPunch(player) {
    if (this._punchCooldown > 0 || player.inCar) return false;
    this._punchCooldown = 0.45;
    this.audio.punch();
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    let hit = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const p = e.humanoid.group.position;
      const dx = p.x - player.pos.x, dz = p.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.4 && dx * fx + dz * fz > 0) {
        this._damageEnemy(e, 25);
        p.x += fx * 0.8; p.z += fz * 0.8;
        hit = true;
      }
    }
    if (!hit) {
      for (const p of this.traffic.peds) {
        if (p.dead) continue;
        const g = p.humanoid.group.position;
        const dx = g.x - player.pos.x, dz = g.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.4 && dx * fx + dz * fz > 0) {
          p.dead = true;
          p.humanoid.group.rotation.x = -Math.PI / 2;
          p.humanoid.group.position.y = 0.3;
          this.police.addWanted(1, 'ped punched');
          this.traffic.scarePeds(g.x, g.z, 25);
          hit = true;
        }
      }
    }
    return hit;
  }

  update(dt, player, time) {
    this._shootCooldown = Math.max(0, this._shootCooldown - dt);
    this._punchCooldown = Math.max(0, this._punchCooldown - dt);
    for (const t of this.tracers) t.life -= dt;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      if (this.tracers[i].life <= 0) {
        this.scene.remove(this.tracers[i].line);
        this.tracers[i].line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    // enemies: advance, shoot, or punch
    for (const e of this.enemies) {
      if (e.dead) { e.deadTimer += dt; continue; }
      const p = e.humanoid.group.position;
      const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      e.shootTimer -= dt;
      if (d > 3 && d < 45) {
        // close in
        const sp = 3.2;
        p.x += (dx / d) * sp * dt;
        p.z += (dz / d) * sp * dt;
        e.phase += dt * sp * 2;
        e.humanoid.animate(e.phase, sp, false);
      } else if (d <= 3) {
        if (e.shootTimer <= 0) {
          e.shootTimer = 1.1;
          player.damage(8);
          this.audio.punch();
        }
        e.humanoid.idle(time);
      } else {
        e.humanoid.idle(time);
      }
      if (d < 45 && d > 4 && e.shootTimer <= 0) {
        e.shootTimer = 1.7;
        // enemy fires: 40% hit chance
        const from = p.clone().add(new THREE.Vector3(0, 1.4, 0));
        const to = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
        this._tracer(from, to, 0xff8866);
        this.audio.gunshot();
        if (Math.random() < 0.4) player.damage(7);
      }
      e.humanoid.group.rotation.y = Math.atan2(dx, dz);
    }
    // clean up long-dead enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].dead && this.enemies[i].deadTimer > 12) {
        this.scene.remove(this.enemies[i].humanoid.group);
        this.enemies.splice(i, 1);
      }
    }
  }
}
