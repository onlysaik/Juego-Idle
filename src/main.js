/**
 * MAIN.JS - Punto de entrada de la aplicación
 * Responsabilidad: Inicializar todos los módulos y configurar eventos
 */

const app = {
    // === INICIALIZACIÓN COMPLETA ===
    init() {
        console.log('🚀 CodeIdle iniciando...');
        
        // 1. Inicializar módulos en orden
        audioModule.init();
        themesModule.init();
        gameState.load(); // Ya cargado en state.js pero lo hacemos explícito
        
        // 2. Crear UI inicial
        uiModule.createUpgradesUI();
        uiModule.createLanguagesUI();
        uiModule.createAchievementsUI();
        uiModule.createMissionsUI();
        uiModule.createLabUI();
        uiModule.createMetaUI();
        uiModule.update();
        uiModule.showOfflineReport();
        
        // 3. Inicializar partículas
        this.initializeParticles();
        
        // 4. Setup event listeners
        this.setupEventListeners();
        
        // 5. Iniciar game loops
        gameEngine.startGameLoop();
        gameEngine.startEventLoop();
        
        console.log('✅ CodeIdle listo para jugar!');
    },
    
    // === SETUP DE EVENTOS DE INTERFAZ ===
    setupEventListeners() {
        // Click button
        const clickBtn = document.getElementById('clickBtn');
        if (clickBtn) {
            clickBtn.addEventListener('click', () => gameLogic.handleClick());
        }
        
        // Tab switching
        document.getElementById('upgrades-tab')?.addEventListener('click', () => uiModule.switchTab('upgrades'));
        document.getElementById('languages-tab')?.addEventListener('click', () => uiModule.switchTab('languages'));
        document.getElementById('achievements-tab')?.addEventListener('click', () => uiModule.switchTab('achievements'));
        document.getElementById('stats-tab')?.addEventListener('click', () => uiModule.switchTab('stats'));
        document.getElementById('passive-tab')?.addEventListener('click', () => uiModule.switchTab('passive'));
        document.getElementById('missions-tab')?.addEventListener('click', () => uiModule.switchTab('missions'));
        document.getElementById('lab-tab')?.addEventListener('click', () => uiModule.switchTab('lab'));
        document.getElementById('meta-tab')?.addEventListener('click', () => uiModule.switchTab('meta'));

        // Mobile view switching
        document.getElementById('clicker-view-tab')?.addEventListener('click', () => uiModule.switchMobileView('clicker'));
        document.getElementById('management-view-tab')?.addEventListener('click', () => uiModule.switchMobileView('management'));
        
        // Sound toggle
        document.getElementById('soundToggle')?.addEventListener('click', () => {
            gameState.soundEnabled = audioModule.toggle();
            document.getElementById('soundToggle').style.opacity = gameState.soundEnabled ? '1' : '0.5';
            gameState.save(true);
        });

        document.getElementById('soundToggle').style.opacity = gameState.soundEnabled ? '1' : '0.5';
        
        // Theme selector
        document.getElementById('themeSelector')?.addEventListener('change', (e) => {
            themesModule.toggle(e.target.value);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const isHardReloadShortcut =
                (e.ctrlKey && e.code === 'F5') ||
                (e.ctrlKey && e.shiftKey && e.code === 'KeyR');

            if (isHardReloadShortcut) {
                sessionStorage.setItem(CONFIG.HARD_RELOAD_RESET_FLAG_KEY, '1');
            }

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                gameLogic.handleClick();
            }
        });
    },
    
    // === INICIALIZAR PARTÍCULAS DE FONDO ===
    initializeParticles() {
        const container = document.getElementById('particles-container');
        if (!container) return;
        
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 2px;
                height: 2px;
                background: rgba(0, 212, 255, ${Math.random() * 0.5});
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
            `;
            container.appendChild(particle);
            
            anime({
                targets: particle,
                translateY: [0, Math.random() * -100 - 50],
                translateX: [0, Math.sin(Math.random() * Math.PI) * 50],
                opacity: [{ value: 0, duration: 500 }, { value: Math.random() * 0.5, duration: 500 }],
                duration: Math.random() * 3000 + 2000,
                loop: true,
                easing: 'easeInOutQuad'
            });
        }
    }
};

// Iniciar cuando DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

console.log('✅ MAIN.JS loaded');
