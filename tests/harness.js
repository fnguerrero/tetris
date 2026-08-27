/* harness.js — carga los módulos del juego en Node y provee el mini framework de tests.
   Los módulos de lógica no tocan el DOM; para los que sí (audio, input, ui) el harness
   arma stubs mínimos, así todo se puede verificar sin navegador. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/* ---------- stubs de navegador ---------- */
function makeElement(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    textContent: '', innerHTML: '', value: '', checked: false, disabled: false,
    width: 0, height: 0, offsetWidth: 100, offsetHeight: 100, dataset: {},
    style: new Proxy({}, { get: (t, k) => t[k] || '', set: (t, k, v) => (t[k] = v, true) }),
    children: [], attributes: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); }
    },
    getContext: () => makeCtx(),
    addEventListener(t, fn) { (this._h = this._h || {}), (this._h[t] = this._h[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { ((this._h || {})[t] || []).forEach(f => f(ev || {})); },
    appendChild(c) { this.children.push(c); return c; },
    replaceChildren(...c) { this.children = c; },
    remove() {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
    querySelector: () => makeElement('div'),
    querySelectorAll: () => [],
    closest() { return null; },
    focus() {}, blur() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 640, right: 320, bottom: 640 })
  };
  return el;
}
function makeCtx() {
  const noop = () => {};
  return new Proxy({
    canvas: { width: 320, height: 640 },
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 10 }),
    save: noop, restore: noop
  }, { get: (t, k) => (k in t ? t[k] : noop) });
}

function makeStorage() {
  const map = new Map();
  return {
    _map: map,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    clear: () => map.clear()
  };
}

/* ---------- carga de módulos ---------- */
const ORDER = ['config.js', 'storage.js', 'audio.js', 'engine.js', 'effects.js', 'render.js', 'input.js', 'ui.js'];

function load(opts) {
  opts = opts || {};
  const nodes = {};
  const listeners = {};
  const storage = makeStorage();

  const win = {
    T: {},
    devicePixelRatio: 1,
    innerWidth: 1280, innerHeight: 900,
    localStorage: storage,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    navigator: { vibrate: (...a) => { win.navigator._calls.push(a); return true; }, _calls: [], maxTouchPoints: 0 },
    AudioContext: opts.AudioContext || null,
    webkitAudioContext: null,
    getComputedStyle: () => ({ getPropertyValue: () => '' })
  };

  const doc = {
    _nodes: nodes,
    _listeners: listeners,
    documentElement: makeElement('html'),
    body: makeElement('body'),
    hidden: false,
    title: '',
    fullscreenElement: null,
    getElementById(id) { return nodes[id] || (nodes[id] = makeElement('div')); },
    createElement(tag) { return makeElement(tag); },
    querySelector: () => makeElement('div'),
    querySelectorAll: () => [],
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { (listeners[t] || []).forEach(f => f(ev || {})); },
    exitFullscreen() { doc.fullscreenElement = null; return Promise.resolve(); }
  };
  doc.documentElement.requestFullscreen = () => { doc.fullscreenElement = doc.documentElement; return Promise.resolve(); };

  const sandbox = {
    window: win, document: doc, localStorage: storage, navigator: win.navigator,
    console, Math, JSON, Date, Object, Array, String, Number, Boolean, Set, Map,
    Uint8ClampedArray, Promise, isNaN, parseInt, parseFloat, Proxy, Error,
    requestAnimationFrame: win.requestAnimationFrame,
    cancelAnimationFrame: win.cancelAnimationFrame,
    setTimeout: (fn, ms) => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    performance: { now: () => 0 }
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const files = opts.files || ORDER;
  for (const f of files) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) continue;
    try {
      vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
    } catch (e) {
      throw new Error('Error cargando js/' + f + ': ' + e.message);
    }
  }
  return { T: win.T, window: win, document: doc, storage, sandbox, nodes };
}

/* ---------- mini framework ---------- */
const state = { pass: 0, fail: 0, failures: [], suite: '' };

function suite(name) { state.suite = name; console.log('\n-- ' + name + ' --'); }
function ok(name, cond, extra) {
  if (cond) { state.pass++; console.log('  OK   ' + name); }
  else {
    state.fail++;
    state.failures.push(state.suite + ' / ' + name + (extra ? '  ->  ' + extra : ''));
    console.log('  FAIL ' + name + (extra ? '  ->  ' + extra : ''));
  }
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  ok(name, a === b, 'esperado ' + b + ', obtenido ' + a);
}
function near(name, actual, expected, tol) {
  ok(name, Math.abs(actual - expected) <= (tol === undefined ? 0.001 : tol), 'esperado ~' + expected + ', obtenido ' + actual);
}
function throws(name, fn) {
  let t = false;
  try { fn(); } catch (e) { t = true; }
  ok(name, t, 'no lanzó');
}

/* ---------- utilidades de juego para los tests ---------- */
function seededRng(seed) {
  let s = seed || 12345;
  return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
/** Llena las n filas de abajo dejando libre la columna `gap`. */
function fillRows(eng, n, gap) {
  gap = (gap === undefined) ? 9 : gap;
  const T = eng.constructor.T || null;
  const total = eng.grid.length, cols = eng.grid[0].length;
  for (let y = total - n; y < total; y++)
    for (let x = 0; x < cols; x++) eng.grid[y][x] = (x === gap) ? null : 'O';
}
/** Deja una I vertical justo sobre la columna `col` y la tira. */
function dropIVertical(eng, col) {
  eng.piece = { type: 'I', rot: 0, x: 3, y: 0 };
  eng.rotate(1);
  eng.piece.x = col - 2;
  eng.hardDrop();
}
/** Avanza el motor en pasos de `step` ms hasta un total de `ms`. */
function tick(eng, ms, step) {
  step = step || 16;
  let t = 0;
  while (t < ms) { eng.update(Math.min(step, ms - t)); t += step; }
}

module.exports = { load, suite, ok, eq, near, throws, state, seededRng, fillRows, dropIVertical, tick, makeElement, makeCtx };
