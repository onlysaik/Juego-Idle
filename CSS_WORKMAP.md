# CSS Work Map

Objetivo: ubicar rapido donde editar cada parte visual sin perder tiempo en un archivo grande.

## Secciones en styles.css

- [SEC-01] Base & Tokens: reset, html/body, variables globales.
- [SEC-02] App Layout & Shell: estructura principal del shell.
- [SEC-03] Header & Top Controls: barra superior, stats y controles.
- [SEC-04] Main Panels: panel izquierdo y panel derecho.
- [SEC-05] Clicker Core UI: clicker-area, clicker-centerpiece, click-stage, click-button.
- [SEC-06] Project Health UI: tarjeta de salud, badges, medidores, acciones.
- [SEC-07] Progress / Tabs / Content: barra de progreso, tabs, tab-content.
- [SEC-08] Cards, Grids and Gameplay Panels: upgrades, logros, meta, misiones.
- [SEC-09] Overlays: consola admin, alerts y notificaciones.
- [SEC-10] Responsive Rules: media queries por ancho/alto.
- [SEC-11] Desktop Scroll Strategy: reglas de overflow y scroll en desktop.
- [SEC-12] Visual Performance Modes: balanced/compact/reduced.
- [SEC-13] Theme Overrides: dark/cyberpunk/hacker/light.

## Flujo sugerido para editar rapido

1. Ubica la seccion con buscar por texto: [SEC-05], [SEC-10], etc.
2. Ajusta primero base de componente en su seccion principal.
3. Revisa despues overrides en responsive y desktop scroll strategy.
4. Si un cambio no aparece, verifica estados de body con data-attributes.

## Cambios frecuentes y donde hacerlos

- Centrado del boton click: [SEC-05] y [SEC-10].
- Espacios del panel izquierdo: [SEC-04] y [SEC-05].
- Mostrar/ocultar tarjeta salud: [SEC-06] y [SEC-11].
- Tamaño en mobile: [SEC-10] (max-width 991.98, 768, 560, 420).
- Rendimiento visual: [SEC-12].

## Convencion recomendada para nuevos bloques

Usar encabezados de este estilo:

/* ===================== [SEC-XX] Nombre ===================== */

Esto mantiene el archivo navegable con Ctrl+F.
