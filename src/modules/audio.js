/**
 * MODULES/AUDIO.JS - Sistema de audio
 * Responsabilidad: Generar sonidos y manejar estado de audio
 * Independiente del resto del juego
 */

const audioModule = window.audioModule = {
    enabled: true,
    audioContext: null,
    
    init() {
        this.enabled = true;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('⚠️ Audio Context no disponible');
            this.audioContext = null;
        }
    },

    ensureContextReady() {
        if (!this.audioContext) return false;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        return true;
    },

    // Reproducir sonido genérico
    play(type = 'click') {
        if (!this.enabled) return;
        
        switch (type) {
            case 'click':
            case 'keyboard-upgrade':
                this.playBeep(400, 100);
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
        }
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
