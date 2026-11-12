/**
 * MODULES/GITLOG.JS - Git log vivo
 * Panel colapsable con estilo `git log --oneline`: hash corto aleatorio de 7 caracteres,
 * mensaje y tiempo relativo. Registra commits (mensajes de CONFIG.COMMIT_MESSAGES),
 * compras importantes, hitos, releases (como tags vX.Y.Z) y prestige ("git checkout -b run-N").
 * Solo las últimas CONFIG.GIT_LOG.MAX_ENTRIES entradas, en memoria: no se guarda en la partida.
 */

const gitLogModule = window.gitLogModule = {
    entries: [],           // más nueva primero
    panel: null,
    listEl: null,
    toggleEl: null,
    lastCommitAt: 0,
    lastMessage: '',
    refreshTimer: null,

    init() {
        this.panel = document.getElementById('gitLogPanel');
        this.listEl = document.getElementById('gitLogList');
        this.toggleEl = document.getElementById('gitLogToggle');
        if (!this.panel || !this.listEl) return;

        this.toggleEl?.addEventListener('click', event => {
            event.stopPropagation();
            this.isOpen() ? this.close() : this.open();
        });
        this.panel.querySelector('.git-log-close')?.addEventListener('click', () => this.close());
        this.panel.querySelector('.git-log-collapse')?.addEventListener('click', () => {
            this.panel.classList.toggle('is-collapsed');
        });
        this.render();
    },

    // === REGISTRO ===
    randomHash() {
        let hash = '';
        for (let i = 0; i < 7; i++) hash += Math.floor(Math.random() * 16).toString(16);
        return hash;
    },

    add(kind, text, extra = {}) {
        const entry = { hash: this.randomHash(), kind, text, at: Date.now(), refs: extra.refs || '' };
        this.entries.unshift(entry);
        if (this.entries.length > CONFIG.GIT_LOG.MAX_ENTRIES) this.entries.length = CONFIG.GIT_LOG.MAX_ENTRIES;
        if (this.isOpen()) this.render();
        return entry;
    },

    // Commits: los automáticos llegan a decenas por minuto, así que se agrupan.
    logCommits(count = 1) {
        const now = Date.now();
        if (now - this.lastCommitAt < CONFIG.GIT_LOG.COMMIT_MIN_GAP_MS) return null;
        this.lastCommitAt = now;
        const messages = CONFIG.COMMIT_MESSAGES.filter(message => message !== this.lastMessage);
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.lastMessage = message;
        return this.add('commit', count > 1 ? `${message} (+${count - 1} commits)` : message);
    },

    // Compras importantes: la primera copia, hitos, frameworks, artefactos y especializaciones.
    logPurchase(collection, key, milestone = null) {
        const item = gameState[collection]?.[key];
        if (!item) return null;
        if (milestone) {
            return this.add('milestone', `feat: ${milestone.name} x${milestone.multiplier} (${milestone.threshold} unidades)`);
        }
        const important = item.owned === 1 || ['frameworks', 'artifacts'].includes(collection);
        if (!important) return null;
        const verb = { artifacts: 'equipar', team: 'contratar', languages: 'añadir', frameworks: 'integrar', upgrades: 'mejorar' }[collection] || 'añadir';
        return this.add('purchase', `feat: ${verb} ${item.name}`);
    },

    logSpecialization(name) {
        return this.add('purchase', `feat: especializarse en ${name}`);
    },

    logRelease(result) {
        if (!result) return null;
        return this.add('release', `release: ${result.band?.label || 'publicada'}`, { refs: `(tag: ${result.version})` });
    },

    logPrestige(runNumber) {
        return this.add('prestige', `git checkout -b run-${runNumber}`, { refs: `(run-${runNumber})` });
    },

    // === PANEL ===
    isOpen() {
        return !!this.panel && !this.panel.hidden;
    },

    open() {
        if (!this.panel) return;
        this.panel.hidden = false;
        this.panel.classList.remove('is-collapsed');
        this.toggleEl?.setAttribute('aria-expanded', 'true');
        this.render();
        clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => this.render(), 10000); // el tiempo relativo avanza
    },

    close() {
        if (!this.panel) return;
        this.panel.hidden = true;
        this.toggleEl?.setAttribute('aria-expanded', 'false');
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    },

    relativeTime(at, now = Date.now()) {
        const seconds = Math.max(0, Math.floor((now - at) / 1000));
        if (seconds < 5) return 'ahora';
        if (seconds < 60) return `hace ${seconds} s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `hace ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `hace ${hours} h`;
        return `hace ${Math.floor(hours / 24)} d`;
    },

    // git log --oneline: "a3f9c21 (tag: v1.2.0) mensaje · hace 5 s"
    formatLine(entry, now = Date.now()) {
        return `${entry.hash} ${entry.refs ? entry.refs + ' ' : ''}${entry.text} · ${this.relativeTime(entry.at, now)}`;
    },

    render() {
        if (!this.listEl) return;
        const now = Date.now();
        this.listEl.replaceChildren();
        if (this.entries.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'git-log-empty';
            empty.textContent = 'Sin commits todavía. Escribe algo de código.';
            this.listEl.appendChild(empty);
            return;
        }
        const fragment = document.createDocumentFragment();
        this.entries.forEach(entry => {
            const item = document.createElement('li');
            item.className = `git-log-entry git-log-${entry.kind}`;
            const hash = document.createElement('span');
            hash.className = 'gl-hash';
            hash.textContent = entry.hash;
            item.appendChild(hash);
            if (entry.refs) {
                const refs = document.createElement('span');
                refs.className = 'gl-refs';
                refs.textContent = entry.refs;
                item.append(' ', refs);
            }
            const message = document.createElement('span');
            message.className = 'gl-msg';
            message.textContent = entry.text;
            const time = document.createElement('span');
            time.className = 'gl-time';
            time.textContent = this.relativeTime(entry.at, now);
            item.append(' ', message, ' ', time);
            fragment.appendChild(item);
        });
        this.listEl.appendChild(fragment);
    }
};

console.log('✅ GIT LOG MODULE loaded');
