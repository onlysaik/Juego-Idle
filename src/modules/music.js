/**
 * MODULES/MUSIC.JS - Música adaptativa con Tone.js
 * Cuatro capas (pad, ritmo, arpegio, melodía) a 90 BPM que se suman según la producción
 * (CONFIG.MUSIC_LAYERS). Usa los loops de assets/audio/music/ si existen; si no, sintetiza
 * cada capa con Tone.js.
 *
 * - Tone.js se carga por CDN, de forma diferida, tras la primera interacción
 *   (audioModule.unlock → requestLoad). Si falla, el juego sigue sin música.
 * - Comparte el AudioContext de Howler y entra por Howler.masterGain, así pasa por el
 *   mismo limitador y respeta el mute del master. Su nivel lo marca el bus "music" de
 *   audio.js (slider Música × duck()).
 * - Las capas entran y salen con fundido, siempre al inicio de un compás: los cambios
 *   se aplican en onBar(), agendado con Tone.Transport cada '1m'.
 * - Con el bus a 0, el sonido apagado o la pestaña oculta, el Transport se pausa: Tone.js
 *   no procesa eventos.
 * - Prestige: handle({action:'cut'}) corta la música en el impacto y handle({action:'resume'})
 *   la devuelve en la reconstrucción, una quinta más arriba y solo con el pad.
 */

