# Arquitectura de CodeIdle

## Resumen

El juego es una SPA estática con HTML, CSS y JavaScript cargado por orden de `<script>` en [index.html](index.html). No usa bundler ni framework de componentes, y funciona tanto servido por http como abriendo `index.html` directamente desde el disco. El flujo principal depende de:

1. `CONFIG` como fuente de balance, catálogos, textos y coreografías.
2. `SOUND_MANIFEST` como catálogo de sonidos (assets/audio/sounds.js).
3. `gameState` como estado persistente y capa de reglas.
4. Módulos: audio, efectos visuales, coreografías, ajustes, eventos, logros, UI, onboarding, admin…
5. `gameEngine` para los loops de tiempo.
6. `app.init()` para cablear todo.

## Estructura real

```text
index.html
styles.css
assets/
└── audio/
    ├── sounds.js        ← SOUND_MANIFEST (lo carga el juego)
    ├── ui/ sfx/ epic/   ← 38 sonidos en .ogg y .mp3 (58 variaciones)
    ├── CREDITS.md       ← origen y licencia de cada sonido
    ├── manifest.json    ← mismo catálogo con origen/licencia (no lo carga el juego)
    └── preview.html, preview/  ← solo para escuchar; no se cargan en el juego
src/
├── config.js
├── state.js
├── game.js
├── main.js
└── modules/
    ├── audio.js         ← motor de audio (Howler)
    ├── fx.js            ← efectos visuales (GSAP + tsParticles) y shatter()
    ├── fx-scene.js      ← escena del prestige (extiende fxModule)
    ├── feedback.js      ← coreografías audio + visual
    ├── settings.js      ← panel de sonido y efectos
    ├── events.js
    ├── achievements.js
    ├── themes.js
    ├── editor.js
    ├── ui.js
    ├── game-logic.js
    ├── golden-commit.js
    ├── onboarding.js
    └── admin.js
```

## Responsabilidades

### [src/config.js](src/config.js)

- Balance general y catálogos (lenguajes, upgrades, frameworks, artefactos, especializaciones, equipo, misiones, logros, temas).
- Onboarding (`FEATURE_UNLOCKS`, `NEXT_GOAL_RULES`, `ONBOARDING`).
- Audio: buses (`AUDIO_BUSES`), sliders (`AUDIO_SLIDERS`), limitador, pool del teclado, aura de racha y respaldos ZzFX (`SOUND_FALLBACKS`, `SOUND_FALLBACK_BY_BUS`).
- Coreografías (`CHOREOGRAPHIES`) y sus reglas de prioridad (`FEEDBACK`).
- Nunca duplica `bus`, `volume` ni `pitchRange` de los sonidos: eso vive en `SOUND_MANIFEST`.

### [assets/audio/sounds.js](assets/audio/sounds.js)

- Define el global `SOUND_MANIFEST`: `id → { files, bus, volume, pitchRange, durationMs, desc }`. `files` son rutas sin extensión, una por variación.
- Se carga con `<script>` (no con `fetch`) para que funcione desde `file://`.

### [src/state.js](src/state.js)

- Estado central y reglas: click power, generación, costes, prestige, misiones, onboarding.
- Persistencia en `localStorage` (formato versionado). Las partidas antiguas se migran al cargar con valores por defecto.
- Preferencias del jugador: `audioSettings` (0–100 por slider), `visualSettings` (`reduceMotion`, `shortCelebrations`) y `seenChoreographies` (vistas de cada coreografía). Se conservan en el prestige.

### [src/modules/audio.js](src/modules/audio.js)

