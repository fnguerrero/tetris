/* ui.js — HUD, menús, overlays y opciones. Las partes calculables son funciones puras
   para poder verificarlas sin navegador. */
(function (T) {
  'use strict';

  /* ---------- helpers puros ---------- */
  function pad(n, w) {
    var s = String(Math.floor(n));
    while (s.length < (w || 2)) s = '0' + s;
    return s;
  }
  /** ms -> "m:ss.mmm" (o "m:ss" si se pide corto). */
  function fmtTime(ms, short) {
    ms = Math.max(0, ms || 0);
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    if (short) return m + ':' + pad(s);
    return m + ':' + pad(s) + '.' + pad(Math.floor(ms % 1000), 3);
  }
  function fmtNum(n) {
    return String(Math.floor(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  /** Escala para que el tablero entre en el alto disponible, con topes. */
  function computeScale(availH, availW, cols, rows, min, max) {
    min = min || 12; max = max || 42;
    var byH = Math.floor(availH / rows);
    var byW = Math.floor(availW / cols);
    return Math.max(min, Math.min(max, Math.min(byH, byW)));
  }
  /** Etiqueta legible de una tecla. */
  function keyLabel(k) {
    var map = {
      ' ': 'Space', 'arrowleft': '←', 'arrowright': '→', 'arrowup': '↑', 'arrowdown': '↓',
      'escape': 'Esc', 'enter': 'Enter', 'control': 'Ctrl', 'shift': 'Shift', 'tab': 'Tab'
    };
    if (map[k]) return map[k];
    return k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
  }
  /** Filas de la ayuda de controles a partir del mapa vigente. */
  function helpRows(keymap) {
    return T.ACTIONS.map(function (a) {
      return { action: a, label: T.ACTION_LABELS[a], keys: keymap.keysOf(a).map(keyLabel) };
    });
  }
  /** Resumen de la partida para la pantalla de fin. */
  function summarize(eng) {
    return {
      mode: eng.mode.id,
      modeLabel: eng.mode.label,
      result: eng.result,
      score: eng.score,
      lines: eng.lines,
      level: eng.level,
      time: eng.elapsed,
      pps: Math.round(eng.pps() * 100) / 100,
      lpm: Math.round(eng.lpm() * 10) / 10,
      pieces: eng.stats.pieces,
      tetrises: eng.stats.tetrises,
      tspins: eng.stats.tspins,
      perfectClears: eng.stats.perfectClears,
      maxCombo: Math.max(0, eng.stats.maxCombo),
      done: eng.result === 'win'
    };
  }

  /* ---------- controlador de UI ---------- */
  function UI(refs, opts) {
    this.r = refs || {};
    this.opts = opts || {};
    this.screen = 'menu';
  }

  UI.prototype.el = function (id) {
    if (this.r[id]) return this.r[id];
    if (typeof document !== 'undefined') return document.getElementById(id);
    return null;
  };

  UI.prototype.setText = function (id, text) {
    var e = this.el(id);
    if (e) e.textContent = text;
    return e;
  };
  UI.prototype.setHTML = function (id, html) {
    var e = this.el(id);
    if (e) e.innerHTML = html;
    return e;
  };
  UI.prototype.show = function (id, on) {
    var e = this.el(id);
    if (e) e.classList.toggle('hidden', !on);
    return e;
  };

  /** Cambia de pantalla: 'menu' | 'game' | 'options' | 'help' | 'stats' | 'over' | 'pause'. */
  UI.prototype.setScreen = function (name) {
    this.screen = name;
    var screens = ['menu', 'options', 'help', 'stats', 'over', 'pause', 'countdown'];
    for (var i = 0; i < screens.length; i++) this.show('screen-' + screens[i], screens[i] === name);
    this.show('overlay', name !== 'game');
    return name;
  };

  UI.prototype.updateHUD = function (eng) {
    this.setText('score', fmtNum(eng.score));
    this.setText('lines', eng.mode.goalLines ? (eng.lines + '/' + eng.mode.goalLines) : fmtNum(eng.lines));
    this.setText('level', eng.level);
    this.setText('time', eng.mode.timeLimit ? fmtTime(eng.timeLeft(), true) : fmtTime(eng.elapsed, true));
    this.setText('pps', eng.pps().toFixed(2));
    this.setText('lpm', eng.lpm().toFixed(1));
    var combo = eng.combo > 0 ? ('x' + eng.combo) : '—';
    this.setText('combo', combo);
    this.setText('b2b', eng.b2bCount > 0 ? ('x' + eng.b2bCount) : '—');
    var el = this.el('hud');
    if (el) el.classList.toggle('danger', !!(eng.inDanger && eng.inDanger()));
    return true;
  };

  UI.prototype.renderPieceStats = function (eng) {
    var host = this.el('pieceStats');
    if (!host) return null;
    var rows = T.PIECES.map(function (p) {
      var n = eng.stats.byPiece[p] || 0;
      var pct = eng.stats.pieces ? Math.round(n * 100 / eng.stats.pieces) : 0;
      return '<div class="pstat"><span class="pk pk-' + p + '">' + p + '</span>' +
             '<span class="pbar"><i style="width:' + pct + '%"></i></span>' +
             '<span class="pn">' + n + '</span></div>';
    });
    host.innerHTML = rows.join('');
    return rows.length;
  };

  UI.prototype.renderScores = function (modeId) {
    var host = this.el('scoreTable');
    if (!host) return null;
    var list = T.Scores.list(modeId);
    if (!list.length) {
      host.innerHTML = '<div class="empty">Todavía no hay puntajes en este modo.</div>';
      return 0;
    }
    var html = list.map(function (s, i) {
      var right = (modeId === 'sprint') ? (s.done ? fmtTime(s.time) : '—') : fmtNum(s.score);
      return '<div class="srow"><span class="spos">' + (i + 1) + '</span>' +
             '<span class="sval">' + right + '</span>' +
             '<span class="ssub">' + fmtNum(s.lines) + ' líneas · nivel ' + s.level + '</span></div>';
    }).join('');
    host.innerHTML = html;
    return list.length;
  };

  UI.prototype.renderHelp = function (keymap) {
    var host = this.el('helpList');
    var rows = helpRows(keymap);
    if (host) {
      host.innerHTML = rows.map(function (r) {
        return '<div class="hrow"><span class="hlabel">' + r.label + '</span><span class="hkeys">' +
               r.keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join('') + '</span></div>';
      }).join('');
    }
    return rows;
  };

  UI.prototype.showCountdown = function (ms) {
    var n = Math.ceil(ms / 1000);
    this.setText('countdownNum', n > 0 ? String(n) : '¡YA!');
    return n;
  };

  UI.prototype.showResult = function (eng, recordInfo) {
    var s = summarize(eng);
    this.setText('overTitle',
      s.result === 'win' ? '¡COMPLETADO!' : (s.result === 'timeup' ? 'SE ACABÓ EL TIEMPO' : 'GAME OVER'));
    var main = (s.mode === 'sprint' && s.done) ? fmtTime(s.time) : fmtNum(s.score);
    this.setText('overMain', main);
    this.setText('overSub', s.mode === 'sprint'
      ? (fmtNum(s.score) + ' puntos · ' + s.lines + ' líneas')
      : (s.lines + ' líneas · nivel ' + s.level + ' · ' + fmtTime(s.time, true)));
    this.setHTML('overStats',
      '<span>' + s.pieces + ' piezas</span><span>' + s.pps.toFixed(2) + ' PPS</span>' +
      '<span>' + s.tetrises + ' tetris</span><span>' + s.tspins + ' T-spin</span>' +
      '<span>' + s.perfectClears + ' PC</span><span>combo máx x' + s.maxCombo + '</span>');
    this.show('overRecord', !!(recordInfo && recordInfo.isRecord));
    return s;
  };

  /* ---------- pantalla completa ---------- */
  UI.prototype.toggleFullscreen = function () {
    if (typeof document === 'undefined') return false;
    try {
      if (!document.fullscreenElement) {
        var el = document.documentElement;
        if (el.requestFullscreen) { el.requestFullscreen(); return true; }
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
        return false;
      }
    } catch (e) {}
    return !!document.fullscreenElement;
  };

  T.UI = UI;
  T.fmtTime = fmtTime;
  T.fmtNum = fmtNum;
  T.computeScale = computeScale;
  T.keyLabel = keyLabel;
  T.helpRows = helpRows;
  T.summarize = summarize;

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
