/* engine.test.js — lógica del juego */
'use strict';
const H = require('./harness');

module.exports = function run() {
  const { T } = H.load({ files: ['config.js', 'engine.js'] });
  const mk = (mode, opts) => {
    const e = new T.Engine({ rng: H.seededRng(7) });
    e.start(mode || 'marathon', Object.assign({ countdown: 0 }, opts || {}));
    return e;
  };
  const fill = (e, n, gap) => {
    for (let y = T.TOTAL_ROWS - n; y < T.TOTAL_ROWS; y++)
      for (let x = 0; x < T.COLS; x++) e.grid[y][x] = (x === (gap === undefined ? 9 : gap)) ? null : 'O';
  };
  const dropI = (e, col) => {
    e.piece = { type: 'I', rot: 0, x: 3, y: 0 };
    e.lockTimer = null; e.lastAction = null;
    e.rotate(1);
    e.piece.x = col - 2;
    let d = 0, y = e.piece.y;
    while (e.valid(e.piece, e.piece.rot, e.piece.x, y + 1)) { y++; d++; }
    e.hardDrop();
    return d;
  };
  const flush = e => { if (e.state === 'clearing') e.finishClear(); };

  /* ---------------- arranque ---------------- */
  H.suite('Arranque');
  let e = mk();
  H.ok('el motor arranca jugando', e.state === 'playing', 'state=' + e.state);
  H.ok('hay una pieza activa', !!e.piece, 'piece=' + JSON.stringify(e.piece));
  H.eq('la cola trae 5 piezas', e.queue.length, 5);
  H.ok('el tablero arranca vacío', e.grid.every(r => r.every(c => !c)));
  H.eq('score inicial', e.score, 0);
  H.eq('nivel inicial', e.level, 1);

  /* ---------------- line clears y puntaje ---------------- */
  H.suite('Line clears y puntaje');
  e = mk();
  fill(e, 4);
  let d = dropI(e, 9);
  H.ok('entra en estado clearing', e.state === 'clearing', 'state=' + e.state);
  flush(e);
  H.eq('el tetris borra 4 líneas', e.lines, 4);
  H.ok('la fila de abajo queda limpia', e.grid[T.TOTAL_ROWS - 1].every(c => !c));
  H.ok('back-to-back armado', e.backToBack === true);

  e = mk();
  fill(e, 1);
  d = dropI(e, 9);
  flush(e);
  H.eq('un single suma 100 x nivel + hard drop', e.score, 100 + d * 2);

  e = mk();
  e.grid[T.TOTAL_ROWS - 12][0] = 'O';   // basura suelta (bien arriba: tras el 1er tetris baja 4 filas): evita que los tetris sean Perfect Clear
  fill(e, 4);
  d = dropI(e, 9);
  flush(e);
  const afterFirst = e.score;
  fill(e, 4);
  const d2 = dropI(e, 9);
  flush(e);
  H.eq('segundo tetris: b2b x1.5 + combo', e.score - afterFirst, Math.floor(800 * 1.5) + 50 + d2 * 2);
  H.eq('8 líneas en total', e.lines, 8);
  H.eq('sigue en nivel 1', e.level, 1);

  fill(e, 2);
  dropI(e, 9);
  flush(e);
  H.eq('nivel 2 a las 10 líneas', e.level, 2);
  H.ok('la gravedad se acelera', e.gravityMs() < 1000, 'g=' + Math.round(e.gravityMs()));

  /* ---------------- perfect clear ---------------- */
  H.suite('Perfect Clear');
  e = mk();
  fill(e, 4);
  H.ok('detecta el tablero limpio', e.isPerfectClear([T.TOTAL_ROWS - 1, T.TOTAL_ROWS - 2, T.TOTAL_ROWS - 3, T.TOTAL_ROWS - 4]));
  d = dropI(e, 9);
  const pcMsg = e.events.filter(ev => ev.type === 'message' && ev.kind === 'perfect');
  H.eq('avisa el Perfect Clear', pcMsg.length, 1);
  H.eq('suma el bonus de PC', e.score, 800 + T.SCORE.perfectClear[4] + d * 2);
  H.eq('lo cuenta en las stats', e.stats.perfectClears, 1);
  flush(e);
  H.ok('el tablero queda vacío', e.grid.every(r => r.every(c => !c)));

  e = mk();
  e.grid[T.TOTAL_ROWS - 5][0] = 'O';
  fill(e, 1);
  dropI(e, 9);
  H.ok('con basura arriba no es PC', e.stats.perfectClears === 0);

  /* ---------------- rotación y SRS ---------------- */
  H.suite('Rotación y SRS');
  e = mk();
  e.piece = { type: 'I', rot: 0, x: -1, y: 5 };
  e.rotate(1);
  H.ok('wall kick de la I contra la pared izquierda', e.valid(e.piece) && e.piece.rot === 1, 'x=' + e.piece.x + ' rot=' + e.piece.rot);
  e.piece = { type: 'T', rot: 0, x: 4, y: 5 };
  e.rotate(1); e.rotate(1); e.rotate(1); e.rotate(1);
  H.ok('4 rotaciones vuelven al estado 0', e.piece.rot === 0 && e.piece.x === 4);
  e.piece = { type: 'O', rot: 0, x: 4, y: 5 };
  H.ok('la O no rota', e.rotate(1) === false && e.piece.rot === 0);
  e.piece = { type: 'L', rot: 0, x: 8, y: 5 };
  e.rotate(1);
  H.ok('rotar contra la pared derecha deja la pieza adentro', e.cellsOf(e.piece).every(c => c[0] < T.COLS));

  H.suite('Rotación 180');
  e = mk();
  e.piece = { type: 'T', rot: 0, x: 4, y: 5 };
  H.ok('la 180 se aplica de una', e.rotate(2) === true && e.piece.rot === 2, 'rot=' + e.piece.rot);
  e.piece = { type: 'J', rot: 1, x: 4, y: 5 };
  e.rotate(2);
  H.eq('180 desde rot 1 va a rot 3', e.piece.rot, 3);
  e.piece = { type: 'S', rot: 0, x: 4, y: 5 };
  e.rotate(2); e.rotate(2);
  H.eq('dos 180 vuelven al origen', e.piece.rot, 0);

  /* ---------------- movimiento ---------------- */
  H.suite('Movimiento y límites');
  e = mk();
  let guard = 0; while (e.move(-1) && guard++ < 20);
  H.ok('no se sale por la izquierda', e.cellsOf(e.piece).every(c => c[0] >= 0));
  guard = 0; while (e.move(1) && guard++ < 20);
  H.ok('no se sale por la derecha', e.cellsOf(e.piece).every(c => c[0] < T.COLS));
  guard = 0; while (e.softDrop() && guard++ < 40);
  H.ok('el soft drop llega al piso', e.cellsOf(e.piece).some(c => c[1] === T.TOTAL_ROWS - 1));
  H.ok('el soft drop suma puntos', e.score > 0, 'score=' + e.score);
  e = mk();
  const y0 = e.piece.y;
  e.hardDrop();
  H.ok('el hard drop fija la pieza', e.stats.pieces === 1, 'pieces=' + e.stats.pieces);

  /* ---------------- hold ---------------- */
  H.suite('Hold');
  e = mk();
  const t1 = e.piece.type;
  e.doHold();
  H.ok('guarda la pieza y trae otra', e.hold === t1 && e.piece.type !== t1, 'hold=' + e.hold);
  const t2 = e.piece.type;
  H.ok('no se puede holdear dos veces seguidas', e.doHold() === false && e.piece.type === t2);
  e.hardDrop();
  H.ok('tras fijar, el hold se habilita de nuevo', e.holdUsed === false);
  const t3 = e.piece.type;
  e.doHold();
  H.ok('el segundo hold intercambia', e.piece.type === t1 && e.hold === t3, 'piece=' + e.piece.type + ' hold=' + e.hold);

  /* ---------------- 7-bag ---------------- */
  H.suite('7-bag y cola');
  e = mk();
  const bolsa1 = [e.piece.type].concat(e.queue.slice(0, 5), e.bag.slice(0, 1));
  H.eq('la primera bolsa trae las 7 sin repetir', new Set(bolsa1).size, 7);
  H.eq('la segunda bolsa también', new Set(e.bag.slice(1, 8)).size, 7);
  const orden = e.queue.slice();
  e.hardDrop();
  H.eq('al consumir, la cola respeta el orden', e.piece.type, orden[0]);
  H.eq('la cola se repone a 5', e.queue.length, 5);

  /* ---------------- ghost, lock y peligro ---------------- */
  H.suite('Ghost, lock delay y peligro');
  e = mk();
  H.ok('el ghost cae hasta el piso', e.ghostY() > e.piece.y, 'ghostY=' + e.ghostY());
  e.piece.y = e.ghostY();
  e.update(0);
  H.near('progreso de lock en 0 al apoyar', e.lockProgress(), 0, 0.05);
  H.tick(e, 250, 50);                 // update() clampa dt a 100 ms: hay que avanzar en pasos
  H.ok('el progreso de lock avanza', e.lockProgress() > 0.4 && e.lockProgress() < 0.6, 'p=' + e.lockProgress().toFixed(2));
  H.tick(e, 300, 50);
  H.ok('al completarse el lock, la pieza se fija', e.stats.pieces === 1, 'pieces=' + e.stats.pieces);

  e = mk();
  H.eq('pila vacía = altura 0', e.stackHeight(), 0);
  H.ok('sin peligro al empezar', e.inDanger() === false);
  fill(e, 17);
  H.eq('altura de la pila', e.stackHeight(), 17);
  H.ok('avisa peligro con la pila alta', e.inDanger() === true);

  /* ---------------- T-spin ---------------- */
  H.suite('T-spin');
  e = mk();
  e.piece = { type: 'T', rot: 1, x: 4, y: 10 };
  e.grid[10][4] = 'O'; e.grid[12][4] = 'O'; e.grid[12][6] = 'O';
  e.rotate(1);
  H.ok('detecta el T-spin (3 esquinas + rotación)', e.detectTSpin() !== null, 'res=' + e.detectTSpin());
  e = mk();
  e.piece = { type: 'T', rot: 2, x: 4, y: 10 };
  e.grid[10][4] = 'O'; e.grid[12][4] = 'O'; e.grid[12][6] = 'O';
  e.move(1);
  H.ok('sin rotación previa no cuenta', e.detectTSpin() === null);
  e = mk();
  e.piece = { type: 'I', rot: 1, x: 4, y: 10 };
  e.rotate(1);
  H.ok('solo la T hace T-spin', e.detectTSpin() === null);

  /* ---------------- game over ---------------- */
  H.suite('Game over');
  e = mk();
  guard = 0;
  while (e.state !== 'over' && guard++ < 300) { e.piece.x = 4; e.hardDrop(); flush(e); }
  H.ok('game over al apilar hasta arriba', e.state === 'over', 'state=' + e.state + ' piezas=' + guard);
  H.eq('el resultado es derrota', e.result, 'lose');
  H.ok('emite el evento gameover', e.events.some(ev => ev.type === 'gameover'));

  return true;
};
