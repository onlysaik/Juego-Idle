# CodeIdle

Juego incremental sobre programación con click manual, automatización, releases, reputación, decisiones, admin tools y una interfaz inspirada en IDE.

## Estado actual

- Click manual con racha, bonificación de click y commits automáticos cada 1000 líneas.
- 9 lenguajes con generación pasiva. Cada partida nueva y cada run tras un prestige empiezan con 1 JavaScript gratis (`STARTING_LANGUAGES`); JavaScript cuesta 50.
- Hitos por lenguaje y por miembro del equipo: ×2 de producción al tener 10/25/50/100, con barra de progreso en cada tarjeta.
- 4 upgrades base (Teclado Mecánico, Monitor 4K, Café y VS Code Pro), hasta 25 niveles cada uno; el coste ×1.45 por nivel los autolimita.
- 8 frameworks con boosts por lenguaje.
- 6 artefactos meta que cuestan 3 / 6 / 10 / 15 / 22 / 30 de reputación. Los que no puedes pagar muestran cuánto falta.
- Prestige: reputación = raíz cúbica de (código total / coste), mínimo 1; cada punto da +15% global. El panel Meta muestra en vivo la rep a ganar y el multiplicador resultante.
- Especializaciones, equipo, misiones y sistema de release con carga acumulada.
- Las recompensas de código de misiones y eventos equivalen a segundos de producción pasiva, con un mínimo fijo para el inicio.
- Commit dorado: aparece cada 60–180 s y da código, un frenesí de clicks o carga de release.
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
- `golden` (hace aparecer un commit dorado)
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

- Balance: [src/config.js](src/config.js). Todo el balance vive ahí; `ui.js` y `game-logic.js` no tienen valores fijos. Constantes más tocadas:

  | Constante | Valor | Qué controla |
  | --- | --- | --- |
  | `PRESTIGE_REWARD_ROOT` | 3 | Raíz aplicada a `código total / coste` para calcular la rep del prestige |
  | `PRESTIGE_BONUS_PER_POINT` | 0.15 | Bonus global por punto de reputación |
  | `ARTIFACTS.*.cost` | 3–30 | Coste en reputación de cada artefacto |
  | `STARTING_LANGUAGES` | `{ javascript: 1 }` | Lenguajes gratis al empezar y tras cada prestige (no al cargar una partida) |
  | `LANGUAGES.javascript.cost` | 50 | Coste base de JavaScript |
  | `UPGRADE_MAX_OWNED` | 25 | Niveles máximos de cada upgrade |
  | `MILESTONES` | 10/25/50/100, ×2 | Hitos de producción por unidad |
  | `MISSION_REWARD`, `EVENT_REWARDS` | — | Segundos de producción y mínimos de las recompensas |
  | `GOLDEN_COMMIT` | 60–180 s | Frecuencia y recompensas del commit dorado |

- Estado y persistencia: [src/state.js](src/state.js)
- Flujo visual y render: [src/modules/ui.js](src/modules/ui.js)
- Eventos y decisiones: [src/modules/events.js](src/modules/events.js)
- Audio: [src/modules/audio.js](src/modules/audio.js)
- Layout y look & feel: [styles.css](styles.css)

## Documentación técnica

La arquitectura real del proyecto está resumida en [ARCHITECTURE.md](ARCHITECTURE.md).
