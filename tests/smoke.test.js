/* smoke.test.js — todos los módulos cargan y quedan enganchados entre sí */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./harness');

module.exports = function run() {
  H.suite('Carga de módulos');
  const env = H.load();
  const T = env.T;

  ['Engine', 'Effects', 'Renderer', 'Input', 'Gestures', 'KeyMap', 'UI', 'Audio', 'Store', 'Settings', 'Records', 'Scores', 'Save']
    .forEach(k => H.ok('expone T.' + k, typeof T[k] === 'function' || typeof T[k] === 'object', 'tipo=' + typeof T[k]));

  H.ok('el tablero es de 10x20 + 2 ocultas', T.COLS === 10 && T.ROWS === 20 && T.TOTAL_ROWS === 22);
  H.ok('hay 7 piezas con 4 rotaciones', T.PIECES.length === 7 && T.PIECES.every(p => T.SHAPES[p].length === 4));
  H.ok('cada rotación tiene 4 celdas', T.PIECES.every(p => T.SHAPES[p].every(r => r.length === 4)));
  H.ok('hay al menos 3 temas', Object.keys(T.THEMES).length >= 3);
  H.ok('cada tema define las 7 piezas', Object.keys(T.THEMES).every(k => T.PIECES.every(p => !!T.THEMES[k].pieces[p])));
  H.ok('hay 3 modos de juego', Object.keys(T.MODES).length === 3);

  H.suite('index.html');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scripts = (html.match(/<script src="js\/([a-z]+)\.js">/g) || []).map(s => s.match(/js\/([a-z]+)\.js/)[1]);
  H.eq('carga los 9 módulos en orden', scripts,
    ['config', 'storage', 'audio', 'engine', 'effects', 'render', 'input', 'ui', 'main']);
  H.ok('no quedaron scripts embebidos', html.indexOf('<script>') === -1);
  H.ok('enlaza la hoja de estilos', html.indexOf('css/style.css') !== -1);
  ['board', 'next', 'hold', 'overlay', 'screen-menu', 'screen-options', 'screen-help', 'screen-stats', 'screen-over', 'screen-pause', 'touch']
    .forEach(id => H.ok('tiene #' + id, html.indexOf('id="' + id + '"') !== -1));
  H.ok('todo el JS vive en js/', fs.readdirSync(path.join(__dirname, '..', 'js')).every(f => f.endsWith('.js')));

  H.suite('Tamaño de los módulos');
  fs.readdirSync(path.join(__dirname, '..', 'js')).forEach(f => {
    const n = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8').split('\n').length;
    H.ok('js/' + f + ' bajo 500 líneas', n < 500, n + ' líneas');
  });

  return true;
};
