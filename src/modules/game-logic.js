/**
 * MODULES/GAME-LOGIC.JS - Lógica principal del juego
 * Responsabilidad: Manejar clicks, compras, commits
 * Orquesta entre estados y módulos
 */

const gameLogic = {
    processCommits(options = {}) {
        const {
            showFeedback = false,
            auto = false, // commits de la producción pasiva: feedback mínimo (nivel pequeño, sin sonido)
            maxCommits = CONFIG.COMMIT_BATCH_LIMIT
        } = options;

        let commitsProcessed = 0;
        while (gameState.commitProgress >= CONFIG.CODE_PER_COMMIT && commitsProcessed < maxCommits) {
            gameState.addCommit();
            commitsProcessed++;
        }

        if (commitsProcessed === 0) return 0;
        gitLogModule.logCommits(commitsProcessed);

        if (showFeedback) {
            const label = commitsProcessed === 1 ? '¡Commit realizado!' : `¡${commitsProcessed} commits realizados!`;
            uiModule.showNotification(label, 'success');
            feedbackModule.play('commit');
        } else if (auto) {
            feedbackModule.play('commit', { auto: true });
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
        // Durante la escena del prestige no hay UI donde pulsar (la economía sigue corriendo).
        if (fxModule.isSceneActive?.()) return;
        onboardingModule.dismissWelcomeHint();

        // Animación: rebote del botón
        uiModule.animateClickButton();

        // Progreso
        const amount = gameState.calculateClickPower();
        gameState.earnCode(amount);
        gameState.clicks++;
        gameState.updateStreak();
        gameState.applyProjectHealthImpact(gameState.getClickProjectHealthImpact());

        // Sonido: pool del teclado mecánico (mejora con el nivel del upgrade y sube
        // un semitono cada 5 clicks de racha).
        audioModule.playKey(gameState.streak);

        // Racha: acorde en cada escalón y aura (CSS + chispas + chisporroteo) que crece.
        const chordIndex = CONFIG.AUDIO.STREAK_CHORDS.indexOf(gameState.streak);
        if (chordIndex >= 0) feedbackModule.play('streak', this.buildStreakContext(chordIndex + 1));
        this.updateStreakFeedback();

        // Visuales: número flotante
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

    // === RACHA ===
    // Nivel de aura: escalones de STREAK_CHORDS alcanzados mientras la racha siga viva.
    getStreakLevel(now = Date.now()) {
        if (now - gameState.lastClickTime >= CONFIG.STREAK_TIMEOUT) return 0;
        return CONFIG.AUDIO.STREAK_CHORDS.filter(threshold => gameState.streak >= threshold).length;
    },

    // Desde cada click y desde el game loop (el aura se apaga cuando la racha caduca).
    updateStreakFeedback(now = Date.now()) {
        const level = this.getStreakLevel(now);
        audioModule.updateStreakAura(level);
        fxModule.setAura(level);
        // La racha abre poco a poco el filtro del arpegio.
        musicModule.setStreak(now - gameState.lastClickTime < CONFIG.STREAK_TIMEOUT ? gameState.streak : 0);
    },

    buildStreakContext(level) {
        const colors = CONFIG.STREAK_AURA_FX.COLORS[Math.min(CONFIG.STREAK_AURA_FX.COLORS.length, level) - 1];
        return {
            level,
            pitch: (level - 1) * 2, // acorde más agudo en cada escalón
            sparks: 10 + (level * 8),
            sparksShort: 4 + (level * 3),
            flashColor: `${colors[0]}2b` // hex + alfa ≈ 0.17
        };
    },

    // === FEEDBACK DE COMPRAS ===
    // Tarjeta de la tienda/equipo/lab (para animarla). Se busca después de
    // reconstruir la UI, así se anima la tarjeta nueva y no la que se quitó.
    findCard(collection, key) {
        if (collection === 'team') return document.querySelector(`.team-card[data-team="${key}"]`);
        if (collection === 'artifacts') return document.querySelector(`.artifact-card[data-artifact="${key}"]`);
        return document.querySelector(`[data-shop-collection="${collection}"][data-shop-key="${key}"]`)?.closest('.upgrade-card, .language-card') || null;
    },

    // Lo que hay antes de comprar, para mostrar lo gastado como número flotante.
    getWallet() {
        return { code: gameState.code, rep: gameState.prestigePoints };
    },

    formatSpent(before) {
        if (!before) return null;
        const code = before.code - gameState.code;
        if (code >= 1) return `-${uiModule.formatCompactNumber(Math.floor(code))}`;
        const rep = before.rep - gameState.prestigePoints;
        return rep > 0 ? `-${rep} rep` : null;
    },

    buildMilestoneContext(element, milestone) {
        const label = element?.querySelector('[data-milestone-label]') || null;
        return {
            element,
            label,
            labelText: label?.textContent || '',
            stamp: `x${CONFIG.MILESTONES.MULTIPLIER}`,
            banner: `${milestone.name} x${milestone.multiplier}`
        };
    },

    purchaseFeedback(collection, key, milestone = null, walletBefore = null) {
        gitLogModule.logPurchase(collection, key, milestone);
        const element = this.findCard(collection, key);
        if (milestone) {
            feedbackModule.play('milestone', this.buildMilestoneContext(element, milestone));
            return;
        }
        feedbackModule.play(collection === 'upgrades' && key === 'keyboard' ? 'keyboard_upgrade' : 'purchase', {
            element,
            spent: this.formatSpent(walletBefore)
        });
    },

    purchaseFailFeedback(collection, key) {
        feedbackModule.play('purchase_fail', { element: this.findCard(collection, key) });
    },

    // === COMPRA DESDE LA TERMINAL / PALETA ===
    // Compra `count` unidades de golpe y hace el feedback una sola vez.
    // Devuelve { bought, spent, reason } (reason explica por qué se detuvo o no se pudo).
    buyItem(collection, key, count = 1) {
        const methods = { languages: 'buyLanguage', upgrades: 'buyUpgrade', frameworks: 'buyFramework', team: 'buyTeamMember', artifacts: 'buyArtifact' };
        const method = methods[collection];
        const item = gameState[collection]?.[key];
        if (!method || !item) return { bought: 0, spent: '', reason: 'item desconocido' };

        const wallet = this.getWallet();
        const ownedBefore = item.owned;
        let bought = 0;
        for (let i = 0; i < count; i++) {
            if (!gameState[method](key)) break;
            bought++;
        }

        const reason = collection === 'artifacts'
            ? (item.owned > 0 ? 'ya lo tienes' : 'reputación insuficiente')
            : (collection === 'upgrades' && item.owned >= CONFIG.UPGRADE_MAX_OWNED ? 'límite alcanzado' : 'código insuficiente');
        if (bought === 0) return { bought: 0, spent: '', reason };

        const spent = collection === 'artifacts'
            ? `${wallet.rep - gameState.prestigePoints} rep`
            : uiModule.formatCompactNumber(Math.floor(wallet.code - gameState.code));
        const milestone = ['languages', 'team'].includes(collection) ? this.checkMilestone(item.name, ownedBefore, item.owned) : null;
        uiModule.rebuildCommerceUI();
        if (collection === 'languages') uiModule.setPreviewLanguage(key);
        achievementsModule.checkAll();
        this.afterProgressAction();
        uiModule.update();
        this.purchaseFeedback(collection, key, milestone, wallet);
        gameState.save(true);
        return { bought, spent, reason };
    },

    // === COMPRAR UPGRADE ===
    buyUpgrade(key) {
        const walletBefore = this.getWallet();
        if (gameState.buyUpgrade(key)) {
            const upgrade = gameState.upgrades[key];
            uiModule.showNotification(`✨ ${upgrade.name}!`, 'success');
            uiModule.createUpgradesUI();
            achievementsModule.checkAll();
            this.afterProgressAction();
            uiModule.update();
            this.purchaseFeedback('upgrades', key, null, walletBefore);
            gameState.save(true);
        } else {
            const upgrade = gameState.upgrades[key];
            this.purchaseFailFeedback('upgrades', key);
            if (upgrade?.owned >= CONFIG.UPGRADE_MAX_OWNED) {
                uiModule.showNotification(`Límite alcanzado para ${upgrade.name}`, 'info');
                return;
            }
            uiModule.showNotification('Código insuficiente', 'warning');
        }
    },

    // === COMPRAR LENGUAJE ===
    // Aviso cuando una compra cruza un hito de cantidad (10/25/50/100).
    // Devuelve los datos del hito para su coreografía, o null.
    checkMilestone(name, ownedBefore, ownedAfter) {
        const levelBefore = gameState.getMilestoneLevel(ownedBefore);
        const levelAfter = gameState.getMilestoneLevel(ownedAfter);
        if (levelAfter <= levelBefore) return null;

        const threshold = CONFIG.MILESTONES.THRESHOLDS[levelAfter - 1];
        const multiplier = gameState.getMilestoneMultiplier(ownedAfter);
        uiModule.showNotification(`🏁 Hito ${threshold}: ${name} produce x${multiplier}`, 'success', { duration: 4500 });
        return { name, threshold, multiplier };
    },

    buyLanguage(key) {
        const ownedBefore = gameState.languages[key]?.owned ?? 0;
        const walletBefore = this.getWallet();
        if (gameState.buyLanguage(key)) {
            const language = gameState.languages[key];
            const milestone = this.checkMilestone(language.name, ownedBefore, language.owned);
            if (!milestone) {
                uiModule.showNotification(`🚀 ${language.name} desbloqueado!`, 'success');
            }
            uiModule.createLanguagesUI();
            uiModule.createUpgradesUI(); // Mostrar frameworks
            uiModule.setPreviewLanguage(key);
            uiModule.animateLanguageChange(language.name);
            achievementsModule.checkAll();
            this.afterProgressAction();
            uiModule.update();
            this.purchaseFeedback('languages', key, milestone, walletBefore);
            gameState.save(true);
        } else {
            this.purchaseFailFeedback('languages', key);
            uiModule.showNotification('Código insuficiente', 'warning');
        }
    },

    // === COMPRAR FRAMEWORK ===
    buyFramework(key) {
        const walletBefore = this.getWallet();
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
            this.purchaseFeedback('frameworks', key, null, walletBefore);
            gameState.save(true);
        } else {
            this.purchaseFailFeedback('frameworks', key);
            uiModule.showNotification('Código insuficiente', 'warning');
        }
    },

    buyTeam(key) {
        const ownedBefore = gameState.team[key]?.owned ?? 0;
        const walletBefore = this.getWallet();
        if (gameState.buyTeamMember(key)) {
            const member = gameState.team[key];
            const milestone = this.checkMilestone(member.name, ownedBefore, member.owned);
            if (!milestone) {
                uiModule.showNotification(`👥 ${member.name} se unió al equipo`, 'success');
            }
            uiModule.update();
            achievementsModule.checkAll();
            this.afterProgressAction();
            this.purchaseFeedback('team', key, milestone, walletBefore);
            gameState.save(true);
        } else {
            this.purchaseFailFeedback('team', key);
            uiModule.showNotification('No puedes contratar todavía', 'warning');
        }
    },

    buyArtifact(key) {
        const walletBefore = this.getWallet();
        if (gameState.buyArtifact(key)) {
            const artifact = gameState.artifacts[key];
            uiModule.showNotification(`🧪 ${artifact.name} equipado`, 'success');
            uiModule.update();
            achievementsModule.checkAll();
            this.afterProgressAction();
            this.purchaseFeedback('artifacts', key, null, walletBefore);
            gameState.save(true);
        } else {
            this.purchaseFailFeedback('artifacts', key);
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
        gitLogModule.logSpecialization(specialization.name);
        uiModule.update();
        achievementsModule.checkAll();
        this.afterProgressAction();
        gameState.save(true);
    },

    claimMission(slot) {
        const codeBefore = gameState.code;
        const mission = gameState.claimMission(slot);
        if (!mission) {
            feedbackModule.play('purchase_fail', { element: document.getElementById(`${slot}MissionClaim`) });
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
        feedbackModule.play('mission', {
            element: document.getElementById(`${slot}MissionClaim`)?.closest('.mission-card'),
            from: Math.floor(codeBefore),
            to: Math.floor(gameState.code)
        });
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

        uiModule.showNotification(`🚀 ${result.version} · ${result.band.label} · ${result.trust.label} · +${result.code.toLocaleString()} código · +${result.rep} rep · liderazgo ${result.responsibilityDelta >= 0 ? '+' : ''}${Math.round(result.responsibilityDelta)}`, result.band.tone);
        uiModule.update();
        achievementsModule.checkAll();
        this.afterProgressAction();
        // Pipeline Build → Test → Deploy y desenlace según la banda de calidad:
        // limpia (cohete + fuegos), sólida (cohete), arriesgada/inestable (glitch, en tono menor).
        gitLogModule.logRelease(result);
        tickerModule.noteRelease(result);
        feedbackModule.play(this.getReleaseChoreography(result.band.key), this.buildReleaseContext(result));
        gameState.save(true);
    },

    getReleaseChoreography(bandKey) {
        return {
            clean: 'release_clean',
            normal: 'release_normal',
            risky: 'release_risky',
            unstable: 'release_unstable'
        }[bandKey] || 'release_unstable';
    },

    buildReleaseContext(result) {
        return {
            anchor: document.querySelector('.release-card'),
            version: result.version,
            banner: `${result.version} · ${result.band.label}`
        };
    },

    // === POTENCIAS DE 10 DEL CÓDIGO TOTAL ===
    // Desde el game loop: cada nueva potencia desde 1M (récord histórico) es un momento alto.
    checkCodePower() {
        const power = gameState.getCodePower();
        if (power < CONFIG.CODE_POWER.MIN_POWER || power <= gameState.codePowerRecord) return false;
        gameState.codePowerRecord = power;
        const context = this.buildCodePowerContext(power);
        uiModule.showNotification(`🏆 ${context.banner}`, 'success', { duration: 4500 });
        feedbackModule.play('code_power', context);
        gameState.save(true);
        return true;
    },

    // Todo escala con la potencia: sacudida, partículas, volumen y peso del impacto.
    buildCodePowerContext(power) {
        const config = CONFIG.CODE_POWER;
        const steps = Math.max(0, power - config.MIN_POWER);
        const shake = Math.min(1, config.SHAKE_BASE + (steps * config.SHAKE_PER_POWER));
        const tierColor = uiModule.getCodeTierColor(power);
        const to = Math.floor(gameState.code);
        return {
            power,
            impactSound: power >= config.HEAVY_FROM_POWER ? 'impact_heavy' : 'impact_medium',
            shake,
            shakeShort: shake * 0.6,
            shakeMs: Math.min(700, 300 + (steps * 70)),
            quantity: config.PARTICLES_BASE + (steps * config.PARTICLES_PER_POWER),
            subVolume: Math.min(1, 0.6 + (steps * 0.1)),
            tierColor,
            colors: [tierColor, '#ffffff'],
            from: Math.floor(to * 0.5),
            to,
            banner: config.BANNER.replace('{value}', this.formatPowerOfTen(power))
        };
    },

    // 6 → "1M", 7 → "10M", 9 → "1B"...
    formatPowerOfTen(power) {
        const units = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
        const group = Math.min(units.length - 1, Math.floor(power / 3));
        return `${Math.pow(10, power - (group * 3)).toLocaleString()}${units[group]}`;
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
        feedbackModule.play('maintenance');
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

    // Estado seguro: el prestige se aplica y se guarda ANTES de animar. La animación trabaja
    // sobre una copia visual de la UI vieja (fxModule.captureSnapshot), así que cerrar o
    // recargar la pestaña a mitad de la escena no pierde ni duplica nada.
    finishPrestige() {
        // 1) Foto de la UI vieja y datos previos (el DOM aún no cambió: todo es síncrono).
        const snapshot = fxModule.captureSnapshot?.() || null;
        const impact = fxModule.getImpactPoint?.('#prestigeActionBtn') || null;
        const fromRep = gameState.prestigePoints;

        // 2) Estado nuevo + guardado inmediato.
        const reward = gameState.performPrestige();
        if (reward <= 0) return;
        gameState.save(true);

        const releaseBias = Math.min(CONFIG.PRESTIGE_RELEASE_SCORE_CAP, gameState.prestigePoints * CONFIG.PRESTIGE_RELEASE_SCORE_PER_POINT);
        const responsibilityFloor = Math.round(gameState.getResponsibilityBaselineValue());

        // 3) UI nueva, detrás de la escena.
        uiModule.rebuildAllPrimaryUI();
        achievementsModule.checkAll();
        onboardingModule.applyVisibility(); // lo desbloqueado se conserva tras el reset
        this.afterProgressAction();

        gitLogModule.logPrestige(gameState.prestigeLevel + 1);

        // 4) La escena. El aviso sale al final (o al saltarla con Esc), no encima de ella.
        feedbackModule.play('prestige', {
            snapshot,
            impact,
            fromRep,
            toRep: gameState.prestigePoints,
            runNumber: gameState.prestigeLevel + 1,
            onSceneEnd: () => this.notifyPrestige(reward, releaseBias, responsibilityFloor)
        });
        gameState.save(true);
    },

    notifyPrestige(reward, releaseBias, responsibilityFloor) {
        uiModule.showNotification(`🌟 Prestige completado: +${reward} reputación · bonus global x${gameState.getPrestigeMultiplier().toFixed(2)} · disciplina permanente +${Math.round(releaseBias)} score de release · piso de responsabilidad ${responsibilityFloor}`, 'success');
    }
};

console.log('✅ GAME-LOGIC MODULE loaded');
