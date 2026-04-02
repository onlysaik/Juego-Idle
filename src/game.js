/**
 * GAME.JS - Game Loop y lógica de tiempo
 * Responsabilidad: Mantener el juego actualizado constantemente
 */

const gameEngine = {
    gameLoopId: null,
    eventLoopId: null,
    
    // === INICIAR GAME LOOP ===
    startGameLoop() {
        this.gameLoopId = setInterval(() => {
            const now = Date.now();
            const deltaTime = (now - gameState.lastUpdate) / 1000; // segundos
            gameState.lastUpdate = now;
            gameState.refreshTrend();
            
            // Generar código pasivo
            const generation = gameState.calculateGeneration();
            gameState.code += generation * deltaTime;
            gameState.totalCode += generation * deltaTime;
            
            // Chequear commit
            gameLogic.processCommits({ showFeedback: false });
            
            // Decrementar cooldown de eventos
            if (gameState.eventCooldown > 0) {
                gameState.eventCooldown = Math.max(0, gameState.eventCooldown - deltaTime);
            }
            
            // Update UI
            uiModule.update();
            gameState.save();
        }, CONFIG.UPDATE_RATE);
        
        console.log('✅ Game Loop started');
    },
    
    // === INICIAR EVENT LOOP ===
    startEventLoop() {
        this.eventLoopId = setInterval(() => {
            if (Math.random() < CONFIG.EVENT_CHANCE) {
                eventsModule.trigger();
            }
        }, CONFIG.EVENT_CHECK_INTERVAL);
        
        console.log('✅ Event Loop started');
    },
    
    // === DETENER LOOPS ===
    stop() {
        if (this.gameLoopId) clearInterval(this.gameLoopId);
        if (this.eventLoopId) clearInterval(this.eventLoopId);
    }
};

console.log('✅ GAME ENGINE loaded');
