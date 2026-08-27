# TODO — Tetris: 33 mejoras

Estados: `[ ]` pendiente · `[~]` en curso · `[x]` hecho y verificado · `[!]` bloqueado

## Andamiaje (previo a todo)

- [~] 00. Reorganizar en módulos + motor sin DOM + runner de tests · verif: `node tests/run.js` corre y reproduce en verde la cobertura actual (28 tests de lógica + 10 de controles)

## Núcleo de juego

- [ ] 01. Next queue de 5 piezas · verif: test — la cola tiene 5 y el orden se respeta al consumir
- [ ] 02. Rotación 180° con tecla A · verif: test — rot 0 -> 2 en un solo input, con kicks propios
- [ ] 03. Indicador visual de lock delay (parpadeo antes de fijar) · verif: test del progreso 0..1 expuesto por el motor
- [ ] 04. Perfect Clear con bonus y mensaje · verif: test — tablero vacío tras el clear suma el bonus correcto
- [ ] 05. Combo y back-to-back visibles en el HUD · verif: test — el estado expone combo y b2b; UI los lee
- [ ] 06. Nivel inicial seleccionable (1-15) · verif: test — arrancar en nivel 10 usa la gravedad de nivel 10
- [ ] 07. Modo Sprint: 40 líneas contrarreloj · verif: test — termina exactamente a las 40 líneas y registra el tiempo
- [ ] 08. Modo Ultra: 2 minutos, máximo score · verif: test — termina al agotar el tiempo
- [ ] 09. Selector de modo (Marathon / Sprint / Ultra) · verif: test — cada modo arranca con sus reglas
- [ ] 10. Countdown 3-2-1 al empezar y al despausar · verif: test — el estado 'countdown' bloquea los inputs de juego
- [ ] 11. Cronómetro y stats en vivo (tiempo, PPS, LPM) · verif: test — con 10 piezas en 5 s da 2.0 PPS
- [ ] 12. Panel de estadísticas de piezas usadas · verif: test — el conteo por tipo suma el total de piezas fijadas
- [ ] 13. Récords por modo persistidos · verif: test — guardar y releer récord de cada modo
- [ ] 14. Tabla de top 5 puntajes · verif: test — inserta ordenado y recorta a 5
- [ ] 15. Guardar y reanudar la partida en curso · verif: test — serializar, restaurar y comparar estado

## Feedback visual

- [ ] 16. Animación de line clear con flash y colapso · verif: test del progreso de la animación + captura en navegador
- [ ] 17. Screen shake configurable · verif: test — el offset decae a 0 y respeta el ajuste apagado
- [ ] 18. Partículas al borrar líneas · verif: test — se crean N partículas y expiran solas
- [ ] 19. Estela del hard drop · verif: test — la estela dura y se desvanece
- [ ] 20. Zona de peligro (aviso cuando la pila sube) · verif: test — el flag se enciende sobre el umbral de altura
- [ ] 21. Temas de color seleccionables · verif: test — cambiar tema cambia la paleta y persiste
- [ ] 22. Toggle de grilla · verif: test del ajuste + captura
- [ ] 23. Toggle y opacidad del ghost · verif: test — con ghost off el render no lo pide
- [ ] 24. Fondo animado sutil · verif: captura en navegador + sin errores de consola
- [ ] 25. Mensajes de acción con color por tipo · verif: test — cada evento produce su texto y su color

## Audio

- [ ] 26. SFX por evento (mover, rotar, lock, clear, tetris, level up, game over, hold) · verif: test — cada evento emite su sonido en el bus falso
- [ ] 27. Control de volumen persistente · verif: test — el volumen se guarda y se aplica
- [ ] 28. Vibración háptica en móvil · verif: test — llama a navigator.vibrate solo si está habilitado

## Controles y UX

- [ ] 29. Remapeo de teclas persistente · verif: test — remapear y resolver la acción por tecla
- [ ] 30. Menú de opciones completo · verif: captura + test de que cada control escribe su ajuste
- [ ] 31. Gestos táctiles (swipe / tap) · verif: test — la máquina de gestos traduce trazos a acciones
- [ ] 32. Overlay de ayuda de controles · verif: captura + test de que lista el mapeo vigente
- [ ] 33. Pantalla completa y escalado responsive · verif: test del cálculo de escala + captura
