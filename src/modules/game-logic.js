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
    // Tras cada compra o acción relevante: revisar desbloqueos sin esperar al loop.
    afterProgressAction() {
        onboardingModule.check();
    },

    handleClick() {
        onboardingModule.dismissWelcomeHint();

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
            this.afterProgressAction();
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
    // Confetti + aviso cuando una compra cruza un hito de cantidad (10/25/50/100).
    checkMilestone(name, ownedBefore, ownedAfter) {
        const levelBefore = gameState.getMilestoneLevel(ownedBefore);
        const levelAfter = gameState.getMilestoneLevel(ownedAfter);
        if (levelAfter <= levelBefore) return false;

        const threshold = CONFIG.MILESTONES.THRESHOLDS[levelAfter - 1];
        const multiplier = gameState.getMilestoneMultiplier(ownedAfter);
        audioModule.play('achievement');
        uiModule.showNotification(`🏁 Hito ${threshold}: ${name} produce x${multiplier}`, 'success', { duration: 4500 });
        uiModule.celebrateMilestone();
        return true;
    },

    buyLanguage(key) {
        const ownedBefore = gameState.languages[key]?.owned ?? 0;
        if (gameState.buyLanguage(key)) {
            const language = gameState.languages[key];
            const hitMilestone = this.checkMilestone(language.name, ownedBefore, language.owned);
            if (!hitMilestone) {
                uiModule.showNotification(`🚀 ${language.name} desbloqueado!`, 'success');
            }
            uiModule.createLanguagesUI();
            uiModule.createUpgradesUI(); // Mostrar frameworks
            uiModule.setPreviewLanguage(key);
            uiModule.animateLanguageChange(language.name);
            achievementsModule.checkAll();
            this.afterProgressAction();
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
            this.afterProgressAction();
            uiModule.update();
            gameState.save(true);
        } else {
            uiModule.showNotification('Código insuficiente', 'warning');
        }
    },

    buyTeam(key) {
        const ownedBefore = gameState.team[key]?.owned ?? 0;
        if (gameState.buyTeamMember(key)) {
            const member = gameState.team[key];
            const hitMilestone = this.checkMilestone(member.name, ownedBefore, member.owned);
            if (!hitMilestone) {
                uiModule.showNotification(`👥 ${member.name} se unió al equipo`, 'success');
            }
            uiModule.update();
            achievementsModule.checkAll();
            this.afterProgressAction();
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
            this.afterProgressAction();
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
        this.afterProgressAction();
        gameState.save(true);
    },

    claimMission(slot) {
        const mission = gameState.claimMission(slot);
        if (!mission) {
            uiModule.showNotification('La misión aún no está completa', 'warning');
            return;
        }

        const rewardCode = mission.rewardCode || 0;
        const rewardRep = mission.rewardRep || 0;
        const repText = rewardRep > 0 ? ` · +${rewardRep} rep` : '';
        uiModule.showNotification(`🎯 ${mission.name} completada · +${rewardCode.toLocaleString()} código${repText}`, 'success');
        uiModule.createMissionsUI();
        uiModule.update();
        achievementsModule.checkAll();
        this.afterProgressAction();
        gameState.save(true);
    },

    rerollMission(slot) {
        const result = gameState.rerollMission(slot);
        if (!result.ok) {
            if (result.reason === 'cost') {
                uiModule.showNotification(`Cambiar la misión cuesta ${result.cost.toLocaleString()} código`, 'warning');
            }
            return;
        }

        uiModule.showNotification(`🔄 Nueva misión: ${result.mission.name} · -${result.cost.toLocaleString()} código`, 'info');
        uiModule.createMissionsUI();
        uiModule.update();
        gameState.save(true);
    },

    // === GESTIÓN DE PARTIDA ===
    reloadWithoutSaving() {
        gameEngine.stop();
        window.location.reload();
    },

    async exportSave() {
        gameState.save(true);
        const code = gameState.exportSave();
        let copied = false;
        try {
            await navigator.clipboard.writeText(code);
            copied = true;
        } catch (error) {
            copied = false;
        }

        if (typeof Swal === 'undefined') {
            window.prompt('Copia este texto para guardar tu partida:', code);
            return;
        }

        Swal.fire({
            title: 'Exportar partida',
            text: copied ? 'Copiado al portapapeles. Guárdalo en un lugar seguro.' : 'Copia este texto y guárdalo en un lugar seguro.',
            input: 'textarea',
            inputValue: code,
            inputAttributes: { readonly: 'readonly', 'aria-label': 'Partida exportada' },
            confirmButtonText: 'Cerrar',
            background: '#1a1f3a',
            color: '#ffffff',
            buttonsStyling: false,
            customClass: {
                popup: 'codeidle-alert-popup',
                title: 'codeidle-alert-title',
                htmlContainer: 'codeidle-alert-html',
                actions: 'codeidle-alert-actions',
                confirmButton: 'codeidle-alert-confirm'
            }
        });
    },

    async importSave() {
        let code = null;
        if (typeof Swal === 'undefined') {
            code = window.prompt('Pega el texto de tu partida exportada:');
        } else {
            const result = await Swal.fire({
                title: 'Importar partida',
                text: 'Esto reemplaza tu partida actual.',
                input: 'textarea',
                inputPlaceholder: 'Pega aquí el texto exportado',
                inputAttributes: { 'aria-label': 'Partida a importar' },
                showCancelButton: true,
                confirmButtonText: 'Importar',
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
            });
            if (!result.isConfirmed) return;
            code = result.value;
        }

        if (code === null || code === undefined) return;
        const outcome = gameState.importSave(code);
        if (!outcome.ok) {
            uiModule.showNotification(outcome.error, 'warning');
            return;
        }

        this.reloadWithoutSaving();
    },

    async resetGame() {
        let confirmed = false;
        if (typeof Swal === 'undefined') {
            confirmed = window.confirm('¿Borrar la partida y empezar de cero? No se puede deshacer.');
        } else {
            const result = await Swal.fire({
                title: '¿Borrar la partida?',
                text: 'Perderás todo el progreso, incluida la reputación. Exporta antes si quieres conservarla.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, borrar todo',
                cancelButtonText: 'Cancelar',
                focusCancel: true,
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
            });
            confirmed = result.isConfirmed;
        }

        if (!confirmed) return;
        gameState.wipeSave();
        this.reloadWithoutSaving();
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
        this.afterProgressAction();
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

        uiModule.showNotification(`🧰 Refactor iniciado · -${result.cost.toLocaleString()} código · salud técnica +${Math.round(result.qualityRestore)} · deuda -${Math.round(result.debtReduction)}`, 'success');
        uiModule.update();
        gameState.save(true);
    },

    prestige() {
        const reward = gameState.calculatePrestigeReward();
        if (reward <= 0) {
            uiModule.showNotification('Necesitas más código total para hacer prestige', 'warning');
            return;
        }

        if (eventsModule.isModalOpen()) {
            uiModule.showNotification('Primero resuelve el diálogo abierto', 'info');
            return;
        }

        if (typeof Swal !== 'undefined') {
            const preview = gameState.getPrestigePreview();
            Swal.fire({
                title: '¿Reiniciar run?',
                text: `Obtendrás +${preview.reward} reputación permanente. Bonus global x${preview.currentMultiplier.toFixed(2)} → x${preview.nextMultiplier.toFixed(2)}.`,
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
        onboardingModule.applyVisibility(); // lo desbloqueado se conserva tras el reset
        this.afterProgressAction();
        gameState.save(true);

        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: uiModule.scaleCelebrationCount(140),
                spread: 80,
                origin: { y: 0.55 }
            });
        }

        uiModule.showNotification(`🌟 Prestige completado: +${reward} reputación · bonus global x${gameState.getPrestigeMultiplier().toFixed(2)} · disciplina permanente +${Math.round(releaseBias)} score de release · piso de responsabilidad ${responsibilityFloor}`, 'success');
    }
};

console.log('✅ GAME-LOGIC MODULE loaded');