- Motor sobre Howler.js: un `Howl` por archivo (`ruta.ogg`, `ruta.mp3`).
- `play(id, { pitch, volume, delay, loop })`: variación al azar (sin repetir la anterior) y tono aleatorio dentro de `pitchRange`. Con `pitch` fijo sube semitonos (`rate = 2^(n/12)`).
- Buses `ui`, `sfx`, `music`, `ambient` y `master`; `duck(bus, amount, ms)` baja un bus temporalmente con una rampa propia (no le afectan `freeze` ni `slowmo`).
- Servido por http: Web Audio, con limitador en el master (compresor, trim que anula su ganancia de compensación y recorte suave con techo de 0.98). Desde `file://`: HTML5 Audio, porque Chrome bloquea el XHR de archivos locales. En HTML5, tono y volumen se aplican directamente al `<audio>` para que no arranque con los valores por defecto.
- Precarga el bus `ui` al iniciar y el resto en la primera interacción, que también desbloquea el `AudioContext`.
- Si un archivo falla, suena su respaldo ZzFX.
- Pool del teclado mecánico: instancias de `ui_click` cuyo volumen y tono mejoran con el nivel del upgrade, con variación de tono por tecla y como máximo `POOL_SIZE` a la vez.
- Aura de racha: `aura_loop` en bucle (bus `ambient`) mientras la racha activa supera el umbral.

### [src/modules/fx.js](src/modules/fx.js)

- Efectos sobre GSAP y sus plugins: `shake`, `flash`, `crack` (grietas SVG con DrawSVG), `burst` (tsParticles: `fireworks` y `confettiExplosions`), `shatter` (ver abajo), `scramble` (ScrambleText), `banner` (SplitText + CustomEase), `odometer`, `pulse` y `glow`.
- `freeze(ms)` y `slowmo(factor, ms)` solo tocan lo visual: `gsap.globalTimeline.timeScale`, las animaciones CSS/WAAPI y las partículas. La economía usa `Date.now()` y sigue corriendo.
- Cada efecto aplica su primer estado de forma síncrona, así se pinta en el mismo frame que su sonido.
- Mientras anima un texto (scramble/odómetro) lo marca con `data-fx-lock` y `uiModule.setText()` no lo sobrescribe.
- "Reducir movimiento": sin sacudidas, cámara lenta, congelados, grietas, fragmentos ni partículas; solo destellos suaves, fundidos y sonido.
- `warmUp()` paga en tiempo libre el primer pintado caro de los efectos.

- `shatter(elemento, punto, contexto, { pieces, restoreMs, onRestore, prepare })`: rompe un elemento en 30–60 polígonos irregulares. Voronoi simple (semillas más densas cerca del impacto, celdas recortadas por mediatrices); cada fragmento es un clon visual del elemento recortado con `clip-path: polygon(...)` (sin html2canvas) y el original se oculta. Physics2D (velocidad hacia afuera, gravedad, rotación) y fundido; solo `transform` y `opacity` con `will-change`; el `clip-path` va en un hijo estático y `contain: strict` aísla cada clon. Con `prepare` devuelve un handle `fire()` y construye los clones por trozos (3 por frame) para que el impacto no cueste frame. Con "Reducir movimiento" no hay fragmentos: el original se desvanece. Lo usan el candado del desbloqueo y el prestige.
- Rendimiento: `isLite()` (menos de `PERF.MIN_CORES` núcleos o fps bajo `PERF.MIN_FPS`) usa 30 piezas y quita el blur (`body[data-fx-lite]`); un medidor de fps corre mientras dura un momento grande y un vigilante apaga los fragmentos si el vuelo va por debajo de 45 fps.

### [src/modules/fx-scene.js](src/modules/fx-scene.js)

- Extiende `fxModule` con los efectos de la coreografía `prestige`: `sceneStart`, `shatterPrep`/`shatterFire`, `void`/`voidOff`, `terminal`, `assemble`, `runBadge`, `ambient` y `sceneEnd`.
- `captureSnapshot()` clona el contenedor principal (podando lo que no se ve) *antes* de tocar el estado; esa foto vieja es lo que se desatura, tiembla, se agrieta y se rompe, mientras la UI nueva ya está armada detrás (oculta con `opacity: 0`).
- `sceneEnd()` (fin normal, Esc o coreografía descartada) quita foto, fondo y fragmentos, devuelve el contenedor real, suelta los textos retenidos (`data-fx-lock` en reputación y "Run N") y llama a `context.onSceneEnd` una sola vez.

### [src/modules/feedback.js](src/modules/feedback.js)

