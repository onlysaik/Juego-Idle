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
    lastAutoAt: {},
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
            // Sin GSAP: el sonido de cada paso y el estado final de sus efectos.
            const steps = this.pickSteps(definition, context, false);
            steps.forEach(step => {
                const sound = this.resolveValue(step.sound, context);
                if (sound) audioModule.play(sound, { delay: step.at });
            });
            this.applyFinalStates(steps, context);
            return 'audio-only';
        }

        const { big, medium } = CONFIG.FEEDBACK.PRIORITIES;
        let priority = this.getPriority(definition);
        const bigRunning = this.runs.some(run => run.priority >= big);

        // Lo que dispara el juego solo nunca pasa del nivel pequeño ni se repite seguido.
        if (context.auto) {
            const now = performance.now();
            if (now - (this.lastAutoAt[id] ?? -Infinity) < CONFIG.FEEDBACK.AUTO_MIN_GAP_MS) return false;
            this.lastAutoAt[id] = now;
            priority = Math.min(priority, CONFIG.FEEDBACK.PRIORITIES[CONFIG.FEEDBACK.AUTO_MAX_PRIORITY]);
        }

        if (priority >= big) {
            if (bigRunning) {
                this.bigQueue.push({ id, context });
                return 'queued';
            }
            // Un momento grande cancela los pequeños y medianos en curso (y los
            // medianos en espera), dejándolos en su estado final.
            this.runs.filter(run => run.priority < big).forEach(run => this.finishRun(run));
            this.mediumQueue.splice(0).forEach(entry => this.discard(entry));
            return this.start(id, definition, context, priority);
        }

        if (priority === medium) {
            const now = performance.now();
            const mustWait = bigRunning
                || this.runs.some(run => run.priority === medium)
                || now - this.lastMediumStart < CONFIG.FEEDBACK.MEDIUM_MIN_GAP_MS
                || this.mediumQueue.length > 0;
            if (mustWait) {
                if (this.mediumQueue.length >= CONFIG.FEEDBACK.MEDIUM_QUEUE_MAX) {
                    this.discard({ id, context });
                    return false;
                }
                this.mediumQueue.push({ id, context });
                return 'queued';
            }
            return this.start(id, definition, context, priority);
        }

        // Pequeños: se descartan durante un momento grande.
        if (bigRunning) {
            this.discard({ id, context });
            return false;
        }
        return this.start(id, definition, context, priority);
    },

    // Versión a usar: auto (disparada por el juego), corta (vista ya varias veces o
    // "Celebraciones cortas") o completa.
    pickSteps(definition, context, useShort) {
        if (context.auto) return definition.auto || definition.short || definition.steps;
        return useShort ? definition.short : definition.steps;
    },

    // Una coreografía que no llega a sonar (cola llena, cancelada por un momento
    // grande) deja igualmente su estado final: textos, tier, avisos pendientes.
    discard(entry) {
        const definition = CONFIG.CHOREOGRAPHIES[entry.id];
        if (!definition) return;
        this.applyFinalStates(this.pickSteps(definition, entry.context, false), entry.context);
    },

    applyFinalStates(steps, context) {
        steps.forEach(step => [].concat(step.fx || []).forEach(spec => {
            fxModule.applyFinalState(this.resolveSpec(spec, context), context);
        }));
    },

    start(id, definition, context, priority) {
        const previousViews = gameState.seenChoreographies[id] || 0;
        if (!context.auto) gameState.recordChoreographyView(id);
        const useShort = Boolean(definition.short)
            && (gameState.visualSettings.shortCelebrations || previousViews >= (definition.shortAfterViews ?? CONFIG.FEEDBACK.SHORT_AFTER_VIEWS));
        const steps = this.pickSteps(definition, context, useShort);

        const run = {
            id,
            priority,
            short: useShort || Boolean(context.auto),
            context,
            sounds: [],
            skipping: false,
            startedAt: performance.now(),
            duration: this.getVisualDuration(steps, context),
            tl: gsap.timeline({ paused: true })
        };
        steps.forEach(step => run.tl.call(() => this.runStep(run, step), [], step.at / 1000));
        run.tl.call(() => {}, [], run.duration / 1000);

        if (priority === CONFIG.FEEDBACK.PRIORITIES.medium) this.lastMediumStart = run.startedAt;
        // Momentos grandes: se vigilan los fps para pasar a modo ligero si hace falta, y la
        // música baja hasta la calma (el prestige la corta y la devuelve él mismo).
        if (priority >= CONFIG.FEEDBACK.PRIORITIES.big) {
            fxModule.fpsStart?.();
            if (!definition.noAutoDuck) audioModule.duck('music', CONFIG.MUSIC.BIG_DUCK, run.duration);
        }
        this.runs.push(run);
        // Los pasos en t=0 se lanzan ya, en el mismo frame que la acción que los dispara.
        run.tl.totalTime(0.0001);
        return run;
    },

    // Duración visual: último paso + la duración de su efecto más largo.
    getVisualDuration(steps, context = {}) {
        return steps.reduce((max, step) => {
            const fxList = [].concat(step.fx || []);
            const fxMs = fxList.reduce((longest, spec) => {
                const ms = Number(this.resolveValue(spec.ms, context));
                return Math.max(longest, Number.isFinite(ms) ? ms : 400);
            }, 0);
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
        if (!this.runs.some(item => item.priority >= CONFIG.FEEDBACK.PRIORITIES.big)) fxModule.fpsStop?.();
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
        // Cada efecto se resuelve justo antes de lanzarse: uno puede dejar en el
        // contexto lo que usa el siguiente (encrypt → label, pipeline → pipelineEl).
        const specs = [].concat(step.fx || []);

        // Al saltar: sin sonido ni efectos pasajeros, solo el estado final.
        if (run.skipping) {
            specs.forEach(spec => fxModule.applyFinalState(this.resolveSpec(spec, run.context), run.context));
            return;
        }

        const frame = gsap.ticker.frame;
        const startedAt = performance.now();
        const sound = this.resolveValue(step.sound, run.context);
        [].concat(step.duck || []).forEach(duck => audioModule.duck(duck.bus, duck.amount, duck.ms));
        if (sound) this.playStepSound(run, sound, step);
        const fxTypes = specs.map(spec => {
            const resolved = this.resolveSpec(spec, run.context);
            this.runFx(resolved, run.context);
            return resolved.type;
        });

        // Traza para depurar la sincronía: frame, inicio real (ms) y coste del paso.
        this.trace.push({
            run: run.id,
            at: step.at,
            frame,
            time: startedAt,
            costMs: performance.now() - startedAt,
            sound: sound || null,
            fx: fxTypes
        });
        if (this.trace.length > 80) this.trace.shift();
    },

    // Sonido del paso. cutAt corta con un fundido corto (el silencio antes del
    // impacto); soundRepeat lo repite subiendo de tono (clicks ascendentes).
    playStepSound(run, sound, step) {
        const options = step.soundOptions ? this.resolveSpec(step.soundOptions, run.context) : {};
        const { cutAt } = options;
        delete options.cutAt;
        if (!Number.isFinite(options.pitch)) delete options.pitch;
        if (!Number.isFinite(options.volume)) delete options.volume;

        const plays = [];
        const repeat = step.soundRepeat;
        if (repeat) {
            for (let i = 0; i < repeat.count; i++) {
                plays.push({
                    ...options,
                    pitch: (options.pitch || 0) + (i * (repeat.pitchStep || 0)),
                    volume: repeat.volume ?? options.volume,
                    delay: i * repeat.every
                });
            }
        } else {
            plays.push(options);
        }

        plays.forEach(playOptions => {
            const handle = audioModule.play(sound, playOptions);
            if (!handle) return;
            run.sounds.push(handle);
            if (Number.isFinite(cutAt)) {
                // Temporizador real: el corte no debe alargarse con un slowmo.
                setTimeout(() => handle.stop?.(50), cutAt + (playOptions.delay || 0));
            }
        });
    },

    runFx(spec, context) {
        switch (spec.type) {
            case 'shake':
                return fxModule.shake(spec.intensity, spec.ms, spec.target ? fxModule.resolveElement(spec.target, context) : 'screen');
            case 'flash':
                return fxModule.flash(spec.color, spec.ms);
            case 'crack':
                return fxModule.crack(spec.target, spec.point, context, { persist: spec.persist, reach: spec.reach });
            case 'burst': {
                const point = fxModule.resolvePoint(spec.point || 'center', context);
                // La cantidad respeta el perfil de rendimiento visual (móvil/equipos lentos).
                const quantity = uiModule.scaleCelebrationCount(Number.isFinite(spec.quantity) ? spec.quantity : 60);
                return fxModule.burst(point.x, point.y, spec.preset, { ms: spec.ms, quantity, colors: spec.colors });
            }
            case 'shatter':
                return fxModule.shatter(spec.target, spec.point, context, {
                    pieces: spec.pieces,
                    restoreMs: spec.restoreMs,
                    onRestore: spec.reveal ? () => fxModule.reveal(context.element, context) : null
                });
            case 'charge':
                return fxModule.charge(spec.target, spec.ms, spec.color, context);
            case 'stamp':
                return fxModule.stamp(spec.target, spec.text, { ms: spec.ms }, context);
            case 'floater':
                return fxModule.floater(spec.target, spec.text, context);
            case 'sparks':
                return fxModule.sparks(spec.target, spec.count, spec.level, context);
            case 'coins':
                return fxModule.coins(spec.point, spec.target, spec.count, spec, context);
            case 'encrypt':
                return fxModule.encrypt(spec.target, context);
            case 'reveal':
                return fxModule.reveal(spec.target, context);
            case 'pipeline':
                return fxModule.pipeline(spec.target, spec.ms, context);
            case 'pipelineStage':
                return fxModule.pipelineStage(spec.index, spec.status, context);
            case 'rocket':
                return fxModule.rocket(spec.point, context);
            case 'glitch':
                return fxModule.glitch(spec.target, spec.ms, context);
            case 'tier':
                return uiModule.setCodeTier(spec.power);
            case 'callback':
                return fxModule.runCallback(spec.name, context);
            case 'music':
                return musicModule.handle(spec);
            case 'scramble':
                return fxModule.scramble(spec.target, spec.text, { ms: spec.ms, chars: spec.chars }, context);
            case 'odometer':
                return fxModule.odometer(spec.target, Number(spec.from), Number(spec.to), { ms: spec.ms, tick: spec.tick }, context);
            case 'pulse':
                return fxModule.pulse(spec.target, spec.scale, spec.ms, context, spec.ease);
            case 'glow':
                return fxModule.glow(spec.target, spec.color, spec.ms, context);
            case 'banner':
                return fxModule.banner(spec.text, { tone: spec.tone, ms: spec.ms });
            case 'freeze':
                return fxModule.freeze(spec.ms);
            case 'slowmo':
                return fxModule.slowmo(spec.factor, spec.ms);
            default:
                // Efectos de la escena del prestige (fx-scene.js).
                if (fxModule.runSceneFx?.(spec, context) !== false) return null;
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
