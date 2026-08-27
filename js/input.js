/* input.js — teclado remapeable con DAS/ARR y gestos táctiles.
   No toca el DOM: recibe eventos ya normalizados, así se puede probar sin navegador. */
(function (T) {
  'use strict';

  function normKey(k) {
    if (!k) return '';
    if (k === 'Spacebar') return ' ';
    return String(k).toLowerCase();
  }

  /* ---------- mapa de teclas ---------- */
  function KeyMap(custom) {
    this.map = {};
    this.set(custom);
  }
  KeyMap.prototype.set = function (custom) {
    this.map = {};
    for (var a in T.DEFAULT_KEYS) this.map[a] = T.DEFAULT_KEYS[a].slice();
    if (custom) {
      for (var b in custom) {
        if (this.map[b] && custom[b] && custom[b].length) this.map[b] = custom[b].map(normKey);
      }
    }
    return this;
  };
  /** Acción asociada a una tecla, o null. */
  KeyMap.prototype.actionFor = function (key) {
    var k = normKey(key);
    for (var a in this.map) {
      if (this.map[a].indexOf(k) !== -1) return a;
    }
    return null;
  };
  /** Asigna una tecla a una acción, sacándola de cualquier otra. */
  KeyMap.prototype.bind = function (action, key) {
    var k = normKey(key);
    if (!this.map[action]) return false;
    for (var a in this.map) {
      var i = this.map[a].indexOf(k);
      if (i !== -1) this.map[a].splice(i, 1);
    }
    this.map[action] = [k];
    return true;
  };
  KeyMap.prototype.keysOf = function (action) { return (this.map[action] || []).slice(); };
  KeyMap.prototype.toJSON = function () {
    var out = {};
    for (var a in this.map) out[a] = this.map[a].slice();
    return out;
  };
  KeyMap.prototype.resetDefaults = function () { return this.set(null); };

  /* ---------- controlador de input ---------- */
  function Input(opts) {
    opts = opts || {};
    this.keymap = new KeyMap(opts.keys);
    this.das = opts.das === undefined ? T.TIMING.das : opts.das;
    this.arr = opts.arr === undefined ? T.TIMING.arr : opts.arr;
    this.softInterval = opts.soft === undefined ? T.TIMING.soft : opts.soft;
    this.actions = opts.actions || {};      // { left(), right(), softDrop(), ... }
    this.down = {};
    this.repeat = { dir: 0, timer: 0, started: false };
    this.softTimer = 0;
    this.log = [];                          // acciones disparadas, para verificación
    this.capturing = null;                  // acción esperando una tecla nueva (remapeo)
  }

  Input.prototype.fire = function (action) {
    this.log.push(action);
    var fn = this.actions[action];
    if (typeof fn === 'function') fn();
    return action;
  };

  /** Devuelve la acción disparada, 'captured' si estaba remapeando, o null. */
  Input.prototype.keyDown = function (key) {
    var k = normKey(key);
    if (this.capturing) {
      var act = this.capturing;
      this.capturing = null;
      if (k !== 'escape') this.keymap.bind(act, k);
      return 'captured';
    }
    var action = this.keymap.actionFor(k);
    if (!action) return null;
    if (this.down[k]) return null;          // sin auto-repeat del sistema operativo
    this.down[k] = true;

    if (action === 'left' || action === 'right') {
      this.repeat.dir = (action === 'left') ? -1 : 1;
      this.repeat.timer = 0;
      this.repeat.started = false;
    }
    if (action === 'softDrop') this.softTimer = 0;
    return this.fire(action);
  };

  Input.prototype.keyUp = function (key) {
    var k = normKey(key);
    this.down[k] = false;
    var action = this.keymap.actionFor(k);
    if (action === 'left' && this.repeat.dir === -1) this.repeat.dir = 0;
    if (action === 'right' && this.repeat.dir === 1) this.repeat.dir = 0;
    return action;
  };

  Input.prototype.isDown = function (action) {
    var keys = this.keymap.keysOf(action);
    for (var i = 0; i < keys.length; i++) if (this.down[keys[i]]) return true;
    return false;
  };

  /** Auto-repeat lateral (DAS/ARR) y soft drop sostenido. */
  Input.prototype.update = function (dt) {
    if (this.repeat.dir !== 0) {
      this.repeat.timer += dt;
      if (!this.repeat.started) {
        if (this.repeat.timer >= this.das) {
          this.repeat.started = true;
          this.repeat.timer = 0;
          this.fire(this.repeat.dir === -1 ? 'left' : 'right');
        }
      } else {
        while (this.repeat.timer >= this.arr) {
          this.repeat.timer -= this.arr;
          this.fire(this.repeat.dir === -1 ? 'left' : 'right');
          if (this.arr <= 0) break;
        }
      }
    }
    if (this.isDown('softDrop')) {
      this.softTimer += dt;
      while (this.softTimer >= this.softInterval) {
        this.softTimer -= this.softInterval;
        this.fire('softDrop');
      }
    }
  };

  Input.prototype.releaseAll = function () {
    this.down = {};
    this.repeat = { dir: 0, timer: 0, started: false };
    this.softTimer = 0;
  };
  Input.prototype.startCapture = function (action) { this.capturing = action; };
  Input.prototype.clearLog = function () { this.log = []; };

  /* ---------- gestos táctiles ---------- */
  // swipe lateral = mover (una celda por tramo), swipe abajo = caída, swipe arriba = hold,
  // tap corto = rotar, mantener presionado hacia abajo = soft drop.
  function Gestures(opts) {
    opts = opts || {};
    this.cell = opts.cell || 30;            // px por celda, define el paso lateral
    this.tapMs = opts.tapMs || 220;
    this.tapDist = opts.tapDist || 12;
    this.flickV = opts.flickV || 1.1;       // px/ms para considerar swipe rápido
    this.reset();
  }
  Gestures.prototype.reset = function () {
    this.active = false;
    this.x0 = 0; this.y0 = 0; this.t0 = 0;
    this.lastX = 0; this.lastY = 0;
    this.movedCells = 0;
    this.dropped = false;
    this.held = false;
  };
  Gestures.prototype.start = function (x, y, t) {
    this.active = true;
    this.x0 = this.lastX = x;
    this.y0 = this.lastY = y;
    this.t0 = t;
    this.movedCells = 0;
    this.dropped = false;
    this.held = false;
    return [];
  };
  /** Devuelve la lista de acciones producidas por el movimiento. */
  Gestures.prototype.move = function (x, y, t) {
    if (!this.active) return [];
    var out = [];
    var dx = x - this.lastX;
    var steps = Math.trunc(dx / this.cell);
    if (steps !== 0) {
      for (var i = 0; i < Math.abs(steps); i++) out.push(steps > 0 ? 'right' : 'left');
      this.lastX += steps * this.cell;
      this.movedCells += Math.abs(steps);
    }
    var dy = y - this.lastY;
    if (dy > this.cell * 0.9) {
      var vy = (y - this.y0) / Math.max(1, t - this.t0);
      if (vy > this.flickV && !this.dropped) {
        out.push('hardDrop');
        this.dropped = true;
        this.active = false;
      } else {
        var vsteps = Math.trunc(dy / this.cell);
        for (var j = 0; j < vsteps; j++) out.push('softDrop');
        this.lastY += vsteps * this.cell;
      }
    } else if (dy < -this.cell * 1.6 && !this.held) {
      out.push('hold');
      this.held = true;
      this.active = false;
    }
    return out;
  };
  Gestures.prototype.end = function (x, y, t) {
    if (!this.active) { this.reset(); return []; }
    var dt = t - this.t0;
    var dist = Math.abs(x - this.x0) + Math.abs(y - this.y0);
    this.reset();
    if (dt <= this.tapMs && dist <= this.tapDist) return ['rotateCW'];
    return [];
  };

  T.normKey = normKey;
  T.KeyMap = KeyMap;
  T.Input = Input;
  T.Gestures = Gestures;

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
