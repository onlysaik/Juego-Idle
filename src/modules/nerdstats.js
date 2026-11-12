/**
 * MODULES/NERDSTATS.JS - Nerd stats
 * - Tooltip monospace con el desglose de la fórmula de código/s y del poder de click al
 *   pasar el mouse (o mantener pulsado en móvil) sobre los elementos con data-nerd.
 *   Los valores salen de gameState.getGenerationBreakdown() / getClickBreakdown(), de donde
 *   calculateGeneration() y calculateClickPower() toman su total: coinciden por construcción.
 * - "ROI: X s" en las tarjetas de lenguajes y equipo (coste ÷ producción que añade una unidad)
 *   y un borde sutil en la compra más eficiente del momento.
 * - Se activa/desactiva con el toggle de Estadísticas; sin elección del jugador se activa
 *   solo tras el primer prestige (gameState.isNerdStatsEnabled()).
 */

const nerdStatsModule = window.nerdStatsModule = {
    tooltip: null,
    activeTarget: null,
    activeKind: null,
    holdTimer: null,
    refreshTimer: null,
    lastRoiAt: 0,
    lastRoiSignature: '',
    best: null,

    init() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'nerdTooltip';
        this.tooltip.className = 'nerd-tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.hidden = true;
        document.body.appendChild(this.tooltip);

        // Ratón: delegado sobre cualquier elemento con data-nerd (algunos se recrean).
        document.addEventListener('mouseover', event => {
            const target = event.target.closest?.('[data-nerd]');
            if (target) this.show(target, event);
        });
        document.addEventListener('mousemove', event => {
            if (this.activeTarget && !this.tooltip.hidden) this.place(event.clientX, event.clientY);
        });
        document.addEventListener('mouseout', event => {
            const target = event.target.closest?.('[data-nerd]');
            if (target && target === this.activeTarget && !target.contains(event.relatedTarget)) this.hide();
        });
        // Móvil: mantener pulsado.
        document.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse') return;
            const target = event.target.closest?.('[data-nerd]');
            if (!target) { this.hide(); return; }
            clearTimeout(this.holdTimer);
            this.holdTimer = setTimeout(() => this.show(target, event), CONFIG.NERD_STATS.HOLD_MS);
        });
        ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, event => {
            if (event.pointerType === 'mouse') return;
            clearTimeout(this.holdTimer);
            setTimeout(() => this.hide(), 1800); // se queda un momento para poder leerlo
        }));

        this.bindToggles();
        this.apply();
    },

    isEnabled() {
        return gameState.isNerdStatsEnabled();
    },

    // body[data-nerd-stats] activa el estilo (código/s visible, ROI visible).
    apply() {
        const enabled = this.isEnabled();
        document.body.dataset.nerdStats = enabled ? 'true' : 'false';
        if (!enabled) {
            this.hide();
            this.best = null;
            document.querySelectorAll('.roi-best').forEach(card => card.classList.remove('roi-best'));
        }
        this.syncToggles();
    },

    // === TOGGLES (pestaña Estadísticas) ===
    bindToggles() {
        document.getElementById('nerdStatsToggle')?.addEventListener('change', event => {
            gameState.devSettings.nerdStats = event.target.checked;
            gameState.save(true);
            this.apply();
            this.update(true);
        });
        document.getElementById('newsTickerToggle')?.addEventListener('change', event => {
            tickerModule.setMode(event.target.checked ? 'running' : 'hidden');
        });
    },

    syncToggles() {
        const nerd = document.getElementById('nerdStatsToggle');
        if (nerd) nerd.checked = this.isEnabled();
        const ticker = document.getElementById('newsTickerToggle');
        if (ticker) ticker.checked = gameState.devSettings.ticker !== 'hidden';
    },

    // === FORMATO ===
    fmt(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        const abs = Math.abs(value);
        if (abs >= 1e6) return uiModule.formatCompactNumber(value);
        return value.toLocaleString('es', { maximumFractionDigits: abs >= 100 ? 1 : digits });
    },

    pad(label, value, width = 26) {
        return `${label.padEnd(width, ' ')}${value}`;
    },

    // === TEXTO DEL TOOLTIP ===
    buildGeneration() {
        const b = gameState.getGenerationBreakdown({ detail: true });
        const f = value => this.fmt(value);
        const lines = ['código/s = base × (1 + bonus) × prestige × eventos × mant.', ''];
        lines.push(this.pad('lenguajes', f(b.sources.languages)));
        lines.push(this.pad('equipo', f(b.sources.team)));
        lines.push(this.pad('especialización', f(b.sources.specialization)));
        lines.push(this.pad('frameworks', f(b.sources.frameworks)));
        lines.push(this.pad('tendencia', f(b.sources.trendLanguage + b.sources.trendFramework)));
        lines.push(this.pad('hitos (incluidos arriba)', `+${f(b.milestoneExtra || 0)}`));
        lines.push(this.pad('= base', f(b.base)));
        lines.push('');
        lines.push(this.pad('1 + bonus', `×${this.fmt(b.bonusMultiplier, 3)}`));
        lines.push(this.pad('  especialización', `+${this.fmt(b.bonus.specialization, 3)}`));
        lines.push(this.pad('  equipo', `+${this.fmt(b.bonus.team, 3)}`));
        lines.push(this.pad('  artefactos', `+${this.fmt(b.bonus.artifacts, 3)}`));
        lines.push(this.pad(`prestige (${gameState.prestigePoints} rep)`, `×${this.fmt(b.prestige, 3)}`));
        lines.push(this.pad('eventos activos', `×${this.fmt(b.effects, 3)}`));
        lines.push(this.pad('mantenimiento', `×${this.fmt(b.maintenance, 3)}`));
        lines.push('');
        lines.push(this.pad('= total', `${f(b.total)} /s`));
        return lines.join('\n');
    },

    buildClick() {
        const b = gameState.getClickBreakdown();
        const f = value => this.fmt(value);
        const lines = ['click = base × prestige × (1 + bonus + racha) × eventos × mant. + % producción', ''];
        lines.push(this.pad('base (upgrades)', f(b.base)));
        lines.push(this.pad(`prestige (${gameState.prestigePoints} rep)`, `×${this.fmt(b.prestige, 3)}`));
        lines.push(this.pad('1 + bonus + racha', `×${this.fmt(b.bonusMultiplier, 3)}`));
        lines.push(this.pad('  especialización', `+${this.fmt(b.bonus.specialization, 3)}`));
        lines.push(this.pad('  equipo', `+${this.fmt(b.bonus.team, 3)}`));
        lines.push(this.pad('  artefactos', `+${this.fmt(b.bonus.artifacts, 3)}`));
        lines.push(this.pad(`  racha (${gameState.streak})`, `+${this.fmt(b.bonus.streak, 3)}`));
        lines.push(this.pad('eventos activos', `×${this.fmt(b.effects, 3)}`));
        lines.push(this.pad('mantenimiento', `×${this.fmt(b.maintenance, 3)}`));
        lines.push(this.pad('= click propio', f(b.baseClick)));
        lines.push(this.pad(`+ ${Math.round(CONFIG.CLICK_PASSIVE_SHARE * 100)}% de la producción`, `+${f(b.passiveShare)}`));
        lines.push('');
        lines.push(this.pad('= total', `${f(b.total)} /click`));
        return lines.join('\n');
    },

    // === MOSTRAR / OCULTAR ===
    show(target, event) {
        if (!this.isEnabled() || !this.tooltip) return;
        this.activeTarget = target;
        this.activeKind = target.dataset.nerd;
        this.refresh();
        this.tooltip.hidden = false;
        this.place(event.clientX, event.clientY);
        clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => this.refresh(), 400); // los números en vivo
    },

    refresh() {
        if (!this.activeTarget) return;
        this.tooltip.textContent = this.activeKind === 'click' ? this.buildClick() : this.buildGeneration();
    },

    place(x, y) {
        const margin = 14;
        const rect = this.tooltip.getBoundingClientRect();
        let left = x + margin;
        let top = y + margin;
        if (left + rect.width > window.innerWidth - 8) left = Math.max(8, x - rect.width - margin);
        if (top + rect.height > window.innerHeight - 8) top = Math.max(8, y - rect.height - margin);
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    },

    hide() {
        clearTimeout(this.holdTimer);
        clearInterval(this.refreshTimer);
        this.activeTarget = null;
        if (this.tooltip) this.tooltip.hidden = true;
    },

    // === ROI ===
    formatRoi(seconds) {
        if (!Number.isFinite(seconds)) return 'ROI: —';
        const value = seconds < 10 ? seconds.toFixed(1) : (seconds < 1000 ? String(Math.round(seconds)) : uiModule.formatCompactNumber(seconds));
        return `ROI: ${value} s`;
    },

    // Llamado desde uiModule.update(): se recalcula como mucho cada ROI_REFRESH_MS o al
    // cambiar lo comprado, la reputación, la especialización o la tendencia.
    update(force = false) {
        const enabled = this.isEnabled();
        if (document.body.dataset.nerdStats !== String(enabled)) this.apply();
        const rate = document.getElementById('codeRate');
        if (!enabled) return;

        if (rate) rate.textContent = `+${this.fmt(gameState.calculateGeneration())}/s`;

        const now = performance.now();
        const signature = [
            ...CONFIG.NERD_STATS.ROI_COLLECTIONS.map(name => Object.values(gameState[name]).map(item => item.owned).join(',')),
            gameState.prestigePoints, gameState.currentSpecialization, gameState.currentTrend?.languageKey || ''
        ].join('|');
        if (!force && signature === this.lastRoiSignature && now - this.lastRoiAt < CONFIG.NERD_STATS.ROI_REFRESH_MS) return;
        this.lastRoiAt = now;
        this.lastRoiSignature = signature;
        this.updateRoi();
    },

    updateRoi() {
        let best = null;
        document.querySelectorAll('.roi-label[data-roi-collection]').forEach(label => {
            const { roiCollection, roiKey } = label.dataset;
            const roi = gameState.getPurchaseRoi(roiCollection, roiKey);
            label.textContent = this.formatRoi(roi);
            label.dataset.roi = Number.isFinite(roi) ? String(roi) : '';
            if (Number.isFinite(roi) && (!best || roi < best.roi)) best = { roi, label };
        });
        document.querySelectorAll('.roi-best').forEach(card => card.classList.remove('roi-best'));
        this.best = best ? { collection: best.label.dataset.roiCollection, key: best.label.dataset.roiKey, roi: best.roi } : null;
        best?.label.closest('.language-card, .team-card')?.classList.add('roi-best');
    }
};

console.log('✅ NERD STATS MODULE loaded');
