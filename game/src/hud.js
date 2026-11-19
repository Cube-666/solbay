// SOLBAY — HUD: mission tracker, money, wanted stars, health, speed, prompts,
// banners, and a live top-down minimap canvas.
import { ROAD_AT, CITY_HALF } from './city.js';

export class HUD {
  constructor() {
    this.el = {
      missionTitle: document.getElementById('mission-title'),
      missionObj: document.getElementById('mission-objective'),
      missionDist: document.getElementById('mission-distance'),
      money: document.getElementById('money'),
      wanted: document.getElementById('wanted'),
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      speed: document.getElementById('speed-value'),
      speedLabel: document.getElementById('speed-label'),
      prompt: document.getElementById('prompt'),
      banner: document.getElementById('banner'),
      bannerTitle: document.getElementById('banner-title'),
      bannerSub: document.getElementById('banner-sub'),
      crosshair: document.getElementById('crosshair'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this._bannerTimer = null;
  }

  setMission(title, objective, dist) {
    if (this.el.missionTitle.textContent !== title) this.el.missionTitle.textContent = title;
    this.el.missionObj.textContent = objective;
    this.el.missionDist.textContent = dist === null ? '' : `${dist} m`;
  }

  setMoney(n) { this.el.money.textContent = `$${Math.round(n).toLocaleString('en-US')}`; }

  setWanted(n) {
    const stars = '★'.repeat(n) + '☆'.repeat(5 - n);
    if (this.el.wanted.textContent !== stars) this.el.wanted.textContent = stars;
    this.el.wanted.className = n > 0 ? 'wanted-hot' : '';
  }

  setHealth(h) {
    const pct = Math.max(0, Math.min(100, Math.round(h)));
    this.el.healthFill.style.width = `${pct}%`;
    this.el.healthFill.style.background = pct > 50 ? '#34c759' : pct > 25 ? '#ffcc00' : '#ff3b30';
    this.el.healthText.textContent = `${pct}`;
  }

  setSpeed(kmh, inCar) {
    this.el.speed.textContent = inCar ? `${Math.round(kmh)}` : '';
    this.el.speedLabel.textContent = inCar ? 'km/h' : '';
    this.el.crosshair.style.display = inCar ? 'none' : 'block';
  }

  prompt(text) {
    this.el.prompt.textContent = text ?? '';
    this.el.prompt.style.display = text ? 'block' : 'none';
  }

  banner(title, sub = '', ms = 2600) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub;
    this.el.banner.style.display = 'block';
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => { this.el.banner.style.display = 'none'; }, ms);
  }

  drawMinimap(snap) {
    const ctx = this.mapCtx;
    const S = 200, RANGE = 260;
    const scale = S / (RANGE * 2);
    const toMap = (x, z) => [S / 2 + (x - snap.px) * scale, S / 2 + (z - snap.pz) * scale];
    ctx.clearRect(0, 0, S, S);
    // sea + sand at the bottom (south)
    ctx.fillStyle = '#14303e'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#1e6f8e';
    const [, seaY] = toMap(0, 240);
    if (seaY < S) ctx.fillRect(0, Math.max(0, seaY), S, S);
    ctx.fillStyle = '#e8d5a4';
    const [, sandY] = toMap(0, 196);
    if (sandY < S) ctx.fillRect(0, Math.max(0, sandY), S, Math.max(0, seaY - sandY));
    // city ground
    ctx.fillStyle = '#3d5a3a';
    ctx.fillRect(0, 0, S, S);
    // roads
    ctx.strokeStyle = '#55595e'; ctx.lineWidth = 5;
    for (const a of ROAD_AT) {
      const [x1] = toMap(a, 0); const [x2] = toMap(a, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      const [, y1] = toMap(0, a);
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(S, y1); ctx.stroke();
    }
    // mission marker
    if (snap.marker) {
      const [mx, my] = toMap(snap.marker.x, snap.marker.z);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 6, my);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    }
    // traffic cars
    ctx.fillStyle = '#e8e8e8';
    for (const c of snap.cars) {
      const [cx, cy] = toMap(c.x, c.z);
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    }
    // police
    ctx.fillStyle = '#3b82f6';
    for (const p of snap.police) {
      const [px, py] = toMap(p.x, p.z);
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // enemies
    ctx.fillStyle = '#ff3b30';
    for (const e of snap.enemies) {
      const [ex, ey] = toMap(e.x, e.z);
      ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow (north = up, heading: 0 = south/+z, PI = north)
    const [px, py] = toMap(snap.px, snap.pz);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - snap.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
  }
}
