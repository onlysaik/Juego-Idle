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
        while (gameState.code >= CONFIG.CODE_PER_COMMIT && commitsProcessed < maxCommits) {
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
                    particleCount: Math.min(160, 40 + commitsProcessed * 10),
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
        gameState.addCode(amount);
        gameState.clicks++;
        gameState.updateStreak();
        
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
            uiModule.showNotification(`✨ ${upgrade.name}!`, 'success');
            uiModule.createUpgradesUI();
            achievementsModule.checkAll();
            uiModule.update();
            gameState.save(true);
        } else {
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

        audioModule.play('achievement');
        uiModule.showNotification(`🚀 ${result.version} publicada`, 'success');
        uiModule.update();
        achievementsModule.checkAll();
        gameState.save(true);

        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 90,
                spread: 65,
                origin: { y: 0.58 }
            });
        }
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

        audioModule.play('achievement');
        uiModule.createUpgradesUI();
        uiModule.createLanguagesUI();
        uiModule.createAchievementsUI();
        uiModule.createMissionsUI();
        uiModule.createLabUI();
        uiModule.createMetaUI();
        uiModule.update();
        achievementsModule.checkAll();
        gameState.save(true);

        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 140,
                spread: 80,
                origin: { y: 0.55 }
            });
        }

        uiModule.showNotification(`🌟 Prestige completado: +${reward} reputación`, 'success');
    }
};

console.log('✅ GAME-LOGIC MODULE loaded');
