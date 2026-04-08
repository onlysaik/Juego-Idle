/**
 * MODULES/TOOLS/ADMIN.JS - Consola de administrador
 * Responsabilidad: Herramientas de debug y modo creativo
 * Propósito: Facilitar testing y debugging del juego
 */

const adminModule = {
    enable() {
        gameState.setAdminEnabled(true);
        console.log('✅ Admin console enabled');
    },
    
    disable() {
        gameState.setAdminEnabled(false);
        console.log('❌ Admin console disabled');
    },
    
    toggleCreativeMode() {
        gameState.setCreativeMode(!gameState.isCreativeModeEnabled());
        console.log(`Creative mode: ${gameState.isCreativeModeEnabled() ? 'ON' : 'OFF'}`);
    },
    
    giveCode(amount) {
        gameState.addCode(amount);
        uiModule.update();
        gameState.save(true);
        console.log(`+${amount} código`);
    },
    
    givePrestige(amount) {
        gameState.prestigePoints += amount;
        uiModule.update();
        gameState.save(true);
        console.log(`+${amount} reputación`);
    }
};

console.log('✅ ADMIN MODULE loaded');
