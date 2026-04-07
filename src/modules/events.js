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

    applyProjectHealthEffect({ quality = 0, debt = 0 } = {}, message = null, type = 'info') {
        gameState.applyProjectHealthImpact({ quality, debt });

        if (message) {
            uiModule.showNotification(message, type);
            return;
        }

        const parts = [];
        if (quality !== 0) {
            parts.push(`Calidad ${quality > 0 ? '+' : ''}${Math.round(quality)}`);
        }
        if (debt !== 0) {
            parts.push(`Deuda ${debt > 0 ? '+' : ''}${Math.round(debt)}`);
        }

        if (parts.length > 0) {
            uiModule.showNotification(parts.join(' · '), type);
        }
    },

    applyResponsibilityEffect(amount = 0, message = null, type = 'info') {
        const result = gameState.applyResponsibilityImpact(amount);

        if (message) {
            const roundedDelta = Math.round(result.delta);
            const suffix = roundedDelta !== 0
                ? ` · impacto real ${roundedDelta > 0 ? '+' : ''}${roundedDelta}`
                : ' · sin cambio neto';
            uiModule.showNotification(`${message}${suffix}`, type);
            return;
        }

        if (result.delta !== 0) {
            uiModule.showNotification(`Responsabilidad ${result.delta > 0 ? '+' : ''}${Math.round(result.delta)}`, type);
        }
    },

    getWeightedPool(list = this.registry) {
        const snapshot = gameState.getProjectHealthSnapshot();
        const responsibility = gameState.getResponsibilitySnapshot();
        const qualityNormalized = (snapshot.quality - 50) / 50;
        const debtNormalized = (snapshot.technicalDebt - 50) / 50;
        const responsibilityNormalized = (responsibility.value - 50) / 50;

        return list.map(event => {
            const bias = event.healthBias || {};
            const stateMultiplier = bias.stateMultipliers?.[snapshot.state.key] ?? 1;
            const responsibilityBias = event.responsibilityBias || {};
            const responsibilityStateMultiplier = responsibilityBias.stateMultipliers?.[responsibility.state.key] ?? 1;
            const dynamicFactor = Math.max(
                0.15,
                1 + (qualityNormalized * (bias.qualityBias || 0)) + (debtNormalized * (bias.debtBias || 0))
            );
            const responsibilityFactor = Math.max(
                0.65,
                1 + (responsibilityNormalized * (responsibilityBias.valueBias || 0))
            );

            return {
                event,
                weight: event.weight * stateMultiplier * dynamicFactor * responsibilityStateMultiplier * responsibilityFactor
            };
        });
    },

    // Definición de eventos
    registry: [
        {
            id: 'bugCritical',
            name: '🐛 Bug Crítico',
            desc: 'Pierdes el 10% código',
            weight: 3,
            healthBias: {
                qualityBias: -0.35,
                debtBias: 0.95,
                stateMultipliers: {
                    fragile: 1.35,
                    critical: 1.8,
                    premium: 0.55
                }
            },
            execute() {
                gameState.scaleCodePools(0.9);
                uiModule.showNotification('¡Bug detectado! -10% código', 'warning');
                eventsModule.applyProjectHealthEffect({ quality: -6, debt: 8 }, 'El bug dejó más fragilidad en el proyecto', 'warning');
            }
        },
        {
            id: 'codeReview',
            name: '✅ Code Review',
            desc: '+2x velocidad temporal',
            weight: 2,
            healthBias: {
                qualityBias: 0.65,
                debtBias: -0.45,
                stateMultipliers: {
                    premium: 1.35,
                    stable: 1.15,
                    critical: 0.7
                }
            },
            execute() {
                eventsModule.applyProjectHealthEffect({ quality: 4, debt: -3 }, 'La revisión dejó el código más limpio', 'success');
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
            healthBias: {
                qualityBias: -0.2,
                debtBias: 0.55,
                stateMultipliers: {
                    underPressure: 1.2,
                    fragile: 1.35,
                    critical: 1.45
                }
            },
            execute() {
                eventsModule.applyProjectHealthEffect({ quality: -3, debt: 6 }, 'El hackathon empujó velocidad, pero dejó deuda técnica', 'warning');
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
            healthBias: {
                qualityBias: 0.15,
                debtBias: 0.2
            },
            execute() {
                eventsModule.applyProjectHealthEffect({ quality: 1, debt: 1 }, 'Ganaste foco, pero dejaste un par de atajos', 'info');
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
            healthBias: {
                qualityBias: 0.8,
                debtBias: -0.5,
                stateMultipliers: {
                    premium: 1.4,
                    critical: 0.6
                }
            },
            execute() {
                gameState.addCode(500);
                uiModule.showNotification('+500 código bonus completado!', 'success');
                eventsModule.applyProjectHealthEffect({ quality: 6, debt: -4 }, 'La documentación ordenó el proyecto', 'success');
                audioModule.play('event');
            }
        },
        {
            id: 'openSourceSpike',
            name: '⭐ Repo Trending',
            desc: '+3 commits hacia la próxima release y +1 reputación',
            weight: 1,
            healthBias: {
                qualityBias: 0.55,
                debtBias: -0.25,
                stateMultipliers: {
                    premium: 1.45,
                    stable: 1.2
                }
            },
            responsibilityBias: {
                valueBias: 0.22,
                stateMultipliers: {
                    exemplary: 1.2,
                    accountable: 1.1,
                    opportunistic: 0.9,
                    negligent: 0.8
                }
            },
            execute() {
                gameState.releaseCharge += 3;
                gameState.addPrestigePoints(1);
                uiModule.showNotification('Tu repo se volvió tendencia. +3 carga de release, +1 rep', 'success');
                eventsModule.applyProjectHealthEffect({ quality: 2, debt: 0 }, null, 'success');
                eventsModule.applyResponsibilityEffect(2, 'Cumpliste con visibilidad real: Responsabilidad +2', 'success');
                audioModule.play('event');
            }
        },
        {
            id: 'hiringWave',
            name: '💼 Hiring Wave',
            desc: 'El equipo rinde +2x por un rato',
            weight: 1,
            healthBias: {
                qualityBias: 0.4,
                debtBias: -0.15
            },
            execute() {
                eventsModule.applyProjectHealthEffect({ quality: 3, debt: -2 }, 'El equipo absorbió parte de la carga técnica', 'success');
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
            name: '🧭 Decisión: Cliente en llamada',
            desc: 'Tomas una decisión de alcance con impacto inmediato en el proyecto.',
            weight: 1,
            showAlert: false,
            type: 'decision',
            healthBias: {
                debtBias: 0.85,
                qualityBias: -0.2,
                stateMultipliers: {
                    underPressure: 1.25,
                    fragile: 1.45,
                    critical: 1.8
                }
            },
            responsibilityBias: {
                valueBias: -0.28,
                stateMultipliers: {
                    opportunistic: 1.2,
                    negligent: 1.35,
                    exemplary: 0.82
                }
            },
            execute() {
                audioModule.play('event');

                if (typeof Swal === 'undefined') {
                    gameState.addCode(1500);
                    eventsModule.applyProjectHealthEffect({ quality: -3, debt: 5 }, 'Resolviste rápido, pero quedó deuda técnica', 'warning');
                    eventsModule.applyResponsibilityEffect(-4, 'Prometiste más de lo sostenible: Responsabilidad -4', 'warning');
                    uiModule.showNotification('Decisión resuelta: +1500 código', 'success');
                    return;
                }

                Swal.fire({
                    title: 'Decisión',
                    html: `
                        <section class="decision-modal">
                            <div class="decision-modal-badge">Decision critica</div>
                            <div class="decision-modal-header">
                                <h2>Cliente en llamada</h2>
                                <p>El alcance cambió de golpe y tienes que elegir entre velocidad, calidad o reputación.</p>
                            </div>
                            <div class="decision-modal-options">
                                <article class="decision-option decision-option-risk">
                                    <span class="decision-option-label">Opcion agresiva</span>
                                    <strong>Aceptar deuda tecnica</strong>
                                    <p>Entregas rapido y ganas codigo ahora, pero el proyecto queda mas fragil durante un tiempo.</p>
                                    <p class="decision-option-impact">Impacto: Calidad -7 · Deuda +12 · Responsabilidad -6 · bonus corto de velocidad</p>
                                </article>
                                <article class="decision-option decision-option-balance">
                                    <span class="decision-option-label">Opcion limpia</span>
                                    <strong>Refactorizar bien</strong>
                                    <p>Inviertes en estructura y luego el proyecto trabaja con mejor ritmo y menos friccion.</p>
                                    <p class="decision-option-impact">Impacto: Calidad +8 · Deuda -10 · Responsabilidad +5 · mejor ritmo temporal</p>
                                </article>
                                <article class="decision-option decision-option-guard">
                                    <span class="decision-option-label">Opcion politica</span>
                                    <strong>Rechazar alcance</strong>
                                    <p>Proteges el alcance, no aceleras la entrega y te llevas reputacion por sostener el criterio.</p>
                                    <p class="decision-option-impact">Impacto: Calidad +3 · Deuda -2 · Responsabilidad +7 · +1 reputacion</p>
                                </article>
                            </div>
                        </section>
                    `,
                    position: 'center',
                    heightAuto: false,
                    allowOutsideClick: false,
                    showDenyButton: true,
                    showCancelButton: true,
                    confirmButtonText: 'Aceptar deuda técnica',
                    denyButtonText: 'Refactorizar bien',
                    cancelButtonText: 'Rechazar alcance',
                    background: '#1a1f3a',
                    color: '#ffffff',
                    buttonsStyling: false,
                    customClass: {
                        container: 'decision-alert-container',
                        popup: 'decision-alert-popup',
                        title: 'decision-alert-title',
                        htmlContainer: 'decision-alert-html',
                        actions: 'decision-alert-actions',
                        confirmButton: 'decision-alert-confirm',
                        denyButton: 'decision-alert-deny',
                        cancelButton: 'decision-alert-cancel'
                    }
                }).then(result => {
                    if (result.isConfirmed) {
                        gameState.addCode(4000);
                        eventsModule.applyProjectHealthEffect({ quality: -7, debt: 12 }, 'Entregaste con atajos: Calidad -7 · Deuda +12', 'warning');
                        eventsModule.applyResponsibilityEffect(-6, 'Promesa inflada para cerrar rápido: Responsabilidad -6', 'warning');
                        eventsModule.applyTimedEffect(
                            'clickMultiplier',
                            1.35,
                            CONFIG.EVENT_DURATIONS.technicalDebt,
                            'Ganaste velocidad a corto plazo, pero quedó deuda técnica',
                            'El rush perdió impulso y quedaron los costes técnicos'
                        );
                    } else if (result.isDenied) {
                        eventsModule.applyProjectHealthEffect({ quality: 8, debt: -10 }, 'Refactor exitoso: Calidad +8 · Deuda -10', 'success');
                        eventsModule.applyResponsibilityEffect(5, 'Sostuviste una entrega responsable: Responsabilidad +5', 'success');
                        eventsModule.applyTimedEffect(
                            'passiveMultiplier',
                            1.2,
                            CONFIG.EVENT_DURATIONS.refactorBoost,
                            'Refactor exitoso: el proyecto respira mejor',
                            'El boost de refactor terminó'
                        );
                    } else {
                        gameState.addPrestigePoints(1);
                        eventsModule.applyProjectHealthEffect({ quality: 3, debt: -2 }, 'Protegiste el alcance y cuidaste la salud del proyecto', 'success');
                        eventsModule.applyResponsibilityEffect(7, 'Definiste límites claros con el cliente: Responsabilidad +7', 'success');
                        uiModule.showNotification('Protegiste el alcance y ganaste +1 reputación', 'success');
                    }

                    uiModule.update();
                    achievementsModule.checkAll();
                    gameState.save(true);
                });
            }
        },
        {
            id: 'productionFire',
            name: '🔥 Incidente en Producción',
            desc: 'La deuda acumulada te explota en la cara: pierdes código y carga de release.',
            weight: 1,
            healthBias: {
                qualityBias: -0.55,
                debtBias: 1.25,
                stateMultipliers: {
                    fragile: 1.6,
                    critical: 2.2,
                    premium: 0.35
                }
            },
            responsibilityBias: {
                valueBias: -0.24,
                stateMultipliers: {
                    negligent: 1.25,
                    opportunistic: 1.12,
                    accountable: 0.92,
                    exemplary: 0.82
                }
            },
            execute() {
                gameState.scaleCodePools(0.92);
                gameState.releaseCharge = Math.max(0, gameState.releaseCharge - 2);
                eventsModule.applyProjectHealthEffect({ quality: -5, debt: 7 }, 'Incidente en producción: -8% código, -2 carga, más fragilidad', 'warning');
                eventsModule.applyResponsibilityEffect(-5, 'El incidente expuso promesas débiles y poca contención: Responsabilidad -5', 'warning');
            }
        },
        {
            id: 'trustedLaunch',
            name: '🤝 Cliente Premium',
            desc: 'La calidad del proyecto atrae confianza: ganas reputación y mejor preparación de release.',
            weight: 1,
            healthBias: {
                qualityBias: 1.15,
                debtBias: -0.95,
                stateMultipliers: {
                    premium: 2,
                    stable: 1.35,
                    critical: 0.25
                }
            },
            responsibilityBias: {
                valueBias: 0.26,
                stateMultipliers: {
                    exemplary: 1.28,
                    accountable: 1.14,
                    strained: 0.96,
                    negligent: 0.72
                }
            },
            execute() {
                gameState.addPrestigePoints(1);
                gameState.releaseCharge += 2;
                gameState.addCode(1200);
                eventsModule.applyProjectHealthEffect({ quality: 4, debt: -3 }, 'Un cliente premium confió en tu stack: +1200 código, +2 carga, +1 rep', 'success');
                eventsModule.applyResponsibilityEffect(4, 'La confianza ganada reforzó tu imagen de ownership: Responsabilidad +4', 'success');
            }
        }
    ],
    
    // Calcular peso total
    getTotalWeight(list = this.registry) {
        return this.getWeightedPool(list).reduce((sum, entry) => sum + entry.weight, 0);
    },
    
    // Seleccionar evento aleatorio con pesos
    selectRandom(list = this.registry) {
        const weightedPool = this.getWeightedPool(list);
        const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const entry of weightedPool) {
            random -= entry.weight;
            if (random <= 0) return entry.event;
        }
        return weightedPool[0]?.event || null;
    },

    findById(eventId) {
        return this.registry.find(event => event.id === eventId) || null;
    },

    showEventAlert(event) {
        const alertEl = document.getElementById('eventAlert');
        if (!alertEl || event.showAlert === false) {
            return;
        }

        alertEl.innerHTML = `
            <div class="event-alert-card">
                <span class="event-alert-tag">Evento</span>
                <h3>${event.name}</h3>
                <p>${event.desc}</p>
            </div>
        `;
        alertEl.classList.add('show');

        setTimeout(() => {
            alertEl.classList.remove('show');
        }, 3000);
    },

    runEvent(event, options = {}) {
        if (!event) return false;

        const {
            respectCooldown = true,
            setCooldown = true,
            showAlert = true,
            playTriggerSound = true
        } = options;

        if (respectCooldown && gameState.eventCooldown > 0) {
            return false;
        }

        if (showAlert) {
            this.showEventAlert(event);
        }

        event.execute();
        uiModule.update();

        if (setCooldown) {
            gameState.eventCooldown = CONFIG.EVENT_COOLDOWN;
        }

        if (playTriggerSound) {
            audioModule.play('event');
        }

        return true;
    },

    triggerById(eventId, options = {}) {
        const event = this.findById(eventId);
        return this.runEvent(event, {
            respectCooldown: false,
            setCooldown: false,
            showAlert: event?.showAlert !== false,
            ...options
        });
    },

    triggerRandomStandard(options = {}) {
        const standardEvents = this.registry.filter(event => event.type !== 'decision');
        if (standardEvents.length === 0) return false;

        const event = this.selectRandom(standardEvents);
        return this.runEvent(event, {
            respectCooldown: false,
            setCooldown: false,
            ...options
        });
    },
    
    // Disparar evento
    trigger() {
        const event = this.selectRandom();
        this.runEvent(event);
    },
    
    // Método para agregar nuevos eventos (para futuras features)
    register(event) {
        this.registry.push(event);
        console.log(`✅ Event registered: ${event.id}`);
    }
};

console.log('✅ EVENTS MODULE loaded');
