/**
 * MODULES/MECHANICS/GAME-LOGIC.JS - Lógica principal del juego
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
        uiModule.animateClickButton();
        audioModule.play('click');
        
        const amount = gameState.calculateClickPower();
        gameState.earnCode(amount);
        gameState.clicks++;
        gameState.updateStreak();
        gameState.applyProjectHealthImpact(gameState.getClickProjectHealthImpact());
        
        uiModule.createFloatingText(amount);
        achievementsModule.checkAll();
        this.processCommits({ showFeedback: true });
        
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
            uiModule.showNotification('Código insuficiente', 'warning');
        }
    },
    
    // === COMPRAR LENGUAJE ===
    buyLanguage(key) {
        if (gameState.buyLanguage(key)) {
            const language = gameState.languages[key];
            uiModule.showNotification(`🚀 ${language.name} desbloqueado!`, 'success');
            uiModule.createLanguagesUI();
            uiModule.createUpgradesUI();
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
    }
};

console.log('✅ GAME-LOGIC MODULE loaded');
