# Arquitectura de CodeIdle

## Resumen

El juego está montado como una SPA estática con HTML, CSS y JavaScript modular cargado por orden de `<script>` en [index.html](index.html). No usa bundler ni framework de componentes; el flujo principal depende de:

1. `CONFIG` como fuente de balance y catálogos.
2. `gameState` como estado persistente y capa de reglas.
3. módulos de UI, audio, eventos, temas, logros y admin.
4. `gameEngine` para loops de tiempo.
5. `app.init()` para cablear todo.

## Estructura real

```text
src/
├── config.js
├── state.js
├── game.js
├── main.js
└── modules/
    ├── achievements.js
    ├── admin.js
    ├── audio.js
    ├── events.js
    ├── game-logic.js
    ├── themes.js
    └── ui.js
```

## Responsabilidades

### [src/config.js](src/config.js)

- Balance general del juego.
- Catálogos de lenguajes, upgrades, frameworks, artefactos, especializaciones, equipo, misiones, logros y temas.
- Constantes de loops, prestige, release, tendencias y offline.

### [src/state.js](src/state.js)

- Estado central del juego.
- Persistencia en `localStorage`.
- Cálculos principales: click power, generación pasiva, costos, affordability y boosts.
- Estado admin/creative y restauración de sesión.

### [src/modules/game-logic.js](src/modules/game-logic.js)

- Orquestación de acciones del jugador.
- Click manual, commits, compras y acciones principales.
- Coordina `gameState`, `uiModule`, `audioModule` y `achievementsModule`.

### [src/modules/ui.js](src/modules/ui.js)

- Render de upgrades, lenguajes, lab, meta, misiones y estadísticas.
- Vista del editor tipo IDE y sus tabs.
- Notificaciones y animaciones del feedback principal.
- Estados visuales especiales, como la mejora visual del `Monitor 4K`.

### [src/modules/audio.js](src/modules/audio.js)

- Sonidos genéricos con Web Audio para beep y feedback.
- Sonido del `Teclado Mecánico` basado en samples remotos con pool de instancias.
- Postproceso simple para brillo/cuerpo mediante `bandpass` y `lowpass`.
- Tolerancia a ausencia de `AudioContext`.

### [src/modules/events.js](src/modules/events.js)

- Registro y ejecución de eventos aleatorios.
- Efectos temporales con tokens para evitar corrupción de estado.
- Diferenciación entre eventos livianos y decisiones modales.

### [src/modules/achievements.js](src/modules/achievements.js)

- Chequeo y desbloqueo de logros.
- Integración con audio, notificaciones y confetti.

### [src/modules/themes.js](src/modules/themes.js)

- Cambio de tema y persistencia visual.

### [src/modules/admin.js](src/modules/admin.js)

- Consola oculta, `godmode`, creative mode y comandos de debug.
- Hotkeys de administración.
- Badge visual en header y sincronización de estado admin.

### [src/game.js](src/game.js)

- Game loop principal.
- Tick de generación pasiva.
- Loop de eventos aleatorios y demás procesos temporales.

### [src/main.js](src/main.js)

- Punto de entrada.
- Inicializa módulos, UI, partículas y listeners.
- Maneja el toggle del panel derecho `Panel/Editor` y hooks globales de teclado.

## Flujos principales

### Click manual

```text
input usuario
→ gameLogic.handleClick()
→ gameState actualiza código, streak y commits
→ audioModule reproduce feedback
→ achievementsModule valida progreso
→ uiModule.update()
→ gameState.save(true)
```

### Compra de upgrade

```text
card click
→ gameLogic.buyUpgrade(key)
→ gameState.buyUpgrade(key)
→ audio y notificación
→ rerender parcial de UI
→ check de logros
→ save
```

### Evento o decisión

```text
gameEngine o event loop
→ eventsModule elige entrada del registry
→ execute()
→ efecto inmediato o temporal
→ uiModule.update()
→ save
```

## UI y layout

- [index.html](index.html) concentra el shell completo del juego.
- [styles.css](styles.css) contiene diseño, responsive, temas, animaciones, alertas, modal de decisiones, consola admin, editor y efectos especiales.
- El área principal se divide en:
  - panel izquierdo de click y progreso
  - panel derecho con toggle entre management y editor

## Orden de carga

El orden actual importa y está definido en [index.html](index.html):

1. `src/config.js`
2. `src/state.js`
3. módulos en `src/modules/*.js`
4. `src/game.js`
5. `src/main.js`

Si cambias este orden, rompes bindings globales entre módulos.

## Dónde tocar cada cosa

- Balance y contenido nuevo: [src/config.js](src/config.js)
- Reglas y persistencia: [src/state.js](src/state.js)
- Acciones del jugador: [src/modules/game-logic.js](src/modules/game-logic.js)
- Render y efectos visuales: [src/modules/ui.js](src/modules/ui.js), [styles.css](styles.css)
- Audio: [src/modules/audio.js](src/modules/audio.js)
- Eventos y decisiones: [src/modules/events.js](src/modules/events.js)
- Admin y debug: [src/modules/admin.js](src/modules/admin.js)

## Criterio de mantenimiento

- No agregar balance hardcodeado en `ui.js` o `game-logic.js` si puede vivir en `config.js`.
- Usar `gameLogic` para acciones de usuario; no mutar `gameState` desde listeners arbitrarios.
- Mantener editor, alertas y mejoras visuales como estados derivados del juego.
- Cualquier feature nueva debería ubicarse primero como:
  - dato de configuración,
  - regla de estado,
  - orquestación,
  - render,
  - o loop temporal.