const musicModule = window.musicModule = {
    status: 'idle',      // idle | loading | ready | failed
    mode: null,          // 'synth' | 'loops'
    Tone: null,
    out: null,           // Tone.Gain → Howler.masterGain
    layerGain: {},
    instruments: {},
    loops: {},
    arpFilter: null,
    pitchShift: null,
    active: {},          // capa sonando (sus eventos disparan notas)
    desired: {},         // capa que debe sonar (se aplica en el próximo compás)
    fadeToken: {},
    keyIndex: 0,
    cut: false,
    lastUpdate: 0,
    streakTarget: -1,
    loadPromise: null,

    init() {
        if (!CONFIG.MUSIC.ENABLED) return;
        this.keyIndex = gameState.prestigeLevel || 0;
        this.desired.pad = true;
        document.addEventListener('visibilitychange', () => this.syncPlayback());
    },

    // === CARGA DIFERIDA ===
    // Primera interacción (audioModule.unlock): se descarga Tone.js en tiempo libre.
    requestLoad() {
        if (this.loadPromise || !CONFIG.MUSIC.ENABLED) return;
        this.status = 'loading';
        const defer = window.requestIdleCallback || (callback => setTimeout(callback, 200));
        this.loadPromise = new Promise((resolve, reject) => {
            defer(() => {
                if (window.Tone) { resolve(); return; }
                const script = document.createElement('script');
                script.src = CONFIG.MUSIC.TONE_URL;
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error('no se pudo cargar Tone.js'));
                document.head.appendChild(script);
            }, { timeout: 1500 });
        }).then(() => this.build()).catch(error => {
            this.status = 'failed';
            console.warn('⚠️ Música desactivada:', error.message || error);
        });
    },

    isReady() {
        return this.status === 'ready';
    },

    // === CONSTRUCCIÓN ===
    async build() {
        const Tone = this.Tone = window.Tone;
        const raw = window.Howler?.ctx;
        // Mismo AudioContext que Howler: la música pasa por su limitador y su mute.
        // Importante: con un contexto propio hay que usar Tone.getTransport() (Tone.Transport queda
        // ligado al contexto por defecto que Tone crea al importarse y no dispara Sequence/Loop).
        if (raw) Tone.setContext(raw, true);
        await Tone.start();

        this.out = new Tone.Gain(0);
        if (raw && Howler.masterGain) this.out.connect(Howler.masterGain);
        else this.out.toDestination();

        Tone.getTransport().bpm.value = CONFIG.MUSIC.BPM;
        Tone.getTransport().swing = CONFIG.MUSIC.SWING;
        Tone.getTransport().swingSubdivision = '8n';

        Object.keys(CONFIG.MUSIC_LAYERS).forEach(name => {
            this.layerGain[name] = new Tone.Gain(0);
        });
        this.arpFilter = new Tone.Filter({ frequency: CONFIG.MUSIC.ARP_FILTER.CLOSED, type: 'lowpass', Q: 3 });

        const useLoops = await this.detectLoops();
        this.mode = useLoops ? 'loops' : 'synth';
        if (useLoops) await this.buildLoops(useLoops);
        else this.buildSynth();

        Tone.getTransport().scheduleRepeat(time => this.onBar(time), '1m', 0);
        this.status = 'ready';
        this.setKeyShift();
        this.applyBus();
        this.syncPlayback();
    },

    // === SÍNTESIS ===
    buildSynth() {
        const Tone = this.Tone;
        const { layerGain } = this;
        const mix = CONFIG.MUSIC_LAYERS;
        const instruments = this.instruments;

        // Pad: acordes suaves con eco difuso (sin Freeverb: usa un AudioWorklet que no hace falta).
        instruments.pad = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 6,
            oscillator: { type: 'triangle' },
            envelope: { attack: 1.1, decay: 0.4, sustain: 0.8, release: 2.2 },
            volume: -9
        });
        const padFilter = new Tone.Filter(1200, 'lowpass');
        const padReverb = new Tone.FeedbackDelay({ delayTime: '2n', feedback: 0.45, wet: 0.25 });
        instruments.pad.chain(padFilter, padReverb, layerGain.pad);

        // Ritmo: bombo, caja y hi-hat con filtros.
        instruments.kick = new Tone.MembraneSynth({
            pitchDecay: 0.04, octaves: 5,
            envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 },
            volume: -4
        });
        instruments.snare = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.002, decay: 0.16, sustain: 0 }, volume: -12 });
        instruments.hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 }, volume: -20 });
        const snareFilter = new Tone.Filter(1900, 'bandpass');
        const hatFilter = new Tone.Filter(7500, 'highpass');
        instruments.kick.connect(layerGain.rhythm);
        instruments.snare.chain(snareFilter, layerGain.rhythm);
        instruments.hat.chain(hatFilter, layerGain.rhythm);

        // Arpegio: sierra con filtro que la racha abre poco a poco, y eco.
        instruments.arp = new Tone.Synth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.005, decay: 0.2, sustain: 0.04, release: 0.25 },
            volume: -12
        });
        const arpDelay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.32, wet: 0.28 });
        instruments.arp.chain(this.arpFilter, arpDelay, layerGain.arp);

        // Melodía: triángulo con eco.
        instruments.melody = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.03, decay: 0.25, sustain: 0.4, release: 0.9 },
            volume: -10
        });
        const melodyDelay = new Tone.FeedbackDelay({ delayTime: '4n.', feedback: 0.35, wet: 0.3 });
        instruments.melody.chain(melodyDelay, layerGain.melody);

        Object.keys(mix).forEach(name => layerGain[name].connect(this.out));

        // Patrones: se leen la capa activa y el acorde del compás en cada paso.
        const stepSeconds = () => 60 / this.Tone.getTransport().bpm.value / 4;
        const rhythm = CONFIG.MUSIC.RHYTHM;
        this.sequences = [
            new Tone.Sequence((time, step) => {
                if (!this.active.rhythm) return;
                if (rhythm.KICK.includes(step)) instruments.kick.triggerAttackRelease(this.noteFor(-12, 0), '8n', time);
                if (rhythm.SNARE.includes(step)) instruments.snare.triggerAttackRelease('16n', time);
                if (rhythm.HAT.includes(step)) instruments.hat.triggerAttackRelease('32n', time, step % 4 === 2 ? 0.8 : 0.45);
            }, [...Array(16).keys()], '16n'),

            new Tone.Sequence((time, index) => {
                if (!this.active.arp) return;
                const chord = this.chordAt(time);
                const slot = CONFIG.MUSIC.ARP_PATTERN[index % CONFIG.MUSIC.ARP_PATTERN.length];
                const tone = chord.notes[slot % 4] + (12 * Math.floor(slot / 4));
                instruments.arp.triggerAttackRelease(this.noteFor(12, chord.offset + tone), '16n', time, 0.7);
            }, [...Array(8).keys()], '8n'),

            new Tone.Sequence((time, step) => {
                if (!this.active.melody) return;
                const phrase = CONFIG.MUSIC.MELODY[this.barAt(time) % CONFIG.MUSIC.MELODY.length];
                const chord = this.chordAt(time);
                phrase.filter(note => note[0] === step).forEach(([, degree, length]) => {
                    const scale = CONFIG.MUSIC.PENTATONIC;
                    const semitones = scale[degree % scale.length] + (12 * Math.floor(degree / scale.length));
                    instruments.melody.triggerAttackRelease(this.noteFor(24, semitones), length * stepSeconds(), time, 0.75);
                });
            }, [...Array(16).keys()], '16n')
        ];
        this.sequences.forEach(sequence => sequence.start(0));
    },

    // === LOOPS (opcional) ===
    // Si assets/audio/music/{pad,rhythm,arp,melody}.{ogg,mp3} existen, se usan en vez de sintetizar.
    async detectLoops() {
        const { DIR, EXTENSIONS } = CONFIG.MUSIC.LOOPS;
        if (window.location.protocol === 'file:') return null; // sin fetch/XHR locales
        const found = {};
        for (const name of Object.keys(CONFIG.MUSIC_LAYERS)) {
            let url = null;
            for (const extension of EXTENSIONS) {
                try {
                    const response = await fetch(`${DIR}${name}.${extension}`, { method: 'HEAD' });
                    if (response.ok) { url = `${DIR}${name}.${extension}`; break; }
                } catch (error) { /* no existe */ }
            }
            if (!url) return null;
            found[name] = url;
        }
        return found;
    },

    async buildLoops(urls) {
        const Tone = this.Tone;
        // Cambiar de tonalidad con loops = transponer el bus con PitchShift (solo cuando hace falta).
        this.pitchShift = new Tone.PitchShift({ pitch: 0, windowSize: 0.1 });
        this.pitchShift.connect(this.out);
        await Promise.all(Object.entries(urls).map(([name, url]) => new Promise(resolve => {
            const player = new Tone.Player({ url, loop: true, onload: resolve, onerror: resolve });
            if (name === 'arp') player.chain(this.arpFilter, this.layerGain[name]);
            else player.connect(this.layerGain[name]);
            this.layerGain[name].connect(this.pitchShift);
            player.sync().start(0);
            this.loops[name] = player;
        })));
    },

    // === TONALIDAD ===
    rootMidi() {
        const { BASE_MIDI, FIFTH_STEP } = CONFIG.MUSIC;
        return BASE_MIDI + ((this.keyIndex * FIFTH_STEP) % 12);
    },

    noteFor(octaveOffset, semitones) {
        return this.Tone.Frequency(this.rootMidi() + octaveOffset + semitones, 'midi').toFrequency();
    },

    barAt(time) {
        const Tone = this.Tone;
        return Math.max(0, Math.floor(Tone.getTransport().getTicksAtTime(time) / (Tone.getTransport().PPQ * 4)));
    },

    chordAt(time) {
        const progression = CONFIG.MUSIC.PROGRESSION;
        return progression[this.barAt(time) % progression.length];
    },

    // Con loops: semitonos de diferencia entre la tonalidad del run y la de los archivos.
    setKeyShift() {
        if (this.mode !== 'loops' || !this.pitchShift) return;
        const semitones = ((this.rootMidi() - CONFIG.MUSIC.BASE_MIDI - CONFIG.MUSIC.LOOPS.KEY_SEMITONE) % 12 + 12) % 12;
        this.pitchShift.pitch = semitones > 6 ? semitones - 12 : semitones;
    },

    // === COMPÁS: AQUÍ SE APLICAN LAS CAPAS ===
    onBar(time) {
        Object.keys(CONFIG.MUSIC_LAYERS).forEach(name => {
            const want = !!this.desired[name];
            if (want !== !!this.active[name]) this.fadeLayer(name, want, time);
        });
        if (this.mode === 'synth' && this.active.pad) {
            const chord = this.chordAt(time);
            const notes = chord.notes.map(note => this.noteFor(12, chord.offset + note));
            this.instruments.pad.triggerAttackRelease(notes, this.barSeconds() * 0.97, time, 0.5);
        }
    },

    barSeconds() {
        return (60 / this.Tone.getTransport().bpm.value) * 4;
    },

    fadeLayer(name, on, time) {
        const gain = this.layerGain[name];
        const fade = CONFIG.MUSIC.FADE_SECONDS;
        const token = (this.fadeToken[name] || 0) + 1;
        this.fadeToken[name] = token;
        gain.gain.cancelScheduledValues(time);
        gain.gain.setValueAtTime(gain.gain.value, time);
        gain.gain.linearRampToValueAtTime(on ? CONFIG.MUSIC_LAYERS[name].gain : 0, time + fade);
        if (on) {
            this.active[name] = true;
        } else {
            // Los eventos dejan de disparar notas cuando el fundido termina.
            setTimeout(() => { if (this.fadeToken[name] === token) this.active[name] = false; }, (fade + 0.3) * 1000);
        }
    },

    // === PRODUCCIÓN → CAPAS ===
    // Desde el game loop (cada tick, se reevalúa una vez por UPDATE_MS). Sube una capa al
    // alcanzar su umbral y la baja cuando la producción cae a threshold × HYSTERESIS.
    update(generation, now = performance.now()) {
        if (now - this.lastUpdate < CONFIG.MUSIC.UPDATE_MS) return;
        this.lastUpdate = now;
        if (this.cut) return;
        Object.entries(CONFIG.MUSIC_LAYERS).forEach(([name, layer]) => {
            const on = !!this.desired[name];
            if (!on && generation >= layer.threshold) this.desired[name] = true;
            else if (on && layer.threshold > 0 && generation < layer.threshold * CONFIG.MUSIC.HYSTERESIS) this.desired[name] = false;
        });
    },

    // === RACHA ===
    // La racha abre poco a poco el filtro del arpegio; al cortarse se cierra despacio.
    setStreak(streak) {
        const { CLOSED, OPEN, STREAK_FOR_FULL_OPEN, RAMP_UP_S, RAMP_DOWN_S } = CONFIG.MUSIC.ARP_FILTER;
        const position = Math.max(0, Math.min(1, streak / STREAK_FOR_FULL_OPEN));
        const quantized = Math.round(position * 20) / 20;
        if (!this.arpFilter || quantized === this.streakTarget) return;
        const rising = quantized > this.streakTarget;
        this.streakTarget = quantized;
        const frequency = CLOSED * Math.pow(OPEN / CLOSED, quantized);
        this.arpFilter.frequency.rampTo(frequency, rising ? RAMP_UP_S : RAMP_DOWN_S);
    },

    // === NIVEL Y REPRODUCCIÓN ===
    // Bus "music" de audio.js (slider × duck) → ganancia de salida.
    applyBus() {
        if (!this.out) return;
        const level = this.cut ? 0 : audioModule.getBusGain('music') * CONFIG.MUSIC.MASTER_GAIN;
        this.out.gain.rampTo(level, 0.06);
    },

    // El Transport corre solo si hay música audible: con el bus en 0, el sonido apagado, la
    // pestaña oculta o la música cortada, se pausa y Tone.js no procesa nada.
    shouldRun() {
        return this.isReady() && !this.cut && audioModule.enabled && !document.hidden
            && (audioModule.buses.music?.volume ?? 0) > 0;
    },

    syncPlayback() {
        if (!this.isReady()) return;
        const Tone = this.Tone;
        const transport = Tone.getTransport();
        if (this.shouldRun()) {
            if (transport.state !== 'started') transport.start('+0.05');
        } else if (transport.state === 'started') {
            transport.pause();
        }
        this.applyBus();
    },

    // === ACCIONES DE COREOGRAFÍA (prestige) ===
    handle(spec) {
        if (spec.action === 'cut') this.cutMusic();
        else if (spec.action === 'resume') this.resume();
        return null;
    },

    // Impacto del prestige: la música se corta en seco.
    cutMusic() {
        this.cut = true;
        Object.keys(CONFIG.MUSIC_LAYERS).forEach(name => {
            this.active[name] = false;
            this.desired[name] = false;
            this.fadeToken[name] = (this.fadeToken[name] || 0) + 1;
        });
        if (!this.isReady()) return;
        this.applyBus();
        // Un instante después (para que el corte no haga clic): capas a 0 y Transport parado.
        setTimeout(() => {
            if (!this.cut) return;
            Object.values(this.layerGain).forEach(gain => { gain.gain.cancelScheduledValues(0); gain.gain.value = 0; });
            this.Tone.getTransport().stop();
        }, 80);
    },

    // Reconstrucción: vuelve en la tonalidad nueva (una quinta más por run), solo con el pad.
    resume() {
        this.cut = false;
        this.keyIndex = gameState.prestigeLevel || 0;
        this.lastUpdate = 0;
        Object.keys(CONFIG.MUSIC_LAYERS).forEach(name => {
            this.active[name] = false;
            this.desired[name] = name === 'pad';
        });
        this.streakTarget = -1;
        if (!this.isReady()) return;
        Object.values(this.layerGain).forEach(gain => { gain.gain.cancelScheduledValues(0); gain.gain.value = 0; });
        this.Tone.getTransport().stop();
        this.setKeyShift();
        this.syncPlayback();
    },

    // Estado para depurar y probar.
    getState() {
        return {
            status: this.status,
            mode: this.mode,
            transport: this.isReady() ? this.Tone.getTransport().state : null,
            key: this.keyIndex,
            rootMidi: this.rootMidi(),
            cut: this.cut,
            active: { ...this.active },
            desired: { ...this.desired },
            out: this.out ? this.out.gain.value : null,
            layerGains: Object.fromEntries(Object.entries(this.layerGain).map(([name, node]) => [name, +node.gain.value.toFixed(3)])),
            arpCutoff: this.arpFilter ? Math.round(this.arpFilter.frequency.value) : null
        };
    }
};

console.log('✅ MUSIC MODULE loaded');
