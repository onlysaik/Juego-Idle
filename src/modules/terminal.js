/**
 * MODULES/TERMINAL.JS - Terminal pública
 * Reutiliza la UI de la consola admin (#adminConsole, se abre con la tecla `) y añade los
 * comandos públicos: help, man, status, buy, git log y clear. Los textos viven en
 * CONFIG.TERMINAL y CONFIG.MAN_PAGES.
 *
 * Separación pública / admin:
 * - Aquí solo están los comandos públicos. Lo que no reconoce pasa tal cual a
 *   adminModule.runCommand() (godmode, addcode, creative…), que sigue funcionando igual y
 *   mantiene sus propias comprobaciones de admin. Lo que esos comandos escriben en su línea
 *   de estado se copia a la salida de la terminal (mirror).
 * - Historial con flecha arriba/abajo y autocompletado con Tab.
 * - man solo muestra sistemas ya desbloqueados (gameState.isFeatureUnlocked); uno bloqueado
 *   responde igual que uno inexistente, sin revelar nada.
 */

const terminalModule = window.terminalModule = {
    outputEl: null,
    inputEl: null,
    history: [],
    historyIndex: -1,
    draft: '',
    capturing: null,

    // Colecciones comprables con el comando buy y la feature que las desbloquea.
    COLLECTIONS: [
        { name: 'languages', feature: 'shop', method: 'buyLanguage' },
        { name: 'upgrades', feature: 'shop', method: 'buyUpgrade' },
        { name: 'frameworks', feature: 'shop', method: 'buyFramework' },
        { name: 'team', feature: 'team', method: 'buyTeamMember' },
        { name: 'artifacts', feature: 'releases', method: 'buyArtifact' }
    ],
    PUBLIC_COMMANDS: ['help', 'man', 'status', 'buy', 'git', 'clear'],

    init() {
        this.outputEl = document.getElementById('adminConsoleOutput');
        this.inputEl = document.getElementById('adminConsoleInput');
        const t = CONFIG.TERMINAL;
        const title = document.getElementById('adminConsoleTitle');
        const tag = document.querySelector('.admin-console-tag');
        const copy = document.querySelector('.admin-console-copy');
        if (title) title.textContent = t.TITLE;
        if (tag) tag.textContent = t.TAG;
        if (copy) copy.innerHTML = t.COPY;
        if (this.inputEl) {
            this.inputEl.placeholder = t.PLACEHOLDER;
            this.inputEl.addEventListener('keydown', event => this.onKeydown(event));
        }
        this.print(`${t.TAG} · ${t.COPY.replace(/<[^>]+>/g, '')}`, 'hint');
    },

    // === SALIDA ===
    print(text, kind = 'out') {
        if (!this.outputEl) return;
        String(text).split('\n').forEach(line => {
            const row = document.createElement('div');
            row.className = `term-line term-${kind}`;
            row.textContent = line;
            this.outputEl.appendChild(row);
        });
        while (this.outputEl.children.length > 200) this.outputEl.firstElementChild.remove();
        this.outputEl.scrollTop = this.outputEl.scrollHeight;
    },

    // adminModule.setStatus() copia aquí lo que escriben los comandos de admin.
    mirror(message, state) {
        if (this.capturing) this.capturing.push(message);
        this.print(message, state === 'warning' ? 'err' : 'out');
    },

    // === ENTRADA ===
    submit(rawValue) {
        const raw = String(rawValue || '').trim();
        if (!raw) return false;
        this.print(`${CONFIG.TERMINAL.PROMPT}${raw}`, 'cmd');
        this.history.push(raw);
        if (this.history.length > CONFIG.TERMINAL.HISTORY_MAX) this.history.shift();
        this.historyIndex = this.history.length;
        this.draft = '';

        const [command, ...args] = raw.toLowerCase().split(/\s+/);
        switch (command) {
            case 'help': return this.cmdHelp(args), true;
            case 'man': return this.cmdMan(args), true;
            case 'status': return this.cmdStatus(), true;
            case 'buy': return this.cmdBuy(args), true;
            case 'git': return this.cmdGit(args), true;
            case 'clear': return this.cmdClear(), true;
            default: return this.runAdmin(raw.toLowerCase(), command);
        }
    },

    // Todo lo demás es de admin: se ejecuta tal cual (godmode, addcode, creative…).
    runAdmin(value, command) {
        this.capturing = [];
        let handled = false;
        try {
            handled = adminModule.runCommand(value);
        } finally {
            const printed = this.capturing.length > 0;
            this.capturing = null;
            if (!handled && !printed) this.print(CONFIG.TERMINAL.UNKNOWN.replace('{command}', command), 'err');
        }
        adminModule.syncAdminUIState();
        return handled;
    },

    onKeydown(event) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            if (this.history.length === 0) return;
            event.preventDefault();
            if (this.historyIndex === this.history.length) this.draft = this.inputEl.value;
            this.historyIndex += event.key === 'ArrowUp' ? -1 : 1;
            this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex));
            this.inputEl.value = this.historyIndex === this.history.length ? this.draft : this.history[this.historyIndex];
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            this.autocomplete();
        }
    },

    // === AUTOCOMPLETADO (Tab) ===
    getCommandNames() {
        const names = [...this.PUBLIC_COMMANDS, adminModule.activationWord];
        if (gameState.isAdminEnabled()) names.push('addcode', 'addrep', 'creative', 'decision', 'event', 'golden', 'missions', 'release', 'resources', 'unlockall', 'fx', 'sound');
        return names;
    },

    getArgCandidates(command) {
        if (command === 'man') return this.getUnlockedSystems().map(system => system.key);
        if (command === 'buy') return this.getBuyables().map(item => item.key);
        if (command === 'git') return ['log'];
        if (command === 'help') return ['admin'];
        return [];
    },

    commonPrefix(words) {
        return words.reduce((prefix, word) => {
            let i = 0;
            while (i < prefix.length && i < word.length && prefix[i] === word[i]) i++;
            return prefix.slice(0, i);
        });
    },

    autocomplete() {
        const value = this.inputEl.value.toLowerCase();
        const endsWithSpace = /\s$/.test(value);
        const tokens = value.trim().split(/\s+/).filter(Boolean);
        const completing = endsWithSpace ? '' : (tokens[tokens.length - 1] || '');
        const position = endsWithSpace ? tokens.length : Math.max(0, tokens.length - 1);

        const candidates = position === 0 ? this.getCommandNames() : this.getArgCandidates(tokens[0]);
        const matches = [...new Set(candidates)].filter(candidate => candidate.startsWith(completing));
        if (matches.length === 0) return;

        const completed = matches.length === 1 ? matches[0] + (position === 0 ? ' ' : '') : this.commonPrefix(matches);
        const head = tokens.slice(0, position).join(' ');
        this.inputEl.value = `${head}${head ? ' ' : ''}${completed}`;
        if (matches.length > 1) this.print(matches.join('   '), 'hint');
    },

    // === help ===
    cmdHelp(args) {
        const t = CONFIG.TERMINAL;
        if (args[0] === 'admin') {
            this.print(t.HELP_ADMIN);
            return;
        }
        this.print('Comandos:');
        t.HELP_PUBLIC.forEach(line => this.print(`  ${line}`));
        this.print('Atajos de teclado:');
        CONFIG.SHORTCUTS.forEach(shortcut => this.print(`  ${shortcut.keys.padEnd(16)}${shortcut.desc}`));
        if (gameState.isAdminEnabled()) this.print(t.HELP_ADMIN, 'hint');
    },

    // === man ===
    fillTokens(text) {
        const map = {
            CODE_PER_COMMIT: CONFIG.CODE_PER_COMMIT.toLocaleString(),
            RELEASE_CHARGE_REQUIRED: CONFIG.RELEASE_CHARGE_REQUIRED,
            PRESTIGE_PERCENT: Math.round(CONFIG.PRESTIGE_BONUS_PER_POINT * 100),
            STREAK_SECONDS: CONFIG.STREAK_TIMEOUT / 1000,
            STREAK_CAP: Math.round(CONFIG.STREAK_CLICK_BONUS_CAP * 100),
            MILESTONES: CONFIG.MILESTONES.THRESHOLDS.join('/'),
            CLICK_SHARE: Math.round(CONFIG.CLICK_PASSIVE_SHARE * 100)
        };
        return text.replace(/\{(\w+)\}/g, (match, key) => (key in map ? map[key] : match));
    },

    isSystemUnlocked(page) {
        return !page.feature || gameState.isFeatureUnlocked(page.feature);
    },

    getUnlockedSystems() {
        return Object.entries(CONFIG.MAN_PAGES)
            .filter(([, page]) => this.isSystemUnlocked(page))
            .map(([key, page]) => ({ key, page }));
    },

    normalize(text) {
        return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#+.]+/g, '');
    },

    // Un sistema bloqueado no se encuentra: la respuesta es idéntica a la de uno inexistente.
    findSystem(name) {
        const wanted = this.normalize(name);
        return this.getUnlockedSystems().find(({ key, page }) => [key, ...(page.aliases || [])].some(alias => this.normalize(alias) === wanted)) || null;
    },

    cmdMan(args) {
        const t = CONFIG.TERMINAL;
        if (args.length === 0) {
            this.print(t.MAN_USAGE.replace('{list}', this.getUnlockedSystems().map(system => system.key).join(', ')));
            return;
        }
        const system = this.findSystem(args.join(' '));
        if (!system) {
            this.print(t.MAN_UNKNOWN.replace('{name}', args.join(' ')), 'err');
            return;
        }
        this.print(`${system.key.toUpperCase()}(1)`, 'hint');
        system.page.lines.forEach(line => this.print(`  ${this.fillTokens(line)}`));
    },

    // === status ===
    cmdStatus() {
        const generation = gameState.getGenerationBreakdown();
        const click = gameState.getClickBreakdown();
        const fmt = value => nerdStatsModule.fmt(value);
        this.print(`producción  ${fmt(generation.total)} código/s · click ${fmt(click.total)}`);
        this.print(`código      ${Math.floor(gameState.code).toLocaleString()} · commits ${gameState.commits} · racha ${gameState.streak} · run ${gameState.prestigeLevel + 1}`);
        this.print(`multiplic.  prestige ×${nerdStatsModule.fmt(generation.prestige, 3)} · bonus ×${nerdStatsModule.fmt(generation.bonusMultiplier, 3)} · eventos ×${nerdStatsModule.fmt(generation.effects, 3)} · mant. ×${nerdStatsModule.fmt(generation.maintenance, 3)}`);
        const goal = gameState.getNextGoal();
        if (goal) {
            const format = value => onboardingModule.formatGoalValue(goal.metric, value);
            this.print(`objetivo    ${goal.label} (${format(goal.current)}/${format(goal.target)})`);
        } else {
            this.print('objetivo    nada pendiente: sigue escribiendo código');
        }
    },

    // === buy ===
    getBuyables() {
        const items = [];
        this.COLLECTIONS.forEach(collection => {
            if (!gameState.isFeatureUnlocked(collection.feature)) return;
            Object.entries(gameState[collection.name]).forEach(([key, item]) => {
                if (collection.name === 'frameworks' && !(gameState.languages[item.requires]?.owned > 0)) return;
                items.push({ collection: collection.name, key, item });
            });
        });
        return items;
    },

    // Todas las colecciones, también las bloqueadas: para distinguir "no existe" de "aún no".
    findBuyable(name, includeLocked = false) {
        const wanted = this.normalize(name);
        const pool = [];
        this.COLLECTIONS.forEach(collection => {
            Object.entries(gameState[collection.name]).forEach(([key, item]) => {
                pool.push({ collection: collection.name, key, item, locked: !gameState.isFeatureUnlocked(collection.feature), feature: collection.feature });
            });
        });
        const visible = pool.filter(entry => includeLocked || !entry.locked);
        const exact = visible.filter(entry => this.normalize(entry.key) === wanted || this.normalize(entry.item.name) === wanted);
        if (exact.length) return exact[0];
        const prefix = visible.filter(entry => this.normalize(entry.key).startsWith(wanted) || this.normalize(entry.item.name).startsWith(wanted));
        return prefix.length === 1 ? prefix[0] : null;
    },

    cmdBuy(args) {
        const t = CONFIG.TERMINAL;
        if (args.length === 0) {
            const list = this.getBuyables().filter(entry => entry.collection !== 'upgrades' || true).map(entry => entry.key).join(', ');
            this.print(t.BUY_USAGE.replace('{list}', list || '—'));
            return;
        }
        let count = 1;
        const last = args[args.length - 1];
        if (args.length > 1 && /^\d+$/.test(last)) {
            count = Math.max(1, Math.min(500, parseInt(last, 10)));
            args = args.slice(0, -1);
        }
        const name = args.join(' ');
        const entry = this.findBuyable(name, true);
        if (!entry) {
            this.print(t.BUY_UNKNOWN.replace('{name}', name), 'err');
            return;
        }
        if (entry.locked) {
            this.print(t.BUY_LOCKED.replace('{name}', name), 'err');
            return;
        }
        if (entry.collection === 'frameworks' && !(gameState.languages[entry.item.requires]?.owned > 0)) {
            this.print(t.BUY_FAIL.replace('{name}', entry.item.name).replace('{reason}', `necesita ${gameState.languages[entry.item.requires]?.name || 'su lenguaje'}`), 'err');
            return;
        }
        const result = gameLogic.buyItem(entry.collection, entry.key, count);
        if (result.bought === 0) {
            this.print(t.BUY_FAIL.replace('{name}', entry.item.name).replace('{reason}', result.reason), 'err');
            return;
        }
        this.print(t.BUY_OK.replace('{count}', result.bought).replace('{name}', entry.item.name).replace('{cost}', result.spent), 'out');
        if (result.bought < count) this.print(`(se compraron ${result.bought} de ${count}: ${result.reason})`, 'hint');
    },

    // === git ===
    cmdGit(args) {
        if (args[0] !== 'log') {
            this.print(CONFIG.TERMINAL.GIT_USAGE, 'err');
            return;
        }
        this.print(CONFIG.TERMINAL.GIT_OPEN);
        const recent = gitLogModule.entries.slice(0, 5);
        recent.forEach(entry => this.print(gitLogModule.formatLine(entry)));
        adminModule.closeConsole();
        gitLogModule.open();
    },

    cmdClear() {
        if (this.outputEl) this.outputEl.replaceChildren();
    }
};

console.log('✅ TERMINAL MODULE loaded');
