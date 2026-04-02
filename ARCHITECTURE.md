# 🏗️ Arquitectura Modular de CodeIdle

## Visión General

El código ahora está organizado como un **proyecto profesional escalable**:

```
src/
├── config.js              # Configuración centralizada
├── state.js              # Gestión del estado
├── game.js               # Game loop
├── main.js               # Inicialización
└── modules/
    ├── audio.js          # Sistema de audio
    ├── events.js         # Eventos aleatorios
    ├── achievements.js   # Sistema de logros
    ├── themes.js         # Manejo de temas
    ├── ui.js            # Renderización
    └── game-logic.js    # Lógica del juego
```

---

## 📦 Cada Módulo Tiene Una Responsabilidad

### 1. **config.js** - La fuente de verdad
```javascript
// Todo lo que pueda cambiar está aquí
CONFIG.INITIAL_CODE_PER_CLICK = 10
CONFIG.CODE_PER_COMMIT = 1000
CONFIG.LANGUAGES = { ... }
CONFIG.UPGRADES = { ... }
```
**Por qué**: Si quieres aumentar el costo de un lenguaje, lo cambias aquí y listo.

---

### 2. **state.js** - Gestión centralizada
```javascript
class GameState {
    addCode(amount) { ... }           // Método
    buyUpgrade(key) { ... }           // Método
    calculateGeneration() { ... }     // Lógica de cálculo
    save() { ... }                    // Persistencia
}
```
**Por qué**: Un solo lugar para todos los datos del juego. Fácil de debuggear.

---

### 3. **modules/Audio.js** - Solo audio
```javascript
audioModule.play('click')     // Toca sonido
audioModule.playBeep(400, 100) // Beep personalizado
audioModule.toggle()          // On/off
```
**Por qué**: Audio es completamente independiente. Si quieres cambiar de Web Audio API a Howler.js, solo editas este.

---

### 4. **modules/Events.js** - Solo eventos
```javascript
eventsModule.registry = [ ... ]  // Lista de eventos
eventsModule.trigger()           // Dispara uno
eventsModule.register(newEvent)  // Agregar eventos dinámicamente
```
**Por qué**: Agregar nuevo evento es tan fácil como `.register()`. Cero dependencies.

---

### 5. **modules/Achievements.js** - Solo logros
```javascript
achievementsModule.checkAll()    // Chequear automáticamente
achievementsModule.register(key, condition, callback) // Agregar logro
```
**Por qué**: Sistema completamente desacoplado. Los logros no afectan nada más.

---

### 6. **modules/Themes.js** - Solo temas
```javascript
themesModule.apply('cyberpunk')  // Aplicar tema
themesModule.getAvailable()      // Listar temas
```
**Por qué**: Agregar nuevo tema: solo agregar en config.js y aquí.

---

### 7. **modules/UI.js** - Solo renderización
```javascript
uiModule.update()               // Refrescar todo
uiModule.createUpgradesUI()    // Renderizar upgradesuiModule.showNotification()    // Toast
```
**Por qué**: La lógica de cálculo está en state.js. Aquí solo se muestra.

---

### 8. **modules/Game-Logic.js** - Orquestación
```javascript
gameLogic.handleClick()     // Coordina: audio + state + ui + achievements
gameLogic.buyUpgrade(key)   // Coordina: compra + feedback + logros
```
**Por qué**: Punto central para todas las acciones del jugador.

---

### 9. **game.js** - Game loop
```javascript
gameEngine.startGameLoop()   // Cada 100ms: genera código pasivo
gameEngine.startEventLoop()  // Cada 5s: chequea eventos
```
**Por qué**: Tiempo separado de lógica.

---

### 10. **main.js** - Inicializador
```javascript
app.init()  // Carga todo en orden correcto
```
**Por qué**: Un lugar que ve todo.

---

## 🎯 Cómo Agregar Nuevas Features

### Ejemplo 1: Agregar un nuevo upgrade

**Paso 1**: Edita `config.js`:
```javascript
UPGRADES: {
    // ... existentes
    newUpgrade: {
        cost: 200,
        multiplier: 1.2,
        name: 'Super Upgrade',
        icon: 'fas fa-star',
        desc: '+20% velocidad'
    }
}
```

**Paso 2**: ¡Listo! La UI se crea automáticamente en `ui.js`.

---

### Ejemplo 2: Agregar un nuevo evento

**Paso 1**: Abre `src/modules/events.js`:
```javascript
eventsModule.register({
    id: 'newEvent',
    name: '🎊 Mi Evento',
    desc: '+100 código',
    weight: 2,
    execute() {
        gameState.addCode(100);
        uiModule.showNotification('¡Mi evento!', 'success');
    }
});
```

