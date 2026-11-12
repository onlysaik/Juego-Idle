/**
 * MODULES/ONBOARDING.JS - Onboarding progresivo
 * Responsabilidad: mostrar/ocultar pestañas según CONFIG.FEATURE_UNLOCKS,
 * badges NEW, tips con estilo de commit, barra "// TODO:" y la bienvenida.
 * Las reglas y los textos viven en config.js; el estado (unlockedFeatures,
 * seenTips, newTabBadges) en state.js.
 */

const onboardingModule = {
    lastCheckAt: 0,

    init() {
        this.bindTabSeenListeners();
        this.applyVisibility();
        this.renderBadges();
        this.updateWelcomeHint();
        this.updateNextGoal();
    },

    // === CHEQUEO DE DESBLOQUEOS ===
    // Desde el game loop: como mucho una vez por CHECK_INTERVAL_MS.
    tick(now = Date.now()) {
        if (now - this.lastCheckAt < CONFIG.ONBOARDING.CHECK_INTERVAL_MS) return;
        this.check(now);
    },

    // Forzado (tras compras, misiones, releases, prestige).
    check(now = Date.now()) {
        this.lastCheckAt = now;
        const unlocked = gameState.checkFeatureUnlocks();
        if (unlocked.length === 0) return unlocked;

        this.applyVisibility();
        this.renderBadges();
        this.updateNextGoal();
        unlocked.forEach(key => this.showTipOnce(key));
        gameState.save(true);
        return unlocked;
    },

    // === VISIBILIDAD ===
    // Mapa id → features que lo listan. Un id sin features asociadas siempre se ve.
    getGateMap(field) {
        const map = new Map();
        CONFIG.FEATURE_UNLOCKS.forEach(feature => {
            (feature[field] || []).forEach(id => {
                if (!map.has(id)) map.set(id, []);
                map.get(id).push(feature.key);
            });
        });
        return map;
    },

    isGateOpen(id, gateMap) {
        const features = gateMap.get(id);
        return !features || features.some(key => gameState.isFeatureUnlocked(key));
    },

    isTabLocked(tabId) {
        return !this.isGateOpen(tabId, this.getGateMap('tabIds'));
    },

    applyVisibility() {
        const tabGates = this.getGateMap('tabIds');
        tabGates.forEach((features, tabId) => {
            const locked = !this.isGateOpen(tabId, tabGates);
            const tab = document.getElementById(tabId);
            tab?.closest('.nav-item')?.classList.toggle('is-locked', locked);
            tab?.setAttribute('aria-hidden', String(locked));
            document.getElementById(tabId.replace(/-tab$/, '-content'))?.classList.toggle('is-locked', locked);
        });

        const panelGates = this.getGateMap('panelIds');
        panelGates.forEach((features, panelId) => {
            document.getElementById(panelId)?.classList.toggle('is-locked', !this.isGateOpen(panelId, panelGates));
        });

        // Si la pestaña activa quedó oculta, activar la primera visible.
        const activeTab = document.querySelector('.nav-tabs .nav-link.active');
        const visibleTab = this.getFirstVisibleTab();
        if (visibleTab && (!activeTab || activeTab.closest('.nav-item')?.classList.contains('is-locked'))) {
            uiModule.switchTab(visibleTab.id.replace(/-tab$/, ''));
        }

        const emptyState = document.getElementById('tabsEmptyState');
        if (emptyState) {
            emptyState.textContent = CONFIG.ONBOARDING.EMPTY_PANEL;
            emptyState.hidden = Boolean(visibleTab);
        }
        // Sin pestañas visibles no se muestra la barra de pestañas ni el contenedor vacío.
        document.querySelector('.nav-tabs')?.classList.toggle('is-locked', !visibleTab);
        document.querySelector('#managementContentView .tab-content')?.classList.toggle('is-locked', !visibleTab);
    },

    getFirstVisibleTab() {
        return [...document.querySelectorAll('.nav-tabs .nav-link')]
            .find(tab => !tab.closest('.nav-item')?.classList.contains('is-locked')) || null;
    },

    // === BADGES NEW ===
    renderBadges() {
        document.querySelectorAll('.nav-tabs .nav-link').forEach(tab => {
            const pending = gameState.newTabBadges.includes(tab.id);
            let badge = tab.querySelector('.tab-new-badge');
            if (pending && !badge) {
                badge = document.createElement('span');
                badge.className = 'tab-new-badge';
                badge.textContent = CONFIG.ONBOARDING.NEW_BADGE;
                tab.appendChild(badge);
            } else if (!pending && badge) {
                badge.remove();
            }
        });

        // En escritorio el panel por defecto es el editor y en móvil la vista
        // "Bucle": se marca también el botón que lleva a las pestañas.
        const hasPending = gameState.newTabBadges.some(tabId => !this.isTabLocked(tabId));
        ['managementContentToggle', 'management-view-tab'].forEach(id => {
            document.getElementById(id)?.classList.toggle('has-new', hasPending);
        });
    },

    bindTabSeenListeners() {
        document.querySelectorAll('.nav-tabs .nav-link').forEach(tab => {
            tab.addEventListener('click', () => this.markTabSeen(tab.id));
        });
    },

    // Solo cuando el jugador abre la pestaña (no en cambios automáticos).
    markTabSeen(tabId) {
        if (!gameState.newTabBadges.includes(tabId)) return;
        gameState.markTabSeen(tabId);
        this.renderBadges();
        gameState.save(true);
    },

    // === TIPS ===
    // Coreografía 'unlock': la pestaña nueva aparece cifrada con candado, se
    // descifra, el candado se rompe y, al final (onDone), sale el aviso tipo commit.
    showTipOnce(key) {
        const feature = gameState.getFeatureDefinition(key);
        if (!feature?.tip || gameState.hasSeenTip(key)) return false;
        gameState.markTipSeen(key);
        const showTip = () => {
            const notification = uiModule.showCommitTip(key, feature.tip);
            // El texto del tip se descifra con su sonido (coreografía 'tip').
            feedbackModule.play('tip', {
                element: notification?.querySelector('.commit-tip-text'),
                text: feature.tip.text
            });
            this.renderBadges(); // el badge NEW vuelve a su sitio tras el descifrado
        };
        const context = this.buildUnlockContext(feature);
        if (!context) {
            showTip();
            return true;
        }
        context.onDone = showTip;
        feedbackModule.play('unlock', context);
        return true;
    },

    // Pestaña a descifrar (la primera nueva de la feature) y lo que se ve de ella:
    // la propia pestaña o, si el panel de pestañas está oculto (móvil), el botón que lleva a él.
    buildUnlockContext(feature) {
        const tabIds = feature.tabIds || [];
        const tabId = tabIds.find(id => gameState.newTabBadges.includes(id)) || tabIds[0];
        const tab = tabId ? document.getElementById(tabId) : null;
        if (!tab) return null;
        const label = tab.cloneNode(true);
        label.querySelector('.tab-new-badge')?.remove();
        const anchor = [tab, document.getElementById('managementContentToggle'), document.getElementById('management-view-tab')]
            .find(element => element && fxModule.isVisible(element)) || tab;
        return {
            element: tab,
            anchor,
            text: label.textContent.trim()
        };
    },

    // === BIENVENIDA ===
    isBrandNewGame() {
        return gameState.clicks === 0 && gameState.totalCode === 0;
    },

    updateWelcomeHint() {
        const hint = document.getElementById('clickWelcomeHint');
        if (!hint) return;
        hint.textContent = CONFIG.ONBOARDING.WELCOME_HINT;
        hint.hidden = !this.isBrandNewGame();
    },

    dismissWelcomeHint() {
        const hint = document.getElementById('clickWelcomeHint');
        if (hint && !hint.hidden) hint.hidden = true;
    },

    // === PRÓXIMO OBJETIVO ===
    updateNextGoal() {
        const container = document.getElementById('nextGoal');
        const text = document.getElementById('nextGoalText');
        const bar = document.getElementById('nextGoalBar');
        if (!container || !text || !bar) return;

        const goal = gameState.getNextGoal();
        container.hidden = !goal;
        if (!goal) return;

        // Etiqueta y contador en spans separados: en pantallas estrechas se
        // recorta la etiqueta con "…" y el contador (actual/meta) siempre se ve.
        const format = value => this.formatGoalValue(goal.metric, value);
        if (!this.goalLabelEl || !text.contains(this.goalLabelEl)) {
            text.textContent = '';
            this.goalLabelEl = document.createElement('span');
            this.goalLabelEl.className = 'next-goal-label';
            this.goalCountEl = document.createElement('span');
            this.goalCountEl.className = 'next-goal-count';
            text.append(this.goalLabelEl, this.goalCountEl);
        }
        this.goalLabelEl.textContent = `// TODO: ${goal.label}`;
        this.goalCountEl.textContent = ` (${format(goal.current)}/${format(goal.target)})`;
        const percent = goal.target > 0 ? Math.max(0, Math.min(100, (goal.current / goal.target) * 100)) : 0;
        bar.style.width = `${percent}%`;
    },

    formatGoalValue(metric, value) {
        if (metric === 'healthySeconds' || metric === 'highResponsibilitySeconds') {
            return uiModule.formatMissionValue(metric, value);
        }
        return uiModule.formatCompactNumber(Math.floor(value));
    }
};

console.log('✅ ONBOARDING MODULE loaded');
