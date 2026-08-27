/* storage.js — ajustes, récords y partida guardada. Tolera que no haya localStorage. */
(function (T) {
  'use strict';

  var PREFIX = 'tetris.';

  function backend() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* origen opaco o modo privado */ }
    return null;
  }

  var mem = {};   // fallback en memoria: el juego anda igual, solo no persiste

  var Store = {
    get: function (key, def) {
      var b = backend();
      try {
        var raw = b ? b.getItem(PREFIX + key) : mem[key];
        if (raw === null || raw === undefined) return def;
        return JSON.parse(raw);
      } catch (e) { return def; }
    },
    set: function (key, value) {
      var raw;
      try { raw = JSON.stringify(value); } catch (e) { return false; }
      var b = backend();
      try {
        if (b) b.setItem(PREFIX + key, raw); else mem[key] = raw;
        return true;
      } catch (e) { mem[key] = raw; return false; }
    },
    remove: function (key) {
      var b = backend();
      try { if (b) b.removeItem(PREFIX + key); } catch (e) {}
      delete mem[key];
    }
  };

  /* ---------- ajustes ---------- */
  var Settings = {
    load: function () {
      var saved = Store.get('settings', {}) || {};
      var out = {};
      for (var k in T.DEFAULT_SETTINGS) {
        out[k] = (saved[k] === undefined || saved[k] === null) ? T.DEFAULT_SETTINGS[k] : saved[k];
      }
      if (!T.THEMES[out.theme]) out.theme = T.DEFAULT_SETTINGS.theme;
      out.volume = Math.max(0, Math.min(1, Number(out.volume)));
      out.das = Math.max(0, Math.min(400, Number(out.das)));
      out.arr = Math.max(0, Math.min(200, Number(out.arr)));
      out.startLevel = Math.max(1, Math.min(15, Math.round(Number(out.startLevel) || 1)));
      out.ghostOpacity = Math.max(0.1, Math.min(1, Number(out.ghostOpacity)));
      return out;
    },
    save: function (s) { return Store.set('settings', s); },
    reset: function () { Store.remove('settings'); return Settings.load(); }
  };

  /* ---------- récords ---------- */
  // marathon/ultra: mayor score gana. sprint: menor tiempo gana.
  function better(modeId, a, b) {
    if (!b) return true;
    if (modeId === 'sprint') return a.time < b.time;
    return a.score > b.score;
  }

  var Records = {
    all: function () { return Store.get('records', {}) || {}; },
    best: function (modeId) { return (Records.all() || {})[modeId] || null; },
    /** Devuelve {isRecord, best} y persiste si corresponde. */
    submit: function (modeId, entry) {
      var all = Records.all();
      var cur = all[modeId] || null;
      var isRecord = better(modeId, entry, cur);
      if (isRecord) { all[modeId] = entry; Store.set('records', all); }
      return { isRecord: isRecord, best: all[modeId] };
    },
    clear: function () { Store.remove('records'); Store.remove('scores'); }
  };

  /* ---------- tabla de puntajes (top 5 por modo) ---------- */
  var TOP = 5;
  var Scores = {
    list: function (modeId) { return ((Store.get('scores', {}) || {})[modeId]) || []; },
    add: function (modeId, entry) {
      var all = Store.get('scores', {}) || {};
      var list = all[modeId] || [];
      list.push(entry);
      list.sort(function (a, b) {
        if (modeId === 'sprint') {
          var at = a.done ? a.time : Infinity, bt = b.done ? b.time : Infinity;
          if (at !== bt) return at - bt;
        }
        return b.score - a.score;
      });
      list = list.slice(0, TOP);
      all[modeId] = list;
      Store.set('scores', all);
      return list;
    },
    position: function (modeId, entry) {
      var list = Scores.list(modeId);
      for (var i = 0; i < list.length; i++) {
        if (list[i].score === entry.score && list[i].time === entry.time) return i + 1;
      }
      return 0;
    },
    TOP: TOP
  };

  /* ---------- partida en curso ---------- */
  var Save = {
    write: function (data) { return Store.set('savegame', data); },
    read: function () { return Store.get('savegame', null); },
    clear: function () { Store.remove('savegame'); },
    has: function () { var d = Save.read(); return !!(d && d.v === 1 && d.state !== 'over'); }
  };

  T.Store = Store;
  T.Settings = Settings;
  T.Records = Records;
  T.Scores = Scores;
  T.Save = Save;

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
