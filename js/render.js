/* render.js — dibujo en canvas del tablero, next, hold y efectos. */
(function (T) {
  'use strict';

  var CELL = 32;   // resolución interna de cada celda; el CSS escala el canvas

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(Math.min(255, Math.max(0, r + r * amt)));
    g = Math.round(Math.min(255, Math.max(0, g + g * amt)));
    b = Math.round(Math.min(255, Math.max(0, b + b * amt)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function hexToRgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function Renderer(canvases, opts) {
    opts = opts || {};
    this.board = canvases.board;
    this.next = canvases.next;
    this.hold = canvases.hold;
    this.bctx = this.board ? this.board.getContext('2d') : null;
    this.nctx = this.next ? this.next.getContext('2d') : null;
    this.hctx = this.hold ? this.hold.getContext('2d') : null;
    this.settings = opts.settings || T.DEFAULT_SETTINGS;
    this.theme = T.THEMES[this.settings.theme] || T.THEMES.neon;
    this.bgPhase = 0;
    if (this.board) {
      this.board.width = T.COLS * CELL;
      this.board.height = T.ROWS * CELL;
    }
  }

  Renderer.prototype.setTheme = function (id) {
    this.theme = T.THEMES[id] || T.THEMES.neon;
    T.currentTheme = this.theme === T.THEMES[id] ? id : 'neon';
    return this.theme;
  };
  Renderer.prototype.color = function (type) { return this.theme.pieces[type] || '#ffffff'; };

  Renderer.prototype.block = function (ctx, x, y, size, color, alpha, ghost) {
    var p = Math.max(1, size * 0.06);
    ctx.save();
    ctx.globalAlpha = (alpha === undefined) ? 1 : alpha;
    if (ghost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, size * 0.09);
      roundRect(ctx, x + p, y + p, size - p * 2, size - p * 2, size * 0.18);
      ctx.stroke();
    } else {
      var g = ctx.createLinearGradient(x, y, x, y + size);
      g.addColorStop(0, color);
      g.addColorStop(1, shade(color, -0.32));
      ctx.fillStyle = g;
      roundRect(ctx, x + p, y + p, size - p * 2, size - p * 2, size * 0.18);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      roundRect(ctx, x + p * 2, y + p * 2, size - p * 4, (size - p * 4) * 0.34, size * 0.12);
      ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype.drawBackground = function (ctx, w, h, dt) {
    ctx.fillStyle = this.theme.board;
    ctx.fillRect(0, 0, w, h);
    if (!this.settings.background) return;
    this.bgPhase += (dt || 16) / 1000;
    var bands = 3;
    for (var i = 0; i < bands; i++) {
      var t = (this.bgPhase * 0.08 + i / bands) % 1;
      var y = t * (h + 200) - 100;
      var g = ctx.createRadialGradient(w * (0.3 + 0.4 * ((i % 2) ? 1 : 0)), y, 0, w * 0.5, y, w * 0.9);
      g.addColorStop(0, hexToRgba(i % 2 ? this.theme.accent : this.theme.accent2, 0.05));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - w, w, w * 2);
    }
  };

  Renderer.prototype.drawGrid = function (ctx, w, h) {
    if (!this.settings.grid) return;
    ctx.strokeStyle = this.theme.grid;
    ctx.lineWidth = 1;
    for (var x = 1; x < T.COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, h); ctx.stroke();
    }
    for (var y = 1; y < T.ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(w, y * CELL + 0.5); ctx.stroke();
    }
  };

  /** Dibuja el tablero completo. `dt` alimenta el fondo animado. */
  Renderer.prototype.drawBoard = function (eng, fx, dt) {
    var ctx = this.bctx;
    if (!ctx) return;
    var w = T.COLS * CELL, h = T.ROWS * CELL;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.drawBackground(ctx, w, h, dt);

    var sx = fx ? fx.shake.x : 0, sy = fx ? fx.shake.y : 0;
    ctx.save();
    ctx.translate(sx, sy);

    this.drawGrid(ctx, w, h);

    // estelas del hard drop
    if (fx) {
      for (var t = 0; t < fx.trails.length; t++) {
        var tr = fx.trails[t];
        var y0 = (tr.y0 - T.HIDDEN) * CELL, y1 = (tr.y1 - T.HIDDEN) * CELL;
        var grad = ctx.createLinearGradient(0, y0, 0, y1 + CELL);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, hexToRgba(tr.color, 0.32 * tr.life));
        ctx.fillStyle = grad;
        ctx.fillRect(tr.x * CELL + CELL * 0.2, y0, CELL * 0.6, Math.max(0, y1 - y0 + CELL));
      }
    }

    // pila
    var clearing = eng.state === 'clearing' ? eng.clearRows : [];
    var prog = eng.state === 'clearing' ? Math.min(1, eng.clearTimer / eng.timing.clearAnim) : 0;
    for (var gy = T.HIDDEN; gy < T.TOTAL_ROWS; gy++) {
      var isClearing = clearing.indexOf(gy) !== -1;
      for (var gx = 0; gx < T.COLS; gx++) {
        var type = eng.grid[gy][gx];
        if (!type) continue;
        var alpha = 1, size = CELL, ox = 0;
        if (isClearing) {
          alpha = Math.max(0, 1 - prog * 1.15);
          size = CELL * (1 - prog * 0.25);
          ox = (CELL - size) / 2;
        }
        this.block(ctx, gx * CELL + ox, (gy - T.HIDDEN) * CELL + ox, size,
          isClearing && prog > 0.35 ? '#ffffff' : this.color(type), alpha);
      }
    }

    // pieza activa + ghost
    if (eng.piece && (eng.state === 'playing' || eng.state === 'paused' || eng.state === 'countdown')) {
      var color = this.color(eng.piece.type);
      if (this.settings.ghost) {
        var gYY = eng.ghostY();
        var gcells = eng.cellsOf(eng.piece, eng.piece.rot, eng.piece.x, gYY);
        for (var i = 0; i < gcells.length; i++) {
          if (gcells[i][1] >= T.HIDDEN) {
            this.block(ctx, gcells[i][0] * CELL, (gcells[i][1] - T.HIDDEN) * CELL, CELL, color, this.settings.ghostOpacity, true);
          }
        }
      }
      var pulse = 1;
      var lp = eng.lockProgress();
      if (lp > 0) pulse = 0.55 + 0.45 * Math.abs(Math.cos(lp * Math.PI * 3));
      var pop = eng.spawnTimer > 0 ? (1 - eng.spawnTimer / eng.timing.spawnPop) * 0.15 + 0.85 : 1;
      var cells = eng.cellsOf(eng.piece);
      for (var c = 0; c < cells.length; c++) {
        if (cells[c][1] < T.HIDDEN) continue;
        var bs = CELL * pop, bo = (CELL - bs) / 2;
        this.block(ctx, cells[c][0] * CELL + bo, (cells[c][1] - T.HIDDEN) * CELL + bo, bs, color, pulse);
      }
    }

    // partículas
    if (fx) {
      for (var pi = 0; pi < fx.particles.length; pi++) {
        var p = fx.particles[pi];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        var s = p.size * CELL;
        ctx.fillRect(p.x * CELL, (p.y - T.HIDDEN) * CELL, s, s);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // destello de line clear
    if (fx && fx.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (fx.flash * 0.35) + ')';
      ctx.fillRect(0, 0, w, h);
    }

    // borde de peligro
    if (eng.inDanger && eng.inDanger() && eng.state === 'playing') {
      var pulse2 = 0.35 + 0.25 * Math.sin(this.bgPhase * 6);
      ctx.strokeStyle = 'rgba(255,77,94,' + pulse2 + ')';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
    }
  };

  Renderer.prototype.drawMini = function (ctx, type, cx, cy, size, alpha) {
    if (!type || !ctx) return;
    var cells = T.SHAPES[type][0];
    var xs = cells.map(function (c) { return c[0]; });
    var ys = cells.map(function (c) { return c[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var w = (maxX - minX + 1) * size, h = (maxY - minY + 1) * size;
    var ox = cx - w / 2 - minX * size, oy = cy - h / 2 - minY * size;
    for (var i = 0; i < cells.length; i++) {
      this.block(ctx, ox + cells[i][0] * size, oy + cells[i][1] * size, size, this.color(type), alpha);
    }
  };

  Renderer.prototype.drawNext = function (queue) {
    var ctx = this.nctx;
    if (!ctx) return;
    var w = this.next.width, h = this.next.height;
    ctx.clearRect(0, 0, w, h);
    var n = Math.min(queue.length, T.NEXT_COUNT);
    var slot = h / T.NEXT_COUNT;
    for (var i = 0; i < n; i++) {
      var size = i === 0 ? 20 : 16;
      this.drawMini(ctx, queue[i], w / 2, slot * i + slot / 2, size, i === 0 ? 1 : 0.72);
    }
  };

  Renderer.prototype.drawHold = function (type, used) {
    var ctx = this.hctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.hold.width, this.hold.height);
    this.drawMini(ctx, type, this.hold.width / 2, this.hold.height / 2, 19, used ? 0.3 : 1);
  };

  Renderer.CELL = CELL;
  T.Renderer = Renderer;
  T.shade = shade;
  T.hexToRgba = hexToRgba;

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
