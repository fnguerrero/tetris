/* main.js — arma el juego: motor + render + input + UI + audio, y corre el loop. */
(function (T) {
  'use strict';

  var G = {};        // estado global de la app
  T.game = G;

  function $(id) { return document.getElementById(id); }

  /* ---------- tema ---------- */
  function applyTheme(id) {
    var th = T.THEMES[id] || T.THEMES.neon;
    T.currentTheme = T.THEMES[id] ? id : 'neon';
    var css = document.documentElement.style;
    css.setProperty('--bg', th.bg);
    css.setProperty('--board', th.board);
    css.setProperty('--grid', th.grid);
    css.setProperty('--line', th.line);
    css.setProperty('--txt', th.txt);
    css.setProperty('--dim', th.dim);
    css.setProperty('--accent', th.accent);
    css.setProperty('--accent2', th.accent2);
    for (var p in th.pieces) css.setProperty('--p-' + p, th.pieces[p]);
    if (G.renderer) G.renderer.setTheme(T.currentTheme);
    return th;
  }

  /* ---------- ajustes ---------- */
  function applySettings() {
    var s = G.settings;
    applyTheme(s.theme);
    if (G.renderer) G.renderer.settings = s;
    if (G.fx) G.fx.settings = s;
    if (G.audio) { G.audio.setEnabled(s.sound); G.audio.setVolume(s.volume); }
    if (G.input) { G.input.das = s.das; G.input.arr = s.arr; }
    T.Haptics.enabled = !!s.vibration;
    document.body.classList.toggle('no-bg', !s.background);
  }
  function saveSettings() {
    G.settings.keys = G.input ? G.input.keymap.toJSON() : G.settings.keys;
    T.Settings.save(G.settings);
    applySettings();
  }

  /* ---------- ciclo ---------- */
  function startGame(modeId) {
    T.Save.clear();
    G.mode = modeId;
    G.fx.clear();
    G.engine.start(modeId, { startLevel: G.settings.startLevel, countdown: T.TIMING.countdown });
    G.recordInfo = null;
    G.ui.setScreen('countdown');
    G.lastCountdownBeep = -1;
    G.input.releaseAll();
    G.audio.play('menu');
  }

  function resumeSaved() {
    var data = T.Save.read();
    if (!data) return false;
    if (!G.engine.restore(data)) return false;
    G.mode = G.engine.mode.id;
    G.fx.clear();
    G.engine.resume(T.TIMING.countdown);
    G.ui.setScreen('countdown');
    G.input.releaseAll();
    return true;
  }

  function pauseGame() {
    if (!G.engine.pause()) return false;
    T.Save.write(G.engine.serialize());
    G.ui.setScreen('pause');
    G.ui.setText('pauseScore', T.fmtNum(G.engine.score));
    G.input.releaseAll();
    return true;
  }

  function resumeGame() {
    if (G.engine.state !== 'paused') return false;
    G.engine.resume(T.TIMING.countdown);
    G.ui.setScreen('countdown');
    G.lastCountdownBeep = -1;
    return true;
  }

  function backToMenu() {
    if (G.engine.state === 'paused') T.Save.write(G.engine.serialize());
    G.engine.state = 'ready';
    G.ui.setScreen('menu');
    refreshMenu();
  }

  function onGameOver() {
    var s = T.summarize(G.engine);
    var entry = { score: s.score, lines: s.lines, level: s.level, time: s.time, done: s.done, date: Date.now() };
    G.recordInfo = T.Records.submit(G.mode, entry);
    T.Scores.add(G.mode, entry);
    T.Save.clear();
    G.ui.showResult(G.engine, G.recordInfo);
    G.ui.renderPieceStats(G.engine);
    G.ui.setScreen('over');
    T.Haptics.fire('gameover');
  }

  /* ---------- eventos del motor ---------- */
  function handleEvent(ev) {
    G.audio.onEvent(ev);
    G.fx.onEvent(ev, G.engine);
    if (ev.type === 'clear') T.Haptics.fire(ev.n >= 4 ? 'tetris' : 'clear');
    else if (ev.type === 'lock') T.Haptics.fire('lock');
    else if (ev.type === 'hold') T.Haptics.fire('hold');
    else if (ev.type === 'harddrop' && G.engine.piece) {
      G.fx.addTrail(G.engine.cellsOf(G.engine.piece), ev.fromY, ev.toY, G.renderer.color(ev.piece));
    } else if (ev.type === 'gameover') {
      G.pendingGameOver = true;
    }
  }

  /* ---------- menú ---------- */
  function refreshMenu() {
    ['marathon', 'sprint', 'ultra'].forEach(function (m) {
      var best = T.Records.best(m);
      var txt = '—';
      if (best) txt = (m === 'sprint') ? (best.done ? T.fmtTime(best.time) : '—') : T.fmtNum(best.score);
      var el = $('best-' + m);
      if (el) el.textContent = txt;
    });
    var cont = $('btnContinue');
    if (cont) cont.classList.toggle('hidden', !T.Save.has());
  }

  /* ---------- opciones ---------- */
  function bindOption(id, key, kind) {
    var el = $(id);
    if (!el) return;
    if (kind === 'check') el.checked = !!G.settings[key];
    else el.value = G.settings[key];
    el.addEventListener('change', function () {
      G.settings[key] = (kind === 'check') ? !!el.checked
        : (kind === 'num' ? Number(el.value) : el.value);
      saveSettings();
      updateOptionLabels();
      G.audio.play('menu');
    });
    if (kind === 'num') el.addEventListener('input', function () {
      G.settings[key] = Number(el.value);
      applySettings();
      updateOptionLabels();
    });
  }
  function updateOptionLabels() {
    var s = G.settings;
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('volLabel', Math.round(s.volume * 100) + '%');
    set('dasLabel', s.das + ' ms');
    set('arrLabel', s.arr + ' ms');
    set('ghostLabel', Math.round(s.ghostOpacity * 100) + '%');
    set('levelLabel', s.startLevel);
  }

  function buildKeyBinder() {
    var host = $('keyBinder');
    if (!host) return;
    host.innerHTML = T.ACTIONS.map(function (a) {
      return '<div class="krow"><span>' + T.ACTION_LABELS[a] + '</span>' +
             '<button class="kbtn" data-action="' + a + '">' +
             G.input.keymap.keysOf(a).map(T.keyLabel).join(' / ') + '</button></div>';
    }).join('');
  }

  /* ---------- input ---------- */
  function buildInput() {
    var actions = {
      left: function () { G.engine.move(-1); },
      right: function () { G.engine.move(1); },
      softDrop: function () { G.engine.softDrop(); },
      hardDrop: function () { G.engine.hardDrop(); },
      rotateCW: function () { G.engine.rotate(1); },
      rotateCCW: function () { G.engine.rotate(-1); },
      rotate180: function () { G.engine.rotate(2); },
      hold: function () { G.engine.doHold(); },
      pause: function () {
        if (G.engine.state === 'playing' || G.engine.state === 'clearing') pauseGame();
        else if (G.engine.state === 'paused') resumeGame();
      },
      restart: function () {
        if (G.engine.state !== 'ready') startGame(G.mode || 'marathon');
      }
    };
    G.input = new T.Input({ keys: G.settings.keys, das: G.settings.das, arr: G.settings.arr, actions: actions });
    G.gestures = new T.Gestures({ cell: 30 });
  }

  /* ---------- loop ---------- */
  function loop(ts) {
    var dt = G.last ? Math.min(ts - G.last, 100) : 0;
    G.last = ts;

    var st = G.engine.state;
    if (st === 'playing' || st === 'clearing') G.input.update(dt);
    G.engine.update(dt);

    var evs = G.engine.drainEvents();
    for (var i = 0; i < evs.length; i++) handleEvent(evs[i]);

    if (G.engine.state === 'countdown') {
      var n = Math.ceil(G.engine.countdown / 1000);
      G.ui.showCountdown(G.engine.countdown);
      if (n !== G.lastCountdownBeep) {
        G.lastCountdownBeep = n;
        G.audio.play(n > 0 ? 'countdown' : 'go');
      }
      if (G.ui.screen !== 'countdown') G.ui.setScreen('countdown');
    } else if (G.engine.state === 'playing' && G.ui.screen !== 'game') {
      G.ui.setScreen('game');
    }

    if (G.pendingGameOver) { G.pendingGameOver = false; onGameOver(); }

    G.fx.update(dt);
    G.ui.updateHUD(G.engine);
    G.renderer.drawBoard(G.engine, G.fx, dt);
    G.renderer.drawNext(G.engine.queue);
    G.renderer.drawHold(G.engine.hold, G.engine.holdUsed);
    drawMessages();

    requestAnimationFrame(loop);
  }

  function drawMessages() {
    var host = $('msgs');
    if (!host) return;
    var html = '';
    for (var i = 0; i < G.fx.messages.length; i++) {
      var m = G.fx.messages[i];
      html += '<div class="msg" style="color:' + m.color + ';opacity:' + Math.max(0, Math.min(1, m.life * 1.4)) +
              ';transform:translateY(' + (-m.y) + 'px)">' + m.text + '</div>';
    }
    host.innerHTML = html;
  }

  /* ---------- escalado ---------- */
  function resize() {
    var wrap = $('boardWrap');
    if (!wrap) return;
    var availH = window.innerHeight - (window.innerWidth < 700 ? 210 : 130);
    var availW = Math.min(window.innerWidth - (window.innerWidth < 700 ? 24 : 300), 520);
    var cell = T.computeScale(availH, availW, T.COLS, T.ROWS, 12, 34);
    wrap.style.width = (cell * T.COLS) + 'px';
    wrap.style.height = (cell * T.ROWS) + 'px';
    document.documentElement.style.setProperty('--cell', cell + 'px');
  }

  /* ---------- arranque ---------- */
  function init() {
    G.settings = T.Settings.load();
    G.engine = new T.Engine();
    G.fx = new T.Effects({ settings: G.settings });
    G.audio = new T.Audio({ enabled: G.settings.sound, volume: G.settings.volume });
    G.renderer = new T.Renderer({ board: $('board'), next: $('next'), hold: $('hold') }, { settings: G.settings });
    G.ui = new T.UI({});
    buildInput();
    applySettings();
    G.mode = 'marathon';
    G.ui.setScreen('menu');
    refreshMenu();
    updateOptionLabels();
    buildKeyBinder();
    G.ui.renderHelp(G.input.keymap);

    /* menú */
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-go]') : null;
      if (b) {
        var go = b.getAttribute('data-go');
        G.audio.play('menu');
        if (go === 'menu') backToMenu();
        else if (go === 'resume') resumeGame();
        else if (go === 'restart') startGame(G.mode);
        else if (go === 'continue') { if (!resumeSaved()) startGame('marathon'); }
        else if (go === 'fullscreen') G.ui.toggleFullscreen();
        else {
          if (go === 'options') { updateOptionLabels(); buildKeyBinder(); }
          if (go === 'help') G.ui.renderHelp(G.input.keymap);
          if (go === 'stats') { G.ui.renderScores(G.mode); G.ui.renderPieceStats(G.engine); }
          G.ui.setScreen(go);
        }
        return;
      }
      var m = e.target.closest ? e.target.closest('[data-mode]') : null;
      if (m) { startGame(m.getAttribute('data-mode')); return; }
      var st = e.target.closest ? e.target.closest('[data-scores]') : null;
      if (st) { G.ui.renderScores(st.getAttribute('data-scores')); return; }
      var kb = e.target.closest ? e.target.closest('.kbtn') : null;
      if (kb) {
        kb.textContent = '…';
        G.input.startCapture(kb.getAttribute('data-action'));
        G.capturingBtn = kb;
      }
    });

    /* teclado */
    document.addEventListener('keydown', function (e) {
      var k = T.normKey(e.key);
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'enter'].indexOf(k) !== -1) e.preventDefault();

      if (G.input.capturing) {
        G.input.keyDown(k);
        buildKeyBinder();
        G.ui.renderHelp(G.input.keymap);
        saveSettings();
        G.capturingBtn = null;
        return;
      }
      if (k === 'f') { G.ui.toggleFullscreen(); return; }
      if (k === 'h' && G.engine.state !== 'playing') { G.ui.renderHelp(G.input.keymap); G.ui.setScreen('help'); return; }

      var playing = G.engine.state === 'playing' || G.engine.state === 'clearing' || G.engine.state === 'paused' || G.engine.state === 'countdown';
      if (!playing) {
        if (k === 'enter' || k === ' ') startGame(G.mode || 'marathon');
        if (k === 'escape') backToMenu();
        return;
      }
      G.input.keyDown(k);
    });
    document.addEventListener('keyup', function (e) { G.input.keyUp(T.normKey(e.key)); });

    /* táctil */
    var wrap = $('boardWrap');
    if (wrap) {
      var run = function (acts) {
        for (var i = 0; i < acts.length; i++) G.input.fire(acts[i]);
      };
      wrap.addEventListener('pointerdown', function (e) {
        if (G.engine.state !== 'playing') return;
        wrap.setPointerCapture && wrap.setPointerCapture(e.pointerId);
        G.gestures.start(e.clientX, e.clientY, e.timeStamp);
      });
      wrap.addEventListener('pointermove', function (e) {
        if (G.engine.state !== 'playing') return;
        run(G.gestures.move(e.clientX, e.clientY, e.timeStamp));
      });
      wrap.addEventListener('pointerup', function (e) {
        if (G.engine.state !== 'playing') return;
        run(G.gestures.end(e.clientX, e.clientY, e.timeStamp));
      });
    }

    /* botones táctiles */
    var touch = $('touch');
    if (touch) {
      touch.addEventListener('pointerdown', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        e.preventDefault();
        var a = b.getAttribute('data-act');
        if (G.engine.state === 'playing') G.input.fire(a);
        else if (a === 'pause') G.input.fire('pause');
      });
    }

    /* opciones */
    bindOption('optTheme', 'theme', 'text');
    bindOption('optGhost', 'ghost', 'check');
    bindOption('optGhostOpacity', 'ghostOpacity', 'num');
    bindOption('optGrid', 'grid', 'check');
    bindOption('optShake', 'shake', 'check');
    bindOption('optParticles', 'particles', 'check');
    bindOption('optBackground', 'background', 'check');
    bindOption('optSound', 'sound', 'check');
    bindOption('optVolume', 'volume', 'num');
    bindOption('optVibration', 'vibration', 'check');
    bindOption('optDas', 'das', 'num');
    bindOption('optArr', 'arr', 'num');
    bindOption('optLevel', 'startLevel', 'num');
    var reset = $('btnResetKeys');
    if (reset) reset.addEventListener('click', function () {
      G.input.keymap.resetDefaults();
      saveSettings();
      buildKeyBinder();
      G.ui.renderHelp(G.input.keymap);
    });
    var clear = $('btnClearRecords');
    if (clear) clear.addEventListener('click', function () {
      T.Records.clear();
      refreshMenu();
      G.ui.renderScores(G.mode);
    });

    /* ventana */
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (G.engine.state === 'playing' || G.engine.state === 'clearing') pauseGame();
        G.audio.suspend();
      }
    });
    window.addEventListener('beforeunload', function () {
      if (G.engine.state === 'playing' || G.engine.state === 'paused' || G.engine.state === 'clearing') {
        G.engine.pause();
        T.Save.write(G.engine.serialize());
      }
    });

    resize();
    requestAnimationFrame(loop);
  }

  T.init = init;
  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
