/**
 * MODULES/FX-SCENE.JS - Escena del prestige: "romper lo viejo"
 * Extiende fxModule con los efectos de la coreografía 'prestige' (CONFIG.CHOREOGRAPHIES.prestige).
 *
 * Estado seguro: cuando la escena empieza, gameState.performPrestige() ya se aplicó y se
 * guardó, y la UI nueva ya está armada detrás. Lo que se anima es una FOTO de la UI vieja
 * (captureSnapshot: un clon podado del DOM, tomado antes de tocar el estado), así que cerrar
 * la pestaña a mitad de la animación no pierde nada ni se duplica nada.
 *
 * Capas (de abajo arriba, dentro de .fx-layer):
 *   foto vieja → fondo negro (void) → destello / grietas → fragmentos / terminal / rótulos
 * El contenedor real se oculta (opacity 0) hasta la reconstrucción.
 *
 * Esc (feedbackModule.skip) llama a sceneEnd(): quita todo lo pasajero, devuelve el
 * contenedor real y deja los textos en su valor final.
 */

Object.assign(fxModule, {
    scene: null,

    isSceneActive() {
        return !!this.scene;
    },

    // Centro de un elemento (o de la pantalla si no se ve): punto de impacto del shatter.
    getImpactPoint(selector) {
        const element = document.querySelector(selector);
        if (this.isVisible(element)) {
            const rect = element.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    },

    // === FOTO DE LA UI VIEJA ===
    // Clon visual del contenedor principal. Se poda lo que no se ve (display:none, scripts):
    // menos nodos que clonar por fragmento. Sin html2canvas: es DOM real, no una imagen.
    captureSnapshot(selector = '.main-container') {
        if (!this.ready) return null;
        const root = document.querySelector(selector);
        if (!root) return null;
        const rect = root.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        const svgNs = 'http://www.w3.org/2000/svg';
        const alwaysKeep = new Set(['OPTION', 'OPTGROUP', 'SOURCE', 'TRACK']);
        const dropTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT']);
        const clone = root.cloneNode(true);
        const sources = [root, ...root.querySelectorAll('*')];
        const copies = [clone, ...clone.querySelectorAll('*')];
        const removed = new Set();
        const scrolls = [];

        for (let i = 1; i < sources.length; i++) {
            const source = sources[i];
            const copy = copies[i];
            if (removed.has(source.parentElement)) {
                removed.add(source);
                continue;
            }
            if (source.namespaceURI === svgNs) continue;
            const hidden = dropTags.has(source.tagName)
                || (!alwaysKeep.has(source.tagName) && source.getClientRects().length === 0 && getComputedStyle(source).display !== 'contents');
            if (hidden) {
                copy.remove();
                removed.add(source);
                continue;
            }
            if (source.scrollTop || source.scrollLeft) scrolls.push([copy, source.scrollTop, source.scrollLeft]);
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(source.tagName)) {
                copy.value = source.value;
                if ('checked' in source) copy.checked = source.checked;
            }
        }

        clone.classList.add('fx-ghost');
        clone.setAttribute('aria-hidden', 'true');
        clone.inert = true;
        Object.assign(clone.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            margin: '0',
            zIndex: 'auto',
            transform: 'none',
            pointerEvents: 'none'
        });
        return { node: clone, rect, scrolls, nodes: copies.length - removed.size };
    },

    // === DESPACHO ===
    runSceneFx(spec, context) {
        switch (spec.type) {
            case 'sceneStart': return this.sceneStart(spec, context);
            case 'shatterPrep': return this.sceneShatterPrep(context);
            case 'shatterFire': return this.sceneShatterFire(context);
            case 'void': return this.sceneVoid(1, spec.ms);
            case 'voidOff': return this.sceneVoid(0, spec.ms);
            case 'terminal': return this.sceneTerminal(spec, context);
            case 'assemble': return this.sceneAssemble(spec);
            case 'runBadge': return this.sceneRunBadge(context);
            case 'ambient': return this.sceneAmbient(spec.ms);
            case 'sceneEnd': return this.sceneEnd(context);
            default: return false;
        }
    },

    // === 0,0–2,5 s ANTICIPACIÓN ===
    sceneStart(spec, context) {
        this.sceneEnd(); // por si quedaba una escena a medias (sin disparar su callback)
        const reduced = this.isReducedMotion();
        const real = document.querySelector('.main-container');
        const snapshot = context.snapshot;
        const scene = this.scene = {
            context, real, reduced,
            ghost: null, void: null, prepared: null, tween: null, panels: [],
            locks: [], cards: [], editor: null, lines: null, editorBody: null, swap: null, swapped: false,
            lineNo: 0, currentLine: null, source: '', sourceIndex: 0, typedCarry: 0, lastTick: performance.now(), impacted: false
        };

        // Fondo negro: entre la foto vieja y el resto de efectos; los fragmentos vuelan por encima.
        const voidEl = document.createElement('div');
        voidEl.className = 'fx-void';
        gsap.set(voidEl, { opacity: 0 });
        this.layer.prepend(voidEl);
        scene.void = voidEl;

        if (snapshot?.node) {
            const ghost = snapshot.node;
            this.layer.prepend(ghost);
            snapshot.scrolls.forEach(([element, top, left]) => { element.scrollTop = top; element.scrollLeft = left; });
            scene.ghost = ghost;
            context.ghost = ghost;
            context.frame = this.getVisibleOrNull(ghost.querySelector('.panel-view-stack')) || ghost;
        } else {
            context.frame = real;
        }
        context.snapshot = null; // la foto ya vive en la escena

        // La UI real, ya con el estado nuevo, queda oculta hasta la reconstrucción. La
        // reputación y la insignia "Run N" conservan su valor viejo hasta entonces.
        if (real) {
            real.style.opacity = '0';
            real.style.pointerEvents = 'none';
        }
        const rep = document.getElementById('prestigePoints');
        if (rep) {
            if (Number.isFinite(context.fromRep)) rep.textContent = String(context.fromRep);
            this.lock(rep);
            scene.locks.push(rep);
        }
        const badge = document.getElementById('runBadge');
        if (badge) {
            badge.hidden = true;
            this.lock(badge);
            scene.locks.push(badge);
        }

        if (!scene.ghost) return null;
        if (!reduced) {
            scene.cards = [...scene.ghost.querySelectorAll(CONFIG.PRESTIGE_SCENE.TREMBLE_SELECTOR)].slice(0, CONFIG.PRESTIGE_SCENE.TREMBLE_MAX);
            this.prepareGhostEditor(scene);
        }
        const state = { p: 0 };
        scene.tween = gsap.to(state, {
            p: 1,
            duration: (spec.ms || 2500) / 1000,
            ease: 'power2.in',
            onUpdate: () => this.sceneTick(scene, state.p)
        });
        this.sceneTick(scene, 0);
        return scene.tween;
    },

    getVisibleOrNull(element) {
        return this.isVisible(element) ? element : null;
    },

    // El editor de la foto: si en la UI vieja se veía el panel de gestión (donde está el botón
    // de prestige), el editor "se abre solo" con un corte de glitch.
    prepareGhostEditor(scene) {
        const stack = scene.ghost.querySelector('.panel-view-stack');
        if (!stack) return;
        let editor = stack.querySelector('.editor-mock');
        if (!editor) {
            const live = document.getElementById('editorContentView');
            if (!live) return;
            const view = live.cloneNode(true);
            view.removeAttribute('id');
            view.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
            view.hidden = false;
            view.classList.add('active');
            view.style.display = 'none';
            const hide = [...stack.children];
            stack.appendChild(view);
            scene.swap = { hide, show: view };
            editor = view.querySelector('.editor-mock');
        }
        scene.editor = editor;
        scene.lines = editor?.querySelector('.code-lines') || null;
        scene.editorBody = editor?.querySelector('.editor-body') || null;
    },

    // Un fotograma de la anticipación (p = 0–1): desaturación, temblor, escritura y glitch.
    sceneTick(scene, p) {
        if (this.scene !== scene || scene.impacted || !scene.ghost) return;
        const saturation = (CONFIG.PRESTIGE_SCENE.DESATURATE * p).toFixed(3);
        scene.ghost.style.filter = `grayscale(${saturation}) brightness(${(1 - (0.3 * p)).toFixed(3)})`;
        if (scene.reduced) return;

        // Las tarjetas tiemblan cada vez más.
        const amplitude = 0.2 + (3.6 * p * p);
        scene.cards.forEach(card => {
            card.style.translate = `${((Math.random() * 2 - 1) * amplitude).toFixed(2)}px ${((Math.random() * 2 - 1) * amplitude * 0.7).toFixed(2)}px`;
        });

        if (scene.editor) {
            // Corte de glitch: el editor aparece (si estaba oculto) y empieza a escribir.
            if (!scene.swapped && p >= 0.2) {
                scene.swapped = true;
                if (scene.swap) {
                    scene.swap.hide.forEach(node => { node.style.display = 'none'; });
                    scene.swap.show.style.display = '';
                }
                this.glitch(scene.editor, 160);
            }
            if (scene.swapped) {
                const { FROM, TO } = CONFIG.PRESTIGE_SCENE.TYPING_RATE;
                const now = performance.now();
                const dt = Math.min(0.05, (now - scene.lastTick) / 1000);
                scene.lastTick = now;
                scene.typedCarry += (FROM + ((TO - FROM) * p * p)) * dt;
                const count = Math.floor(scene.typedCarry);
                scene.typedCarry -= count;
                this.typeGhostChars(scene, count);
                if (Math.random() < 0.02 + (0.12 * p * p)) this.glitch(scene.editor, 70 + (Math.random() * 90));
            }
        }
    },

    typeGhostChars(scene, count) {
        if (!scene.lines || count <= 0) return;
        const pool = CONFIG.PRESTIGE_SCENE.TYPING_LINES;
        for (let i = 0; i < count; i++) {
            if (!scene.currentLine) {
                const row = document.createElement('div');
                row.className = 'code-line';
                const number = document.createElement('span');
                number.className = 'line-num';
                number.textContent = String(++scene.lineNo + 40);
                const code = document.createElement('span');
                code.className = 'code';
                row.append(number, code);
                scene.lines.appendChild(row);
                scene.currentLine = code;
                scene.source = pool[Math.floor(Math.random() * pool.length)];
                scene.sourceIndex = 0;
                while (scene.lines.children.length > 60) scene.lines.firstElementChild.remove();
            }
            scene.currentLine.textContent += scene.source[scene.sourceIndex++];
            if (scene.sourceIndex >= scene.source.length) scene.currentLine = null;
        }
        if (scene.editorBody) scene.editorBody.scrollTop = scene.editorBody.scrollHeight;
    },

    // === 2,5–2,8 s TENSIÓN / 2,8 s IMPACTO ===
    // Los clones de los fragmentos se construyen durante el freeze (invisibles) para que el
    // impacto no cargue con ese coste.
    sceneShatterPrep(context) {
        const scene = this.scene;
        if (!scene?.ghost) return null;
        this.checkFps(); // si la animación va floja, piezas mínimas y sin blur
        scene.prepared = this.shatter(scene.ghost, context.impact, context, { prepare: true });
        return scene.prepared;
    },

    sceneShatterFire(context) {
        const scene = this.scene;
        if (!scene) return null;
        scene.impacted = true;
        this.clearCracks();
        if (!scene.ghost) return null;
        const handle = scene.prepared || this.shatter(scene.ghost, context.impact, context, { prepare: true });
        scene.prepared = null;
        const fired = handle ? handle.fire() : null;
        // La foto ya no hace falta (los fragmentos son sus clones): fuera del DOM, menos que recalcular.
        if (!scene.reduced) scene.ghost.remove(); // con movimiento reducido se desvanece primero
        return fired;
    },

    // === 3,0–4,0 s VACÍO ===
    sceneVoid(opacity, ms = 300) {
        const scene = this.scene;
        if (!scene?.void) return null;
        const seconds = (opacity === 1 && scene.reduced) ? 0.6 : ms / 1000;
        gsap.killTweensOf(scene.void);
        return gsap.to(scene.void, { opacity, duration: seconds, ease: 'power2.out' });
    },

    // Terminal que escribe sola "git checkout -b run-N" (clicks de teclado y un beep).
    sceneTerminal(spec, context) {
        const config = CONFIG.PRESTIGE_SCENE.TERMINAL;
        const runNumber = context.runNumber ?? ((gameState.prestigeLevel || 0) + 1);
        const command = config.COMMAND.replace('{n}', runNumber);
        const output = config.OUTPUT.replace('{n}', runNumber);

        const terminal = document.createElement('div');
        terminal.className = 'fx-terminal';
        const bar = document.createElement('div');
        bar.className = 'fx-terminal-bar';
        bar.innerHTML = '<i></i><i></i><i></i><span>bash</span>';
        const body = document.createElement('div');
        body.className = 'fx-terminal-body';
        const line = document.createElement('div');
        const prompt = document.createElement('span');
        prompt.className = 'fx-term-prompt';
        prompt.textContent = config.PROMPT;
        const typed = document.createElement('span');
        const cursor = document.createElement('span');
        cursor.className = 'fx-term-cursor';
        line.append(prompt, typed, cursor);
        const result = document.createElement('div');
        result.className = 'fx-term-out';
        body.append(line, result);
        terminal.append(bar, body);
        this.layer.appendChild(terminal);
        this.transient.add(terminal);

        const totalMs = spec.ms || 1000;
        const typeMs = totalMs * (spec.fast ? 0.55 : 0.6);
        const hold = Math.max(0.05, (totalMs - typeMs) / 1000 - 0.38);
        const counter = { n: 0 };
        let shown = 0;
        let lastClick = 0;
        const timeline = gsap.timeline({ onComplete: () => this.removeTransient(terminal) });
        timeline
            .fromTo(terminal, { opacity: 0, y: this.isReducedMotion() ? 0 : 10 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out', immediateRender: true })
            .to(counter, {
                n: command.length,
                duration: typeMs / 1000,
                ease: 'none',
                onUpdate: () => {
                    const next = Math.floor(counter.n);
                    if (next === shown) return;
                    shown = next;
                    typed.textContent = command.slice(0, shown);
                    const now = performance.now();
                    if (now - lastClick > 30) {
                        lastClick = now;
                        audioModule.play('ui_click', { volume: 0.55, pitch: (Math.random() * 4) - 2 });
                    }
                }
            })
            .call(() => {
                typed.textContent = command;
                audioModule.play('ui_beep', { volume: 0.6 });
                result.textContent = output;
            })
            .to(terminal, { opacity: 0, duration: 0.2, ease: 'power1.in' }, `+=${hold}`);
        terminal._fxTweens = [timeline];
        return timeline;
    },

    // === 4,0–5,5 s RECONSTRUCCIÓN ===
    // La UI nueva se arma: cada panel vuela a su lugar en cascada con su whoosh.
    sceneAssemble(spec) {
        const scene = this.scene;
        const real = scene?.real || document.querySelector('.main-container');
        if (!real) return null;
        const panels = CONFIG.PRESTIGE_SCENE.PANELS.map(selector => document.querySelector(selector)).filter(element => this.isVisible(element));
        const reduced = this.isReducedMotion();

        if (reduced) {
            // Fundido de entrada, con el mismo sonido.
            audioModule.play('ui_whoosh', { volume: 0.75 });
            gsap.killTweensOf(real);
            return gsap.fromTo(real, { opacity: 0 }, { opacity: 1, duration: Math.max(0.4, (spec.ms || 900) / 2000), ease: 'power2.out', immediateRender: true, clearProps: 'opacity' });
        }

        const lite = this.isLite();
        const blurFrom = lite ? 'none' : 'blur(10px)';
        const blurTo = lite ? 'none' : 'blur(0px)';
        gsap.killTweensOf(real);
        gsap.set(real, { opacity: 1 });
        gsap.set(panels, { opacity: 0, y: 80, scale: 0.97, filter: blurFrom });
        if (scene) scene.panels = panels;

        const timeline = gsap.timeline({ onComplete: () => gsap.set(panels, { clearProps: 'opacity,transform,filter' }) });
        const stagger = spec.stagger ?? 0.2;
        panels.forEach((panel, index) => {
            timeline.to(panel, { opacity: 1, y: 0, scale: 1, filter: blurTo, duration: spec.duration ?? 0.6, ease: 'power3.out' }, index * stagger);
            timeline.call(() => audioModule.play('ui_whoosh', { volume: 0.75, pitch: index * 2 }), [], index * stagger);
        });
        return timeline;
    },

    // === 5,5–8,0 s CALMA ===
    sceneRunBadge(context) {
        const badge = document.getElementById('runBadge');
        if (!badge) return null;
        delete badge.dataset.fxLock;
        if (this.scene) this.scene.locks = this.scene.locks.filter(element => element !== badge);
        uiModule.updateRunBadge?.();
        if (badge.hidden) return null;
        return gsap.fromTo(badge,
            { scale: 0.4, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.55, ease: window.CustomEase ? 'fxImpact' : 'back.out(2)', immediateRender: true, clearProps: 'transform,opacity' });
    },

    // Partículas que flotan hacia arriba (DOM + transform/opacity). Sin ellas con "Reducir movimiento".
    sceneAmbient(ms = 2500) {
        if (!this.ready || this.isReducedMotion()) return null;
        const total = this.isLite() ? Math.round(CONFIG.PRESTIGE_SCENE.MOTES / 2) : CONFIG.PRESTIGE_SCENE.MOTES;
        const timeline = gsap.timeline();
        for (let i = 0; i < total; i++) {
            const mote = document.createElement('div');
            mote.className = 'fx-mote';
            const size = 2 + (Math.random() * 4);
            mote.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(60 + (Math.random() * 40)).toFixed(1)}%;width:${size}px;height:${size}px;opacity:0`;
            this.layer.appendChild(mote);
            this.transient.add(mote);
            // Todas terminan antes de `ms` (delay máx. 0,2·ms + duración máx. 0,8·ms).
            const duration = Math.max(0.5, (ms / 1000) * (0.5 + (Math.random() * 0.3)));
            const delay = Math.random() * (ms / 1000) * 0.2;
            timeline.fromTo(mote, { y: 0, x: 0, opacity: 0 }, {
                y: -(120 + (Math.random() * 260)),
                x: (Math.random() - 0.5) * 80,
                duration,
                ease: 'sine.out'
            }, delay);
            timeline.to(mote, { keyframes: { opacity: [0, 0.8, 0] }, duration, ease: 'none' }, delay);
        }
        timeline.call(() => [...this.transient].filter(node => node.classList?.contains('fx-mote')).forEach(node => this.removeTransient(node)));
        return timeline;
    },

    // === FIN (también al saltar con Esc) ===
    // Deja todo en su estado final: quita foto, fondo y fragmentos, devuelve el contenedor
    // real, suelta los textos retenidos y llama a context.onSceneEnd una sola vez.
    sceneEnd(context = null) {
        const scene = this.scene;
        const target = scene?.context || context;
        if (scene) {
            this.scene = null;
            scene.tween?.kill();
            scene.prepared?.cancel();
            this.clearCracks();
            [scene.ghost, scene.void].forEach(node => {
                if (!node) return;
                gsap.killTweensOf(node);
                node.remove();
            });
            if (scene.editor) this.clearGlitch(scene.editor);
            // Lo que haya quedado de la escena (partículas, terminal): fuera.
            [...this.transient].filter(node => node.classList?.contains('fx-mote') || node.classList?.contains('fx-terminal'))
                .forEach(node => this.removeTransient(node));
            if (scene.real) {
                gsap.killTweensOf(scene.real);
                scene.real.style.opacity = '';
                scene.real.style.pointerEvents = '';
                gsap.set(scene.real, { clearProps: 'opacity,transform,filter' });
            }
            const panels = scene.panels.length ? scene.panels : CONFIG.PRESTIGE_SCENE.PANELS.map(selector => document.querySelector(selector)).filter(Boolean);
            gsap.killTweensOf(panels);
            gsap.set(panels, { clearProps: 'opacity,transform,filter' });
            scene.locks.forEach(element => { delete element.dataset.fxLock; });
            uiModule.update?.();
            uiModule.updateRunBadge?.();
        }
        if (target) this.runCallback('onSceneEnd', target);
        return null;
    }
});

console.log('✅ FX SCENE MODULE loaded');
