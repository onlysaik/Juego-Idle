/**
 * MODULES/AUDIO.JS - Motor de audio sobre Howler.js
 * Responsabilidad: reproducir los sonidos de SOUND_MANIFEST (assets/audio/sounds.js)
 * con buses de mezcla (CONFIG.AUDIO_BUSES), variaciones, tono aleatorio, ducking,
 * pool del teclado mecánico y respaldo ZzFX si un archivo falla.
 *
 * - Un Howl por archivo (src: ruta.ogg, ruta.mp3).
 * - Servido por http(s): Web Audio, con limitador en el master.
 *   Abierto desde el disco (file://): HTML5 Audio, porque Chrome bloquea el XHR
 *   que usa Web Audio para cargar archivos locales.
 * - Precarga el bus ui al iniciar; el resto tras la primera interacción, que
 *   también desbloquea el AudioContext.
 */

const audioModule = window.audioModule = {
    enabled: true,
    available: false,
    useHtml5: window.location.protocol === 'file:',
    sounds: {},          // id → { def, howls[], failed:Set, loaded:Set, lastIndex }
    buses: {},           // bus → { volume (0–1, ajuste del jugador), duck, duckTarget, duckUntil }
    active: new Set(),   // instancias sonando: { howl, sid, bus, baseVolume }
    keyboardActive: [],  // pool del teclado mecánico
    aura: null,
    unlocked: false,
    limiter: null,
    duckFrame: null,

    // === INICIO ===
    init() {
        this.available = typeof Howl !== 'undefined' && typeof SOUND_MANIFEST !== 'undefined';
        Object.entries(CONFIG.AUDIO_BUSES).forEach(([bus, config]) => {
            this.buses[bus] = { volume: config.volume, duck: 1, duckTarget: 1, duckUntil: 0 };
        });
        this.applySettings(gameState.audioSettings);

        if (!this.available) {
            console.warn('⚠️ Howler o SOUND_MANIFEST no disponibles: solo respaldo ZzFX');
            return;
        }

        Howler.volume(this.buses.master.volume);
        Object.entries(SOUND_MANIFEST).forEach(([id, def]) => {
            this.sounds[id] = { id, def, howls: [], failed: new Set(), loaded: new Set(), lastIndex: -1, pendingFallback: 0 };
        });
        this.preloadBuses(CONFIG.AUDIO.PRELOAD_BUSES_ON_INIT);
        this.bindUnlock();
    },

    bindUnlock() {
        const unlock = () => {
            ['pointerdown', 'keydown', 'touchstart'].forEach(type => document.removeEventListener(type, unlock, true));
            this.unlock();
        };
        ['pointerdown', 'keydown', 'touchstart'].forEach(type => document.addEventListener(type, unlock, true));
    },

    // Primera interacción: reanudar contextos y precargar el resto de sonidos.
    unlock() {
        if (this.unlocked) return;
        this.unlocked = true;
        try { Howler.ctx?.state === 'suspended' && Howler.ctx.resume(); } catch (error) { /* sin Web Audio */ }
        try { if (typeof zzfxX !== 'undefined' && zzfxX.state === 'suspended') zzfxX.resume(); } catch (error) { /* sin ZzFX */ }
        const rest = Object.keys(this.buses).filter(bus => bus !== 'master' && !CONFIG.AUDIO.PRELOAD_BUSES_ON_INIT.includes(bus));
        this.preloadBuses(rest);
        window.fxModule?.warmUp(); // mismo momento: el primer frame caro de los efectos, en tiempo libre
    },

    preloadBuses(buses) {
        if (!this.available) return;
        Object.values(this.sounds)
            .filter(entry => buses.includes(entry.def.bus))
            .forEach(entry => entry.def.files.forEach((file, index) => this.getHowl(entry, index)));
    },

    getHowl(entry, index) {
        if (entry.howls[index]) return entry.howls[index];

        const path = entry.def.files[index];
        const howl = new Howl({
            src: [`${path}.ogg`, `${path}.mp3`],
            html5: this.useHtml5,
            preload: true,
            onload: () => entry.loaded.add(index),
            onloaderror: (soundId, error) => {
                entry.failed.add(index);
                console.warn(`⚠️ Sonido no disponible: ${path} (${error})`);
                // Los play() que esperaban esta carga suenan con el respaldo ZzFX (una vez).
                if (entry.pendingFallback > 0) this.playFallback(entry.id, entry.def.bus);
                entry.pendingFallback = 0;
            }
        });
        entry.howls[index] = howl;
        this.ensureLimiter();
        return howl;
    },

    // Limitador en el master (solo Web Audio):
    // masterGain → compresor → trim → recorte suave → salida.
    // - El DynamicsCompressor aplica ganancia de compensación automática (makeup);
    //   el trim la anula, así lo que no se comprime suena igual que sin limitador.
    // - El compresor no es un muro (deja pasar picos de unos ms); el WaveShaper
    //   final garantiza que ninguna muestra supere CEILING.
    ensureLimiter() {
        if (this.limiter || this.useHtml5 || !Howler.usingWebAudio || !Howler.ctx || !Howler.masterGain) return;
        try {
            const ctx = Howler.ctx;
            const settings = CONFIG.AUDIO.LIMITER;
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = settings.threshold;
            compressor.knee.value = settings.knee;
            compressor.ratio.value = settings.ratio;
            compressor.attack.value = settings.attack;
            compressor.release.value = settings.release;

            // makeup (spec Web Audio) = 0.6 × |salida del compresor a 0 dBFS| → se resta.
            const fullRangeDb = settings.threshold + ((0 - settings.threshold) / settings.ratio);
            const trim = ctx.createGain();
            trim.gain.value = Math.pow(10, (0.6 * fullRangeDb) / 20);

            const clipper = ctx.createWaveShaper();
            clipper.curve = this.buildSoftClipCurve(settings.KNEE_START, settings.CEILING);
            clipper.oversample = '2x';

            Howler.masterGain.disconnect();
            Howler.masterGain.connect(compressor);
            compressor.connect(trim);
            trim.connect(clipper);
            clipper.connect(ctx.destination);
            this.limiter = { compressor, trim, clipper, output: clipper };
        } catch (error) {
            console.warn('⚠️ No se pudo crear el limitador:', error);
        }
    },

    // Lineal hasta `kneeStart`; por encima se curva (tanh) hacia `ceiling` sin pasarlo.
    buildSoftClipCurve(kneeStart = 0.7, ceiling = 0.98, size = 4096) {
        const curve = new Float32Array(size);
        const headroom = ceiling - kneeStart;
        for (let i = 0; i < size; i++) {
            const x = (i / (size - 1)) * 2 - 1;
            const magnitude = Math.abs(x);
            const y = magnitude <= kneeStart ? magnitude : kneeStart + headroom * Math.tanh((magnitude - kneeStart) / headroom);
            curve[i] = Math.sign(x) * y;
        }
        return curve;
    },

    // === REPRODUCCIÓN ===
    // play(id, { pitch, volume, delay, loop, rate }) → handle { stop(fadeMs) } o null.
    // pitch: semitonos fijos (rate = 2^(n/12)); si no se pasa, tono aleatorio dentro de pitchRange.
    play(id, options = {}) {
        if (!this.enabled) return null;
        const { delay = 0 } = options;
        if (delay > 0) {
            let handle = null;
            const timer = setTimeout(() => { handle = this.play(id, { ...options, delay: 0 }); }, delay);
            return { stop: fadeMs => (handle ? handle.stop(fadeMs) : clearTimeout(timer)) };
        }

        const entry = this.sounds[id];
        if (!entry) return this.playFallback(id, null, options);

        const usable = entry.def.files.map((file, index) => index).filter(index => !entry.failed.has(index));
        if (usable.length === 0) return this.playFallback(id, entry.def.bus, options);

        // Variación al azar, sin repetir la anterior si hay más de una.
        let candidates = usable.length > 1 ? usable.filter(index => index !== entry.lastIndex) : usable;
        if (options.variation !== undefined && usable.includes(options.variation)) candidates = [options.variation];
        const index = candidates[Math.floor(Math.random() * candidates.length)];
        entry.lastIndex = index;

        const howl = this.getHowl(entry, index);
        if (howl.state() === 'loading') {
            // Si la carga falla, este play sonará con el respaldo ZzFX (ver onloaderror).
            entry.pendingFallback++;
            howl.once('load', () => { entry.pendingFallback = Math.max(0, entry.pendingFallback - 1); });
        }

        const rate = this.resolveRate(entry.def, options);
        const baseVolume = (entry.def.volume ?? 1) * (options.volume ?? 1);
        const bus = entry.def.bus;
        const volume = baseVolume * this.getBusGain(bus);
        const sid = howl.play();
        howl.rate(rate, sid);
        howl.loop(!!options.loop, sid);
        howl.volume(volume, sid);
        // HTML5 Audio: Howler encola rate/volume hasta que la promesa de play() se
        // resuelve, y el sonido arrancaría unos ms con el tono y volumen por defecto.
        // Se aplican ya sobre el <audio> (el valor encolado luego es el mismo).
        if (this.useHtml5) {
            const node = howl._soundById?.(sid)?._node;
            if (node) {
                node.playbackRate = rate;
                node.volume = Math.max(0, Math.min(1, volume * Howler.volume()));
            }
        }

        const instance = { howl, sid, bus, baseVolume, id };
        this.active.add(instance);
        // Se libera al terminar o al pararse; el listener que no se dispara se retira
        // (si no, cada click dejaría un listener colgado en el Howl).
        const release = () => {
            this.active.delete(instance);
            howl.off('end', onEnd, sid);
            howl.off('stop', release, sid);
        };
        const onEnd = () => { if (!options.loop) release(); };
        howl.on('end', onEnd, sid);
        howl.on('stop', release, sid);

        return {
            id,
            instance,
            stop: (fadeMs = 0) => this.stopInstance(instance, fadeMs)
        };
    },

    resolveRate(def, options) {
        if (Number.isFinite(options.rate)) return options.rate;
        if (Number.isFinite(options.pitch)) return Math.pow(2, options.pitch / 12);
        const range = def.pitchRange || 0;
        return 1 + ((Math.random() * 2 - 1) * range);
    },

    stopInstance(instance, fadeMs = 0) {
        if (!instance || !this.active.has(instance)) return;
        const { howl, sid } = instance;
        if (fadeMs > 0) {
            howl.fade(howl.volume(sid), 0, fadeMs, sid);
            howl.once('fade', () => howl.stop(sid), sid);
        } else {
            howl.stop(sid);
        }
    },

    stopAll(fadeMs = 120) {
        [...this.active].forEach(instance => this.stopInstance(instance, fadeMs));
    },

    // === RESPALDO ZZFX ===
    playFallback(id, bus, options = {}) {
        if (!this.enabled || typeof zzfx === 'undefined') return null;
        const params = CONFIG.SOUND_FALLBACKS[id] || (bus ? CONFIG.SOUND_FALLBACK_BY_BUS[bus] : CONFIG.SOUND_FALLBACK_BY_BUS.sfx);
        if (!params) return null;

        const play = () => {
            const tuned = [...params];
            const gain = this.getBusGain(bus || 'sfx') * this.buses.master.volume * (options.volume ?? 1);
            tuned[0] = (tuned[0] ?? 1) * gain / 0.3; // zzfx multiplica por zzfxV (0.3)
            if (Number.isFinite(options.pitch)) tuned[2] = (tuned[2] ?? 220) * Math.pow(2, options.pitch / 12);
            try { zzfx(...tuned); } catch (error) { /* contexto no disponible */ }
        };
        play();
        return { id, fallback: true, stop: () => {} };
    },

    // === BUSES ===
    getBusGain(bus) {
        const state = this.buses[bus];
        if (!state) return 1;
        return state.volume * state.duck;
    },

    setBusVolume(bus, volume) {
        if (!this.buses[bus]) return;
        this.buses[bus].volume = Math.max(0, Math.min(1, volume));
        if (bus === 'master' && this.available) Howler.volume(this.buses.master.volume);
        this.refreshBus(bus);
    },

    refreshBus(bus) {
        this.active.forEach(instance => {
            if (instance.bus === bus) instance.howl.volume(instance.baseVolume * this.getBusGain(bus), instance.sid);
        });
    },

    // Ajustes del jugador (0–100 por slider) → volumen de sus buses.
    applySettings(settings = {}) {
        CONFIG.AUDIO_SLIDERS.forEach(slider => {
            const value = Number(settings[slider.key]);
            if (!Number.isFinite(value)) return;
            slider.buses.forEach(bus => this.setBusVolume(bus, value / 100));
        });
    },

    // duck(bus, amount, ms): baja un bus a `amount` (0–1) durante `ms` y lo devuelve.
    duck(bus, amount = 0.3, ms = 1000) {
        const state = this.buses[bus];
        if (!state) return;
        state.duckTarget = Math.min(state.duckTarget, Math.max(0, Math.min(1, amount)));
        state.duckUntil = Math.max(state.duckUntil, performance.now() + ms);
        this.runDuckLoop();
    },

    // Rampa propia (rAF + tiempo real): no depende de gsap, así freeze/slowmo no la afectan.
    runDuckLoop() {
        if (this.duckFrame) return;
        let last = performance.now();
        const step = now => {
            const dt = now - last;
            last = now;
            let busy = false;
            Object.entries(this.buses).forEach(([bus, state]) => {
                if (now >= state.duckUntil) state.duckTarget = 1;
                const target = state.duckTarget;
                if (Math.abs(state.duck - target) < 0.001) {
                    state.duck = target;
                } else {
                    const speed = target < state.duck ? dt / 120 : dt / 400; // ataque 120 ms, relajación 400 ms
                    state.duck += Math.sign(target - state.duck) * Math.min(Math.abs(target - state.duck), speed);
                    this.refreshBus(bus);
                }
                if (state.duck !== 1 || now < state.duckUntil) busy = true;
            });
            this.duckFrame = busy ? requestAnimationFrame(step) : null;
        };
        this.duckFrame = requestAnimationFrame(step);
    },

    // === TECLADO MECÁNICO ===
    // Pool de instancias de ui_click: el perfil (volumen y tono) mejora con el nivel
    // del upgrade, cada tecla varía de tono y nunca suenan más de POOL_SIZE a la vez.
    getKeyboardProfile(level = gameState.upgrades?.keyboard?.owned || 0) {
        const { BASE, PER_LEVEL, LIMITS } = CONFIG.AUDIO.KEYBOARD;
        return {
            volume: Math.min(LIMITS.volume, BASE.volume + (level * PER_LEVEL.volume)),
            rate: Math.max(LIMITS.rate, BASE.rate + (level * PER_LEVEL.rate))
        };
    },

    playKey() {
        const { SOUND, POOL_SIZE, JITTER } = CONFIG.AUDIO.KEYBOARD;
        const profile = this.getKeyboardProfile();
        const handle = this.play(SOUND, {
            volume: profile.volume,
            rate: profile.rate * (1 + ((Math.random() * 2 - 1) * JITTER))
        });
        if (!handle) return null;

        this.keyboardActive.push(handle);
        this.keyboardActive = this.keyboardActive.filter(item => !item.instance || this.active.has(item.instance));
        while (this.keyboardActive.length > POOL_SIZE) {
            this.keyboardActive.shift().stop(15);
        }
        return handle;
    },

    // === AURA DE RACHA ===
    updateStreakAura(now = Date.now()) {
        const { SOUND, MIN_STREAK, VOLUME, FADE_MS } = CONFIG.AUDIO.STREAK_AURA;
        const streakActive = now - gameState.lastClickTime < CONFIG.STREAK_TIMEOUT;
        const shouldPlay = this.enabled && streakActive && gameState.streak >= MIN_STREAK;

        if (shouldPlay && !this.aura) {
            this.aura = this.play(SOUND, { loop: true, volume: VOLUME });
            const instance = this.aura?.instance;
            if (instance) instance.howl.fade(0, VOLUME * this.getBusGain(instance.bus), FADE_MS, instance.sid);
        } else if (!shouldPlay && this.aura) {
            this.aura.stop(FADE_MS);
            this.aura = null;
        }
    },

    // === UTILIDADES ===
    toggle() {
        this.enabled = !this.enabled;
        if (this.available) Howler.mute(!this.enabled);
        if (!this.enabled) {
            this.aura?.stop(0);
            this.aura = null;
        }
        return this.enabled;
    },

    setEnabled(enabled) {
        if (this.enabled !== !!enabled) this.toggle();
    },

    list() {
        return Object.keys(SOUND_MANIFEST || {});
    },

    // Estado de carga por sonido (para depurar y probar).
    getLoadReport() {
        return Object.fromEntries(Object.values(this.sounds).map(entry => [entry.id, {
            variations: entry.def.files.length,
            created: entry.howls.filter(Boolean).length,
            loaded: entry.loaded.size,
            failed: entry.failed.size
        }]));
    }
};

console.log('✅ AUDIO MODULE loaded');
