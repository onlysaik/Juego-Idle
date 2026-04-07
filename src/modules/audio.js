/**
 * MODULES/AUDIO.JS - Sistema de audio
 * Responsabilidad: Generar sonidos y manejar estado de audio
 * Independiente del resto del juego
 */

class MechanicalKeyboardSamplePlayer {
    constructor(options = {}) {
        this.sources = options.sources || [];
        this.poolSize = options.poolSize || 6;
        this.audioContext = options.audioContext || null;
        this.pool = this.sources.map((source) => {
            const config = typeof source === 'string' ? { src: source } : source;

            return {
                src: config.src,
                startTime: config.startTime || 0,
                maxDuration: config.maxDuration,
                instances: Array.from({ length: this.poolSize }, () => this.createAudioInstance(config.src))
            };
        });
    }

    createAudioInstance(src) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.volume = 0.4;
        audio._stopTimer = null;

        if (this.audioContext) {
            const sourceNode = this.audioContext.createMediaElementSource(audio);
            const bandpass = this.audioContext.createBiquadFilter();
            const lowpass = this.audioContext.createBiquadFilter();
            const outputGain = this.audioContext.createGain();

            bandpass.type = 'bandpass';
            bandpass.frequency.value = 2100;
            bandpass.Q.value = 0.7;

            lowpass.type = 'lowpass';
            lowpass.frequency.value = 5200;
            lowpass.Q.value = 0.7;

            outputGain.gain.value = 1;

            sourceNode.connect(bandpass);
            bandpass.connect(lowpass);
            lowpass.connect(outputGain);
            outputGain.connect(this.audioContext.destination);

            audio._processingNodes = {
                sourceNode,
                bandpass,
                lowpass,
                outputGain
            };
        }

        return audio;
    }

    warmup() {
        this.pool.forEach((entry) => {
            entry.instances.forEach((audio) => {
                audio.load();
            });
        });
    }

    getAvailableInstance(entry) {
        const available = entry.instances.find((audio) => audio.paused || audio.ended);
        return available || entry.instances[0];
    }

    play(options = {}) {
        if (this.pool.length === 0) return;

        const {
            volume = 0.42,
            playbackRate = 1,
            variationAmount = 0.04,
            startTime = 0,
            maxDuration = 0.095,
            brightness = 0.52,
            body = 0.48
        } = options;

        const entry = this.pool[Math.floor(Math.random() * this.pool.length)];
        const audio = this.getAvailableInstance(entry);
        const drift = 1 + ((Math.random() - 0.5) * variationAmount * 2);
        const effectiveStartTime = entry.startTime ?? startTime;
        const effectiveMaxDuration = entry.maxDuration ?? maxDuration;

        if (audio._stopTimer) {
            clearTimeout(audio._stopTimer);
            audio._stopTimer = null;
        }

        audio.pause();
        audio.currentTime = effectiveStartTime;
        audio.volume = Math.min(1, Math.max(0.05, volume + ((Math.random() - 0.5) * 0.08)));
        audio.playbackRate = Math.min(1.18, Math.max(0.86, playbackRate * drift));

        if (audio._processingNodes) {
            const normalizedBrightness = Math.min(1, Math.max(0, brightness));
            const normalizedBody = Math.min(1, Math.max(0, body));
            const bandpassFrequency = 1400 + (normalizedBrightness * 1900) - (normalizedBody * 220);
            const bandpassQ = 0.55 + (normalizedBrightness * 0.7);
            const lowpassFrequency = 3200 + (normalizedBrightness * 3600) - (normalizedBody * 650);

            audio._processingNodes.bandpass.frequency.setTargetAtTime(bandpassFrequency, this.audioContext.currentTime, 0.01);
            audio._processingNodes.bandpass.Q.setTargetAtTime(bandpassQ, this.audioContext.currentTime, 0.01);
            audio._processingNodes.lowpass.frequency.setTargetAtTime(Math.max(1800, lowpassFrequency), this.audioContext.currentTime, 0.01);
            audio._processingNodes.outputGain.gain.setTargetAtTime(0.92 + (normalizedBody * 0.12), this.audioContext.currentTime, 0.01);
        }

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }

        audio._stopTimer = setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
            audio._stopTimer = null;
        }, effectiveMaxDuration * 1000);
    }
}

