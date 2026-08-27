# SPEC — Tetris: 33 mejoras

## Objetivo

Llevar el Tetris de un solo archivo (versión inicial, funcional) a un juego completo con
33 mejoras concretas: modos de juego, estadísticas, persistencia, efectos visuales,
audio ampliado, controles configurables y UX de menús. Sin dependencias externas, sin
build, abrible con doble clic y publicable en GitHub Pages tal cual.

## Alcance

**Entra:**
- Las 33 mejoras listadas en TODO.md.
- Reorganización del código en módulos cargados con `<script src>` clásicos.
- Suite de tests en Node sobre la lógica pura (motor sin DOM).

**No entra:**
- Multijugador, backend, cuentas, leaderboards online.
- Frameworks, bundlers, npm, TypeScript.
- Música de fondo en loop (decisión explícita, ver Supuestos).
- Renombrar el proyecto ni publicarlo (push/deploy requieren confirmación aparte).

## Stack y decisiones

- HTML + CSS + JavaScript ES5/ES6 sin módulos ES (`import`/`export` no funcionan en
  `file://`). Scripts clásicos en orden, namespace único `window.T`.
- Canvas 2D para el tablero, hold, next y partículas.
- `localStorage` con wrapper tolerante a fallos (origen opaco, modo privado).
- Sin dependencias, sin build. `index.html` abre directo.

Estructura:

```
index.html        markup + carga de scripts
css/style.css     estilos y temas
js/config.js      constantes, formas, kicks, temas, textos
js/storage.js     settings y records persistentes
js/audio.js       SFX sintéticos
js/engine.js      LÓGICA PURA, sin DOM (testeable en Node)
js/render.js      dibujo del tablero y efectos
js/input.js       teclado, touch, remapeo
js/ui.js          menús, HUD, overlays
js/main.js        wiring y game loop
tests/engine.test.js  suite en Node
tests/run.js          runner
```

## Supuestos

Decisiones tomadas por criterio propio ante ambigüedad (crece durante el trabajo):

1. **"33 mejoras" no venía con lista** → las elijo yo, priorizando: primero lo que cambia
   la jugabilidad (modos, stats, persistencia), después feedback visual, después audio y
   UX. Lista completa y cerrada en TODO.md.
2. **Se reorganiza en módulos** en vez de seguir con un solo archivo de 700+ líneas: con
   33 mejoras encima quedaría inmantenible. Sigue siendo cero-build y `file://`.
3. **El motor no toca el DOM.** Todo lo verificable vive en `engine.js`, que corre igual en
   Node. Es lo que permite verificar sin manos.
4. **Nada de música en loop.** Solo SFX cortos disparados por evento. Motivo conocido:
   audio que queda colgado en pestañas viejas.
5. **Se conserva el mapeo actual** (Space rota, Enter tira) como default, ahora
   remapeable.
6. **Idioma de la UI: español.** Términos del juego en inglés donde son nombre propio
   (Tetris, T-Spin, Hold, Next, Perfect Clear).
7. **Los tests son la verificación primaria**; el navegador se usa para confirmar render,
   no como única prueba (el preview sirve snapshots cacheados y no es confiable para
   iterar).

## Criterios de aceptación

1. `node tests/run.js` pasa al 100%, con al menos 60 tests.
2. Las 33 mejoras están implementadas y cada una tiene al menos un test o una
   verificación registrada en la bitácora.
3. `index.html` abre sin errores de consola y se puede jugar una partida completa
   (spawn → line clear → game over) en los 3 modos.
4. Los ajustes (tema, teclas, volumen, ghost, grilla) persisten al recargar.
5. Los récords por modo persisten y se muestran.
6. El juego funciona con teclado y con gestos táctiles.
7. No hay dependencias externas: el juego abre desde `file://` sin servidor.
8. El código queda repartido en los módulos declarados, ninguno de más de ~500 líneas.

## Presupuesto

40 iteraciones. El TODO tiene 34 ítems (1 de andamiaje + 33 mejoras), así que el margen
es de 6 iteraciones para imprevistos y cierre.
