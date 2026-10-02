/* Candidate-only presentation time. Never reads or mutates gameplay/RNG. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TRIAD_SCENE_CLOCK = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class SceneClock {
    constructor({ requestFrame, cancelFrame, onError = () => {} } = {}) {
      this.requestFrame = requestFrame; this.cancelFrame = cancelFrame; this.onError = onError;
      this.time = 0; this.lastWall = null; this.paused = true; this.frame = null;
      this.serial = 0; this.tasks = new Map(); this.actors = new Set(); this.after = new Set();
      this.stats = { frames: 0, callbacks: 0, errors: 0, maxPending: 0 };
    }
    safe(callback) { try { callback(this.time); } catch (error) { this.stats.errors++; this.onError(error); } }
    subscribe(callback) { this.actors.add(callback); return () => this.actors.delete(callback); }
    schedule(callback, delay = 0, scope = null) {
      const id = ++this.serial;
      this.tasks.set(id, { id, at: this.time + Math.max(0, Number(delay) || 0), callback, scope });
      this.stats.maxPending = Math.max(this.stats.maxPending, this.tasks.size);
      return id;
    }
    cancelScope(scope) { for (const [id, task] of this.tasks) if (task.scope === scope) this.tasks.delete(id); }
    cancel(id) { this.tasks.delete(id); }
    setPaused(value) {
      const changed = this.paused !== Boolean(value); this.paused = Boolean(value);
      if (changed) this.lastWall = null;
      if (this.paused && this.frame !== null) { this.cancelFrame?.(this.frame); this.frame = null; }
      if (!this.paused) this.arm();
    }
    arm() {
      if (this.paused || this.frame !== null || !this.requestFrame) return;
      this.frame = this.requestFrame(wall => { this.frame = null; this.step(wall); this.arm(); });
    }
    step(wall) {
      if (this.paused) { this.lastWall = null; return; }
      const delta = this.lastWall === null ? 0 : Math.max(0, wall - this.lastWall);
      this.lastWall = wall; this.time += delta; this.stats.frames++;
      for (const callback of [...this.actors]) this.safe(callback);
      // Snapshot prevents a callback that schedules itself at zero from starving input.
      const due = [...this.tasks.values()].filter(t => t.at <= this.time).sort((a, b) => a.at - b.at || a.id - b.id);
      for (const task of due) {
        if (!this.tasks.delete(task.id)) continue;
        this.stats.callbacks++; this.safe(task.callback);
      }
      for (const callback of [...this.after]) this.safe(callback);
    }
    snapshot() { return { time: this.time, paused: this.paused, pending: this.tasks.size, actors: this.actors.size, rafOwners: this.frame === null ? 0 : 1, ...this.stats }; }
  }
  function crossedEvents(events, previousFrame, currentFrame, fired) {
    return Object.entries(events || {}).filter(([name, frame]) => Number.isFinite(frame) && frame >= 0 && frame > previousFrame && frame <= currentFrame && !fired.has(name))
      .sort((a, b) => a[1] - b[1]).map(([name, frame]) => { fired.add(name); return { name, frame }; });
  }
  function releaseTime(clip) {
    const events = clip?.events || {};
    for (const name of ['release', 'projectile', 'skill', 'impact']) if (Number.isFinite(events[name])) return 1000 * events[name] / clip.fps;
    return clip ? Math.min(180, clip.frames * 1000 / clip.fps * .25) : 0;
  }
  return { SceneClock, crossedEvents, releaseTime };
});
