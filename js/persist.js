/* persist.js — serializar y restaurar una partida en curso.
   Vive aparte del motor para que engine.js se mantenga chico. */
(function (T) {
  'use strict';

  var P = T.Engine.prototype;

  P.serialize = function () {
    return {
      v: 1,
      mode: this.mode.id, startLevel: this.startLevel,
      grid: this.grid.map(function (r) { return r.slice(); }),
      piece: this.piece ? { type: this.piece.type, rot: this.piece.rot, x: this.piece.x, y: this.piece.y } : null,
      queue: this.queue.slice(), bag: this.bag.slice(),
      hold: this.hold, holdUsed: this.holdUsed,
      score: this.score, lines: this.lines, level: this.level,
      combo: this.combo, backToBack: this.backToBack, b2bCount: this.b2bCount,
      elapsed: this.elapsed, stats: JSON.parse(JSON.stringify(this.stats)),
      state: (this.state === 'over') ? 'over' : 'paused'
    };
  };

  P.restore = function (d) {
    if (!d || d.v !== 1) return false;
    this.reset(d.mode, { startLevel: d.startLevel });
    this.grid = d.grid.map(function (r) { return r.slice(); });
    this.piece = d.piece ? { type: d.piece.type, rot: d.piece.rot, x: d.piece.x, y: d.piece.y } : null;
    this.queue = d.queue.slice();
    this.bag = d.bag.slice();
    this.hold = d.hold;
    this.holdUsed = !!d.holdUsed;
    this.score = d.score; this.lines = d.lines; this.level = d.level;
    this.combo = d.combo; this.backToBack = d.backToBack; this.b2bCount = d.b2bCount || 0;
    this.elapsed = d.elapsed || 0;
    this.stats = d.stats || this.stats;
    this.state = 'paused';
    this.pausedFrom = 'playing';
    return true;
  };


  /** Guarda la partida actual si tiene sentido guardarla. */
  T.persistGame = function (eng) {
    if (!eng || eng.state === 'ready' || eng.state === 'over') { T.Save.clear(); return false; }
    return T.Save.write(eng.serialize());
  };

  /** Restaura la última partida guardada en el motor dado. */
  T.restoreGame = function (eng) {
    var data = T.Save.read();
    if (!data) return false;
    return eng.restore(data);
  };

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
