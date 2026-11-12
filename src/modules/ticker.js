/**
 * MODULES/TICKER.JS - Ticker de noticias dev
 * Una franja delgada bajo el header con un titular nuevo cada CONFIG.NEWS.INTERVAL_MS.
 * Los titulares y sus umbrales viven en CONFIG.NEWS_TICKER / NEWS_CONTEXT.
 *
 * - Escala con el progreso: solo salen los titulares con minTotalCode <= código total de la
 *   run; los más recientes pesan más (RECENT_WEIGHT) y no se repiten los últimos NO_REPEAT.
 * - Contextuales según el estado: deuda alta, release inestable, racha larga, tendencia
 *   activa y mantenimiento en curso.
 * - Un click en el titular lo pausa o reanuda; la × lo oculta. El estado se guarda en
 *   gameState.devSettings.ticker ('running' | 'paused' | 'hidden').
 */

const tickerModule = window.tickerModule = {
    el: null,
    textEl: null,
    closeEl: null,
    timer: null,
    recent: [],
    badReleaseAt: 0,
    current: '',

    init() {
        this.el = document.getElementById('newsTicker');
        this.textEl = document.getElementById('newsTickerText');
        this.closeEl = document.getElementById('newsTickerClose');
        if (!this.el || !this.textEl) return;

        this.textEl.addEventListener('click', () => this.setMode(this.getMode() === 'paused' ? 'running' : 'paused'));
        this.closeEl?.addEventListener('click', () => this.setMode('hidden'));
        this.apply(true);
    },

    getMode() {
        return gameState.devSettings?.ticker || 'running';
    },

    setMode(mode) {
        if (!['running', 'paused', 'hidden'].includes(mode)) return;
        gameState.devSettings.ticker = mode;
        gameState.save(true);
        this.apply(false);
        window.nerdStatsModule?.syncToggles();
    },

    // Muestra u oculta la franja y arranca o detiene el temporizador según el modo.
    apply(first = false) {
        if (!this.el) return;
        const mode = this.getMode();
        this.el.hidden = mode === 'hidden';
        this.el.classList.toggle('is-paused', mode === 'paused');
        this.textEl.title = mode === 'paused' ? 'Click: reanudar' : 'Click: pausar';
        clearInterval(this.timer);
        this.timer = null;
        if (mode === 'hidden') return;
        if (first || !this.current) this.show(this.pickHeadline(), false);
        if (mode === 'running') {
            this.timer = setInterval(() => this.tick(), CONFIG.NEWS.INTERVAL_MS);
        }
    },

    tick() {
        if (document.hidden || this.getMode() !== 'running') return;
        this.show(this.pickHeadline(), true);
    },

    // === SELECCIÓN DE TITULARES ===
    getContext() {
        const context = [];
        const { DEBT_HIGH, LONG_STREAK } = CONFIG.NEWS;
        if (gameState.projectHealth.technicalDebt >= DEBT_HIGH) context.push('debtHigh');
        if (Date.now() - this.badReleaseAt < 180000) context.push('releaseBad');
        const streakAlive = Date.now() - gameState.lastClickTime < CONFIG.STREAK_TIMEOUT;
        if (streakAlive && gameState.streak >= LONG_STREAK) context.push('streakLong');
        const language = gameState.currentTrend?.languageKey ? gameState.languages[gameState.currentTrend.languageKey] : null;
        if (language) context.push('trend');
        if (gameState.getMaintenanceStatus().isActive) context.push('maintenance');
        return context;
    },

    // Para que salga "release inestable" justo después de publicarla (gameLogic.publishRelease).
    noteRelease(result) {
        if (['unstable', 'risky'].includes(result?.band?.key)) {
            this.badReleaseAt = Date.now();
            if (this.getMode() === 'running') this.show(this.pickContextual(['releaseBad']) || this.current, true);
        }
    },

    fill(text) {
        const language = gameState.currentTrend?.languageKey ? gameState.languages[gameState.currentTrend.languageKey] : null;
        return text.replace('{language}', language?.name || 'lo nuevo');
    },

    pickContextual(context) {
        const pool = context.flatMap(key => CONFIG.NEWS_CONTEXT[key] || []).map(text => this.fill(text))
            .filter(text => !this.recent.includes(text));
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    },

    pickHeadline() {
        const context = this.getContext();
        if (context.length && Math.random() < CONFIG.NEWS.CONTEXT_CHANCE) {
            const contextual = this.pickContextual(context);
            if (contextual) return this.remember(contextual);
        }

        const total = gameState.totalCode;
        const eligible = CONFIG.NEWS_TICKER
            .filter(item => item.minTotalCode <= total)
            .sort((a, b) => a.minTotalCode - b.minTotalCode);
        // Los últimos niveles desbloqueados pesan más: el ticker "avanza" con la run.
        const recentFrom = Math.max(0, eligible.length - CONFIG.NEWS.RECENT_COUNT);
        const weighted = eligible
            .map((item, index) => ({ item, weight: index >= recentFrom ? CONFIG.NEWS.RECENT_WEIGHT : 1 }))
            .filter(entry => !this.recent.includes(entry.item.text));
        const pool = weighted.length ? weighted : eligible.map(item => ({ item, weight: 1 }));
        let roll = Math.random() * pool.reduce((sum, entry) => sum + entry.weight, 0);
        for (const entry of pool) {
            roll -= entry.weight;
            if (roll <= 0) return this.remember(entry.item.text);
        }
        return this.remember(pool[pool.length - 1].item.text);
    },

    remember(text) {
        this.recent.push(text);
        while (this.recent.length > CONFIG.NEWS.NO_REPEAT) this.recent.shift();
        return text;
    },

    // === TRANSICIÓN ===
    show(text, animate = true) {
        if (!this.textEl || !text) return;
        this.current = text;
        const reduced = window.fxModule?.isReducedMotion?.();
        if (!animate || reduced || typeof gsap === 'undefined') {
            this.textEl.textContent = text;
            return;
        }
        gsap.killTweensOf(this.textEl);
        gsap.to(this.textEl, {
            opacity: 0, y: -6, duration: 0.25, ease: 'power1.in',
            onComplete: () => {
                this.textEl.textContent = text;
                gsap.fromTo(this.textEl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' });
            }
        });
    }
};

console.log('✅ TICKER MODULE loaded');
