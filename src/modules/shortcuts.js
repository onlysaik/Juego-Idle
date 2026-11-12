/**
 * MODULES/SHORTCUTS.JS - Atajos de teclado y paleta de comandos
 * - Ctrl+K: paleta con búsqueda difusa (comprar, cambiar de pestaña, publicar release,
 *   refactorizar, cambiar tema, terminal, git log, nerd stats, ticker).
 * - 1–9: cambian de pestaña (solo las desbloqueadas). R: publica una release si hay una lista.
 * - No tocan Espacio/Enter (click), ni los hotkeys de admin (adminModule.handleKeydown corre
 *   antes: con admin activo, R sigue siendo la release instantánea de admin), ni se activan
 *   mientras se escribe en un input, con un modal abierto o con la terminal abierta.
 * La lista de atajos vive en CONFIG.SHORTCUTS (también la muestra el comando help).
 */

const shortcutsModule = window.shortcutsModule = {
    paletteEl: null,
    inputEl: null,
    listEl: null,
    items: [],
    results: [],
    selected: 0,

    init() {
        this.buildPalette();
    },

    // === TECLADO ===
    isPaletteOpen() {
        return !!this.paletteEl && !this.paletteEl.hidden;
    },

    isBlocked(event) {
        return eventsModule.isModalOpen()
            || adminModule.isConsoleOpen
            || this.isPaletteOpen()
            || adminModule.isTypingTarget(event.target)
            || !!event.target?.closest?.('input, textarea, select, [contenteditable="true"], .swal2-container, #adminConsole, #settingsPanel');
    },

    // Devuelve true si el evento era un atajo suyo.
    handleKeydown(event) {
        if (event.repeat) return false;
        const key = event.key;

        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && key.toLowerCase() === 'k') {
            if (this.isBlocked(event)) return false;
            event.preventDefault();
            this.openPalette();
            return true;
        }

        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
        if (this.isBlocked(event)) return false;

        if (/^[1-9]$/.test(key)) {
            event.preventDefault();
            this.goToTabByNumber(Number(key));
            return true;
        }
        if (key.toLowerCase() === 'r') {
            event.preventDefault();
            this.publishRelease();
            return true;
        }
        return false;
    },

    // === PESTAÑAS ===
    getVisibleTabs() {
        return [...document.querySelectorAll('.nav-tabs .nav-link')]
            .filter(tab => !tab.closest('.nav-item')?.classList.contains('is-locked'));
    },

    goToTabByNumber(number) {
        const tab = this.getVisibleTabs()[number - 1];
        if (tab) this.goToTab(tab);
    },

    // Abre el panel de gestión (en escritorio puede estar el editor; en móvil, la vista del clicker).
    goToTab(tab) {
        if (document.body.dataset.screenProfile === 'mobile') {
            document.getElementById('management-view-tab')?.click();
        }
        const managementView = document.getElementById('managementContentView');
        if (managementView?.hidden) document.getElementById('managementContentToggle')?.click();
        tab.click();
    },

    publishRelease() {
        if (gameState.canPublishRelease()) {
            gameLogic.publishRelease();
        } else {
            uiModule.showNotification(`Aún no hay release lista (${Math.floor(gameState.releaseCharge)}/${CONFIG.RELEASE_CHARGE_REQUIRED} commits)`, 'info');
        }
    },

    // === BÚSQUEDA DIFUSA ===
    // Subsecuencia: las letras de la consulta deben aparecer en orden. Puntúa más las
    // coincidencias seguidas y las que empiezan al inicio de una palabra. -1 = no coincide.
    fuzzyScore(query, text) {
        const q = terminalModule.normalize(query);
        const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (!q) return 0;
        let score = 0;
        let position = 0;
        let streak = 0;
        for (const char of q) {
            const found = t.indexOf(char, position);
            if (found === -1) return -1;
            const wordStart = found === 0 || /[\s:·(/-]/.test(t[found - 1]);
            streak = found === position ? streak + 1 : 0;
            score += 1 + (streak * 2) + (wordStart ? 3 : 0) - Math.min(2, (found - position) * 0.1);
            position = found + 1;
        }
        return score - (t.length * 0.02);
    },

    // === PALETA ===
    buildPalette() {
        const overlay = document.createElement('div');
        overlay.id = 'commandPalette';
        overlay.className = 'command-palette';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="command-palette-panel" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
                <input class="command-palette-input" type="text" autocomplete="off" spellcheck="false">
                <ul class="command-palette-list" role="listbox"></ul>
            </div>`;
        document.body.appendChild(overlay);
        this.paletteEl = overlay;
        this.inputEl = overlay.querySelector('.command-palette-input');
        this.listEl = overlay.querySelector('.command-palette-list');
        if (!this.inputEl || !this.listEl) return;
        this.inputEl.placeholder = CONFIG.PALETTE.PLACEHOLDER;

        overlay.addEventListener('mousedown', event => {
            if (event.target === overlay) this.closePalette();
        });
        this.inputEl.addEventListener('input', () => this.search());
        this.inputEl.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closePalette();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                this.move(event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                this.runSelected();
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                this.closePalette();
            }
        });
    },

    openPalette() {
        if (!this.paletteEl) return;
        this.items = this.buildItems();
        this.paletteEl.hidden = false;
        this.inputEl.value = '';
        this.search();
        requestAnimationFrame(() => this.inputEl.focus());
    },

    closePalette() {
        if (!this.paletteEl) return;
        this.paletteEl.hidden = true;
        this.inputEl.blur();
    },

    // Acciones disponibles ahora mismo (se reconstruyen al abrir).
    buildItems() {
        const items = [];
        const add = (label, hint, run, enabled = true) => items.push({ label, hint, run, enabled });

        this.getVisibleTabs().forEach((tab, index) => {
            const name = tab.textContent.trim();
            add(`Ir a: ${name}`, index < 9 ? `tecla ${index + 1}` : '', () => this.goToTab(tab));
        });

        terminalModule.getBuyables().forEach(({ collection, key, item }) => {
            const owned = item.owned > 0 && collection === 'artifacts';
            const isUpgradeMax = collection === 'upgrades' && item.owned >= CONFIG.UPGRADE_MAX_OWNED;
            const cost = collection === 'artifacts' ? `${item.cost} rep` : uiModule.formatCodeCost(item.cost);
            const affordable = collection === 'artifacts' ? gameState.canAffordPrestigeCost(item.cost) : gameState.canAffordCodeCost(item.cost);
            add(`Comprar: ${item.name}`, owned ? 'ya lo tienes' : (isUpgradeMax ? 'máximo' : cost), () => this.buy(collection, key), affordable && !owned && !isUpgradeMax);
        });

        add('Publicar release', gameState.canPublishRelease() ? 'tecla R' : `faltan commits (${Math.floor(gameState.releaseCharge)}/${CONFIG.RELEASE_CHARGE_REQUIRED})`, () => gameLogic.publishRelease(), gameState.canPublishRelease());
        if (gameState.isFeatureUnlocked('health')) {
            add('Refactorizar (mantenimiento)', `${uiModule.formatCodeCost(gameState.getMaintenanceCost())} código`, () => gameLogic.startMaintenance());
        }
        Object.entries(CONFIG.THEMES).forEach(([key, theme]) => {
            add(`Tema: ${theme.label}`, gameState.theme === key ? 'actual' : '', () => this.setTheme(key));
        });
        add('Abrir terminal', 'tecla `', () => adminModule.openConsole());
        add('Abrir git log', 'git log --oneline', () => gitLogModule.open());
        add('Ajustes de sonido y efectos', '', () => settingsModule.open());
        add(`Nerd stats: ${nerdStatsModule.isEnabled() ? 'desactivar' : 'activar'}`, '', () => {
            gameState.devSettings.nerdStats = !nerdStatsModule.isEnabled();
            gameState.save(true);
            nerdStatsModule.apply();
            nerdStatsModule.update(true);
        });
        const mode = tickerModule.getMode();
        add(`Ticker de noticias: ${mode === 'hidden' ? 'mostrar' : 'ocultar'}`, '', () => tickerModule.setMode(mode === 'hidden' ? 'running' : 'hidden'));
        if (mode !== 'hidden') add(`Ticker de noticias: ${mode === 'paused' ? 'reanudar' : 'pausar'}`, '', () => tickerModule.setMode(mode === 'paused' ? 'running' : 'paused'));
        return items;
    },

    buy(collection, key) {
        const result = gameLogic.buyItem(collection, key, 1);
        if (result.bought === 0) uiModule.showNotification(result.reason, 'warning');
    },

    setTheme(key) {
        themesModule.toggle(key);
        const selector = document.getElementById('themeSelector');
        if (selector) selector.value = key;
    },

    search() {
        const query = this.inputEl.value.trim();
        const scored = this.items
            .map(item => ({ item, score: this.fuzzyScore(query, `${item.label} ${item.hint}`) }))
            .filter(entry => entry.score >= 0);
        // Con consulta: mejor coincidencia primero (las no disponibles, un poco peor).
        scored.sort((a, b) => (b.score - (b.item.enabled ? 0 : 4)) - (a.score - (a.item.enabled ? 0 : 4)));
        this.results = (query ? scored : scored.map(entry => entry)).slice(0, CONFIG.PALETTE.MAX_RESULTS).map(entry => entry.item);
        this.selected = 0;
        this.renderResults();
    },

    renderResults() {
        this.listEl.replaceChildren();
        if (this.results.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'command-palette-empty';
            empty.textContent = CONFIG.PALETTE.EMPTY;
            this.listEl.appendChild(empty);
            return;
        }
        this.results.forEach((item, index) => {
            const row = document.createElement('li');
            row.className = `command-palette-item${index === this.selected ? ' is-selected' : ''}${item.enabled ? '' : ' is-disabled'}`;
            row.setAttribute('role', 'option');
            const label = document.createElement('span');
            label.textContent = item.label;
            const hint = document.createElement('small');
            hint.textContent = item.hint || '';
            row.append(label, hint);
            row.addEventListener('mousemove', () => { this.selected = index; this.highlight(); });
            row.addEventListener('mousedown', event => { event.preventDefault(); this.selected = index; this.runSelected(); });
            this.listEl.appendChild(row);
        });
    },

    highlight() {
        [...this.listEl.children].forEach((row, index) => row.classList.toggle('is-selected', index === this.selected));
        this.listEl.children[this.selected]?.scrollIntoView({ block: 'nearest' });
    },

    move(delta) {
        if (this.results.length === 0) return;
        this.selected = (this.selected + delta + this.results.length) % this.results.length;
        this.highlight();
    },

    runSelected() {
        const item = this.results[this.selected];
        if (!item) return;
        this.closePalette();
        if (!item.enabled) {
            uiModule.showNotification(item.hint ? `${item.label}: ${item.hint}` : 'No disponible ahora', 'info');
            return;
        }
        item.run();
    }
};

console.log('✅ SHORTCUTS MODULE loaded');
