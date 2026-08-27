/* audio.js — efectos de sonido sintéticos, uno por evento del motor.
   Sin música en loop a propósito: solo blips cortos que se apagan solos. */
(function (T) {
  'use strict';

  // Cada preset: frecuencia inicial, final, duración (s), onda, ganancia relativa
  var SFX = {
    move:     { f: 180, f2: 180, d: 0.03, w: 'square',   g: 0.35 },
    rotate:   { f: 320, f2: 360, d: 0.04, w: 'square',   g: 0.40 },
    rotate180:{ f: 300, f2: 420, d: 0.06, w: 'square',   g: 0.45 },
    softdrop: { f: 140, f2: 130, d: 0.02, w: 'square',   g: 0.22 },
    harddrop: { f: 110, f2: 60,  d: 0.08, w: 'sawtooth', g: 0.55 },
    lock:     { f: 200, f2: 150, d: 0.05, w: 'triangle', g: 0.40 },
    hold:     { f: 420, f2: 520, d: 0.06, w: 'triangle', g: 0.45 },
    single:   { f: 480, f2: 560, d: 0.12, w: 'triangle', g: 0.55 },
    double:   { f: 520, f2: 640, d: 0.14, w: 'triangle', g: 0.60 },
    triple:   { f: 580, f2: 720, d: 0.16, w: 'triangle', g: 0.65 },
    tetris:   { f: 720, f2: 980, d: 0.22, w: 'triangle', g: 0.75 },
    tspin:    { f: 640, f2: 900, d: 0.20, w: 'sine',     g: 0.70 },
    perfect:  { f: 880, f2: 1320,d: 0.35, w: 'sine',     g: 0.80 },
    combo:    { f: 660, f2: 880, d: 0.09, w: 'square',   g: 0.45 },
    levelup:  { f: 660, f2: 990, d: 0.18, w: 'triangle', g: 0.70 },
    gameover: { f: 220, f2: 70,  d: 0.45, w: 'sawtooth', g: 0.70 },
    countdown:{ f: 520, f2: 520, d: 0.08, w: 'square',   g: 0.45 },
    go:       { f: 780, f2: 900, d: 0.16, w: 'triangle', g: 0.60 },
    menu:     { f: 400, f2: 460, d: 0.04, w: 'square',   g: 0.30 },
    danger:   { f: 160, f2: 120, d: 0.10, w: 'sawtooth', g: 0.35 }
  };

  function Audio(opts) {
    opts = opts || {};
    this.enabled = opts.enabled !== false;
    this.volume = (opts.volume === undefined) ? 0.5 : opts.volume;
    this.ctx = null;
    this.bus = opts.bus || null;      // los tests inyectan un bus falso
    this.played = [];                 // registro para verificación
    this.ctor = opts.ctor || (typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null);
  }

  Audio.prototype.setEnabled = function (on) { this.enabled = !!on; if (!on) this.suspend(); };
  Audio.prototype.setVolume = function (v) { this.volume = Math.max(0, Math.min(1, Number(v) || 0)); };

  Audio.prototype.ensure = function () {
    if (this.bus) return true;
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
      return true;
    }
    if (!this.ctor) return false;
    try { this.ctx = new this.ctor(); return true; } catch (e) { return false; }
  };

  Audio.prototype.suspend = function () {
    try { if (this.ctx && this.ctx.state === 'running' && this.ctx.suspend) this.ctx.suspend(); } catch (e) {}
  };

  /** Reproduce un preset por nombre. Devuelve true si sonó (o si se registró en el bus). */
  Audio.prototype.play = function (name, detune) {
    var p = SFX[name];
    if (!p) return false;
    if (!this.enabled || this.volume <= 0) return false;
    this.played.push(name);
    if (this.bus) { this.bus(name, p); return true; }
    if (!this.ensure()) return false;
    try {
      var ctx = this.ctx, now = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = p.w;
      var mul = detune ? Math.pow(2, detune / 12) : 1;
      o.frequency.setValueAtTime(p.f * mul, now);
      if (p.f2 !== p.f && o.frequency.exponentialRampToValueAtTime) {
        o.frequency.exponentialRampToValueAtTime(Math.max(20, p.f2 * mul), now + p.d);
      }
      var vol = Math.max(0.0001, p.g * this.volume * 0.16);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
      o.connect(g); g.connect(ctx.destination);
      o.start(now);
      o.stop(now + p.d + 0.02);
      return true;
    } catch (e) { return false; }
  };

  /** Traduce un evento del motor al sonido que le corresponde. */
  Audio.prototype.onEvent = function (ev) {
    switch (ev.type) {
      case 'move': return this.play('move');
      case 'rotate': return this.play(ev.dir === 2 ? 'rotate180' : 'rotate');
      case 'softdrop': return this.play('softdrop');
      case 'harddrop': return this.play('harddrop');
      case 'lock': return this.play('lock');
      case 'hold': return this.play('hold');
      case 'levelup': return this.play('levelup');
      case 'gameover': return this.play('gameover');
      case 'clear':
        if (ev.perfect) return this.play('perfect');
        if (ev.tspin) return this.play('tspin');
        return this.play(['', 'single', 'double', 'triple', 'tetris'][ev.n]);
      default: return false;
    }
  };

  Audio.prototype.lastPlayed = function () { return this.played[this.played.length - 1] || null; };
  Audio.prototype.clearLog = function () { this.played = []; };

  T.Audio = Audio;
  T.SFX = SFX;

  /* ---------- vibración háptica ---------- */
  T.Haptics = {
    enabled: true,
    nav: (typeof navigator !== 'undefined') ? navigator : null,
    patterns: { lock: 8, clear: [0, 18, 40, 18], tetris: [0, 30, 50, 30, 50, 30], gameover: [0, 60, 80, 120], hold: 6 },
    fire: function (kind) {
      if (!this.enabled) return false;
      var n = this.nav;
      if (!n || typeof n.vibrate !== 'function') return false;
      var p = this.patterns[kind];
      if (p === undefined) return false;
      try { n.vibrate(p); return true; } catch (e) { return false; }
    }
  };

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
