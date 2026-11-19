// SOLBAY — keyboard + mouse input.
// Held keys are polled (WASD, Shift, Space); one-shot presses (E, F, P, clicks)
// are queued on the event itself, so a fast press is never lost between slow frames.
export class Input {
  constructor() {
    this.keys = new Set();
    this._pressed = new Set();
    this._clicked = false;
    this.mouseDown = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this._onKeyDown = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this._pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'KeyM') this.onMute?.();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => { if (e.button === 0) { this.mouseDown = true; this._clicked = true; } };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onMouseMove = (e) => { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; };
    this._onBlur = () => { this.keys.clear(); this._pressed.clear(); };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
    this.onMute = null;
  }
  down(code) { return this.keys.has(code); }
  axis() {
    const f = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    const s = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    return { f, s };
  }
  get running() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  consumeMouse() {
    // cap per-frame deltas: a big accumulated jump (tab refocus, scripted mouse
    // moves) must not spin the camera around
    const dx = Math.max(-60, Math.min(60, this.mouseDX));
    const dy = Math.max(-60, Math.min(60, this.mouseDY));
    this.mouseDX = 0; this.mouseDY = 0; return { dx, dy };
  }
  /** One-shot press since the last call; consumed on read. */
  pressed(code) {
    if (this._pressed.has(code)) { this._pressed.delete(code); return true; }
    return false;
  }
  clicked() {
    if (this._clicked) { this._clicked = false; return true; }
    return false;
  }
}
