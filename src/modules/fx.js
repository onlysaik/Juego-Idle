/**
 * MODULES/FX.JS - Efectos visuales sobre GSAP (+ tsParticles)
 * shake, flash, crack (DrawSVG), burst (tsParticles), shards (Physics2D),
 * scramble (ScrambleText), banner (SplitText), odometer, pulse, glow,
 * freeze y slowmo.
 *
 * Reglas:
 * - Cada efecto aplica su primer estado de forma síncrona (gsap.set / fromTo),
 *   para que se pinte en el mismo frame que el sonido que lo acompaña.
 * - freeze/slowmo solo tocan lo visual (gsap.globalTimeline y las animaciones
 *   CSS/WAAPI). La economía usa Date.now() en el game loop y no se ve afectada.
 * - Con "Reducir movimiento": sin sacudidas, cámara lenta, congelados,
 *   grietas, fragmentos ni partículas. Solo destellos suaves, fundidos y sonido.
 */

const fxModule = window.fxModule = {
    ready: false,
    layer: null,
    flashEl: null,
    crackSvg: null,
    timeEffects: [],      // { factor, until } activos (freeze = factor 0)
    timeRestoreTimer: null,
    statefulTweens: new Set(), // scramble/odometer: se completan al saltar
    transient: new Set(),      // nodos temporales (grietas, fragmentos, banners)
    particleContainers: new Set(),
    presetsLoaded: null,
    burstCounter: 0,

    init() {
        if (typeof gsap === 'undefined') {
            console.warn('⚠️ GSAP no disponible: efectos visuales desactivados');
            return;
        }
        const plugins = [window.ScrambleTextPlugin, window.SplitText, window.Physics2DPlugin, window.CustomEase, window.DrawSVGPlugin].filter(Boolean);
        gsap.registerPlugin(...plugins);
        if (window.CustomEase) {
            CustomEase.create('fxImpact', 'M0,0 C0.12,0.9 0.28,1.12 0.48,1.02 0.66,0.96 0.82,1 1,1');
            CustomEase.create('fxSnap', 'M0,0 C0.2,0 0.1,1 1,1');
        }

        this.layer = document.createElement('div');
        this.layer.className = 'fx-layer';
        this.layer.setAttribute('aria-hidden', 'true');
        this.flashEl = document.createElement('div');
        this.flashEl.className = 'fx-flash';
        this.crackSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.crackSvg.setAttribute('class', 'fx-cracks');
        this.layer.append(this.flashEl, this.crackSvg);
        document.body.appendChild(this.layer);
        this.ready = true;
    },

    // Precalentamiento (en tiempo libre, tras la primera interacción): el primer
    // pintado con destello, grietas SVG con filtro, fragmentos y rótulo cuesta un
    // frame largo (capas, filtros, fuentes). Se paga aquí, de forma invisible,
    // y no en mitad de la primera celebración. También registra los presets de partículas.
    warmUp() {
        if (!this.ready || this.warmedUp) return;
        this.warmedUp = true;
        const idle = window.requestIdleCallback || (callback => setTimeout(callback, 200));
        idle(() => {
            this.ensurePresets();
            gsap.set(this.flashEl, { opacity: 0.001, backgroundColor: 'rgba(0, 0, 0, 0.01)' });

            const svgNs = 'http://www.w3.org/2000/svg';
            const group = document.createElementNS(svgNs, 'g');
            group.style.opacity = '0.001';
            const path = document.createElementNS(svgNs, 'path');
            path.setAttribute('d', 'M-50,-50 L-40,-40 L-45,-30');
            path.setAttribute('class', 'fx-crack-line');
            group.appendChild(path);
            this.crackSvg.appendChild(group);
            if (window.DrawSVGPlugin) gsap.set(path, { drawSVG: '0% 50%' });

            const shard = document.createElement('div');
            shard.className = 'fx-shard';
            shard.style.cssText = 'left:-100px;top:-100px;width:10px;height:10px;opacity:0.001';
            const banner = document.createElement('div');
            banner.className = 'fx-banner fx-banner-gold';
            banner.style.opacity = '0.001';
            banner.textContent = 'warm';
            this.layer.append(shard, banner);
            if (window.SplitText) new SplitText(banner, { type: 'chars' });

            // Dos frames después (ya pintado una vez), se limpia.
            requestAnimationFrame(() => requestAnimationFrame(() => {
                gsap.set(this.flashEl, { opacity: 0 });
                group.remove();
                shard.remove();
                banner.remove();
            }));
        }, { timeout: 1500 });
    },

    ensurePresets() {
        if (this.presetsLoaded || typeof tsParticles === 'undefined') return this.presetsLoaded;
        this.presetsLoaded = Promise.all([
            typeof loadFireworksPreset === 'function' ? loadFireworksPreset(tsParticles) : null,
            typeof loadConfettiExplosionsPreset === 'function' ? loadConfettiExplosionsPreset(tsParticles) : null
        ]);
        return this.presetsLoaded;
    },

    // === PREFERENCIAS ===
    isReducedMotion() {
        const setting = gameState.visualSettings?.reduceMotion;
        if (typeof setting === 'boolean') return setting;
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    },

    // === RESOLUCIÓN DE DESTINOS Y PUNTOS ===
    resolveElement(target, context = {}) {
        if (!target) return null;
        if (target instanceof Element) return target;
        if (target === 'context') return context.element || null;
        if (target === 'screen') return document.querySelector('.main-container') || document.body;
        return document.querySelector(target);
    },

    resolvePoint(point, context = {}) {
        if (point === 'context' && Number.isFinite(context.x) && Number.isFinite(context.y)) {
            return { x: context.x, y: context.y };
        }
        const element = point === 'center' ? null : this.resolveElement(point === 'context' ? 'context' : point, context);
        if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.width || rect.height) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    },

    // === EFECTOS ===
    // shake(intensidad 0–1, ms, destino): sacudida que decae. Pantalla por defecto.
    shake(intensity = 0.5, ms = 300, target = 'screen') {
        if (!this.ready || this.isReducedMotion()) return null;
        const element = this.resolveElement(target);
        if (!element) return null;

        const amplitude = (element.classList.contains('main-container') ? 4 : 2) + (intensity * 12);
        const steps = Math.max(3, Math.round(ms / 40));
        gsap.killTweensOf(element, 'x,y,rotation');
        const timeline = gsap.timeline({ onComplete: () => gsap.set(element, { clearProps: 'transform' }) });
        // Primer desplazamiento inmediato (mismo frame que el sonido).
        gsap.set(element, { x: (Math.random() * 2 - 1) * amplitude, y: (Math.random() * 2 - 1) * amplitude * 0.6 });
        for (let i = 1; i <= steps; i++) {
            const decay = 1 - (i / steps);
            timeline.to(element, {
                x: (Math.random() * 2 - 1) * amplitude * decay,
                y: (Math.random() * 2 - 1) * amplitude * 0.6 * decay,
                rotation: (Math.random() * 2 - 1) * intensity * 0.6 * decay,
                duration: ms / steps / 1000,
                ease: 'none'
            });
        }
        timeline.to(element, { x: 0, y: 0, rotation: 0, duration: 0.04 });
        return timeline;
    },

    // flash(color, ms): destello a pantalla completa que se desvanece.
    flash(color = 'rgba(255, 255, 255, 0.4)', ms = 300) {
        if (!this.ready) return null;
        const soft = this.isReducedMotion();
        gsap.killTweensOf(this.flashEl);
        return gsap.fromTo(this.flashEl,
            { opacity: soft ? 0.5 : 1, backgroundColor: color },
            { opacity: 0, duration: (soft ? ms * 1.6 : ms) / 1000, ease: 'power2.out' });
    },

    // crack(elemento, puntoDeImpacto): grietas SVG que se dibujan (DrawSVG) desde el impacto.
    crack(target, point = null, context = {}) {
        if (!this.ready || this.isReducedMotion()) return null;
        const element = this.resolveElement(target, context);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const origin = point ? this.resolvePoint(point, context) : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

        const svgNs = 'http://www.w3.org/2000/svg';
        const group = document.createElementNS(svgNs, 'g');
        const clipId = `fxClip${++this.burstCounter}`;
        const clip = document.createElementNS(svgNs, 'clipPath');
        clip.setAttribute('id', clipId);
        const clipRect = document.createElementNS(svgNs, 'rect');
        Object.entries({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, rx: 12 }).forEach(([k, v]) => clipRect.setAttribute(k, v));
        clip.appendChild(clipRect);
        group.appendChild(clip);
        group.setAttribute('clip-path', `url(#${clipId})`);

        const reach = Math.max(rect.width, rect.height) * 0.75;
        const branches = 5 + Math.floor(Math.random() * 3);
        const paths = [];
        for (let b = 0; b < branches; b++) {
            let angle = (Math.PI * 2 * b / branches) + (Math.random() - 0.5) * 0.6;
            let x = origin.x;
            let y = origin.y;
            let d = `M${x.toFixed(1)},${y.toFixed(1)}`;
            const segments = 5 + Math.floor(Math.random() * 4);
            for (let s = 0; s < segments; s++) {
                angle += (Math.random() - 0.5) * 0.9;
                const length = (reach / segments) * (0.6 + Math.random() * 0.8);
                x += Math.cos(angle) * length;
                y += Math.sin(angle) * length;
                d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
            }
            // Halo = segundo trazo ancho y translúcido (un filter: drop-shadow costaba
            // ~18 ms por frame al rasterizar el SVG a pantalla completa).
            const width = 1 + Math.random() * 1.6;
            const glow = document.createElementNS(svgNs, 'path');
            glow.setAttribute('d', d);
            glow.setAttribute('class', 'fx-crack-glow');
            glow.style.strokeWidth = (width + 4).toFixed(2);
            const path = document.createElementNS(svgNs, 'path');
            path.setAttribute('d', d);
            path.setAttribute('class', 'fx-crack-line');
            path.style.strokeWidth = width.toFixed(2);
            group.append(glow, path);
            paths.push(glow, path);
        }
        this.crackSvg.appendChild(group);
        this.transient.add(group);

        gsap.set(paths, { drawSVG: '0%' });
        return gsap.timeline({ onComplete: () => this.removeTransient(group) })
            .to(paths, { drawSVG: '100%', duration: 0.28, stagger: 0.03, ease: 'power3.out' })
            .to(group, { opacity: 0, duration: 0.5 }, '+=0.55');
    },

    // burst(x, y, preset): partículas tsParticles ('fireworks' o 'confettiExplosions').
    async burst(x, y, preset = 'confettiExplosions', options = {}) {
        if (!this.ready || this.isReducedMotion() || typeof tsParticles === 'undefined') return null;
        await this.ensurePresets();

        const { ms = 1500 } = options;
        const holder = document.createElement('div');
        holder.className = 'fx-particles';
        holder.id = `fxParticles${++this.burstCounter}`;
        this.layer.appendChild(holder);

        const particleOptions = {
            preset,
            fullScreen: { enable: false },
            background: { color: { value: 'transparent' } },
            detectRetina: true,
            fpsLimit: 60
        };
        if (preset === 'confettiExplosions') {
            // Una sola explosión en el punto pedido (el preset repite al azar).
            particleOptions.emitters = {
                position: { x: (x / window.innerWidth) * 100, y: (y / window.innerHeight) * 100 },
                life: { count: 1, duration: 0.1, delay: 0 },
                rate: { delay: 0, quantity: options.quantity || 60 }
            };
        }
        if (preset === 'fireworks') {
            particleOptions.sounds = { enable: false }; // el sonido lo pone la coreografía
        }

        let container = null;
        try {
            container = await tsParticles.load({ id: holder.id, element: holder, options: particleOptions });
        } catch (error) {
            console.warn('⚠️ tsParticles no pudo crear la explosión:', error);
            holder.remove();
            return null;
        }
        const record = { container, holder };
        this.particleContainers.add(record);
        record.timer = setTimeout(() => this.destroyParticles(record), ms + 1200);
        return container;
    },

    destroyParticles(record) {
        clearTimeout(record.timer);
        try { record.container?.destroy(); } catch (error) { /* ya destruido */ }
        record.holder.remove();
        this.particleContainers.delete(record);
    },

    // shards(punto, n): fragmentos que salen despedidos con Physics2D.
    shards(point = 'center', count = 20, context = {}) {
        if (!this.ready || this.isReducedMotion() || !window.Physics2DPlugin) return null;
        const origin = this.resolvePoint(point, context);
        const pieces = [];
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'fx-shard';
            piece.style.left = `${origin.x}px`;
            piece.style.top = `${origin.y}px`;
            const size = 6 + Math.random() * 16;
            piece.style.width = `${size}px`;
            piece.style.height = `${size * (0.6 + Math.random())}px`;
            this.layer.appendChild(piece);
            this.transient.add(piece);
            pieces.push(piece);
        }
        return gsap.timeline({ onComplete: () => pieces.forEach(piece => this.removeTransient(piece)) })
            .to(pieces, {
                physics2D: {
                    velocity: () => 350 + Math.random() * 650,
                    angle: () => Math.random() * 360,
                    gravity: 1100
                },
                rotation: () => (Math.random() - 0.5) * 900,
                opacity: 0,
                duration: 1.3,
                ease: 'none'
            });
    },

    // scramble(elemento, textoFinal): el texto se descifra hasta el valor final.
    scramble(target, text, options = {}, context = {}) {
        const element = this.resolveElement(target, context);
        if (!element || text === undefined || text === null) return null;
        const finalText = String(text);
        const { ms = 700, chars = '01<>{}[]/\\#$%&*' } = options;

        if (!this.ready || !window.ScrambleTextPlugin || this.isReducedMotion()) {
            element.textContent = finalText;
            if (this.ready) gsap.fromTo(element, { opacity: 0.2 }, { opacity: 1, duration: 0.3 });
            return null;
        }

        this.lock(element);
        gsap.killTweensOf(element, 'scrambleText');
        const tween = gsap.to(element, {
            duration: ms / 1000,
            scrambleText: { text: finalText, chars, speed: 0.6, revealDelay: 0.15 },
            ease: 'none',
            onComplete: () => { this.statefulTweens.delete(tween); this.unlock(element); }
        });
        tween.render(0.0001, true); // primer fotograma ya visible
        this.statefulTweens.add(tween);
        return tween;
    },

    // odometer(elemento, desde, hasta): contador que rueda hasta el valor final.
    odometer(target, from, to, options = {}, context = {}) {
        const element = this.resolveElement(target, context);
        if (!element || !Number.isFinite(from) || !Number.isFinite(to)) return null;
        const { ms = 900, tick = false } = options;
        const format = options.format || (value => Math.floor(value).toLocaleString());
        if (!this.ready) {
            element.textContent = format(to);
            return null;
        }

        this.lock(element);
        const counter = { value: from };
        let lastTickAt = 0;
        element.textContent = format(from);
        const tween = gsap.to(counter, {
            value: to,
            duration: ms / 1000,
            ease: 'power2.out',
            onUpdate: () => {
                element.textContent = format(counter.value);
                const now = performance.now();
                if (tick && now - lastTickAt > 70) {
                    lastTickAt = now;
                    audioModule.play('ui_tick', { volume: 0.35 });
                }
            },
            onComplete: () => {
                element.textContent = format(to);
                this.statefulTweens.delete(tween);
                this.unlock(element);
            }
        });
        this.statefulTweens.add(tween);
        return tween;
    },

    // pulse(elemento, escala): latido corto (no en movimiento reducido).
    pulse(target, scale = 1.08, ms = 240, context = {}) {
        const element = this.resolveElement(target, context);
        if (!this.ready || !element || this.isReducedMotion()) return null;
        gsap.killTweensOf(element, 'scale');
        return gsap.fromTo(element, { scale: 1 }, {
            scale,
            duration: ms / 2000,
            yoyo: true,
            repeat: 1,
            ease: 'power2.out',
            immediateRender: true,
            onComplete: () => gsap.set(element, { clearProps: 'scale' })
        });
    },

    // glow(elemento, color): halo que se apaga (sin movimiento: permitido siempre).
    glow(target, color = 'rgba(0, 255, 136, 0.9)', ms = 400, context = {}) {
        const element = this.resolveElement(target, context);
        if (!this.ready || !element) return null;
        return gsap.fromTo(element,
            { boxShadow: `0 0 48px ${color}` },
            { boxShadow: '0 0 0px rgba(0, 0, 0, 0)', duration: ms / 1000, ease: 'power2.out', clearProps: 'boxShadow' });
    },

    // banner(texto): rótulo central; letras con SplitText (fundido simple en movimiento reducido).
    banner(text, options = {}) {
        if (!this.ready || !text) return null;
        const { tone = 'accent', ms = 1400 } = options;
        const element = document.createElement('div');
        element.className = `fx-banner fx-banner-${tone}`;
        element.textContent = String(text);
        this.layer.appendChild(element);
        this.transient.add(element);

        const timeline = gsap.timeline({ onComplete: () => this.removeTransient(element) });
        if (this.isReducedMotion() || !window.SplitText) {
            timeline.fromTo(element, { opacity: 0 }, { opacity: 1, duration: 0.3 });
        } else {
            const split = new SplitText(element, { type: 'chars' });
            gsap.set(split.chars, { opacity: 0, y: 40, scale: 1.6 });
            timeline.to(split.chars, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.025, ease: window.CustomEase ? 'fxImpact' : 'back.out(2)' });
        }
        timeline.to(element, { opacity: 0, duration: 0.4 }, `+=${Math.max(0.2, ms / 1000 - 0.75)}`);
        return timeline;
    },

    // === TIEMPO VISUAL ===
    // freeze(ms): congela lo visual. slowmo(factor, ms): lo ralentiza.
    // Solo gsap.globalTimeline, animaciones CSS/WAAPI y partículas; nunca la economía.
    freeze(ms = 120) {
        if (!this.ready || this.isReducedMotion()) return;
        this.pushTimeEffect(0, ms);
    },

    slowmo(factor = 0.35, ms = 800) {
        if (!this.ready || this.isReducedMotion()) return;
        this.pushTimeEffect(Math.max(0.05, Math.min(1, factor)), ms);
    },

    pushTimeEffect(factor, ms) {
        this.timeEffects.push({ factor, until: performance.now() + ms });
        this.applyTimeScale();
    },

    applyTimeScale() {
        const now = performance.now();
        this.timeEffects = this.timeEffects.filter(effect => effect.until > now);
        const factor = this.timeEffects.reduce((min, effect) => Math.min(min, effect.factor), 1);

        gsap.globalTimeline.timeScale(factor);
        document.getAnimations?.().forEach(animation => {
            if (!animation.__fxBaseRate) animation.__fxBaseRate = animation.playbackRate || 1;
            animation.playbackRate = animation.__fxBaseRate * factor;
            if (factor === 1) delete animation.__fxBaseRate;
        });
        this.particleContainers.forEach(({ container }) => {
            try { factor === 0 ? container.pause() : container.play(); } catch (error) { /* destruido */ }
        });

        clearTimeout(this.timeRestoreTimer);
        if (this.timeEffects.length > 0) {
            // Temporizador real (setTimeout): un delayedCall de gsap quedaría congelado.
            const next = Math.min(...this.timeEffects.map(effect => effect.until)) - now;
            this.timeRestoreTimer = setTimeout(() => this.applyTimeScale(), Math.max(0, next));
        }
    },

    // === BLOQUEO DE TEXTOS ===
    // Mientras un efecto anima un texto, la UI no lo sobrescribe (ver uiModule.setText).
    lock(element) {
        element.dataset.fxLock = String((Number(element.dataset.fxLock) || 0) + 1);
    },

    unlock(element) {
        const count = (Number(element.dataset.fxLock) || 1) - 1;
        if (count <= 0) delete element.dataset.fxLock;
        else element.dataset.fxLock = String(count);
    },

    removeTransient(node) {
        gsap.killTweensOf(node);
        node.remove();
        this.transient.delete(node);
    },

    // Lleva todo a su estado final: completa scramble/odometer y retira lo pasajero.
    finishAll() {
        if (!this.ready) return;
        [...this.statefulTweens].forEach(tween => tween.progress(1));
        this.statefulTweens.clear();
        [...this.transient].forEach(node => this.removeTransient(node));
        [...this.particleContainers].forEach(record => this.destroyParticles(record));
        gsap.killTweensOf(this.flashEl);
        gsap.set(this.flashEl, { opacity: 0 });
        const screen = this.resolveElement('screen');
        if (screen) {
            gsap.killTweensOf(screen);
            gsap.set(screen, { clearProps: 'transform' });
        }
        this.timeEffects = [];
        this.applyTimeScale();
    },

    // Aplica el estado final de un efecto sin animarlo (al saltar una coreografía).
    applyFinalState(spec, context) {
        if (spec.type === 'scramble') {
            const element = this.resolveElement(spec.target, context);
            if (element && spec.text !== undefined && spec.text !== null) element.textContent = String(spec.text);
        }
        if (spec.type === 'odometer') {
            const element = this.resolveElement(spec.target, context);
            if (element && Number.isFinite(spec.to)) element.textContent = Math.floor(spec.to).toLocaleString();
        }
    }
};

console.log('✅ FX MODULE loaded');
