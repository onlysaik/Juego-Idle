/**
 * MODULES/ADMIN.JS - Consola y atajos de admin
 * Responsabilidad: Habilitar godmode, modo creativo y utilidades de debug
 */

const adminModule = {
    activationWord: 'godmode',
    isConsoleOpen: false,

    init() {
        this.consoleEl = document.getElementById('adminConsole');
        this.inputEl = document.getElementById('adminConsoleInput');
        this.statusEl = document.getElementById('adminConsoleStatus');
        this.closeEl = document.getElementById('adminConsoleClose');
        this.badgeEl = document.getElementById('adminModeBadge');

        this.closeEl?.addEventListener('click', () => this.closeConsole());
        this.consoleEl?.addEventListener('click', (event) => {
            if (event.target === this.consoleEl) {
                this.closeConsole();
            }
        });

        this.inputEl?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.submitCommand();
            }
        });

        this.syncAdminUIState();
    },

    isTypingTarget(target) {
        if (!target) return false;
        const tagName = target.tagName?.toLowerCase();
        return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
    },

    openConsole() {
        if (!this.consoleEl) return;
        this.consoleEl.hidden = false;
        this.isConsoleOpen = true;
        this.setStatus('Esperando comando.', 'idle');
        requestAnimationFrame(() => this.inputEl?.focus());
    },

    closeConsole() {
        if (!this.consoleEl) return;
        this.consoleEl.hidden = true;
        this.isConsoleOpen = false;
        if (this.inputEl) {
            this.inputEl.value = '';
            this.inputEl.blur();
        }
    },

    toggleConsole() {
        if (this.isConsoleOpen) {
            this.closeConsole();
        } else {
            this.openConsole();
        }
    },

    setStatus(message, state = 'idle') {
        if (!this.statusEl) return;
        this.statusEl.textContent = message;
        if (state === 'idle') {
            this.statusEl.removeAttribute('data-state');
            return;
        }
        this.statusEl.dataset.state = state;
    },

    submitCommand() {
        const rawValue = this.inputEl?.value?.trim();
        const value = rawValue?.toLowerCase();
        if (!value) {
            this.setStatus('Escribe un comando para continuar.', 'warning');
            return;
        }

        const handled = this.runCommand(value);
        this.inputEl.value = '';
        if (!handled) {
            this.setStatus('Comando no reconocido. Usa godmode, help o addcode 100000.', 'warning');
            return;
        }

        this.syncAdminUIState();
    },

    syncAdminUIState() {
        const adminEnabled = gameState.isAdminEnabled();
        const creativeEnabled = gameState.isCreativeModeEnabled();

        document.body.classList.toggle('admin-enabled', adminEnabled);
        document.body.classList.toggle('admin-creative', gameState.isCreativeModeEnabled());

        if (this.badgeEl) {
            this.badgeEl.hidden = !adminEnabled;
            this.badgeEl.textContent = creativeEnabled ? 'ADMIN · CREATIVE' : 'ADMIN';
        }
    },

    ensureAdminEnabled() {
        if (gameState.isAdminEnabled()) {
            return true;
        }

        this.setStatus('Primero activa godmode.', 'warning');
        uiModule.showNotification('Primero activa godmode', 'warning');
        return false;
    },

    rerenderAdminSensitiveUI() {
        uiModule.rebuildCommerceUI();
        uiModule.update();
    },

    enableGodmode() {
        gameState.setAdminEnabled(true);
        gameState.save(true);
        this.setStatus('Godmode habilitado. Usa D, E, C, M, R, K o U.', 'success');
        uiModule.showNotification('Godmode habilitado', 'success');
        return true;
    },

    parseAmount(rawValue, fallback = 0) {
        const amount = Number(rawValue);
        if (!Number.isFinite(amount)) return fallback;
        return Math.max(0, Math.floor(amount));
    },

    runCommand(input) {
        const [command, ...args] = input.split(/\s+/);

        if (command === this.activationWord) {
            return this.enableGodmode();
        }

        if (command === 'help') {
            this.setStatus('Comandos: godmode, addcode N, addrep N, creative on|off, decision, event, golden, missions, release, resources, unlockall, fx <id>|list, sound <id>|list.', 'success');
            return true;
        }

        if (!this.ensureAdminEnabled()) {
            return false;
        }

        switch (command) {
            case 'addcode': {
                const amount = this.parseAmount(args[0], 10000);
                gameState.addCode(amount);
                this.rerenderAdminSensitiveUI();
                gameState.save(true);
                this.setStatus(`Se agregaron ${amount.toLocaleString()} lineas de codigo.`, 'success');
                return true;
            }
            case 'addrep': {
                const amount = this.parseAmount(args[0], 10);
                gameState.addPrestigePoints(amount);
                this.rerenderAdminSensitiveUI();
                gameState.save(true);
                this.setStatus(`Se agregaron ${amount.toLocaleString()} puntos de reputacion.`, 'success');
                return true;
            }
            case 'creative': {
                const mode = args[0];
                if (mode === 'on') {
                    gameState.setCreativeMode(true);
                } else if (mode === 'off') {
                    gameState.setCreativeMode(false);
                } else {
                    gameState.setCreativeMode(!gameState.isCreativeModeEnabled());
                }
                this.syncAdminUIState();
                this.rerenderAdminSensitiveUI();
                gameState.save(true);
                this.setStatus(gameState.isCreativeModeEnabled() ? 'Modo creativo activado.' : 'Modo creativo desactivado.', 'success');
                return true;
            }
            case 'decision':
                this.forceDecision();
                this.setStatus('Decision forzada.', 'success');
                return true;
            case 'event':
                this.forceEvent();
                this.setStatus('Evento forzado.', 'success');
                return true;
            case 'golden':
                goldenCommitModule.spawn();
                this.setStatus('Commit dorado generado.', 'success');
                return true;
            case 'fx':
                return this.runFxCommand(args[0]);
            case 'sound':
                return this.runSoundCommand(args[0]);
            case 'missions':
                this.completeActiveMissions();
                return true;
            case 'release':
                this.instantRelease();
                return true;
            case 'resources':
                this.grantQuickResources();
                this.setStatus('Recursos rapidos otorgados.', 'success');
                return true;
            case 'unlockall':
                this.unlockEverything();
                this.setStatus('Todo desbloqueado.', 'success');
                return true;
            default:
                return false;
        }
    },

    toggleCreativeMode() {
        if (!this.ensureAdminEnabled()) {
            return;
        }

        const nextValue = !gameState.isCreativeModeEnabled();
        gameState.setCreativeMode(nextValue);
        this.syncAdminUIState();
        this.rerenderAdminSensitiveUI();
        gameState.save(true);
        uiModule.showNotification(nextValue ? 'Modo creativo activado' : 'Modo creativo desactivado', 'success');
    },

    grantQuickResources() {
        if (!this.ensureAdminEnabled()) return;
        gameState.addCode(50000);
        gameState.addPrestigePoints(25);
        gameState.releaseCharge = Math.max(gameState.releaseCharge, CONFIG.RELEASE_CHARGE_REQUIRED);
        this.rerenderAdminSensitiveUI();
        gameState.save(true);
        uiModule.showNotification('Recursos de admin otorgados', 'success');
    },

    unlockEverything() {
        if (!this.ensureAdminEnabled()) return;

        Object.keys(gameState.achievements).forEach(key => {
            gameState.unlockAchievement(key);
        });
        gameState.unlockAllFeatures(); // todas las pestañas, sin tips
        onboardingModule.applyVisibility();
        onboardingModule.renderBadges();

        uiModule.createAchievementsUI();
        uiModule.update();
        gameState.save(true);
        uiModule.showNotification('Todos los logros y pestañas desbloqueados', 'success');
    },

    forceDecision() {
        if (!this.ensureAdminEnabled()) return;
        eventsModule.triggerById('clientDeadline');
    },

    forceEvent() {
        if (!this.ensureAdminEnabled()) return;
        eventsModule.triggerRandomStandard();
    },

    // fx <id>: reproduce una coreografía con un contexto de prueba. fx list: las lista.
    runFxCommand(id) {
        const ids = feedbackModule.list();
        if (!id || id === 'list') {
            this.setStatus(`Coreografías (${ids.length}): ${ids.join(', ')}`, 'success');
            return true;
        }
        if (!ids.includes(id)) {
            this.setStatus(`Coreografía desconocida: ${id}. Usa "fx list".`, 'warning');
            return true;
        }

        const target = document.getElementById('clickBtn');
        const rect = target?.getBoundingClientRect();
        const code = Math.floor(gameState.code);
        const context = {
            element: target,
            x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
            y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
            from: code,
            to: code,
            text: 'fx de prueba: coreografía en ejecución',
            version: gameState.getVersionLabel(),
            points: String(gameState.prestigePoints),
            banner: `fx ${id}`,
            pitch: 0
        };
        // Cerrar la consola para ver el efecto (y no tapar el destello).
        this.closeConsole();
        const result = feedbackModule.play(id, context);
        uiModule.showNotification(`fx ${id}: ${result === 'queued' ? 'en cola' : result ? 'reproduciendo' : 'descartada por prioridad'}`, 'info', { duration: 1500 });
        return true;
    },

    // sound <id>: reproduce un sonido de SOUND_MANIFEST (o su respaldo ZzFX). sound list: los lista.
    runSoundCommand(id) {
        const ids = audioModule.list();
        if (!id || id === 'list') {
            this.setStatus(`Sonidos (${ids.length}): ${ids.join(', ')}`, 'success');
            return true;
        }
        const known = ids.includes(id) || CONFIG.SOUND_FALLBACKS[id];
        if (!known) {
            this.setStatus(`Sonido desconocido: ${id}. Usa "sound list".`, 'warning');
            return true;
        }
        audioModule.unlock();
        const handle = audioModule.play(id);
        const meta = SOUND_MANIFEST?.[id];
        this.setStatus(handle
            ? `▶ ${id}${handle.fallback ? ' (respaldo ZzFX)' : ''}${meta ? ` · bus ${meta.bus} · ${meta.durationMs} ms · ${meta.desc}` : ''}`
            : 'El sonido está silenciado.', handle ? 'success' : 'warning');
        return true;
    },

    forceCompleteMissionSlot(slot) {
        return gameState.forceCompleteMission(slot);
    },

    completeActiveMissions() {
        if (!this.ensureAdminEnabled()) return;

        const claimed = ['short', 'long']
            .map(slot => this.forceCompleteMissionSlot(slot))
            .filter(Boolean);

        uiModule.createMissionsUI();
        this.rerenderAdminSensitiveUI();
        achievementsModule.checkAll();
        gameState.save(true);

        if (claimed.length === 0) {
            this.setStatus('No habia misiones activas para completar.', 'warning');
            return;
        }

        const names = claimed.map(mission => mission.name).join(', ');
        this.setStatus(`Misiones completadas: ${names}.`, 'success');
        uiModule.showNotification('Misiones completadas por admin', 'success');
    },

    instantRelease() {
        if (!this.ensureAdminEnabled()) return;

        gameState.releaseCharge = CONFIG.RELEASE_CHARGE_REQUIRED;
        gameLogic.publishRelease();
        this.rerenderAdminSensitiveUI();
        gameState.save(true);
        this.setStatus('Release instantanea ejecutada.', 'success');
    },

    handleKeydown(event) {
        if (event.key === 'Escape' && this.isConsoleOpen) {
            event.preventDefault();
            this.closeConsole();
            return true;
        }

        if (event.key === '`' || (event.ctrlKey && event.shiftKey && event.code === 'KeyP')) {
            if (this.isTypingTarget(event.target) && !this.isConsoleOpen) return false;
            event.preventDefault();
            this.toggleConsole();
            return true;
        }

        if (this.isConsoleOpen) {
            return false;
        }

        if (!gameState.isAdminEnabled()) {
            return false;
        }

        if (this.isTypingTarget(event.target)) {
            return false;
        }

        const key = event.key.toLowerCase();
        switch (key) {
            case 'd':
                event.preventDefault();
                this.forceDecision();
                return true;
            case 'e':
                event.preventDefault();
                this.forceEvent();
                return true;
            case 'c':
                event.preventDefault();
                this.toggleCreativeMode();
                return true;
            case 'm':
                event.preventDefault();
                this.completeActiveMissions();
                return true;
            case 'r':
                event.preventDefault();
                this.instantRelease();
                return true;
            case 'k':
                event.preventDefault();
                this.grantQuickResources();
                return true;
            case 'u':
                event.preventDefault();
                this.unlockEverything();
                return true;
            default:
                return false;
        }
    }
};

console.log('✅ ADMIN MODULE loaded');