- `feedbackModule.play(id, contexto)` arma un `gsap.timeline()` con los pasos de `CONFIG.CHOREOGRAPHIES[id]` y agenda sonido, efectos y ducking de cada paso con un único `.call()`.
- La línea de tiempo avanza con tiempo real desde un listener prioritario de `gsap.ticker`, antes del render de GSAP. Así no la frenan `freeze`/`slowmo` y lo que lanza se pinta en ese mismo frame.
- Prioridades: un momento grande cancela los pequeños y medianos en curso; dos medianos no se superponen (uno cada 1,5 s, el resto en cola); los grandes se encolan entre sí; los pequeños se descartan durante uno grande.
- `skip()` (tecla Esc) lleva lo que está en curso a su estado final: aplica textos finales, apaga sus sonidos y retira lo pasajero.
- Usa la versión corta de una coreografía a partir de la 4.ª vista, o siempre con "Celebraciones cortas".
- Con `context.auto` (commits de la producción pasiva) usa la versión `auto`, nunca pasa del nivel pequeño y se espacia `AUTO_MIN_GAP_MS`.
- Cada efecto se resuelve justo antes de lanzarse, así uno puede dejar datos en el contexto para el siguiente (`encrypt` → `label`/`lock`, `pipeline` → `pipelineEl`). Una coreografía descartada o cancelada aplica igualmente sus estados finales.
- Pasos con `soundOptions.cutAt` (corta el sonido para dejar el silencio previo al impacto) y `soundRepeat` (repite subiendo de tono).
- Efectos nuevos en `fx.js`: `charge`, `stamp`, `floater`, `sparks`/`setAura`, `coins`, `encrypt`/`reveal`, `pipeline`/`pipelineStage`, `rocket`, `glitch`; `tier` vive en `uiModule.setCodeTier`.
- `gameLogic` arma los contextos (`buildStreakContext`, `buildMilestoneContext`, `buildReleaseContext`, `buildCodePowerContext`); `gameState.codePowerRecord` (guardado, se conserva en el prestige) evita repetir `code_power`.

### [src/modules/settings.js](src/modules/settings.js)

- Panel "Sonido y efectos" (botón de sliders en la cabecera): sliders Interfaz/Efectos/Música (70/80/40 por defecto; Música también controla el bus `ambient`), "Reducir movimiento" (por defecto sigue `prefers-reduced-motion`) y "Celebraciones cortas".

### [src/modules/game-logic.js](src/modules/game-logic.js)

- Orquestación de acciones del jugador: click, compras, misiones, release, mantenimiento, prestige, partida.
- `finishPrestige()`: foto de la UI vieja → `performPrestige()` + guardado inmediato → UI nueva → coreografía `prestige` (el aviso final sale en `onSceneEnd`).
- Dispara las coreografías (`feedbackModule.play`) con su contexto (tarjeta, posiciones, código antes/después…).

### [src/modules/ui.js](src/modules/ui.js)

- Render de tienda, lab, meta, misiones, estadísticas, notificaciones y tips.
- `setText()` respeta los textos que está animando un efecto.

### [src/modules/onboarding.js](src/modules/onboarding.js)

- Pestañas que se desbloquean, badges NEW, tips con estilo de commit (con coreografía `unlock`), línea `// TODO:` y bienvenida.

### [src/modules/golden-commit.js](src/modules/golden-commit.js)

- Commit dorado clicable cada 60–180 s, con coreografías `golden_spawn` y `golden_claim`.

### [src/modules/events.js](src/modules/events.js)

- Registro y ejecución de eventos aleatorios y decisiones. Cada evento dispara su coreografía (`event_bad`, `decision` o `event_good`).

### [src/modules/achievements.js](src/modules/achievements.js)

- Chequeo y desbloqueo de logros (coreografía `achievement`).

### [src/modules/themes.js](src/modules/themes.js) · [src/modules/editor.js](src/modules/editor.js)

- Temas visuales; editor tipo IDE con animaciones GSAP.

### [src/modules/admin.js](src/modules/admin.js)

