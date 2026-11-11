# CodeIdle

Juego incremental sobre programación con click manual, automatización, releases, reputación, decisiones, admin tools y una interfaz inspirada en IDE.

## Estado actual

- Onboarding progresivo: las pestañas aparecen a medida que se necesitan, en este orden (`FEATURE_UNLOCKS`):

  | Feature | Pestañas / paneles | Se desbloquea con |
  | --- | --- | --- |
  | Tienda | Upgrades, Lenguajes | 40 de código total |
  | Misiones | Misiones | 1 commit |
  | Equipo | Pasivo, Meta (equipo) | 3 lenguajes distintos |
  | Releases | Lab | 5 commits |
  | Salud | Salud | deuda > 20 o 1 release |
  | Prestige | Meta (prestige) | 50% del coste de prestige |
  | Estadísticas | Logros, Estadísticas | 1 logro |
  | Especialización | Meta (especializaciones) | primer prestige |

  Con `SEQUENTIAL_UNLOCKS` cada feature espera a la anterior, así que salen en el orden de la tabla aunque una condición se cumpla antes. Cada pestaña nueva lleva un badge NEW hasta abrirla (y se marcan los botones Gestión/Build). Su tip aparece una sola vez como mensaje de commit (`feat(...)` / `warn(...)`). Lo desbloqueado se conserva en el prestige. Las partidas anteriores al onboarding lo ven todo si ya hicieron prestige; si no, lo que ya cumplen. En ambos casos, sin avisos.
- Bajo el contador de código, una línea `// TODO: objetivo (actual/meta)` con barra fina. Muestra la próxima feature, un hito cercano, una misión para cobrar o el prestige (`NEXT_GOAL_RULES`).
- Partida nueva: un único aviso junto al botón ("// Escribe código: haz click o presiona Espacio") que desaparece con el primer click.
- Click manual con racha, bonificación de click y commits automáticos cada 1000 líneas. Cada click suma además el 5% de la producción pasiva por segundo (`CLICK_PASSIVE_SHARE`), y bajo el poder de click se muestra cuánto viene de ahí.
- 9 lenguajes con generación pasiva. Cada partida nueva y cada run tras un prestige empiezan con 1 JavaScript gratis (`STARTING_LANGUAGES`); JavaScript cuesta 50.
- Hitos por lenguaje y por miembro del equipo: ×2 de producción al tener 10/25/50/100, con barra de progreso en cada tarjeta.
- 4 upgrades base (Teclado Mecánico, Monitor 4K, Café y VS Code Pro), hasta 6 niveles cada uno. Sus multiplicadores se multiplican entre sí, así que el tope es lo que contiene el poder de click; a partir de ahí el click escala con la producción.
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
  | `UPGRADE_MAX_OWNED` | 6 | Niveles máximos de cada upgrade. Las partidas con más niveles se recortan al cargar |
  | `CLICK_PASSIVE_SHARE` | 0.05 | Fracción de la producción pasiva por segundo que suma cada click |
  | `MILESTONES` | 10/25/50/100, ×2 | Hitos de producción por unidad |
  | `MISSION_REWARD`, `EVENT_REWARDS` | — | Segundos de producción y mínimos de las recompensas |
  | `GOLDEN_COMMIT` | 60–180 s | Frecuencia y recompensas del commit dorado |
  | `FEATURE_UNLOCKS` | 8 features | Orden, pestañas, condición, objetivo y tip de cada desbloqueo |
  | `ONBOARDING` | — | Textos de bienvenida/estado vacío, modo secuencial, duración de tips |
  | `NEXT_GOAL_RULES` | 6 reglas | Qué muestra la línea `// TODO:` y en qué prioridad |

- Estado y persistencia: [src/state.js](src/state.js)
- Flujo visual y render: [src/modules/ui.js](src/modules/ui.js)
- Eventos y decisiones: [src/modules/events.js](src/modules/events.js)
- Audio: [src/modules/audio.js](src/modules/audio.js)
- Layout y look & feel: [styles.css](styles.css)

## Documentación técnica

La arquitectura real del proyecto está resumida en [ARCHITECTURE.md](ARCHITECTURE.md).
