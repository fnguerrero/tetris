/* engine.js — lógica pura del juego. Sin DOM, sin canvas, sin timers propios.
   Todo lo verificable vive acá: corre igual en el navegador y en Node. */
(function (T) {
  'use strict';

  var COLS = T.COLS, TOTAL_ROWS = T.TOTAL_ROWS, HIDDEN = T.HIDDEN;

  function emptyGrid() {
    var g = [];
    for (var y = 0; y < TOTAL_ROWS; y++) g.push(new Array(COLS).fill(null));
    return g;
  }

  function Engine(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.listeners = [];
    this.timing = Object.assign({}, T.TIMING, opts.timing || {});
    this.reset('marathon', {});
  }

  /* ---------- eventos ---------- */
  Engine.prototype.on = function (fn) { this.listeners.push(fn); return this; };
  Engine.prototype.emit = function (type, data) {
    var ev = data || {};
    ev.type = type;
    this.events.push(ev);
    for (var i = 0; i < this.listeners.length; i++) this.listeners[i](ev);
  };
  /** Vacía y devuelve los eventos acumulados desde la última llamada. */
  Engine.prototype.drainEvents = function () {
    var e = this.events;
    this.events = [];
    return e;
  };

  /* ---------- ciclo de vida ---------- */
  Engine.prototype.reset = function (modeId, opts) {
    opts = opts || {};
    this.mode = T.MODES[modeId] ? T.MODES[modeId] : T.MODES.marathon;
    this.startLevel = Math.max(1, Math.min(15, opts.startLevel || 1));

    this.grid = emptyGrid();
    this.bag = [];
    this.queue = [];
    this.piece = null;
    this.hold = null;
    this.holdUsed = false;

    this.score = 0;
    this.lines = 0;
    this.level = this.startLevel;
    this.combo = -1;
    this.backToBack = false;
    this.b2bCount = 0;

    this.state = 'ready';        // ready | countdown | playing | clearing | paused | over
    this.result = null;          // 'win' | 'lose' | 'timeup'
    this.elapsed = 0;            // ms de juego efectivo
    this.countdown = 0;

    this.dropTimer = 0;
    this.lockTimer = null;
    this.lockResets = 0;
    this.clearRows = [];
    this.clearTimer = 0;
    this.spawnTimer = 0;

    this.lastAction = null;
    this.lastKick = 0;
    this.lastClear = null;       // detalle del último clear, para la UI

    this.stats = { pieces: 0, byPiece: {}, singles: 0, doubles: 0, triples: 0, tetrises: 0, tspins: 0, perfectClears: 0, maxCombo: 0, holds: 0, keys: 0 };
    for (var i = 0; i < T.PIECES.length; i++) this.stats.byPiece[T.PIECES[i]] = 0;

    this.events = [];
    return this;
  };

  Engine.prototype.start = function (modeId, opts) {
    this.reset(modeId, opts);
    this.refillBag();
    while (this.queue.length < T.NEXT_COUNT) this.queue.push(this.nextType());
    this.state = 'countdown';
    this.countdown = (opts && opts.countdown !== undefined) ? opts.countdown : this.timing.countdown;
    if (this.countdown <= 0) this.beginPlay();
    else this.emit('countdown', { left: this.countdown });
    return this;
  };

  Engine.prototype.beginPlay = function () {
    this.state = 'playing';
    this.countdown = 0;
    if (!this.piece) this.spawn(this.shiftQueue());
    this.emit('start', { mode: this.mode.id, level: this.level });
  };

  Engine.prototype.pause = function () {
    if (this.state !== 'playing' && this.state !== 'clearing') return false;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.emit('pause', {});
    return true;
  };

  Engine.prototype.resume = function (countdownMs) {
    if (this.state !== 'paused') return false;
    var ms = (countdownMs === undefined) ? this.timing.countdown : countdownMs;
    if (ms > 0) { this.state = 'countdown'; this.countdown = ms; this.emit('countdown', { left: ms }); }
    else { this.state = this.pausedFrom || 'playing'; this.emit('resume', {}); }
    return true;
  };

  Engine.prototype.gameOver = function (result) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.result = result || 'lose';
    this.emit('gameover', { result: this.result, score: this.score, lines: this.lines, level: this.level, time: this.elapsed });
  };

  /* ---------- bolsa de 7 ---------- */
  Engine.prototype.refillBag = function () {
    var p = T.PIECES.slice();
    for (var i = p.length - 1; i > 0; i--) {
      var j = Math.floor(this.rng() * (i + 1));
      var t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.bag = this.bag.concat(p);
  };
  Engine.prototype.nextType = function () {
    if (this.bag.length < T.PIECES.length) this.refillBag();
    return this.bag.shift();
  };
  Engine.prototype.shiftQueue = function () {
    var t = this.queue.shift();
    while (this.queue.length < T.NEXT_COUNT) this.queue.push(this.nextType());
    return t;
  };

  /* ---------- piezas ---------- */
  Engine.prototype.spawn = function (type) {
    this.piece = { type: type, rot: 0, x: 3, y: 0 };
    this.holdUsed = false;
    this.lastAction = null;
    this.lastKick = 0;
    this.dropTimer = 0;
    this.lockTimer = null;
    this.lockResets = 0;
    this.spawnTimer = this.timing.spawnPop;
    while (this.queue.length < T.NEXT_COUNT) this.queue.push(this.nextType());
    this.emit('spawn', { piece: type });
    if (!this.valid(this.piece)) this.gameOver('lose');
  };

  Engine.prototype.cellsOf = function (p, rot, x, y) {
    p = p || this.piece;
    var r = (rot === undefined) ? p.rot : rot;
    var px = (x === undefined) ? p.x : x;
    var py = (y === undefined) ? p.y : y;
    var s = T.SHAPES[p.type][r], out = [];
    for (var i = 0; i < s.length; i++) out.push([s[i][0] + px, s[i][1] + py]);
    return out;
  };

  Engine.prototype.valid = function (p, rot, x, y) {
    var cells = this.cellsOf(p, rot, x, y);
    for (var i = 0; i < cells.length; i++) {
      var cx = cells[i][0], cy = cells[i][1];
      if (cx < 0 || cx >= COLS || cy >= TOTAL_ROWS) return false;
      if (cy >= 0 && this.grid[cy][cx]) return false;
    }
    return true;
  };

  Engine.prototype.ghostY = function () {
    if (!this.piece) return 0;
    var y = this.piece.y;
    while (this.valid(this.piece, this.piece.rot, this.piece.x, y + 1)) y++;
    return y;
  };

  Engine.prototype.gravityMs = function () {
    var t = Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1) * 1000;
    return Math.max(t, 25);
  };

  /** Progreso del lock delay, 0..1. La UI lo usa para el parpadeo. */
  Engine.prototype.lockProgress = function () {
    if (this.lockTimer === null || this.state !== 'playing') return 0;
    return Math.max(0, Math.min(1, this.lockTimer / this.timing.lockDelay));
  };

  /** Altura de la pila, en filas ocupadas desde abajo. */
  Engine.prototype.stackHeight = function () {
    for (var y = 0; y < TOTAL_ROWS; y++) {
      for (var x = 0; x < COLS; x++) if (this.grid[y][x]) return TOTAL_ROWS - y;
    }
    return 0;
  };
  Engine.prototype.inDanger = function () { return this.stackHeight() >= T.ROWS - 4; };

  /* ---------- acciones ---------- */
  Engine.prototype.canAct = function () { return this.state === 'playing' && !!this.piece; };

  Engine.prototype.move = function (dx) {
    if (!this.canAct()) return false;
    if (!this.valid(this.piece, this.piece.rot, this.piece.x + dx, this.piece.y)) return false;
    this.piece.x += dx;
    this.lastAction = 'move';
    if (this.lockTimer !== null) this.resetLock();
    this.emit('move', { dx: dx });
    return true;
  };

  Engine.prototype.softDrop = function () {
    if (!this.canAct()) return false;
    if (this.valid(this.piece, this.piece.rot, this.piece.x, this.piece.y + 1)) {
      this.piece.y++;
      this.score += T.SCORE.softDrop;
      this.lastAction = 'move';
      this.lockTimer = null;
      this.lockResets = 0;
      this.emit('softdrop', {});
      return true;
    }
    this.startLock();
    return false;
  };

  Engine.prototype.hardDrop = function () {
    if (!this.canAct()) return false;
    var from = this.piece.y, d = 0;
    while (this.valid(this.piece, this.piece.rot, this.piece.x, this.piece.y + 1)) { this.piece.y++; d++; }
    this.score += d * T.SCORE.hardDrop;
    this.emit('harddrop', { cells: d, fromY: from, toY: this.piece.y, x: this.piece.x, piece: this.piece.type, rot: this.piece.rot });
    this.lockPiece();
    return true;
  };

  Engine.prototype.rotate = function (dir) {
    if (!this.canAct()) return false;
    if (this.piece.type === 'O') return false;
    var from = this.piece.rot;
    var to = (from + dir + 4) % 4;
    var table;
    if (dir === 2) table = T.KICKS_180;
    else table = (this.piece.type === 'I') ? T.KICKS_I : T.KICKS;
    var kicks = table[from + '>' + to] || [[0, 0]];
    for (var i = 0; i < kicks.length; i++) {
      var kx = kicks[i][0], ky = kicks[i][1];
      if (this.valid(this.piece, to, this.piece.x + kx, this.piece.y + ky)) {
        this.piece.rot = to;
        this.piece.x += kx;
        this.piece.y += ky;
        this.lastAction = 'rotate';
        this.lastKick = i;
        if (this.lockTimer !== null) this.resetLock();
        this.emit('rotate', { dir: dir, kick: i });
        return true;
      }
    }
    return false;
  };

  Engine.prototype.doHold = function () {
    if (!this.canAct() || this.holdUsed) return false;
    var cur = this.piece.type;
    if (this.hold) { var h = this.hold; this.hold = cur; this.spawn(h); }
    else { this.hold = cur; this.spawn(this.shiftQueue()); }
    this.holdUsed = true;
    this.stats.holds++;
    this.emit('hold', { piece: this.hold });
    return true;
  };

  Engine.prototype.startLock = function () { if (this.lockTimer === null) this.lockTimer = 0; };
  Engine.prototype.resetLock = function () {
    if (this.lockResets < this.timing.maxLockResets) { this.lockTimer = 0; this.lockResets++; }
  };

  /* ---------- T-spin ---------- */
  Engine.prototype.detectTSpin = function () {
    if (!this.piece || this.piece.type !== 'T' || this.lastAction !== 'rotate') return null;
    var corners = [[0, 0], [2, 0], [0, 2], [2, 2]];
    var front = { 0: [0, 1], 1: [1, 3], 2: [2, 3], 3: [0, 2] }[this.piece.rot];
    var filled = 0, frontFilled = 0;
    for (var i = 0; i < corners.length; i++) {
      var cx = this.piece.x + corners[i][0], cy = this.piece.y + corners[i][1];
      var occ = cx < 0 || cx >= COLS || cy >= TOTAL_ROWS || (cy >= 0 && !!this.grid[cy][cx]);
      if (occ) { filled++; if (front.indexOf(i) !== -1) frontFilled++; }
    }
    if (filled < 3) return null;
    return (frontFilled === 2 || this.lastKick === 4) ? 'full' : 'mini';
  };

  /* ---------- bloqueo, limpieza y puntaje ---------- */
  Engine.prototype.lockPiece = function () {
    var tspin = this.detectTSpin();
    var cells = this.cellsOf(this.piece);
    var allHidden = cells.every(function (c) { return c[1] < HIDDEN; });

    for (var i = 0; i < cells.length; i++) {
      if (cells[i][1] >= 0) this.grid[cells[i][1]][cells[i][0]] = this.piece.type;
    }
    this.stats.pieces++;
    this.stats.byPiece[this.piece.type]++;
    this.emit('lock', { piece: this.piece.type, cells: cells });

    var full = [];
    for (var y = 0; y < TOTAL_ROWS; y++) {
      var done = true;
      for (var x = 0; x < COLS; x++) if (!this.grid[y][x]) { done = false; break; }
      if (done) full.push(y);
    }

    if (full.length) {
      this.applyClearScore(full.length, tspin, full);
      this.clearRows = full;
      this.clearTimer = 0;
      this.state = 'clearing';
      return;
    }

    if (allHidden) return this.gameOver('lose');

    if (tspin) {
      var pts = (tspin === 'mini' ? T.SCORE.tspinMiniNoLine : T.SCORE.tspinNoLine) * this.level;
      this.score += pts;
      this.stats.tspins++;
      this.emit('message', { kind: 'tspin', text: tspin === 'mini' ? 'T-SPIN MINI' : 'T-SPIN', points: pts });
    }
    this.combo = -1;
    this.spawn(this.shiftQueue());
  };

  /** ¿Queda el tablero completamente vacío si se borran estas filas? */
  Engine.prototype.isPerfectClear = function (rows) {
    for (var y = 0; y < TOTAL_ROWS; y++) {
      if (rows.indexOf(y) !== -1) continue;
      for (var x = 0; x < COLS; x++) if (this.grid[y][x]) return false;
    }
    return true;
  };

  Engine.prototype.applyClearScore = function (n, tspin, rows) {
    var base = tspin ? (tspin === 'mini' ? T.SCORE.tspinMini : T.SCORE.tspin) : T.SCORE.lines;
    var pts = base[n] * this.level;
    var hard = (n === 4) || !!tspin;
    var wasB2B = this.backToBack;
    if (hard && wasB2B) pts = Math.floor(pts * T.SCORE.b2bMultiplier);
    this.backToBack = hard;
    this.b2bCount = hard ? (wasB2B ? this.b2bCount + 1 : 1) : 0;

    this.combo++;
    var comboPts = this.combo > 0 ? T.SCORE.combo * this.combo * this.level : 0;
    pts += comboPts;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;

    var perfect = this.isPerfectClear(rows);
    var perfectPts = 0;
    if (perfect) {
      perfectPts = T.SCORE.perfectClear[n] * this.level;
      pts += perfectPts;
      this.stats.perfectClears++;
    }

    this.score += pts;
    this.lines += n;
    if (n === 1) this.stats.singles++;
    else if (n === 2) this.stats.doubles++;
    else if (n === 3) this.stats.triples++;
    else if (n === 4) this.stats.tetrises++;
    if (tspin) this.stats.tspins++;

    this.lastClear = { n: n, tspin: tspin, perfect: perfect, b2b: hard && wasB2B, combo: this.combo, points: pts };

    var names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
    var text, kind;
    if (perfect) { text = 'PERFECT CLEAR'; kind = 'perfect'; }
    else if (tspin) { text = 'T-SPIN' + (tspin === 'mini' ? ' MINI' : '') + ' ' + names[n]; kind = 'tspin'; }
    else if (n === 4) { text = (hard && wasB2B) ? 'TETRIS B2B' : 'TETRIS!'; kind = hard && wasB2B ? 'b2b' : 'tetris'; }
    else { text = names[n]; kind = ['', 'single', 'double', 'triple'][n]; }
    this.emit('clear', { n: n, rows: rows.slice(), tspin: tspin, perfect: perfect, b2b: hard && wasB2B, combo: this.combo, points: pts });
    this.emit('message', { kind: kind, text: text, points: pts });
    if (this.combo > 0) this.emit('message', { kind: 'combo', text: 'COMBO x' + this.combo, points: comboPts });

    var newLevel = Math.max(this.startLevel, Math.floor(this.lines / 10) + this.startLevel);
    if (this.mode.id === 'marathon' || this.mode.id === 'ultra') {
      if (newLevel > this.level) {
        this.level = newLevel;
        this.emit('levelup', { level: this.level });
        this.emit('message', { kind: 'level', text: 'NIVEL ' + this.level });
      }
    }
  };

  Engine.prototype.finishClear = function () {
    var rows = this.clearRows.slice().sort(function (a, b) { return a - b; });
    for (var i = 0; i < rows.length; i++) {
      this.grid.splice(rows[i], 1);
      this.grid.unshift(new Array(COLS).fill(null));
    }
    this.clearRows = [];
    this.clearTimer = 0;
    this.state = 'playing';

    if (this.mode.goalLines && this.lines >= this.mode.goalLines) {
      this.gameOver('win');
      return;
    }
    this.spawn(this.shiftQueue());
  };

  /* ---------- tick ---------- */
  Engine.prototype.update = function (dt) {
    dt = Math.max(0, Math.min(dt || 0, 100));

    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        if (this.pausedFrom && this.piece) { this.state = this.pausedFrom; this.pausedFrom = null; this.emit('resume', {}); }
        else this.beginPlay();
      }
      return;
    }

    if (this.state === 'clearing') {
      this.elapsed += dt;
      this.clearTimer += dt;
      if (this.clearTimer >= this.timing.clearAnim) this.finishClear();
      this.checkTimeLimit();
      return;
    }

    if (this.state !== 'playing') return;

    this.elapsed += dt;
    if (this.spawnTimer > 0) this.spawnTimer = Math.max(0, this.spawnTimer - dt);

    var grounded = !this.valid(this.piece, this.piece.rot, this.piece.x, this.piece.y + 1);
    if (grounded) {
      this.startLock();
      this.lockTimer += dt;
      if (this.lockTimer >= this.timing.lockDelay) this.lockPiece();
    } else {
      this.lockTimer = null;
      this.dropTimer += dt;
      var g = this.gravityMs();
      var guard = 0;
      while (this.dropTimer >= g && guard++ < TOTAL_ROWS) {
        this.dropTimer -= g;
        if (this.valid(this.piece, this.piece.rot, this.piece.x, this.piece.y + 1)) {
          this.piece.y++;
          this.lastAction = 'move';
        } else { this.startLock(); break; }
      }
    }
    this.checkTimeLimit();
  };

  Engine.prototype.checkTimeLimit = function () {
    if (this.mode.timeLimit && this.elapsed >= this.mode.timeLimit && this.state !== 'over') {
      this.gameOver('timeup');
    }
  };

  Engine.prototype.timeLeft = function () {
    if (!this.mode.timeLimit) return 0;
    return Math.max(0, this.mode.timeLimit - this.elapsed);
  };

  /* ---------- estadísticas derivadas ---------- */
  Engine.prototype.pps = function () {
    var s = this.elapsed / 1000;
    return s > 0 ? this.stats.pieces / s : 0;
  };
  Engine.prototype.lpm = function () {
    var m = this.elapsed / 60000;
    return m > 0 ? this.lines / m : 0;
  };

  T.Engine = Engine;
  T.emptyGrid = emptyGrid;

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
