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
- Motor de audio (Howler, 38 sonidos con buses y variaciones) y efectos visuales (GSAP + tsParticles) sincronizados mediante coreografías; panel de sonido y efectos con "Reducir movimiento". Ver [Audio y efectos](#audio-y-efectos).
- Temas visuales, editor estilo IDE y layout responsive.
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
| Sonido y efectos (volúmenes, reducir movimiento, celebraciones cortas) | Botón de sliders en header |
| Saltar una celebración en curso | `Esc` |
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
- `unlockall` (logros y todas las pestañas)
- `fx <id>` reproduce una coreografía · `fx list` las lista
- `sound <id>` reproduce un sonido (indica bus, duración y si usó el respaldo ZzFX) · `sound list` los lista

Hotkeys activas en admin: `D`, `E`, `C`, `M`, `R`, `K`, `U`.

## Estructura actual

```text
Juego-Idle/
├── index.html
├── styles.css
├── favicon.svg
├── README.md
├── ARCHITECTURE.md
├── assets/
│   └── audio/
│       ├── sounds.js          (SOUND_MANIFEST: id → archivos, bus, volumen, tono)
│       ├── ui/ sfx/ epic/     (38 sonidos, .ogg + .mp3)
│       ├── CREDITS.md         (origen y licencia de cada sonido)
│       └── preview.html       (solo para escuchar, no se carga en el juego)
└── src/
    ├── config.js
    ├── state.js
    ├── game.js
    ├── main.js
    └── modules/
        ├── audio.js           (motor de audio, Howler)
        ├── fx.js              (efectos visuales, GSAP + tsParticles)
        ├── feedback.js        (coreografías audio + visual)
        ├── settings.js        (panel de sonido y efectos)
        ├── achievements.js
        ├── admin.js
        ├── editor.js
        ├── events.js
        ├── game-logic.js
        ├── golden-commit.js
        ├── onboarding.js
        ├── themes.js
        └── ui.js
```

El orden de carga de los scripts está en [ARCHITECTURE.md](ARCHITECTURE.md#orden-de-carga).

## Dependencias CDN

- Bootstrap 5 (solo CSS)
- Font Awesome
- Google Fonts
- SweetAlert2
- Howler.js 2.2.4 (audio)
- GSAP 3.15.0 con ScrambleTextPlugin, SplitText, Physics2DPlugin, CustomEase y DrawSVGPlugin (gratuitos desde 3.13, también para uso comercial)
- tsParticles 4.5.0: presets `fireworks` y `confettiExplosions`
- ZzFX 1.4.0 (versión micro), respaldo si falla un archivo de audio

## Audio y efectos

- Cada momento del juego (compra, commit, logro, misión, hito, release, prestige, commit dorado, eventos, desbloqueos) es una **coreografía** en `CHOREOGRAPHIES` ([src/config.js](src/config.js)). Cada paso lanza en el mismo instante su sonido y sus efectos.
- Prioridades: un momento grande (release limpia, prestige) cancela los pequeños; dos medianos no se superponen (uno cada 1,5 s). `Esc` salta la celebración en curso y la deja en su estado final.
- Tras ver 3 veces una celebración se usa su versión corta (o siempre, con "Celebraciones cortas").
- Buses de mezcla `ui`, `sfx`, `music` y `ambient` (`AUDIO_BUSES`) con limitador en el master: los 38 sonidos se verificaron sin saturar, también apilados.
- "Reducir movimiento" quita sacudidas, cámara lenta, grietas, fragmentos y partículas; quedan destellos suaves, fundidos y sonido.
- Abierto desde el disco (`file://`) el audio usa HTML5 Audio; servido por http usa Web Audio con el limitador.
- Los sonidos vienen de Kenney (CC0) y del Sonniss GDC 2026 Game Audio Bundle (royalty-free, sin atribución, sin redistribución como librería). Ver [assets/audio/CREDITS.md](assets/audio/CREDITS.md).

## Guardado y datos

- El progreso persiste en `localStorage` (clave `codeIdleGame`, formato versionado con `saveVersion`).
- Solo se guarda el progreso (unidades compradas, contadores, misiones por id). Costes, multiplicadores y textos se leen siempre de [src/config.js](src/config.js), así los cambios de balance también afectan a partidas existentes.
- El guardado es automático (con throttle) y también se fuerza al ocultar o cerrar la pestaña.
- Progreso offline con tope `OFFLINE_CAP_SECONDS`; un hueco largo entre ticks (portátil suspendido) se trata igual.
- Los efectos temporales de eventos se guardan con fecha de expiración, así que sobreviven a recargas sin quedarse activos para siempre.
- Si la partida guardada está dañada, se respalda en `codeIdleGame:corrupt` y empieza una nueva.
- En la pestaña **Estadísticas** se puede exportar, importar o borrar la partida.
- Los ajustes de sonido y efectos (`audioSettings`, `visualSettings`) y las vistas de cada coreografía (`seenChoreographies`) se guardan con la partida y se conservan en el prestige. Las partidas anteriores cargan con los valores por defecto (70/80/40).

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
  | `AUDIO_BUSES` | ui .7 · sfx .8 · music .4 · ambient .4 · master 1 | Volumen por defecto de cada bus |
  | `AUDIO_SLIDERS` | Interfaz / Efectos / Música | Sliders del panel y qué buses controla cada uno |
  | `AUDIO` | — | Limitador, pool del teclado mecánico, aura de racha, precarga |
  | `SOUND_FALLBACKS` | — | Respaldos ZzFX por sonido (y por bus en `SOUND_FALLBACK_BY_BUS`) |
  | `CHOREOGRAPHIES` | 19 | Pasos de sonido + efectos de cada momento del juego, con su versión corta |
  | `FEEDBACK` | 1,5 s entre medianos | Prioridades, cola y a partir de cuántas vistas se usa la versión corta |

- Estado y persistencia: [src/state.js](src/state.js)
- Flujo visual y render: [src/modules/ui.js](src/modules/ui.js)
- Eventos y decisiones: [src/modules/events.js](src/modules/events.js)
- Audio: [src/modules/audio.js](src/modules/audio.js) · sonidos: [assets/audio/sounds.js](assets/audio/sounds.js)
- Efectos visuales: [src/modules/fx.js](src/modules/fx.js) · coreografías: [src/modules/feedback.js](src/modules/feedback.js)
- Layout y look & feel: [styles.css](styles.css)

## Documentación técnica

La arquitectura real del proyecto está resumida en [ARCHITECTURE.md](ARCHITECTURE.md).
