/**
 * MODULES/ACHIEVEMENTS.JS - Sistema de logros
 * Responsabilidad: Chequear y desbloquear logros
 * Completamente independiente de la lógica principal
 */

const achievementsModule = {
    // Condiciones de desbloqueo
    conditions: [
        {
            key: 'firstClick',
            check: () => gameState.clicks >= 1,
            onUnlock: () => uiModule.showNotification('🏆 Primer Click!', 'success')
        },
        {
            key: 'firstCommit',
            check: () => gameState.commits >= 1,
            onUnlock: () => uiModule.showNotification('🏆 Primer Commit!', 'success')
        },
        {
            key: 'hundred',
            check: () => gameState.commits >= 100,
            onUnlock: () => uiModule.showNotification('🎖️ Century - ¡100 Commits!', 'success')
        },
        {
            key: 'polyglot',
            check: () => {
                const languages = Object.values(gameState.languages).filter(l => l.owned > 0);
                return languages.length >= 3;
            },
            onUnlock: () => uiModule.showNotification('🌍 Poliglota - 3 Lenguajes!', 'success')
        },
        {
            key: 'speedster',
            check: () => gameState.maxStreak >= 10,
            onUnlock: () => uiModule.showNotification('⚡ Velocista - ¡10 Streak!', 'success')
        },
        {
            key: 'millionaire',
            check: () => gameState.totalCode >= 1000000,
            onUnlock: () => uiModule.showNotification('💰 Millonario - ¡1M de código!', 'success')
        },
        {
            key: 'firstPrestige',
            check: () => gameState.prestigeLevel >= 1,
            onUnlock: () => uiModule.showNotification('🌟 Primer prestige conseguido', 'success')
        },
        {
            key: 'teamLead',
            check: () => gameState.getOwnedCount(gameState.team) >= 5,
            onUnlock: () => uiModule.showNotification('👥 Team Lead - equipo en marcha', 'success')
        },
        {
            key: 'specialist',
            check: () => !!gameState.currentSpecialization,
            onUnlock: () => uiModule.showNotification('🎯 Especialización definida', 'success')
        },
        {
            key: 'releaseEngineer',
            check: () => gameState.releaseCount >= 1,
            onUnlock: () => uiModule.showNotification('🚀 Primera release publicada', 'success')
        },
        {
            key: 'collector',
            check: () => gameState.getOwnedCount(gameState.artifacts) >= 3,
            onUnlock: () => uiModule.showNotification('🧰 Arsenal técnico completo', 'success')
        },
        {
            key: 'enterprise',
            check: () => Object.values(gameState.languages).filter(language => language.owned > 0).length >= 8,
            onUnlock: () => uiModule.showNotification('🏢 Ya sobrevives cualquier enterprise stack', 'success')
        }
    ],
    
    // Chequear todos los logros
    checkAll() {
        this.conditions.forEach(condition => {
            const achievement = gameState.achievements[condition.key];
            
            // Si no está desbloqueado y cumple condición
            if (!achievement.unlocked && condition.check()) {
                this.unlock(condition.key);
                condition.onUnlock();
            }
        });
    },
    
    // Desbloquear logro específico
    unlock(key) {
        if (gameState.unlockAchievement(key)) {
            // Confetti
            if (typeof confetti !== 'undefined') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
            
            // Sonido
            audioModule.play('achievement');
            
            // Actualizar UI
            uiModule.createAchievementsUI();
        }
    },
    
    // Obtener conteo de logros desbloqueados
    getCount() {
        return gameState.getUnlockedAchievements();
    },
    
    // Para agregar nuevos logros en futuro
    register(key, condition, onUnlock) {
        this.conditions.push({
            key,
            check: condition,
            onUnlock: onUnlock || (() => {})
        });
        console.log(`✅ Achievement registered: ${key}`);
    }
};

console.log('✅ ACHIEVEMENTS MODULE loaded');
