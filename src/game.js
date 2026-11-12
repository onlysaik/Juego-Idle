/**
 * GAME.JS - Game Loop y lógica de tiempo
 * Responsabilidad: Mantener el juego actualizado constantemente
 */

const gameEngine = {
    gameLoopId: null,
    eventLoopId: null,
    passiveAnimationTimer: 0,
    
    // === INICIAR GAME LOOP ===
    startGameLoop() {
        this.gameLoopId = setInterval(() => {
            const now = Date.now();
            const rawDelta = Math.max(0, (now - gameState.lastUpdate) / 1000); // segundos
            gameState.lastUpdate = now;
            gameState.refreshTrend();

            // Efectos temporales vencidos (eventos)
            gameState.pruneExpiredEffects(now).forEach(effect => {
                if (effect.endMessage) uiModule.showNotification(effect.endMessage, 'info');
            });

            goldenCommitModule.tick(now);
            audioModule.updateStreakAura(now); // el aura se apaga cuando la racha caduca
            onboardingModule.tick(now); // checkFeatureUnlocks() como mucho 1 vez/s

            let deltaTime = rawDelta;
            if (rawDelta > CONFIG.LIVE_TICK_GAP_SECONDS) {
                // Hueco largo (suspensión, pestaña congelada): se trata como
                // progreso offline con tope, no como un tick gigante.
                gameState.applyElapsedIdleTime(rawDelta);
                uiModule.showOfflineReport();
                deltaTime = 0;
            } else {
                const generation = gameState.calculateGeneration();
                const passiveEarned = generation * deltaTime;
                if (passiveEarned > 0) {
                    gameState.earnCode(passiveEarned);
                }

                gameState.trackProjectHealthTime(deltaTime);
                gameState.trackResponsibilityTime(deltaTime);
            }
            
            // Chequear commit
            gameLogic.processCommits({ showFeedback: false });
            
            // Decrementar cooldown de eventos (con el tiempo real, también tras un hueco)
            if (gameState.eventCooldown > 0) {
                gameState.eventCooldown = Math.max(0, gameState.eventCooldown - rawDelta);
            }
            
            // MEJORA 4: Animar partículas de generación pasiva cada 500ms
            this.passiveAnimationTimer += deltaTime;
            if (this.passiveAnimationTimer >= 0.5) {
                uiModule.animatePassiveGeneration();
                this.passiveAnimationTimer = 0;
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
        this.gameLoopId = null;
        this.eventLoopId = null;
    }
};

console.log('✅ GAME ENGINE loaded');
