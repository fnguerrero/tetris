/* effects.js — partículas, screen shake, estelas y mensajes flotantes.
   Estado puro con update(dt): se verifica sin canvas. */
(function (T) {
  'use strict';

  function Effects(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.settings = opts.settings || { particles: true, shake: true };
    this.particles = [];
    this.trails = [];
    this.messages = [];
    this.shake = { x: 0, y: 0, power: 0 };
    this.flash = 0;              // 0..1, destello blanco al borrar líneas
    this.maxParticles = opts.maxParticles || 260;
  }

  Effects.prototype.clear = function () {
    this.particles.length = 0;
    this.trails.length = 0;
    this.messages.length = 0;
    this.shake = { x: 0, y: 0, power: 0 };
    this.flash = 0;
  };

  /** Explosión de partículas a lo ancho de una fila borrada. */
  Effects.prototype.burstRow = function (row, colors, cols) {
    if (!this.settings.particles) return 0;
    cols = cols || T.COLS;
    var made = 0;
    for (var x = 0; x < cols; x++) {
      var color = colors && colors[x] ? colors[x] : '#ffffff';
      for (var i = 0; i < 3; i++) {
        if (this.particles.length >= this.maxParticles) break;
        this.particles.push({
          x: x + this.rng(), y: row + this.rng(),
          vx: (this.rng() - 0.5) * 9, vy: -this.rng() * 7 - 1.5,
          life: 1, decay: 0.9 + this.rng() * 0.9, size: 0.16 + this.rng() * 0.2,
          color: color
        });
        made++;
      }
    }
    return made;
  };

  Effects.prototype.addShake = function (power) {
    if (!this.settings.shake) return 0;
    this.shake.power = Math.min(1.6, this.shake.power + power);
    return this.shake.power;
  };

  /** Estela vertical del hard drop, en coordenadas de celda. */
  Effects.prototype.addTrail = function (cells, fromY, toY, color) {
    if (toY <= fromY) return 0;
    for (var i = 0; i < cells.length; i++) {
      this.trails.push({ x: cells[i][0], y0: fromY + (cells[i][1] - toY), y1: cells[i][1], life: 1, color: color });
    }
    return this.trails.length;
  };

  Effects.prototype.addFlash = function (amount) {
    this.flash = Math.min(1, this.flash + (amount === undefined ? 0.6 : amount));
    return this.flash;
  };

  Effects.prototype.addMessage = function (text, kind) {
    var style = T.MSG_STYLE[kind] || { color: '#e8ecff' };
    this.messages.push({ text: text, kind: kind, color: style.color, life: 1, y: 0 });
    if (this.messages.length > 3) this.messages.shift();
    return this.messages[this.messages.length - 1];
  };

  Effects.prototype.update = function (dt) {
    var s = dt / 1000;

    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.vy += 26 * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.life -= p.decay * s;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (var j = this.trails.length - 1; j >= 0; j--) {
      this.trails[j].life -= s * 3.2;
      if (this.trails[j].life <= 0) this.trails.splice(j, 1);
    }

    for (var k = this.messages.length - 1; k >= 0; k--) {
      var m = this.messages[k];
      m.life -= s * 0.95;
      m.y = (1 - m.life) * 26;
      if (m.life <= 0) this.messages.splice(k, 1);
    }

    if (this.shake.power > 0) {
      this.shake.power = Math.max(0, this.shake.power - s * 3.4);
      var a = this.rng() * Math.PI * 2;
      var r = this.shake.power * 9;
      this.shake.x = Math.cos(a) * r;
      this.shake.y = Math.sin(a) * r;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }

    if (this.flash > 0) this.flash = Math.max(0, this.flash - s * 3);
  };

  /** Conecta los eventos del motor con los efectos visuales. */
  Effects.prototype.onEvent = function (ev, engine) {
    switch (ev.type) {
      case 'clear':
        var colors = {};
        if (engine) {
          for (var x = 0; x < T.COLS; x++) {
            var t = engine.grid[ev.rows[0]] ? engine.grid[ev.rows[0]][x] : null;
            colors[x] = t ? T.THEMES[T.currentTheme || 'neon'].pieces[t] : '#ffffff';
          }
        }
        for (var i = 0; i < ev.rows.length; i++) this.burstRow(ev.rows[i], colors);
        this.addShake(ev.n >= 4 ? 1.1 : 0.28 * ev.n);
        this.addFlash(ev.perfect ? 1 : 0.25 * ev.n);
        break;
      case 'harddrop':
        this.addShake(Math.min(0.5, 0.06 + ev.cells * 0.02));
        break;
      case 'message':
        this.addMessage(ev.text, ev.kind);
        break;
      case 'gameover':
        this.addShake(1.4);
        break;
    }
  };

  T.Effects = Effects;

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
