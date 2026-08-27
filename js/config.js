/* config.js — constantes, formas, kicks, temas. Sin DOM. */
(function (T) {
  'use strict';

  T.COLS = 10;
  T.ROWS = 20;
  T.HIDDEN = 2;                  // filas ocultas arriba, para el spawn
  T.TOTAL_ROWS = T.ROWS + T.HIDDEN;

  T.NEXT_COUNT = 5;

  T.TIMING = {
    das: 150,                    // retardo antes del auto-repeat lateral
    arr: 40,                     // intervalo del auto-repeat
    soft: 45,                    // intervalo del soft drop sostenido
    lockDelay: 500,
    maxLockResets: 15,
    clearAnim: 260,
    countdown: 3000,
    spawnPop: 90
  };

  T.MODES = {
    marathon: { id: 'marathon', label: 'Marathon', goalLines: 0,  timeLimit: 0,      desc: 'Sin final: subí de nivel hasta que la pila te gane.' },
    sprint:   { id: 'sprint',   label: 'Sprint',   goalLines: 40, timeLimit: 0,      desc: '40 líneas lo más rápido posible.' },
    ultra:    { id: 'ultra',    label: 'Ultra',    goalLines: 0,  timeLimit: 120000, desc: 'Dos minutos: el score más alto que puedas.' }
  };

  T.PIECES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  // Celdas [x,y] por estado de rotación (0=spawn, 1=CW, 2=180, 3=CCW)
  T.SHAPES = {
    I: [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]]],
    J: [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]],
    L: [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]],
    O: [[[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]]],
    S: [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]], [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]]],
    T: [[[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]]],
    Z: [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]]]
  };

  // Wall kicks SRS con la Y ya invertida (positivo = hacia abajo en pantalla)
  T.KICKS = {
    '0>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '1>0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '1>2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '2>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '2>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '3>2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '3>0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '0>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]]
  };
  T.KICKS_I = {
    '0>1': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '1>0': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '1>2': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    '2>1': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '2>3': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '3>2': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '3>0': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '0>3': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
  };
  // Kicks del giro de 180 (estilo SRS+), Y también invertida
  T.KICKS_180 = {
    '0>2': [[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0]],
    '2>0': [[0,0],[0,1],[-1,1],[1,1],[-1,0],[1,0]],
    '1>3': [[0,0],[1,0],[1,-2],[1,-1],[0,-2],[0,-1]],
    '3>1': [[0,0],[-1,0],[-1,-2],[-1,-1],[0,-2],[0,-1]]
  };

  /* Puntaje */
  T.SCORE = {
    lines:      [0, 100, 300, 500, 800],
    tspin:      [0, 800, 1200, 1600, 2000],
    tspinMini:  [0, 200, 400, 600, 800],
    tspinNoLine:     400,
    tspinMiniNoLine: 100,
    perfectClear: [0, 800, 1200, 1800, 2000],
    combo: 50,
    softDrop: 1,
    hardDrop: 2,
    b2bMultiplier: 1.5
  };

  /* Temas de color */
  T.THEMES = {
    neon: {
      label: 'Neón',
      pieces: { I:'#00e5ff', J:'#3d6bff', L:'#ff9f1c', O:'#ffe14d', S:'#3ddc84', T:'#c04dff', Z:'#ff4d5e' },
      bg:'#0a0b14', board:'#12142a', grid:'#1c1f3d', line:'#242850',
      txt:'#e8ecff', dim:'#7c85b8', accent:'#00e5ff', accent2:'#ff2fb3'
    },
    clasico: {
      label: 'Clásico',
      pieces: { I:'#31c7ef', J:'#5a65ad', L:'#ef7921', O:'#f7d308', S:'#42b642', T:'#ad4d9c', Z:'#ef2029' },
      bg:'#101010', board:'#181818', grid:'#242424', line:'#2f2f2f',
      txt:'#f2f2f2', dim:'#8a8a8a', accent:'#f7d308', accent2:'#ef2029'
    },
    mono: {
      label: 'Monocromo',
      pieces: { I:'#f2f5ff', J:'#b9c2e0', L:'#dfe5f7', O:'#ffffff', S:'#a4aecb', T:'#cfd6ee', Z:'#8f98b5' },
      bg:'#07080d', board:'#0e1018', grid:'#171a26', line:'#202433',
      txt:'#eef1fa', dim:'#767e99', accent:'#dfe5f7', accent2:'#8f98b5'
    },
    pastel: {
      label: 'Pastel',
      pieces: { I:'#7fd8de', J:'#8fa3e8', L:'#f2b880', O:'#f6e07d', S:'#9adba0', T:'#c9a3e8', Z:'#f09aa4' },
      bg:'#141220', board:'#1d1a2c', grid:'#2a2540', line:'#352e50',
      txt:'#f4f1ff', dim:'#9d95bd', accent:'#9adba0', accent2:'#f09aa4'
    }
  };

  /* Acciones y teclas por defecto */
  T.ACTIONS = ['left', 'right', 'softDrop', 'hardDrop', 'rotateCW', 'rotateCCW', 'rotate180', 'hold', 'pause', 'restart'];
  T.ACTION_LABELS = {
    left: 'Mover izquierda', right: 'Mover derecha', softDrop: 'Bajar', hardDrop: 'Caída rápida',
    rotateCW: 'Rotar', rotateCCW: 'Rotar al revés', rotate180: 'Rotar 180°', hold: 'Guardar pieza (hold)',
    pause: 'Pausa', restart: 'Reiniciar'
  };
  T.DEFAULT_KEYS = {
    left:      ['arrowleft'],
    right:     ['arrowright'],
    softDrop:  ['arrowdown'],
    hardDrop:  ['enter'],
    rotateCW:  [' ', 'arrowup', 'x'],
    rotateCCW: ['z', 'control'],
    rotate180: ['a'],
    hold:      ['c', 'shift'],
    pause:     ['p', 'escape'],
    restart:   ['r']
  };

  /* Colores de los mensajes flotantes, por tipo de evento */
  T.MSG_STYLE = {
    single:  { color: '#8fa3e8' },
    double:  { color: '#3ddc84' },
    triple:  { color: '#ffe14d' },
    tetris:  { color: '#00e5ff' },
    tspin:   { color: '#c04dff' },
    b2b:     { color: '#ff9f1c' },
    combo:   { color: '#ff2fb3' },
    perfect: { color: '#ffffff' },
    level:   { color: '#3ddc84' }
  };

  T.DEFAULT_SETTINGS = {
    theme: 'neon',
    ghost: true,
    ghostOpacity: 0.4,
    grid: true,
    shake: true,
    particles: true,
    background: true,
    sound: true,
    volume: 0.5,
    vibration: true,
    das: T.TIMING.das,
    arr: T.TIMING.arr,
    startLevel: 1,
    keys: null                   // null = usar DEFAULT_KEYS
  };

})(typeof window !== 'undefined' ? (window.T = window.T || {}) : (global.T = global.T || {}));