- Consola oculta, `godmode`, creative mode, hotkeys y comandos de debug, incluidos `fx <id>`, `fx list`, `sound <id>` y `sound list`.

### [src/game.js](src/game.js)

- Game loop: generación pasiva, efectos temporales, commit dorado, aura de racha, onboarding y eventos aleatorios.

### [src/main.js](src/main.js)

- Punto de entrada: carga la partida, inicia audio → fx → feedback → ajustes y el resto de módulos, crea la UI y los listeners (Esc cierra el panel de ajustes o salta la coreografía en curso).

## Flujos principales

### Click manual

```text
input usuario
→ gameLogic.handleClick()
→ audioModule.playKey() (pool del teclado mecánico)
→ gameState actualiza código, racha y commits
→ racha: coreografía 'streak' en 25/50/100 y aura en bucle
→ processCommits → coreografía 'commit'
→ achievementsModule → coreografía 'achievement'
→ uiModule.update() → save
```

### Compra

```text
card click
→ gameLogic.buyX(key) → gameState.buyX(key)
→ rerender de la tienda
→ coreografía 'purchase' / 'keyboard_upgrade' / 'milestone' sobre la tarjeta nueva
   (o 'purchase_fail' si no alcanza)
→ onboarding.check() → save
```

### Coreografía

```text
feedbackModule.play(id, contexto)
→ prioridad: ¿cancela, encola o descarta?
→ gsap.timeline() con un .call() por paso (sonido + efectos + duck)
→ el reloj propio la avanza en cada frame (antes del render de GSAP)
→ Esc: skip() → estado final
```

### Evento o decisión

```text
event loop
→ eventsModule elige entrada del registry → execute()
→ coreografía del evento → uiModule.update() → save
```

## Orden de carga

El orden importa y está definido en [index.html](index.html):

1. Librerías por CDN: Howler.js → GSAP + ScrambleTextPlugin, SplitText, Physics2DPlugin, CustomEase, DrawSVGPlugin → tsParticles (preset fireworks y preset confettiExplosions; el segundo reutiliza el motor del primero) → ZzFXMicro. SweetAlert2 va en el `<head>`.
2. `src/config.js`
3. `assets/audio/sounds.js` (`SOUND_MANIFEST`, antes de `audio.js`)
4. `src/state.js`
5. Módulos: `audio.js` → `fx.js` → `fx-scene.js` → `feedback.js` → `settings.js` → `events.js` → `achievements.js` → `themes.js` → `editor.js` → `ui.js` → `game-logic.js` → `golden-commit.js` → `onboarding.js` → `admin.js`
6. `src/game.js`
7. `src/main.js`

Si cambias este orden, rompes bindings globales entre módulos.

## Dónde tocar cada cosa

- Balance, textos y contenido nuevo: [src/config.js](src/config.js)
- Sonidos nuevos: añadir archivos en `assets/audio/` y su entrada en [assets/audio/sounds.js](assets/audio/sounds.js); si no hay archivo, un respaldo ZzFX en `SOUND_FALLBACKS`
- Coreografías (qué suena y qué se ve en cada momento): `CHOREOGRAPHIES` en [src/config.js](src/config.js)
- Reglas y persistencia: [src/state.js](src/state.js)
- Acciones del jugador: [src/modules/game-logic.js](src/modules/game-logic.js)
- Efectos visuales: [src/modules/fx.js](src/modules/fx.js), [styles.css](styles.css)
- Audio: [src/modules/audio.js](src/modules/audio.js)
- Eventos y decisiones: [src/modules/events.js](src/modules/events.js)
- Admin y debug: [src/modules/admin.js](src/modules/admin.js)

## Criterio de mantenimiento

- No agregar balance ni textos fijos en `ui.js` o `game-logic.js` si pueden vivir en `config.js`.
- Usar `gameLogic` para acciones de usuario; no mutar `gameState` desde listeners arbitrarios.
- El feedback de un momento de juego se define como coreografía en `config.js`; el código solo la dispara con su contexto.
- Cualquier feature nueva debería ubicarse primero como dato de configuración, regla de estado, orquestación, render o loop temporal.