const MECHANICAL_KEYBOARD_SAMPLE_URLS = [
    {
        src: 'https://cdn.freesound.org/previews/450/450282_9373288-lq.mp3',
        startTime: 0.36,
        maxDuration: 0.068
    },
    {
        src: 'https://cdn.freesound.org/previews/378/378085_6260145-lq.mp3',
        startTime: 0.41,
        maxDuration: 0.062
    },
    {
        src: 'https://cdn.freesound.org/previews/546/546167_12206738-lq.mp3',
        startTime: 0.33,
        maxDuration: 0.071
    }
];

const audioModule = window.audioModule = {
    enabled: true,
    audioContext: null,
    mechanicalKeyboardPlayer: null,
    
    init() {
        this.enabled = true;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('⚠️ Audio Context no disponible');
            this.audioContext = null;
        }

        this.mechanicalKeyboardPlayer = new MechanicalKeyboardSamplePlayer({
            sources: MECHANICAL_KEYBOARD_SAMPLE_URLS,
            poolSize: 6,
            audioContext: this.audioContext
        });
        this.mechanicalKeyboardPlayer.warmup();
    },

    ensureContextReady() {
        if (!this.audioContext) return false;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        return true;
    },

    hasMechanicalKeyboard() {
        return !!gameState?.upgrades?.keyboard?.owned;
    },

    getMechanicalKeyboardProfile(level = 1) {
        const normalizedLevel = Math.max(1, Number(level) || 1);

        return {
            volume: Math.min(0.62, 0.36 + (normalizedLevel * 0.03)),
            playbackRate: Math.min(1.14, 0.97 + (normalizedLevel * 0.018)),
            variationAmount: Math.max(0.028, 0.055 - (normalizedLevel * 0.003)),
            maxDuration: Math.max(0.062, 0.09 - (normalizedLevel * 0.002)),
            brightness: Math.min(0.7, 0.45 + (normalizedLevel * 0.025)),
            body: Math.min(0.56, 0.32 + (normalizedLevel * 0.022))
        };
    },
    
    // Reproducir sonido genérico
    play(type = 'click') {
        if (!this.enabled) return;
        
        switch (type) {
            case 'click':
                if (this.hasMechanicalKeyboard()) {
                    this.playMechanicalKey(this.getMechanicalKeyboardProfile(gameState.upgrades.keyboard.owned));
                } else {
                    this.playBeep(400, 100);
                }
                break;
            case 'commit':
                this.playBeep(800, 200);
                break;
            case 'event':
                this.playBeep(600, 150);
                break;
            case 'achievement':
                this.playMelody([800, 600, 1000], [100, 100, 200]);
                break;
            case 'keyboard-upgrade':
                this.playMechanicalUpgradeFanfare();
                break;
        }
    },

    playMechanicalKey(options = {}) {
        if (!this.mechanicalKeyboardPlayer) return;

        const normalizedOptions = typeof options === 'number'
            ? this.getMechanicalKeyboardProfile(options)
            : options;

        try {
            this.mechanicalKeyboardPlayer.play(normalizedOptions);
        } catch (e) {
            console.error('Error playing mechanical key:', e);
        }
    },

    playMechanicalUpgradeFanfare() {
        this.playMechanicalKey({ volume: 0.5, playbackRate: 1.02, variationAmount: 0.025, maxDuration: 0.09 });
        setTimeout(() => this.playMechanicalKey({ volume: 0.54, playbackRate: 1.08, variationAmount: 0.02, maxDuration: 0.095 }), 45);
    },
    
    // Beep simple
    playBeep(frequency, duration) {
        if (!this.audioContext || !this.ensureContextReady()) return;
        
        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.value = frequency;
            osc.type = 'sine';
            
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);
            
            osc.start(now);
            osc.stop(now + duration / 1000);
        } catch (e) {
            console.error('Error playing beep:', e);
        }
    },
    
    // Melodía (múltiples notas)
    playMelody(frequencies, durations) {
        if (!this.audioContext || frequencies.length === 0 || !this.ensureContextReady()) return;
        
        let totalTime = 0;
        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                this.playBeep(freq, durations[i] || 100);
            }, totalTime);
            totalTime += durations[i] || 100;
        });
    },
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
};

console.log('✅ AUDIO MODULE loaded');
