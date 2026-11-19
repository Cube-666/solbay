// SOLBAY — save/load via localStorage: money, mission progress, position, health.
const KEY = 'solbay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch { return null; }
}

export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: state.money,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      playerX: state.playerX,
      playerZ: state.playerZ,
      health: state.health,
      savedAt: Date.now(),
    }));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
