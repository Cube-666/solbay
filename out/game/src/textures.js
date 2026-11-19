// SOLBAY — procedural textures: building facades, roads, sidewalks, beach.
// Everything is drawn on canvas at runtime: no external image files, no network.
import { canvasTexture, rand, randInt, pick } from './util.js';

const FACADE_BASE = ['#d8c9a3', '#c9b8a0', '#b7c4cc', '#d9b48f', '#a8b8a0', '#cbb6c4', '#e0d6c0', '#9fb4c0'];
const FACADE_TRIM = ['#8a7a5f', '#6f7d84', '#7a6a55', '#5f6f78', '#7d8a6f'];
const GLASS = ['#2e4a5e', '#3a5a6e', '#22384a', '#4a6a7a', '#2a3e52'];

function drawFacade(ctx, w, h, base, trim, glass, cols, rows, litRatio) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  // subtle vertical grime / panel lines
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 12; i++) ctx.fillRect(rand(0, w), 0, rand(2, 8), h);
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.18, y = r * ch + ch * 0.16;
      const ww = cw * 0.64, hh = ch * 0.62;
      const lit = Math.random() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : pick(GLASS);
      ctx.fillRect(x, y, ww, hh);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, ww, hh * 0.28);
      ctx.strokeStyle = trim; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, ww, hh);
    }
  }
  // ground-floor shopfront band
  ctx.fillStyle = trim; ctx.fillRect(0, h - ch * 0.9, w, ch * 0.9);
  ctx.fillStyle = '#1c2a34';
  for (let c = 0; c < cols; c++) ctx.fillRect(c * cw + cw * 0.12, h - ch * 0.72, cw * 0.76, ch * 0.5);
  // neon shop sign strip
  const neon = pick(['#ff5ea8', '#37e0c8', '#ffb347', '#7ab8ff', '#ff6b5e']);
  ctx.fillStyle = neon; ctx.fillRect(0, h - ch * 1.02, w, 5);
}

export function makeBuildingTextures(THREE) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const base = pick(FACADE_BASE), trim = pick(FACADE_TRIM);
    const cols = randInt(4, 8), rows = randInt(6, 14);
    out.push(canvasTexture(THREE, 256, 512, (ctx, w, h) =>
      drawFacade(ctx, w, h, base, trim, pick(GLASS), cols, rows, 0.12)));
  }
  return out;
}

export function makeRoadTexture(THREE) {
  return canvasTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#40444a'; ctx.fillRect(0, 0, w, h);
    // asphalt noise
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${randInt(0, 60)},${randInt(0, 60)},${randInt(0, 60)},0.25)`;
      ctx.fillRect(rand(0, w), rand(0, h), 2, 2);
    }
    // edge lines
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(6, 0, 3, h); ctx.fillRect(w - 9, 0, 3, h);
    // centre dashes
    ctx.fillStyle = '#f5d76e';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 3, y + 8, 6, 34);
  }, 1, 8);
}

export function makeSidewalkTexture(THREE) {
  return canvasTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9b3a4'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
    }
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(rand(0, w), rand(0, h), 2, 2);
    }
  }, 6, 6);
}

export function makeGrassTexture(THREE) {
  return canvasTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5d8a4a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = pick(['#4c7a3e', '#6b9a55', '#557f43']);
      ctx.fillRect(rand(0, w), rand(0, h), 3, 3);
    }
  }, 24, 24);
}

export function makeSandTexture(THREE) {
  return canvasTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8d5a4'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = pick(['#dcc793', '#f2e2b6', '#d0bd85']);
      ctx.fillRect(rand(0, w), rand(0, h), 2, 2);
    }
  }, 10, 10);
}

export function makePlazaTexture(THREE) {
  return canvasTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c8bfa8'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,90,40,0.5)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 90, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 50, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
    }
  }, 2, 2);
}
