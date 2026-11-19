// SOLBAY — boot + game loop: a sun-soaked open-world crime game in Solbay.
// Screens: title → playing ⇄ paused → busted / wasted → playing.
// ?shot=drive|walk|chase|mission stages a scene and sets window.__shotReady.
import * as THREE from 'three';
import { buildCity, CITY_HALF } from './city.js';
import { Player, SEA_LIMIT_Z } from './player.js';
import { TrafficSystem } from './traffic.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { CombatSystem } from './combat.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { clamp } from './util.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const lowfx = params.get('lowfx') === '1'; // headless testing: no shadows/AA, faster frames

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowfx });
renderer.setPixelRatio(lowfx ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !lowfx;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0xa8c8e0, 200, 750);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(0, 4, 190);

// ---- sun, sky, clouds ----
const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 700;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.85);
scene.add(hemi);

const clouds = [];
{
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 12; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 8, 8, 6), cloudMat);
      s.position.set(j * 8 - 12 + Math.random() * 4, Math.random() * 3, Math.random() * 6);
      s.scale.y = 0.45;
      cl.add(s);
    }
    cl.position.set((Math.random() - 0.5) * 600, 95 + Math.random() * 45, (Math.random() - 0.5) * 600);
    scene.add(cl);
    clouds.push(cl);
  }
  // the sun disc
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(22, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
  sunDisc.position.set(320, 260, -420);
  sunDisc.lookAt(camera.position);
  scene.add(sunDisc);
}

// ---- world + systems ----
const city = buildCity(scene);
const audio = new AudioEngine();
const input = new Input();
const hud = new HUD();
const player = new Player(scene, city.colliders, audio);
const traffic = new TrafficSystem(scene, city.colliders);
const police = new PoliceSystem(scene, city.colliders, audio, () => bustPlayer('BUSTED'));
const combat = new CombatSystem(scene, audio, police, traffic);
const missions = new MissionSystem(scene, audio, {
  police,
  combat,
  onObjective: (m, o) => hud.prompt(null),
  onMissionComplete: (m) => {
    player.money += m.reward;
    hud.banner('Mission complete', `${m.title}  •  +$${m.reward}`);
    saveGame();
  },
  onStoryComplete: () => {
    hud.banner('Story complete!', 'You own Solbay now, Dario. Free roam — the city is yours.');
    saveGame();
  },
});

const looseCars = []; // cars the player stole or drove: stay enterable after exit

// ---- screens / state ----
let state = 'title'; // title | playing | paused | busted | wasted
let saveData = loadSave();
let saveTimer = 0;

const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  end: document.getElementById('screen-end'),
};
const endTitle = document.getElementById('end-title');
const endSub = document.getElementById('end-sub');
const continueBtn = document.getElementById('btn-continue');
if (saveData) continueBtn.style.display = 'inline-block';

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.style.display = k === name ? 'flex' : 'none';
}

function startGame(fromSave) {
  audio.ensure();
  audio.startMusic();
  if (fromSave && saveData) {
    player.money = saveData.money ?? 0;
    player.health = saveData.health ?? 100;
    player.teleport(saveData.playerX ?? 0, saveData.playerZ ?? 178);
    missions.restore(saveData.missionIndex ?? 0);
  } else {
    player.money = 0;
    player.health = 100;
    player.teleport(0, 178, Math.PI);
    missions.start();
  }
  state = 'playing';
  showScreen(null);
  hud.banner('SOLBAY', 'Welcome to Solbay — make a name for yourself, Dario.', 3200);
}

document.getElementById('btn-start').addEventListener('click', () => startGame(false));
continueBtn.addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => { state = 'playing'; showScreen(null); });
document.getElementById('btn-restart').addEventListener('click', () => {
  player.health = 100; player.dead = false;
  player.teleport(140, 28, Math.PI);
  police.clearWanted();
  state = 'playing'; showScreen(null);
});

input.onMute = () => {
  audio.setMuted(!audio.muted);
  hud.banner(audio.muted ? 'Sound off' : 'Sound on', '', 1200);
};

function saveGame() {
  writeSave({
    money: player.money,
    missionIndex: missions.index,
    missionsDone: missions.done,
    playerX: player.pos.x,
    playerZ: player.pos.z,
    health: player.health,
  });
}

function bustPlayer(kind) {
  audio.busted();
  if (player.inCar) player.exitCar();
  player.money = Math.floor(player.money * 0.9);
  player.health = 100;
  player.dead = false;
  police.clearWanted();
  player.teleport(140, 28, Math.PI);
  state = kind === 'BUSTED' ? 'busted' : 'wasted';
  endTitle.textContent = kind;
  endSub.textContent = kind === 'BUSTED'
    ? 'The Solbay PD caught up with you. You paid a fine and walked out of the hospital — 10% lighter.'
    : 'You got wasted. The hospital patched you up — for a 10% fee.';
  showScreen('end');
}

// ---- entering / stealing cars ----
function nearestEnterable(x, z, maxDist) {
  let best = null, bestD = maxDist, bestId = null;
  const t = traffic.nearestCar(x, z, maxDist);
  if (t) { best = t.traffic.car; bestD = t.dist; bestId = null; }
  for (const s of missions.specialCars) {
    const p = s.car.group.position;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { best = s.car; bestD = d; bestId = s.id; }
  }
  for (const car of looseCars) {
    const p = car.group.position;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { best = car; bestD = d; bestId = null; }
  }
  return best ? { car: best, dist: bestD, id: bestId } : null;
}

