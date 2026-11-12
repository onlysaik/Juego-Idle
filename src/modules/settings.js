/**
 * MODULES/SETTINGS.JS - Panel de sonido y efectos
 * Sliders por grupo de buses (CONFIG.AUDIO_SLIDERS: Interfaz, Efectos, Música) y
 * los toggles "Reducir movimiento" (por defecto sigue prefers-reduced-motion) y
 * "Celebraciones cortas". Todo se guarda en gameState (audioSettings / visualSettings).
 */

const settingsModule = window.settingsModule = {
    panel: null,
    toggleButton: null,
    saveTimer: null,
    // Sonido de muestra al soltar cada slider.
    previewSounds: { ui: 'ui_click', sfx: 'coin', music: null },

    init() {
        this.panel = document.getElementById('settingsPanel');
        this.toggleButton = document.getElementById('settingsToggle');
        if (!this.panel || !this.toggleButton) return;

        this.render();
        this.applyMotionPreference();
        this.toggleButton.addEventListener('click', event => {
            event.stopPropagation();
            this.isOpen() ? this.close() : this.open();
        });
        document.addEventListener('pointerdown', event => {
            if (!this.isOpen()) return;
            if (this.panel.contains(event.target) || this.toggleButton.contains(event.target)) return;
            this.close();
        });
        // Si el jugador no eligió, seguir los cambios del sistema en vivo.
        window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => {
            if (gameState.visualSettings.reduceMotion === null) {
                this.applyMotionPreference();
                this.syncControls();
            }
        });
    },

    render() {
        const sliders = CONFIG.AUDIO_SLIDERS.map(slider => `
            <label class="settings-slider" for="setting-${slider.key}">
                <span class="settings-slider-head">
                    <span>${slider.label}</span>
                    <output id="setting-${slider.key}-value">0</output>
                </span>
                <input type="range" id="setting-${slider.key}" min="0" max="100" step="1" data-slider="${slider.key}">
            </label>
        `).join('');

        this.panel.innerHTML = `
            <div class="settings-panel-header">
                <h2 id="settingsPanelTitle"><i class="fas fa-sliders"></i> Sonido y efectos</h2>
                <button class="settings-close" type="button" aria-label="Cerrar ajustes"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="settings-group">${sliders}</div>
            <div class="settings-group">
                <label class="settings-toggle">
                    <input type="checkbox" id="setting-reduceMotion">
                    <span class="settings-toggle-copy">
                        <strong>Reducir movimiento</strong>
                        <small id="setting-reduceMotion-hint"></small>
                    </span>
                </label>
                <label class="settings-toggle">
                    <input type="checkbox" id="setting-shortCelebrations">
                    <span class="settings-toggle-copy">
                        <strong>Celebraciones cortas</strong>
                        <small>Usa siempre la versión breve de cada celebración.</small>
                    </span>
                </label>
            </div>
        `;

        this.panel.querySelector('.settings-close')?.addEventListener('click', () => this.close());
        this.panel.querySelectorAll('input[data-slider]').forEach(input => {
            input.addEventListener('input', () => this.onSliderInput(input));
            input.addEventListener('change', () => this.onSliderCommit(input));
        });
        this.panel.querySelector('#setting-reduceMotion')?.addEventListener('change', event => {
            gameState.visualSettings.reduceMotion = event.target.checked;
            this.applyMotionPreference();
            this.syncControls();
            this.scheduleSave();
        });
        this.panel.querySelector('#setting-shortCelebrations')?.addEventListener('change', event => {
            gameState.visualSettings.shortCelebrations = event.target.checked;
            this.scheduleSave();
        });
        this.syncControls();
    },

    syncControls() {
        if (!this.panel) return;
        CONFIG.AUDIO_SLIDERS.forEach(slider => {
            const value = gameState.audioSettings[slider.key];
            const input = this.panel.querySelector(`#setting-${slider.key}`);
            const output = this.panel.querySelector(`#setting-${slider.key}-value`);
            if (input) input.value = value;
            if (output) output.textContent = `${value}`;
        });
        const reduce = this.panel.querySelector('#setting-reduceMotion');
        const hint = this.panel.querySelector('#setting-reduceMotion-hint');
        if (reduce) reduce.checked = fxModule.isReducedMotion();
        if (hint) {
            hint.textContent = gameState.visualSettings.reduceMotion === null
                ? 'Siguiendo la preferencia del sistema. Sin sacudidas, cámara lenta ni fragmentos.'
                : 'Sin sacudidas, cámara lenta ni fragmentos: solo destellos suaves, fundidos y sonido.';
        }
        const short = this.panel.querySelector('#setting-shortCelebrations');
        if (short) short.checked = !!gameState.visualSettings.shortCelebrations;
    },

    onSliderInput(input) {
        const key = input.dataset.slider;
        const value = Math.max(0, Math.min(100, Math.round(Number(input.value))));
        gameState.audioSettings[key] = value;
        audioModule.applySettings({ [key]: value });
        const output = this.panel.querySelector(`#setting-${key}-value`);
        if (output) output.textContent = `${value}`;
        this.scheduleSave();
    },

    onSliderCommit(input) {
        const sound = this.previewSounds[input.dataset.slider];
        if (sound) audioModule.play(sound);
    },

    // Aplica "Reducir movimiento": estado en <body>, partículas de fondo y efectos en curso.
    applyMotionPreference() {
        const reduced = fxModule.isReducedMotion();
        document.body.dataset.reduceMotion = reduced ? 'true' : 'false';
        if (reduced) {
            fxModule.finishAll();
            app.clearParticles?.();
        } else {
            app.initializeParticles?.();
        }
    },

    scheduleSave() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => gameState.save(true), 300);
    },

    isOpen() {
        return !!this.panel && !this.panel.hidden;
    },

    open() {
        this.syncControls();
        this.panel.hidden = false;
        this.toggleButton.setAttribute('aria-expanded', 'true');
        this.panel.querySelector('input')?.focus();
    },

    close() {
        if (!this.panel) return;
        this.panel.hidden = true;
        this.toggleButton.setAttribute('aria-expanded', 'false');
    }
};

console.log('✅ SETTINGS MODULE loaded');
