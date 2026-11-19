// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import { readdirSync, readFileSync, statSync } from 'node:fs';

// Pre-flight gate check, written for this entry: mirrors the scorer's caps
// (reference/gate.json) so a bad build fails here in plain words instead of
// deep inside buildDossier. It only reads the source and prints; it writes
// nothing, so the dossier it guards stays byte for byte the library's.
const GATE = {
  gameMaxFiles: 993,
  gameMaxBytes: 48 * 1024 * 1024,
  gamePathMaxBytes: 1000,
  indexMaxBytes: 1024 * 1024,
  shotsMin: 3,
  shotsMax: 4,
  shotMaxBytes: 256 * 1024,
  shotLongMax: 1280,
  shotShortMin: 480,
};

function listFiles(dir, acc) {
  acc = acc || [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

// Width and height straight from the file header: PNG keeps them at bytes
// 16-23, JPEG in its first frame header (SOF0/1/2) past the length-prefixed
// segments. Returns null when the header is not a PNG or JPEG one.
function imageSize(file) {
  const buf = readFileSync(file);
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    let at = 2;
    while (at + 9 < buf.length) {
      if (buf[at] !== 0xff) { at += 1; continue; }
      const marker = buf[at + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf[at + 7] * 256 + buf[at + 8], height: buf[at + 5] * 256 + buf[at + 6] };
      }
      const len = buf[at + 2] * 256 + buf[at + 3];
      if (len < 2) break;
      at += 2 + len;
    }
  }
  return null;
}

function preflightFail(message) {
  throw new Error('pre-flight: ' + message);
}

function preflight(root) {
  const gameDir = join(root, 'game');
  const gameFiles = listFiles(gameDir);
  const gameBytes = gameFiles.reduce((sum, f) => sum + statSync(f).size, 0);
  if (gameFiles.length > GATE.gameMaxFiles) preflightFail('game/ has ' + gameFiles.length + ' files, cap is ' + GATE.gameMaxFiles);
  if (gameBytes > GATE.gameMaxBytes) preflightFail('game/ is ' + gameBytes + ' bytes, cap is ' + GATE.gameMaxBytes);
  for (const f of gameFiles) {
    const rel = f.slice(gameDir.length + 1);
    if (Buffer.byteLength(rel, 'utf8') > GATE.gamePathMaxBytes) preflightFail('path too long under game/: ' + rel);
  }
  const index = join(gameDir, 'index.html');
  if (!existsSync(index)) preflightFail('game/index.html is missing');
  const indexBytes = statSync(index).size;
  if (indexBytes > GATE.indexMaxBytes) preflightFail('game/index.html is ' + indexBytes + ' bytes, cap is ' + GATE.indexMaxBytes);
  const shotDir = join(root, 'screenshots');
  const shots = existsSync(shotDir)
    ? readdirSync(shotDir).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort()
    : [];
  if (shots.length < GATE.shotsMin || shots.length > GATE.shotsMax) {
    preflightFail('screenshots/ has ' + shots.length + ' images, need ' + GATE.shotsMin + '-' + GATE.shotsMax);
  }
  for (const name of shots) {
    const file = join(shotDir, name);
    const bytes = statSync(file).size;
    if (bytes > GATE.shotMaxBytes) preflightFail(name + ' is ' + bytes + ' bytes, cap is ' + GATE.shotMaxBytes);
    const dim = imageSize(file);
    if (!dim) preflightFail(name + ': could not read its dimensions');
    const long = Math.max(dim.width, dim.height);
    const short = Math.min(dim.width, dim.height);
    if (long > GATE.shotLongMax) preflightFail(name + ' is ' + dim.width + 'x' + dim.height + ', long side over ' + GATE.shotLongMax);
    if (short < GATE.shotShortMin) preflightFail(name + ' is ' + dim.width + 'x' + dim.height + ', short side under ' + GATE.shotShortMin);
  }
  console.log('pre-flight ok: game/ ' + gameFiles.length + ' files, ' + gameBytes + ' bytes, index.html ' + indexBytes + ' bytes; screenshots ' + shots.length + ' (' + shots.join(', ') + ')');
}

// After the dossier is written: confirm the output holds exactly the game,
// its screenshots and the dossier, and say how big the dossier is.
function summariseOutput(outDir) {
  const dossier = join(outDir, 'dossier.json');
  const dossierBytes = statSync(dossier).size;
  const top = readdirSync(outDir).sort();
  const expected = ['dossier.json', 'game', 'screenshots'];
  const extra = top.filter((n) => !expected.includes(n));
  const missing = expected.filter((n) => !top.includes(n));
  if (extra.length > 0) preflightFail('unexpected output entries: ' + extra.join(', '));
  if (missing.length > 0) preflightFail('missing output entries: ' + missing.join(', '));
  console.log('built: dossier.json ' + dossierBytes + ' bytes; output holds game/, screenshots/ and dossier.json');
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

preflight(here);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

summariseOutput(out);
