# 🎮 CodeIdle - Programmer Incremental Game

Un juego incremental/idle hermoso y adictivo sobre programación. ¡Genera líneas de código, completa commits y desbloquea lenguajes!

## 🌟 Características

### Mecánicas del Juego
- **Click Manual**: Genera líneas de código con cada click
- **Sistema de Commits**: Cada 1000 líneas = 1 commit
- **Generación Pasiva**: Compra lenguajes para generar código automáticamente
- **Upgrades**: Mejora tu productividad con equipamiento y herramientas
- **Racha de Clicks**: ¡Mantén la velocidad para construir una racha!

### Contenido
- **4 Lenguajes de Programación**: JavaScript, Python, Rust, TypeScript (cada uno genera más líneas)
- **4 Upgrades**: Teclado Mecánico, Monitor 4K, Café, VS Code
- **Sistema de Estadísticas**: Rastrear tu progreso
- **Persistencia**: Tu progreso se guarda automáticamente en localStorage

## 🎨 Dependencias Visuales

El proyecto utiliza las siguientes librerías CDN para una experiencia hermosa:

### UI/Diseño
- **Bootstrap 5.3.0** - Framework de diseño responsive
- **Google Fonts** - Tipografía moderna (Fira Code, Poppins)
- **Font Awesome 6.4.0** - Iconografía profesional

### Animaciones
- **Anime.js 3.2.1** - Librería de animaciones suave
- **Animate.css 4.1.1** - Animaciones CSS predefinidas

### Datos/Gráficos
- **Chart.js 3.9.1** - Gráficos y estadísticas
- **Particles.js 2.0.0** - Fondo animado con partículas

## 📋 Estructura

```
Juego-Idle/
├── index.html      # Estructura y elementos del juego
├── styles.css      # Estilos personalizados (neon/gaming)
├── game.js         # Lógica del juego
└── README.md       # Este archivo
```

## 🚀 Cómo Usar

1. **Abre el archivo**: Simplemente abre `index.html` en tu navegador
2. **Comienza a clickear**: Haz click en el botón principal para generar código
3. **Compra Upgrades**: Usa tus líneas de código para mejorar
4. **Desbloquea Lenguajes**: Los lenguajes generan código automáticamente
5. **Sigue jugando**: Tu progreso se guarda automáticamente

## 🕹️ Controles

| Acción | Control |
|--------|---------|
| Click Manual | Click en el botón / Barra espaciadora / Enter |
| Comprar Upgrade | Click en el card |
| Cambiar Tab | Click en las pestañas |

## 🎯 Progresión

1. **Principio**: Haz click para generar tus primeras líneas
2. **Temprano**: Compra Teclado Mecánico para +10% eficiencia
3. **Medio**: Desbloquea JavaScript y Python para generación pasiva
4. **Avanzado**: Sigue comprando lenguajes y upgrades más costosos
5. **Endgame**: Optimiza tu configuración para máxima generación

## 💾 Guardado

El juego se guarda automáticamente cada vez que:
- Completas un click
- Compras un upgrade
- Desbloqueas un lenguaje

Los datos se almacenan en `localStorage` del navegador.

## 🎨 Tema Visual

- **Colores Neón**: Cyan (#00d4ff), Magenta (#ff006e), Neon Green (#00ff88)
- **Fondo**: Degradado oscuro futurista
- **Tipografía**: Fira Code para código, Poppins para UI
- **Efectos**: Partículas animadas, bordes brillantes, transiciones fluidas

## 📱 Responsivo

El juego está optimizado para:
- Desktop (1920px+)
- Laptop (1366px+)
- Tablet (768px+)
- Mobile (320px+)

## 🔧 Personalización

Puedes fácilmente personalizar:

### Colores
Edita las variables CSS en `styles.css`:
```css
:root {
    --primary: #00d4ff;      /* Color principal */
    --secondary: #ff006e;    /* Color secundario */
    --accent: #00ff88;       /* Color de acentos */
    /* ... etc */
}
```

### Valores del Juego
Edita `gameState` en `game.js`:
```javascript
codePerClick: 10,  // Líneas por click
languages: { ... } // Costos y generación
upgrades: { ... }  // Upgrades disponibles
```

## 🚦 Requisitos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Conexión a Internet (para CDN)
- JavaScript habilitado

## 📝 Notas

- El juego funciona completely offline una vez cargado
- Los datos se mantienen incluso si cierras el navegador
- Puedes limpiar tu progreso limpiando localStorage

## 🎮 Tips de Juego

1. **Mantén la racha**: Es más rápido llegar a 1000 con clicks rápidos
2. **Prioriza lenguajes**: La generación pasiva es exponencial
3. **Balancea**: Compra upgrades estratégicamente para maximizar ROI
4. **Experimenta**: Cada configuración es única

¡Diviértete programando! 🚀

---

**Versión**: 1.0.0  
**Última actualización**: Abril 2026  
**Hecho con ❤️ y muchas líneas de código**