**¡Listo!** Se triggerea automáticamente.

---

### Ejemplo 3: Agregar un nuevo logro

**Paso 1**: Edita `config.js`:
```javascript
ACHIEVEMENTS: {
    // ... existentes
    newAchievement: {
        name: 'Mi Logro',
        desc: 'Descripción',
        icon: 'fas fa-trophy'
    }
}
```

**Paso 2**: Abre `src/modules/achievements.js`:
```javascript
achievementsModule.register(
    'newAchievement',
    () => gameState.totalCode >= 50000,  // Condición
    () => uiModule.showNotification(...)  // Callback
);
```

**¡Listo!**

---

### Ejemplo 4: Agregar un nuevo tema

**Paso 1**: Edita `config.js`:
```javascript
THEMES: {
    dark: { label: 'Dark' },
    miTema: { label: 'Mi Tema' }
}
```

**Paso 2**: Edita `styles.css` y agrega:
```css
body.theme-miTema {
    --primary: #ff0000;
    --secondary: #00ff00;
    /* ... */
}
```

**¡Listo!** El selector se llena automáticamente.

---

## 🔄 Flujo de Datos

```
Usuario Click
    ↓
gameLogic.handleClick()
    ↓
gameState.addCode()        [Actualiza estado]
    ↓
audioModule.play()          [Reproduce sonido]
    ↓
uiModule.update()           [Renderiza UI]
    ↓
achievementsModule.checkAll()  [Chequea logros]
    ↓
gameState.save()            [Persiste]
```

**Ventaja**: Cada módulo es testeable independientemente.

---

## 📊 Estadísticas de la Arquitectura

| Métrica | Valor |
|---------|-------|
| Archivos | 10 |
| Módulos | 7 (sin contar config/state/game/main) |
| Líneas por archivo | ~100-200 |
| Responsabilidades por módulo | 1-2 |
| Duplicación de código | ~0% |

---

## ✨ Beneficios

### Antes (1 archivo):
- ❌ 1000+ líneas en un archivo
- ❌ Difícil de navegar
- ❌ Imposible testear módulos
- ❌ Agregar feature = caos

### Ahora (10 archivos):
- ✅ ~100-200 líneas por archivo
- ✅ Encontrar código es trivial
- ✅ Cada módulo es testeable
- ✅ Agregar feature es predecible

---

## 🚀 Cómo Agregar una Feature Compleja

### Feature: "Resins" (Moneda secundaria)

**1. config.js**: Agregar constantes
```javascript
CONFIG.RESINS_PER_COMMIT = 10;
CONFIG.PRESTIGE_COST = 1000000;
```

**2. state.js**: Agregar propiedades y métodos
```javascript
this.resins = 0;
addResins(amount) { this.resins += amount; }
prestige() { /* reset pero mantén bonuses */ }
```

**3. modules/ui.js**: Mostrar resins
```javascript
updateStats() { 
    document.getElementById('resins').textContent = gameState.resins; 
}
```

**4. modules/game-logic.js**: Lógica de compra
```javascript
buyPrestige() {
    if (gameState.totalCode >= CONFIG.PRESTIGE_COST) {
        gameState.prestige();
    }
}
```

**5. main.js**: Agregar botón
```javascript
// En setupEventListeners()
document.getElementById('prestigeBtn')?.addEventListener('click', () => {
    gameLogic.buyPrestige();
});
```

---

## 📝 Convenciones

Cada módulo sigue este patrón:

```javascript
/**
 * MODULES/NAME.JS - Descripción
 * Responsabilidad: Una sola cosa
 */

const nameModule = {
    // Datos privados si es necesario
    state: { ... },
    
    // Métodos públicos
    method1() { ... },
    method2() { ... },
    
    // Para extensión
    register(item) { ... }
};
```

---

## 🎓 Aprendizajes

Esta arquitectura usa patrones profesionales:

1. **Separation of Concerns**: Cada módulo hace una cosa
2. **Single Responsibility**: Cambios pequeños cuando cambian requerimientos
3. **Open/Closed**: Abierto a extensión (`.register()`), cerrado a modificación
4. **Module Pattern**: Privacidad + funcionalidad pública

---

## 🔮 Listo para Crecer

Con esta estructura puedes agregar:

- ✅ Nuevo sistema de prestige
- ✅ Leaderboard
- ✅ Minijuegos
- ✅ Retos diarios
- ✅ Multijugador
- ✅ Persistencia a servidor
- ✅ Estadísticas avanzadas

**Sin tocar el código existente.**

---

**Versión**: 2.1.0 (Refactored)  
**Patrón**: Modular Architecture  
**Mantenibilidad**: ⭐⭐⭐⭐⭐
