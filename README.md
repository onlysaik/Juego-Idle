# CodeIdle

Juego incremental sobre programación con click manual, automatización, releases, reputación, decisiones, admin tools y una interfaz inspirada en IDE.

## Estado actual

- Click manual con racha, bonificación de click y commits automáticos cada 1000 líneas.
- 9 lenguajes desbloqueables con generación pasiva.
- 4 upgrades base: Teclado Mecánico, Monitor 4K, Café y VS Code Pro.
- 8 frameworks con boosts por lenguaje.
- 6 artefactos meta y sistema de reputación/prestige.
- Especializaciones, equipo, misiones y sistema de release con carga acumulada.
- Eventos aleatorios y decisiones centradas con impactos temporales o estratégicos.
- Logros, estadísticas, tendencias y reporte offline.
- Temas visuales, editor estilo IDE, audio, animaciones y layout responsive.
- Consola oculta de admin con `godmode`, comandos y hotkeys.

## Cómo ejecutar

1. Abre [index.html](index.html) directamente en el navegador, o usa un servidor estático como Live Server.
2. Espera a que carguen las dependencias CDN.
3. Empieza a jugar desde el panel izquierdo.

## Controles

| Acción | Control |
| --- | --- |
| Click manual | Click, `Space`, `Enter` |
| Cambiar panel móvil | Botones `Juego` / `Panel` |
| Cambiar vista del panel derecho | Botones `Panel` / `Editor` |
| Toggle sonido | Botón de sonido en header |
| Cambiar tema | Selector del header |
| Abrir consola admin | Tecla configurada en el flujo actual y luego escribir `godmode` |

## Comandos admin

Una vez activado `godmode`, la consola soporta:

- `help`
- `addcode N`
- `addrep N`
- `creative on|off`
- `decision`
- `event`
- `missions`
- `release`
- `resources`
- `unlockall`

Hotkeys activas en admin: `D`, `E`, `C`, `M`, `R`, `K`, `U`.

## Estructura actual

```text
Juego-Idle/
├── index.html
├── styles.css
├── favicon.svg
├── README.md
├── ARCHITECTURE.md
└── src/
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

## Dependencias CDN

- Bootstrap 5 (solo CSS)
- Font Awesome
- Google Fonts
- Anime.js
- SweetAlert2
- Canvas Confetti

## Guardado y datos

- El progreso persiste en `localStorage` (clave `codeIdleGame`, formato versionado con `saveVersion`).
- Solo se guarda el progreso (unidades compradas, contadores, misiones por id). Costes, multiplicadores y textos se leen siempre de [src/config.js](src/config.js), así los cambios de balance también afectan a partidas existentes.
- El guardado es automático (con throttle) y también se fuerza al ocultar o cerrar la pestaña.
- Progreso offline con tope `OFFLINE_CAP_SECONDS`; un hueco largo entre ticks (portátil suspendido) se trata igual.
- Los efectos temporales de eventos se guardan con fecha de expiración, así que sobreviven a recargas sin quedarse activos para siempre.
- Si la partida guardada está dañada, se respalda en `codeIdleGame:corrupt` y empieza una nueva.
- En la pestaña **Estadísticas** se puede exportar, importar o borrar la partida.

## Ajustes frecuentes

- Balance: [src/config.js](src/config.js)
- Estado y persistencia: [src/state.js](src/state.js)
- Flujo visual y render: [src/modules/ui.js](src/modules/ui.js)
- Eventos y decisiones: [src/modules/events.js](src/modules/events.js)
- Audio: [src/modules/audio.js](src/modules/audio.js)
- Layout y look & feel: [styles.css](styles.css)

## Documentación técnica

La arquitectura real del proyecto está resumida en [ARCHITECTURE.md](ARCHITECTURE.md).
