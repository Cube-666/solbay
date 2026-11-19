// SOLBAY — ambient life: NPC cars cruising the road grid + pedestrians on sidewalks.
// Traffic cars follow road centrelines, turn at intersections, and yield to the car ahead.
import * as THREE from 'three';
import { rand, randInt, pick, clamp } from './util.js';
import { createCar } from './vehicles.js';
import { createHumanoid } from './character.js';
import { ROAD_AT } from './city.js';

export class TrafficSystem {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.cars = [];
    this.peds = [];
    this._spawnCars(12);
    this._spawnPeds(16);
  }

  _spawnCars(n) {
    const types = ['sedan', 'sedan', 'sedan', 'taxi', 'taxi', 'sport', 'truck'];
    for (let i = 0; i < n; i++) {
      const type = pick(types);
      const car = createCar(type);
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const at = pick(ROAD_AT);
      const along = rand(-180, 180);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const lane = (Math.random() < 0.5 ? -2.6 : 2.6) * dir;
      car.group.position.set(axis === 'x' ? along : at + lane, 0, axis === 'x' ? at + lane : along);
      car.group.rotation.y = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      this.scene.add(car.group);
      this.cars.push({
        car, axis, at, along, dir, lane,
        speed: rand(8, 13), targetSpeed: rand(8, 13),
        phase: Math.random() * 10, stopped: 0,
      });
    }
  }

  _spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const h = createHumanoid({ cap: Math.random() < 0.4 ? pick([0xc0392b, 0x2471a3, 0xf1c40f, 0x111111]) : null });
      const road = pick(ROAD_AT);
      const along = rand(-180, 180);
      const side = Math.random() < 0.5 ? 8 : -8;
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const x = axis === 'x' ? along : road + side;
      const z = axis === 'x' ? road + side : along;
      h.group.position.set(x, 0, z);
      this.scene.add(h.group);
      this.peds.push({
        humanoid: h, axis, at: road, side, along,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: rand(1.0, 1.7), phase: Math.random() * 10,
        fleeing: 0, health: 100, dead: false,
      });
    }
  }

  // nearest drivable car to a point (for E — enter / steal)
  nearestCar(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const t of this.cars) {
      const p = t.car.group.position;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best ? { traffic: best, dist: bestD } : null;
  }

  removeTrafficCar(t) {
    const i = this.cars.indexOf(t);
    if (i >= 0) this.cars.splice(i, 1);
    // keep the streets alive: respawn a fresh car far from the player
    setTimeout(() => this._spawnCars(1), 4000);
  }

  update(dt, playerPos, playerSpeed, time) {
    // ---- cars ----
    for (const t of this.cars) {
      if (t.stopped > 0) { t.stopped -= dt; continue; }
      // car ahead on the same road + lane: slow down
      let ahead = Infinity;
      for (const o of this.cars) {
        if (o === t || o.axis !== t.axis || o.at !== t.at || Math.sign(o.lane) !== Math.sign(t.lane)) continue;
        const gap = (o.along - t.along) * t.dir;
        if (gap > 0 && gap < ahead) ahead = gap;
      }
      const target = ahead < 9 ? 0 : t.targetSpeed;
      t.speed += (target - t.speed) * Math.min(1, dt * 2);
      t.along += t.dir * t.speed * dt;
      // wrap around the city edge
      if (t.along > 195) t.along = -195;
      if (t.along < -195) t.along = 195;
      // intersection: sometimes turn onto the crossing road
      for (const cross of ROAD_AT) {
        if (Math.abs(t.along - cross) < 1.2 && Math.random() < 0.004) {
          const oldAxis = t.axis;
          t.axis = oldAxis === 'x' ? 'z' : 'x';
          t.at = cross;
          t.along = t.at;
          // keep the lane side relative to the new direction of travel
          t.dir = Math.random() < 0.5 ? 1 : -1;
          t.lane = (Math.random() < 0.5 ? -2.6 : 2.6) * t.dir;
          break;
        }
      }
      const p = t.car.group.position;
      p.x = t.axis === 'x' ? t.along : t.at + t.lane;
      p.z = t.axis === 'x' ? t.at + t.lane : t.along;
      const targetYaw = t.axis === 'x' ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
      t.car.group.rotation.y = targetYaw;
      const spin = t.speed * dt / 0.36;
      for (const w of t.car.wheels) w.mesh.rotation.x += spin;
    }
    // ---- pedestrians ----
    for (const p of this.peds) {
      if (p.dead) continue;
      // flee from a fast car or gunfire nearby
      if (p.fleeing > 0) {
        p.fleeing -= dt;
        p.speed = 3.4;
      } else {
        p.speed = 1.3;
      }
      p.along += p.dir * p.speed * dt;
      if (p.along > 192 || p.along < -192) { p.dir *= -1; p.along = clamp(p.along, -192, 192); }
      if (Math.random() < 0.0006) p.dir *= -1;
      const g = p.humanoid.group;
      g.position.x = p.axis === 'x' ? p.along : p.at + p.side;
      g.position.z = p.axis === 'x' ? p.at + p.side : p.along;
      const yaw = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      g.rotation.y = yaw;
      p.phase += dt * p.speed * 2.2;
      p.humanoid.animate(p.phase, p.speed, p.fleeing > 0);
    }
  }

  scarePeds(x, z, radius) {
    for (const p of this.peds) {
      if (p.dead) continue;
      const g = p.humanoid.group.position;
      if (Math.hypot(g.x - x, g.z - z) < radius) p.fleeing = 3;
    }
  }
}
