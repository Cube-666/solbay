// SOLBAY — player controller: third-person on foot + arcade driving, enter/exit cars.
// Collision is circle-vs-AABB against the city's colliders; water is fenced off.
import * as THREE from 'three';
import { clamp, angleLerp, dist2d } from './util.js';
import { createPlayerHumanoid } from './character.js';

export const SEA_LIMIT_Z = 236;

export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
      }
    }
  }
  return { x, z };
}

export class Player {
  constructor(scene, colliders, audio) {
    this.scene = scene;
    this.colliders = colliders;
    this.audio = audio;
    this.humanoid = createPlayerHumanoid();
    this.group = this.humanoid.group;
    scene.add(this.group);
    this.pos = new THREE.Vector3(0, 0, 178);
    this.heading = Math.PI; // facing north (toward -z? +z is south/beach; face the city)
    this.camYaw = Math.PI;
    this.speed = 0;
    this.walkPhase = 0;
    this.health = 100;
    this.money = 0;
    this.inCar = null; // car object from vehicles/traffic
    this.driveSpeed = 0;
    this.steer = 0;
    this.dead = false;
    this.group.position.copy(this.pos);
  }

  teleport(x, z, heading = null) {
    this.pos.set(x, 0, z);
    if (heading !== null) { this.heading = heading; this.camYaw = heading; }
    if (this.inCar) {
      this.inCar.group.position.set(x, 0, z);
      this.inCar.group.rotation.y = this.heading;
    }
    this.group.position.copy(this.pos);
  }

  damage(amount) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) { this.dead = true; }
  }

  heal(amount) { this.health = Math.min(100, this.health + amount); }

  update(dt, input, camera, wanted) {
    if (this.dead) return;
    if (this.inCar) this.updateDriving(dt, input, camera);
    else this.updateOnFoot(dt, input, camera);
    // camera follow
    const camDist = this.inCar ? 11 : 7.5;
    const camHeight = this.inCar ? 4.2 : 3.4;
    const cx = this.pos.x - Math.sin(this.camYaw) * camDist;
    const cz = this.pos.z - Math.cos(this.camYaw) * camDist;
    camera.position.lerp(new THREE.Vector3(cx, camHeight, cz), 1 - Math.pow(0.001, dt));
    camera.lookAt(this.pos.x, this.inCar ? 1.6 : 1.5, this.pos.z);
    // mouse orbit: drag rotates camera yaw
    const { dx } = input.consumeMouse();
    if (Math.abs(dx) > 0.5) this.camYaw -= dx * 0.004;
    // camera eases back behind the player while moving
    const moving = this.inCar ? Math.abs(this.driveSpeed) > 2 : this.speed > 0.5;
    if (moving && Math.abs(dx) < 0.5) {
      const target = this.inCar ? this.inCar.group.rotation.y : this.heading;
      this.camYaw = angleLerp(this.camYaw, target, 1 - Math.pow(0.05, dt));
    }
    // slow health regen on foot, not while wanted
    if (!this.inCar && wanted === 0) this.heal(dt * 2);
  }

  updateOnFoot(dt, input, camera) {
    const { f, s } = input.axis();
    const run = input.running;
    const targetSpeed = (f !== 0 || s !== 0) ? (run ? 8.5 : 4.2) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
    if (this.speed > 0.1) {
      const moveAngle = this.camYaw + Math.atan2(s, f);
      this.heading = angleLerp(this.heading, moveAngle, Math.min(1, dt * 12));
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
      const res = collideCircle(this.colliders, nx, nz, 0.5);
      this.pos.x = res.x; this.pos.z = clamp(res.z, -196, SEA_LIMIT_Z);
      this.walkPhase += dt * this.speed * 1.6;
      this.humanoid.animate(this.walkPhase, this.speed, run);
    } else {
      this.humanoid.idle(performance.now() / 1000);
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  updateDriving(dt, input, camera) {
    const car = this.inCar;
    const { f, s } = input.axis();
    const top = car.topSpeed;
    const accel = f > 0 ? car.accel : f < 0 ? car.accel * 0.8 : 0;
    const braking = input.down('Space');
    if (f > 0) this.driveSpeed += accel * dt;
    else if (f < 0) this.driveSpeed -= accel * 0.7 * dt;
    else this.driveSpeed -= Math.sign(this.driveSpeed) * Math.min(Math.abs(this.driveSpeed), 6 * dt);
    if (braking) this.driveSpeed -= Math.sign(this.driveSpeed) * Math.min(Math.abs(this.driveSpeed), 22 * dt);
    this.driveSpeed = clamp(this.driveSpeed, -top * 0.45, top);
    // steering: stronger at low speed, inverted when reversing
    const steerTarget = -s * 0.55 * clamp(1 - Math.abs(this.driveSpeed) / (top * 1.4), 0.35, 1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    const heading = car.group.rotation.y;
    const newHeading = heading + (this.steer * this.driveSpeed * dt) / 2.6;
    car.group.rotation.y = newHeading;
    const nx = car.group.position.x + Math.sin(newHeading) * this.driveSpeed * dt;
    const nz = car.group.position.z + Math.cos(newHeading) * this.driveSpeed * dt;
    const res = collideCircle(this.colliders, nx, nz, 1.6);
    const hitWall = Math.abs(res.x - nx) > 0.01 || Math.abs(res.z - nz) > 0.01;
    if (hitWall && Math.abs(this.driveSpeed) > 8) {
      this.audio.crash();
      this.driveSpeed *= 0.35;
      this.damage(4);
    } else if (hitWall) {
      this.driveSpeed *= 0.6;
    }
    car.group.position.x = res.x;
    car.group.position.z = clamp(res.z, -196, SEA_LIMIT_Z);
    this.pos.copy(car.group.position);
    // wheels: spin + front steer
    const spin = this.driveSpeed * dt / 0.36;
    for (const w of car.wheels) {
      w.mesh.rotation.x += spin;
      if (w.steer) w.mesh.rotation.y = this.steer * 0.9;
    }
    // engine sound
    this.audio.startEngine(Math.abs(this.driveSpeed) / top);
    // player hidden inside the car
    this.group.visible = false;
  }

  enterCar(car) {
    this.inCar = car;
    this.driveSpeed = 0;
    this.group.visible = false;
    this.audio.ensure();
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    this.inCar = null;
    this.driveSpeed = 0;
    this.audio.stopEngine();
    // step out to the driver's side
    const h = car.group.rotation.y;
    const px = car.group.position.x + Math.cos(h) * 1.8;
    const pz = car.group.position.z - Math.sin(h) * 1.8;
    const res = collideCircle(this.colliders, px, pz, 0.5);
    this.pos.set(res.x, 0, clamp(res.z, -196, SEA_LIMIT_Z));
    this.group.position.copy(this.pos);
    this.group.visible = true;
  }
}
