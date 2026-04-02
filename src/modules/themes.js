/**
 * MODULES/THEMES.JS - Sistema de temas
 * Responsabilidad: Manejar temas visuales
 */

const themesModule = {
    current: 'dark',
    
    init() {
        this.current = gameState.theme;
        this.apply(this.current);
    },
    
    // Aplicar tema
    apply(theme) {
        if (!CONFIG.THEMES[theme]) {
            console.warn(`⚠️ Unknown theme: ${theme}`);
            return;
        }
        
        document.body.className = `theme-${theme}`;
        const selector = document.getElementById('themeSelector');
        if (selector) selector.value = theme;
        
        this.current = theme;
        gameState.theme = theme;
    },
    
    // Cambiar tema
    toggle(theme) {
        if (CONFIG.THEMES[theme]) {
            this.apply(theme);
            gameState.save(true);
        }
    },
    
    // Obtener lista de temas disponibles
    getAvailable() {
        return Object.keys(CONFIG.THEMES)
            .map(key => ({
                key,
                label: CONFIG.THEMES[key].label
            }));
    }
};

console.log('✅ THEMES MODULE loaded');
