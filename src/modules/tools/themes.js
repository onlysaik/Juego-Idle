/**
 * MODULES/TOOLS/THEMES.JS - Sistema de temas
 * Responsabilidad: Manejar tema visual y estilos
 */

const themesModule = {
    current: 'dark',
    
    set(themeName) {
        document.body.className = `theme-${themeName}`;
        this.current = themeName;
        gameState.theme = themeName;
        gameState.save(true);
    },
    
    get() {
        return this.current;
    },
    
    available() {
        return Object.keys(CONFIG.THEMES);
    },
    
    toggle() {
        const themes = this.available();
        const currentIndex = themes.indexOf(this.current);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.set(themes[nextIndex]);
    }
};

console.log('✅ THEMES MODULE loaded');
