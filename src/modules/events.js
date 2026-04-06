/**
 * MODULES/EVENTS.JS - Sistema de eventos aleatorios
 * Responsabilidad: Generar y ejecutar eventos del juego
 * Separado de lógica principal
 */

const eventsModule = {
    applyTimedEffect(stat, factor, duration, startMessage, endMessage) {
        const token = gameState.createEffectToken(stat);
        gameState.activeEffects[stat] *= factor;
        if (startMessage) {
            uiModule.showNotification(startMessage, 'success');
        }

        setTimeout(() => {
            if (!gameState.hasEffectToken(stat, token)) {
                return;
            }

            gameState.consumeEffectToken(stat, token);
            gameState.activeEffects[stat] /= factor;
            if (endMessage) {
                uiModule.showNotification(endMessage, 'info');
            }
        }, duration);
    },

    // Definición de eventos
    registry: [
        {
            id: 'bugCritical',
            name: '🐛 Bug Crítico',
            desc: 'Pierdes el 10% código',
            weight: 3,
            execute() {
                gameState.code *= 0.9;
                uiModule.showNotification('¡Bug detectado! -10% código', 'warning');
            }
        },
        {
            id: 'codeReview',
            name: '✅ Code Review',
            desc: '+2x velocidad temporal',
            weight: 2,
            execute() {
                eventsModule.applyTimedEffect(
                    'clickMultiplier',
                    2,
                    CONFIG.EVENT_DURATIONS.codeReview,
                    'Code Review! x2 velocidad',
                    'Code Review terminó'
                );
            }
        },
        {
            id: 'hackathon',
            name: '🏃 Hackathon',
            desc: '+3x generación temporal',
            weight: 2,
            execute() {
                eventsModule.applyTimedEffect(
                    'passiveMultiplier',
                    3,
                    CONFIG.EVENT_DURATIONS.hackathon,
                    '¡Hackathon! +3x generación',
                    'Hackathon terminó'
                );
                audioModule.play('event');
            }
        },
        {
            id: 'coffeeBreak',
            name: '☕ Coffee Break',
            desc: '+50% generación',
            weight: 2,
            execute() {
                eventsModule.applyTimedEffect(
                    'passiveMultiplier',
                    1.5,
                    CONFIG.EVENT_DURATIONS.coffeeBreak,
                    'Café activo! +50% generación',
                    'Coffee Break terminó'
                );
                audioModule.play('event');
            }
        },
        {
            id: 'documentation',
            name: '📚 Documentación',
            desc: '+500 código bonus',
            weight: 3,
            execute() {
                gameState.addCode(500);
                uiModule.showNotification('+500 código bonus completado!', 'success');
                audioModule.play('event');
            }
        },
        {
            id: 'openSourceSpike',
            name: '⭐ Repo Trending',
            desc: '+3 commits hacia la próxima release y +1 reputación',
            weight: 1,
            execute() {
                gameState.releaseCharge += 3;
                gameState.addPrestigePoints(1);
                uiModule.showNotification('Tu repo se volvió tendencia. +3 carga de release, +1 rep', 'success');
                audioModule.play('event');
            }
        },
        {
            id: 'hiringWave',
            name: '💼 Hiring Wave',
            desc: 'El equipo rinde +2x por un rato',
            weight: 1,
            execute() {
                eventsModule.applyTimedEffect(
                    'passiveMultiplier',
                    2,
                    14000,
                    'Hiring wave: el equipo vuela',
                    'El equipo volvió a ritmo normal'
                );
            }
        },
        {
            id: 'clientDeadline',
            name: '🚨 Cliente en Llamada',
            desc: 'Elige entre deuda técnica, refactor o rechazar el alcance.',
            weight: 1,
            showAlert: false,
            execute() {
                audioModule.play('event');

                if (typeof Swal === 'undefined') {
                    gameState.addCode(1500);
                    uiModule.showNotification('Resolviste al cliente y ganaste +1500 código', 'success');
                    return;
                }

                Swal.fire({
                    title: 'Cliente en llamada',
                    text: '¿Cómo respondes al cambio urgente de alcance?',
                    icon: 'warning',
                    showDenyButton: true,
                    showCancelButton: true,
                    confirmButtonText: 'Aceptar deuda técnica',
                    denyButtonText: 'Refactorizar bien',
                    cancelButtonText: 'Rechazar alcance',
                    background: '#1a1f3a',
                    color: '#ffffff',
                    buttonsStyling: false,
                    customClass: {
                        popup: 'codeidle-alert-popup',
                        title: 'codeidle-alert-title',
                        htmlContainer: 'codeidle-alert-html',
                        actions: 'codeidle-alert-actions',
                        confirmButton: 'codeidle-alert-confirm',
                        denyButton: 'codeidle-alert-deny',
                        cancelButton: 'codeidle-alert-cancel'
                    }
                }).then(result => {
                    if (result.isConfirmed) {
                        gameState.addCode(4000);
                        eventsModule.applyTimedEffect(
                            'clickMultiplier',
                            0.7,
                            CONFIG.EVENT_DURATIONS.technicalDebt,
                            'Ganaste código rápido, pero quedó deuda técnica',
                            'La deuda técnica se estabilizó'
                        );
                    } else if (result.isDenied) {
                        eventsModule.applyTimedEffect(
                            'passiveMultiplier',
                            1.8,
                            CONFIG.EVENT_DURATIONS.refactorBoost,
                            'Refactor exitoso: el proyecto respira mejor',
                            'El boost de refactor terminó'
                        );
                    } else {
                        gameState.addPrestigePoints(1);
                        uiModule.showNotification('Protegiste el alcance y ganaste +1 reputación', 'success');
                    }

                    uiModule.update();
                    achievementsModule.checkAll();
                    gameState.save(true);
                });
            }
        }
    ],
    
    // Calcular peso total
    getTotalWeight() {
        return this.registry.reduce((sum, event) => sum + event.weight, 0);
    },
    
    // Seleccionar evento aleatorio con pesos
    selectRandom() {
        const totalWeight = this.getTotalWeight();
        let random = Math.random() * totalWeight;
        
        for (const event of this.registry) {
            random -= event.weight;
            if (random <= 0) return event;
        }
        return this.registry[0];
    },
    
    // Disparar evento
    trigger() {
        // Verificar cooldown
        if (gameState.eventCooldown > 0) {
            return;
        }
        
        // Seleccionar y ejecutar
        const event = this.selectRandom();
        
        // Mostrar alerta solo para eventos que no abren su propio modal
        const alertEl = document.getElementById('eventAlert');
        if (alertEl && event.showAlert !== false) {
            alertEl.innerHTML = `<div class="event-alert-card"><h3>${event.name}</h3><p>${event.desc}</p></div>`;
            alertEl.classList.add('show');
            
            setTimeout(() => {
                alertEl.classList.remove('show');
            }, 3000);
        }
        
        // Ejecutar lógica
        event.execute();
        uiModule.update();
        
        // Iniciar cooldown
        gameState.eventCooldown = CONFIG.EVENT_COOLDOWN;
        audioModule.play('event');
    },
    
    // Método para agregar nuevos eventos (para futuras features)
    register(event) {
        this.registry.push(event);
        console.log(`✅ Event registered: ${event.id}`);
    }
};

console.log('✅ EVENTS MODULE loaded');
