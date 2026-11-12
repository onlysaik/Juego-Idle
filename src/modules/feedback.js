/**
 * MODULES/FEEDBACK.JS - Coreografías de audio + efectos visuales
 * Las coreografías se definen en CONFIG.CHOREOGRAPHIES como pasos
 * { at, sound, soundOptions, fx, duck }. feedbackModule.play(id, contexto) arma un
 * gsap.timeline() y agenda cada paso con .call(): sonido y efecto se lanzan en la
 * misma llamada, así caen en el mismo frame.
 *
 * - La línea de tiempo avanza con tiempo real desde un listener prioritario de
 *   gsap.ticker (antes del render de GSAP), así freeze/slowmo no la detienen.
 * - Prioridades: un momento grande cancela los pequeños/medianos en curso; dos
 *   medianos no se superponen (uno cada MEDIUM_MIN_GAP_MS como mínimo, el resto
 *   espera en cola); los grandes se encolan entre sí.
 * - Esc salta lo que está en curso y lo deja en su estado final.
 * - gameState.seenChoreographies cuenta las vistas para usar la versión corta.
 */

const feedbackModule = window.feedbackModule = {
    runs: [],
    mediumQueue: [],
    bigQueue: [],
    lastMediumStart: -Infinity,
    trace: [],
    ready: false,

    init() {
        if (typeof gsap === 'undefined') return;
        // prioritize = true: corre antes de que GSAP pinte este frame.
        gsap.ticker.add(() => this.tick(), false, true);
        this.ready = true;
    },

    getPriority(definition) {
        return CONFIG.FEEDBACK.PRIORITIES[definition.priority] ?? CONFIG.FEEDBACK.PRIORITIES.small;
    },

    isPlaying() {
        return this.runs.length > 0;
    },

    // === ENTRADA ===
    play(id, context = {}) {
        const definition = CONFIG.CHOREOGRAPHIES[id];
        if (!definition) {
            console.warn(`⚠️ Coreografía desconocida: ${id}`);
            return false;
        }
        if (!this.ready) {
            // Sin GSAP: al menos el sonido de cada paso.
            definition.steps.forEach(step => step.sound && audioModule.play(step.sound, { delay: step.at }));
            return 'audio-only';
        }

        const { big, medium } = CONFIG.FEEDBACK.PRIORITIES;
        const priority = this.getPriority(definition);
        const bigRunning = this.runs.some(run => run.priority >= big);

        if (priority >= big) {
            if (bigRunning) {
                this.bigQueue.push({ id, context });
                return 'queued';
            }
            // Un momento grande cancela los pequeños y medianos en curso.
            this.runs.filter(run => run.priority < big).forEach(run => this.finishRun(run));
            this.mediumQueue = [];
            return this.start(id, definition, context, priority);
        }

        if (priority === medium) {
            const now = performance.now();
            const mustWait = bigRunning
                || this.runs.some(run => run.priority === medium)
                || now - this.lastMediumStart < CONFIG.FEEDBACK.MEDIUM_MIN_GAP_MS
                || this.mediumQueue.length > 0;
            if (mustWait) {
                if (this.mediumQueue.length >= CONFIG.FEEDBACK.MEDIUM_QUEUE_MAX) return false;
                this.mediumQueue.push({ id, context });
                return 'queued';
            }
            return this.start(id, definition, context, priority);
        }

        // Pequeños: se descartan durante un momento grande.
        if (bigRunning) return false;
        return this.start(id, definition, context, priority);
    },

    start(id, definition, context, priority) {
        const previousViews = gameState.seenChoreographies[id] || 0;
        gameState.recordChoreographyView(id);
        const useShort = Boolean(definition.short)
            && (gameState.visualSettings.shortCelebrations || previousViews >= CONFIG.FEEDBACK.SHORT_AFTER_VIEWS);
        const steps = useShort ? definition.short : definition.steps;

        const run = {
            id,
            priority,
            short: useShort,
            context,
            sounds: [],
            skipping: false,
            startedAt: performance.now(),
            duration: this.getVisualDuration(steps),
            tl: gsap.timeline({ paused: true })
        };
        steps.forEach(step => run.tl.call(() => this.runStep(run, step), [], step.at / 1000));
        run.tl.call(() => {}, [], run.duration / 1000);

        if (priority === CONFIG.FEEDBACK.PRIORITIES.medium) this.lastMediumStart = run.startedAt;
        this.runs.push(run);
        // Los pasos en t=0 se lanzan ya, en el mismo frame que la acción que los dispara.
        run.tl.totalTime(0.0001);
        return run;
    },

    // Duración visual: último paso + la duración de su efecto más largo.
    getVisualDuration(steps) {
        return steps.reduce((max, step) => {
            const fxList = [].concat(step.fx || []);
            const fxMs = fxList.reduce((longest, spec) => Math.max(longest, spec.ms || 400), 0);
            return Math.max(max, step.at + fxMs);
        }, 0);
    },

    // === RELOJ ===
    tick() {
        const now = performance.now();
        [...this.runs].forEach(run => {
            const elapsed = (now - run.startedAt) / 1000;
            run.tl.totalTime(Math.min(elapsed, run.tl.duration()));
            if (now - run.startedAt >= run.duration) this.endRun(run);
        });
        this.processQueues(now);
    },

    processQueues(now = performance.now()) {
        const { big, medium } = CONFIG.FEEDBACK.PRIORITIES;
        if (this.bigQueue.length && !this.runs.some(run => run.priority >= big)) {
            const next = this.bigQueue.shift();
            this.play(next.id, next.context);
            return;
        }
        if (this.mediumQueue.length
            && !this.runs.some(run => run.priority >= medium)
            && now - this.lastMediumStart >= CONFIG.FEEDBACK.MEDIUM_MIN_GAP_MS) {
            const next = this.mediumQueue.shift();
            const definition = CONFIG.CHOREOGRAPHIES[next.id];
            if (definition) this.start(next.id, definition, next.context, this.getPriority(definition));
        }
    },

    endRun(run) {
        this.runs = this.runs.filter(item => item !== run);
        run.tl.kill();
    },

    // === PASOS ===
    resolveValue(value, context) {
        if (typeof value === 'string' && value.startsWith('context.')) return context[value.slice(8)];
        return value;
    },

    resolveSpec(spec, context) {
        return Object.fromEntries(Object.entries(spec).map(([key, value]) => [key, this.resolveValue(value, context)]));
    },

    runStep(run, step) {
        const fxList = [].concat(step.fx || []).map(spec => this.resolveSpec(spec, run.context));

        // Al saltar: sin sonido ni efectos pasajeros, solo el estado final.
        if (run.skipping) {
            fxList.forEach(spec => fxModule.applyFinalState(spec, run.context));
            return;
        }

        const frame = gsap.ticker.frame;
        const startedAt = performance.now();
        if (step.duck) audioModule.duck(step.duck.bus, step.duck.amount, step.duck.ms);
        if (step.sound) {
            const options = step.soundOptions ? this.resolveSpec(step.soundOptions, run.context) : {};
            if (!Number.isFinite(options.pitch)) delete options.pitch;
            const handle = audioModule.play(step.sound, options);
            if (handle) run.sounds.push(handle);
        }
        fxList.forEach(spec => this.runFx(spec, run.context));

        // Traza para depurar la sincronía: frame, inicio real (ms) y coste del paso.
        this.trace.push({
            run: run.id,
            at: step.at,
            frame,
            time: startedAt,
            costMs: performance.now() - startedAt,
            sound: step.sound || null,
            fx: fxList.map(spec => spec.type)
        });
        if (this.trace.length > 80) this.trace.shift();
    },

    runFx(spec, context) {
        switch (spec.type) {
            case 'shake':
                return fxModule.shake(spec.intensity, spec.ms, spec.target ? fxModule.resolveElement(spec.target, context) : 'screen');
            case 'flash':
                return fxModule.flash(spec.color, spec.ms);
            case 'crack':
                return fxModule.crack(spec.target, spec.point, context);
            case 'burst': {
                const point = fxModule.resolvePoint(spec.point || 'center', context);
                // La cantidad respeta el perfil de rendimiento visual (móvil/equipos lentos).
                const quantity = spec.quantity ?? uiModule.scaleCelebrationCount(60);
                return fxModule.burst(point.x, point.y, spec.preset, { ms: spec.ms, quantity });
            }
            case 'shards':
                return fxModule.shards(spec.point, spec.count, context);
            case 'scramble':
                return fxModule.scramble(spec.target, spec.text, { ms: spec.ms, chars: spec.chars }, context);
            case 'odometer':
                return fxModule.odometer(spec.target, Number(spec.from), Number(spec.to), { ms: spec.ms, tick: spec.tick }, context);
            case 'pulse':
                return fxModule.pulse(spec.target, spec.scale, spec.ms, context);
            case 'glow':
                return fxModule.glow(spec.target, spec.color, spec.ms, context);
            case 'banner':
                return fxModule.banner(spec.text, { tone: spec.tone, ms: spec.ms });
            case 'freeze':
                return fxModule.freeze(spec.ms);
            case 'slowmo':
                return fxModule.slowmo(spec.factor, spec.ms);
            default:
                console.warn(`⚠️ Efecto desconocido: ${spec.type}`);
                return null;
        }
    },

    // === SALTAR / CANCELAR ===
    // Lleva la coreografía a su estado final: los pasos pendientes solo aplican su
    // estado final (sin sonido) y los sonidos en curso se apagan rápido.
    finishRun(run) {
        if (!this.runs.includes(run)) return;
        run.skipping = true;
        run.tl.progress(1);
        run.sounds.forEach(handle => handle.stop?.(150));
        fxModule.finishAll();
        this.endRun(run);
    },

    skip() {
        if (!this.isPlaying()) return false;
        [...this.runs].forEach(run => this.finishRun(run));
        return true;
    },

    list() {
        return Object.keys(CONFIG.CHOREOGRAPHIES);
    }
};

console.log('✅ FEEDBACK MODULE loaded');
