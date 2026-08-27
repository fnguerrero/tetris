# TETRIS

> **Estado: Activo** — jugable.

Tetris con las reglas modernas: rotación **SRS** con wall kicks, bolsa de 7 piezas, pieza
fantasma, *hold*, niveles que aceleran la caída y récord guardado en el navegador.
También se juega desde el celular, con controles táctiles.

HTML y JavaScript puro: sin dependencias, sin build y sin un solo archivo de imagen ni de
audio — los gráficos se dibujan por código y el sonido es sintetizado con WebAudio.

## Cómo está armado

| Archivo | Qué hace |
|---|---|
| `js/engine.js` | Tablero, piezas, rotaciones y colisiones |
| `js/render.js` | Dibujo del tablero y de las piezas |
| `js/input.js` | Teclado y controles táctiles |
| `js/audio.js` | Sonido sintetizado |
| `js/storage.js` | Récord y preferencias |
| `tests` | Pruebas del motor |