function tryEnterExitCar() {
  if (player.inCar) {
    player.exitCar();
    return;
  }
  const near = nearestEnterable(player.pos.x, player.pos.z, 3.6);
  if (!near) return;
  if (near.id) {
    // mission car: the taxi is a legit fare, the Comet is a steal
    const spec = missions.specialCarById(near.id);
    if (spec) spec.taken = true;
    if (near.id === 'comet') police.addWanted(1, 'car stolen');
    player.enterCar(near.car);
    missions.onEnterCar(near.id);
    audio.click();
  } else {
    // traffic or loose car: stealing it is a crime (unless it is already ours)
    const isLoose = looseCars.includes(near.car);
    if (!isLoose) {
      // find + remove the traffic wrapper, if any
      const t = traffic.cars.find(c => c.car === near.car);
      if (t) traffic.removeTrafficCar(t);
      looseCars.push(near.car);
      police.addWanted(1, 'car stolen');
      hud.banner('Car stolen', 'The cops noticed that. Lose them.', 2200);
    }
    player.enterCar(near.car);
    audio.click();
  }
}

// ---- staging for screenshots (?shot=...) ----
function stageShot(kind) {
  startGame(false);
  if (kind === 'drive') {
    player.enterCar(missions.specialCarById('taxi').car);
    player.teleport(0, 150, 0); // face south: mission beacon + marina ahead
    player.driveSpeed = 14;
    police.addWanted(1, 'staged');
    traffic.update(0.1, player.pos, 0, 1);
  } else if (kind === 'walk') {
    player.teleport(-10, 56, Math.PI * 0.75);
    traffic.update(0.1, player.pos, 0, 1);
  } else if (kind === 'chase') {
    const comet = missions.specialCarById('comet').car;
    player.enterCar(comet);
    player.teleport(0, 100, Math.PI);
    player.driveSpeed = 24;
    police.addWanted(3, 'staged');
    for (let i = 0; i < 2; i++) police._spawnCruiserNear(player.pos.x, player.pos.z);
  } else if (kind === 'mission') {
    missions.restore(3);
    missions._nextObjective(); // advance to "eliminate the Harbor crew": thugs spawn
    player.teleport(140, -168, 0); // south edge of the Port, facing SOUTH into the yard + Harbor crew (yard is at z -150..-140, i.e. south of here)
  }
  state = 'playing';
  showScreen(null);
}

// ---- main loop ----
const clock = new THREE.Clock();
let framesRendered = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // sun + shadow follow the player
  sun.position.set(player.pos.x + 160, 240, player.pos.z + 110);
  sun.target.position.set(player.pos.x, 0, player.pos.z);
  sun.target.updateMatrixWorld();
  // clouds drift
  for (const cl of clouds) {
    cl.position.x += dt * 1.2;
    if (cl.position.x > 350) cl.position.x = -350;
  }
  // sea shimmer
  city.sea.position.y = 0.05 + Math.sin(time * 0.7) * 0.06;

  if (state === 'playing') {
    // pause (one-shot presses are queued, never lost between frames)
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      state = 'paused'; showScreen('pause'); saveGame();
    }
    // enter / exit car
    if (input.pressed('KeyE')) tryEnterExitCar();
    // punch
    if (input.pressed('KeyF')) combat.playerPunch(player);
    // shoot on click
    if (input.clicked()) combat.playerShoot(camera, player);

    player.update(dt, input, camera, police.wanted);
    traffic.update(dt, player.pos, player.driveSpeed, time);
    police.update(dt, player, time);
    missions.update(dt, player, time);
    combat.update(dt, player, time);

    if (player.dead) bustPlayer('WASTED');

    // HUD
    const m = missions.currentMission();
    hud.setMission(m ? m.title : 'SOLBAY', missions.objectiveText(), missions.objectiveDistance(player));
    hud.setMoney(player.money);
    hud.setWanted(police.wanted);
    hud.setHealth(player.health);
    hud.setSpeed(Math.abs(player.driveSpeed) * 3.6, !!player.inCar);
    // context prompt
    if (!player.inCar) {
      const near = nearestEnterable(player.pos.x, player.pos.z, 3.6);
      hud.prompt(near ? 'E — Get in the car' : '');
    } else {
      hud.prompt('E — Get out   •   Space — Handbrake');
    }
    hud.drawMinimap({
      px: player.pos.x, pz: player.pos.z, heading: player.heading,
      marker: missions._marker ? { x: missions._marker.x, z: missions._marker.z } : null,
      cars: traffic.cars.map(t => ({ x: t.car.group.position.x, z: t.car.group.position.z })),
      police: police.cruisers.map(c => ({ x: c.car.group.position.x, z: c.car.group.position.z })),
      enemies: combat.aliveEnemies().map(e => ({ x: e.humanoid.group.position.x, z: e.humanoid.group.position.z })),
    });
    // autosave
    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; saveGame(); }
  }

  renderer.render(scene, camera);
  framesRendered++;
  if (shotParam && framesRendered === 3) window.__shotReady = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- debug hook for playtests ----
window.__solbay = {
  version: 'solbay-1.0',
  get state() { return state; },
  get cameraPos() { return [Math.round(camera.position.x), Math.round(camera.position.y), Math.round(camera.position.z)]; },
  player, missions, police, traffic, combat, city,
  teleport: (x, z, h) => player.teleport(x, z, h),
  setWanted: (n) => { police.wanted = n; },
  enterNearestCar: () => tryEnterExitCar(),
  startMission: (i) => missions.restore(i),
  get ready() { return framesRendered > 2; },
  saveGame,
};

if (shotParam) {
  stageShot(shotParam);
} else {
  showScreen('title');
  // slow orbit behind the title screen
  const orbit = () => {
    if (state !== 'title') return;
    const t = clock.elapsedTime * 0.05;
    camera.position.set(Math.sin(t) * 220, 90, Math.cos(t) * 220 - 40);
    camera.lookAt(0, 20, 0);
    requestAnimationFrame(orbit);
  };
  orbit();
}
animate();
