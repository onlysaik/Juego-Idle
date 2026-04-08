/**
 * MODULES/GAME-LOGIC.JS - Lógica principal del juego
 * Responsabilidad: Manejar clicks, compras, commits
 * Orquesta entre estados y módulos
 */

const gameLogic = {
    processCommits(options = {}) {
        const {
            showFeedback = false,
            maxCommits = CONFIG.COMMIT_BATCH_LIMIT
        } = options;

        let commitsProcessed = 0;
        while (gameState.commitProgress >= CONFIG.CODE_PER_COMMIT && commitsProcessed < maxCommits) {
            gameState.addCommit();
            commitsProcessed++;
        }

        if (commitsProcessed === 0) return 0;

        if (showFeedback) {
            audioModule.play('commit');
            const label = commitsProcessed === 1 ? '¡Commit realizado!' : `¡${commitsProcessed} commits realizados!`;
            uiModule.showNotification(label, 'success');
            uiModule.animateCommit();

            if (typeof confetti !== 'undefined') {
                confetti({
                    particleCount: uiModule.scaleCelebrationCount(Math.min(160, 40 + commitsProcessed * 10)),
                    spread: 50,
                    origin: { y: 0.6 }
                });
            }
        }

        achievementsModule.checkAll();
        return commitsProcessed;
    },

    // === CLICK ===
    handleClick() {
        // Animación
        uiModule.animateClickButton();
        
        // Sonido
        audioModule.play('click');
        
        // Progreso
        const amount = gameState.calculateClickPower();
        gameState.earnCode(amount);
        gameState.clicks++;
        gameState.updateStreak();
        gameState.applyProjectHealthImpact(gameState.getClickProjectHealthImpact());
        
        // Visuales
        uiModule.createFloatingText(amount);
        
        // Chequear logros
        achievementsModule.checkAll();
        
        // Chequear commit
        this.processCommits({ showFeedback: true });
        
        // Update
        uiModule.update();
        gameState.save(true);
    },
    
    // === COMMIT ===
    makeCommit() {
        return this.processCommits({ showFeedback: true, maxCommits: 1 });
    },
    
    // === COMPRAR UPGRADE ===
    buyUpgrade(key) {
        if (gameState.buyUpgrade(key)) {
            const upgrade = gameState.upgrades[key];
            audioModule.play(key === 'keyboard' ? 'keyboard-upgrade' : 'achievement');
            uiModule.showNotification(`✨ ${upgrade.name}!`, 'success');
            uiModule.createUpgradesUI();
            achievementsModule.checkAll();
            uiModule.update();
            gameState.save(true);
        } else {
            const upgrade = gameState.upgrades[key];
            if (upgrade?.owned >= CONFIG.UPGRADE_MAX_OWNED) {
                uiModule.showNotification(`Límite alcanzado para ${upgrade.name}`, 'info');
                return;
            }
            uiModule.showNotification('Código insuficiente', 'warning');
        }
    },
    
    // === COMPRAR LENGUAJE ===
    buyLanguage(key) {
        if (gameState.buyLanguage(key)) {
            const language = gameState.languages[key];
            uiModule.showNotification(`🚀 ${language.name} desbloqueado!`, 'success');
            uiModule.createLanguagesUI();
            uiModule.createUpgradesUI(); // Mostrar frameworks
            uiModule.setPreviewLanguage(key);
            uiModule.animateLanguageChange(language.name);
            achievementsModule.checkAll();
            uiModule.update();
            gameState.save(true);
        } else {
            uiModule.showNotification('Código insuficiente', 'warning');
        }
    },
    
    // === COMPRAR FRAMEWORK ===
    buyFramework(key) {
        if (gameState.buyFramework(key)) {
            const framework = gameState.frameworks[key];
            const languageKey = framework.requires;
            const language = gameState.languages[languageKey];
            uiModule.showNotification(`⚡ ${framework.name} integrado!`, 'success');
            uiModule.createUpgradesUI();
            uiModule.setPreviewFramework(key);
            uiModule.animateLanguageChange(language.name, framework.name);
            uiModule.update();
            gameState.save(true);
        } else {
            uiModule.showNotification('Código insuficiente', 'warning');
        }
    },

    buyTeam(key) {
        if (gameState.buyTeamMember(key)) {
            const member = gameState.team[key];
            uiModule.showNotification(`👥 ${member.name} se unió al equipo`, 'success');
            uiModule.update();
            achievementsModule.checkAll();
            gameState.save(true);
        } else {
            uiModule.showNotification('No puedes contratar todavía', 'warning');
        }
    },

    buyArtifact(key) {
        if (gameState.buyArtifact(key)) {
            const artifact = gameState.artifacts[key];
            uiModule.showNotification(`🧪 ${artifact.name} equipado`, 'success');
            uiModule.update();
            achievementsModule.checkAll();
            gameState.save(true);
        } else {
            uiModule.showNotification('Necesitas más reputación o ya lo tienes', 'warning');
        }
    },

    chooseSpecialization(key) {
        const alreadySelected = gameState.currentSpecialization === key;
        const specialization = CONFIG.SPECIALIZATIONS[key];
        if (!specialization) return;

        if (alreadySelected) {
            uiModule.showNotification(`Ya eres ${specialization.name}`, 'info');
            return;
        }

        if (!gameState.assignSpecialization(key)) {
            uiModule.showNotification(`Cambiar cuesta ${CONFIG.SPECIALIZATION_SWITCH_COST.toLocaleString()} código`, 'warning');
            return;
        }

        uiModule.showNotification(`Ruta ${specialization.name} activada`, 'success');
        uiModule.update();
        achievementsModule.checkAll();
        gameState.save(true);
    },

    claimMission(slot) {
        const mission = gameState.claimMission(slot);
        if (!mission) {
            uiModule.showNotification('La misión aún no está completa', 'warning');
            return;
        }

        uiModule.showNotification(`🎯 ${mission.name} completada`, 'success');
        uiModule.createMissionsUI();
        uiModule.update();
        achievementsModule.checkAll();
        gameState.save(true);
    },

    publishRelease() {
        const result = gameState.publishRelease();
        if (!result) {
            uiModule.showNotification(`Necesitas ${CONFIG.RELEASE_CHARGE_REQUIRED} commits para una release`, 'warning');
            return;
        }

        audioModule.play(result.band.key === 'unstable' ? 'click' : 'achievement');
        uiModule.showNotification(`🚀 ${result.version} · ${result.band.label} · ${result.trust.label} · +${result.code.toLocaleString()} código · +${result.rep} rep · liderazgo ${result.responsibilityDelta >= 0 ? '+' : ''}${Math.round(result.responsibilityDelta)}`, result.band.tone);
        uiModule.update();
        achievementsModule.checkAll();
        gameState.save(true);

        if (typeof confetti !== 'undefined' && result.band.key !== 'unstable') {
            confetti({
                particleCount: uiModule.scaleCelebrationCount(result.band.key === 'clean' ? 120 : 90),
                spread: result.band.key === 'clean' ? 80 : 65,
                origin: { y: 0.58 }
            });
        }
    },

    startMaintenance() {
        const result = gameState.startMaintenance();
        if (!result.ok) {
            if (result.reason === 'active') {
                uiModule.showNotification('Ya estás en mantenimiento activo', 'info');
            } else if (result.reason === 'cooldown') {
                uiModule.showNotification('El mantenimiento sigue en cooldown', 'warning');
            } else {
                uiModule.showNotification(`Necesitas ${result.status.cost.toLocaleString()} código para refactorizar`, 'warning');
            }
            return;
        }

        uiModule.showNotification(`🧰 Refactor iniciado · -${result.cost.toLocaleString()} código · salud técnica +${CONFIG.MAINTENANCE.QUALITY_RESTORE} · deuda -${CONFIG.MAINTENANCE.DEBT_REDUCTION}`, 'success');
        uiModule.update();
        gameState.save(true);
    },

    prestige() {
        const reward = gameState.calculatePrestigeReward();
        if (reward <= 0) {
            uiModule.showNotification('Necesitas más código total para hacer prestige', 'warning');
            return;
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '¿Reiniciar run?',
                text: `Obtendrás +${reward} reputación permanente.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, hacer prestige',
                cancelButtonText: 'Cancelar',
                background: '#1a1f3a',
                color: '#ffffff',
                buttonsStyling: false,
                customClass: {
                    popup: 'codeidle-alert-popup',
                    title: 'codeidle-alert-title',
                    htmlContainer: 'codeidle-alert-html',
                    actions: 'codeidle-alert-actions',
                    confirmButton: 'codeidle-alert-confirm',
                    cancelButton: 'codeidle-alert-cancel'
                }
            }).then(result => {
                if (result.isConfirmed) {
                    this.finishPrestige();
                }
            });
            return;
        }

        this.finishPrestige();
    },

    finishPrestige() {
        const reward = gameState.performPrestige();
        if (reward <= 0) return;

        const releaseBias = Math.min(CONFIG.PRESTIGE_RELEASE_SCORE_CAP, gameState.prestigePoints * CONFIG.PRESTIGE_RELEASE_SCORE_PER_POINT);
        const responsibilityFloor = Math.round(gameState.getResponsibilityBaselineValue());

        audioModule.play('achievement');
        uiModule.rebuildAllPrimaryUI();
        achievementsModule.checkAll();
        gameState.save(true);

        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: uiModule.scaleCelebrationCount(140),
                spread: 80,
                origin: { y: 0.55 }
            });
        }

        uiModule.showNotification(`🌟 Prestige completado: +${reward} reputación · disciplina permanente +${Math.round(releaseBias)} score de release · piso de responsabilidad ${responsibilityFloor}`, 'success');
    }
};

console.log('✅ GAME-LOGIC MODULE loaded');
