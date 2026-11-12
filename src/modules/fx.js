/**
 * MODULES/FX.JS - Efectos visuales sobre GSAP (+ tsParticles)
 * shake, flash, crack (DrawSVG), burst (tsParticles), shatter (Voronoi + clones
 * recortados + Physics2D),
 * scramble (ScrambleText), banner (SplitText), odometer, pulse, glow,
 * charge (carga antes del impacto), stamp (sello con rebote), floater (número
 * flotante), sparks/setAura (racha), coins (monedas al contador), encrypt/reveal
 * (pestaña cifrada con candado), pipeline/pipelineStage/rocket (release),
 * glitch (RGB), freeze y slowmo.
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
    encrypted: new Set(),      // pestañas mostradas como bloque cifrado (unlock)
    glitched: new Map(),       // elemento → temporizador del glitch RGB
    shatterRestores: new Set(), // shatters en curso con el original oculto
    liteMode: false,            // equipo lento: piezas mínimas y sin blur
    fpsRunning: false,
    fpsFrames: [],
    auraLevel: 0,
    auraTimer: null,
    auraSparks: 0,

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
            // Rebote del sello al caer: se pasa de largo, rebota dos veces y asienta.
            CustomEase.create('fxStamp', 'M0,0 C0.1,0 0.16,1.34 0.3,1.2 0.42,1.06 0.5,0.92 0.62,0.97 0.74,1.02 0.84,1 1,1');
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
        this.applyLiteMode();
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
            shard.className = 'fx-fragment';
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
        // Ya es un punto { x, y } (p. ej. context.impact resuelto por la coreografía).
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return { x: point.x, y: point.y };
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
    // options.persist: las grietas no se desvanecen (las retira quien las lanzó);
    // options.reach: multiplicador de su alcance.
    crack(target, point = null, context = {}, options = {}) {
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

        const reach = Math.max(rect.width, rect.height) * 0.75 * (Number(options.reach) || 1);
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
        group.dataset.persist = options.persist ? '1' : '';
        const timeline = gsap.timeline({ onComplete: () => { if (!options.persist) this.removeTransient(group); } })
            .to(paths, { drawSVG: '100%', duration: 0.28, stagger: 0.03, ease: 'power3.out' });
        if (!options.persist) timeline.to(group, { opacity: 0, duration: 0.5 }, '+=0.55');
        return timeline;
    },

    // Retira las grietas persistentes (cuando lo que agrietaban se rompe).
    clearCracks() {
        [...this.transient].filter(node => node.dataset?.persist === '1').forEach(node => this.removeTransient(node));
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
        if (Array.isArray(options.colors) && options.colors.length) {
            // El preset define los colores en el emisor; se sobrescriben ahí (y en particles, por los fuegos).
            particleOptions.particles = { color: { value: options.colors } };
            if (particleOptions.emitters) particleOptions.emitters.particles = { color: { value: options.colors } };
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
        const { ms = 900, tick = false, pitchStep = 0 } = options;
        const format = options.format || (value => Math.floor(value).toLocaleString());
        if (!this.ready) {
            element.textContent = format(to);
            return null;
        }

        this.lock(element);
        const counter = { value: from };
        let lastTickAt = 0;
        let lastWhole = Math.floor(from);
        let ticks = 0;
        element.textContent = format(from);
        const tween = gsap.to(counter, {
            value: to,
            duration: ms / 1000,
            ease: 'power2.out',
            onUpdate: () => {
                element.textContent = format(counter.value);
                const now = performance.now();
                if (tick === 'step') {
                    // Un tick por cada unidad que sube, cada vez más agudo (tope: una octava).
                    const whole = Math.floor(counter.value);
                    if (whole !== lastWhole && now - lastTickAt > 28) {
                        lastWhole = whole;
                        lastTickAt = now;
                        audioModule.play('ui_tick', { volume: 0.5, pitch: Math.min(12, ticks * pitchStep) });
                        ticks++;
                    }
                } else if (tick && now - lastTickAt > 70) {
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
    // ease 'bounce': salta a la escala y rebota elásticamente hasta 1.
    pulse(target, scale = 1.08, ms = 240, context = {}, ease = null) {
        const element = this.resolveElement(target, context);
        if (!this.ready || !element || this.isReducedMotion()) return null;
        gsap.killTweensOf(element, 'scale');
        if (ease === 'bounce') {
            return gsap.fromTo(element, { scale }, {
                scale: 1,
                duration: ms / 1000,
                ease: 'elastic.out(1.1, 0.35)',
                immediateRender: true,
                onComplete: () => gsap.set(element, { clearProps: 'scale' })
            });
        }
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

    isVisible(element) {
        if (!element?.getBoundingClientRect) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    },

    // charge(elemento, ms, color): el elemento "se carga" (brillo + temblor
    // creciente) y suelta la carga al terminar: anticipación antes de un impacto.
    charge(target, ms = 600, color = 'rgba(0, 212, 255, 0.85)', context = {}) {
        const element = this.resolveElement(target, context);
        if (!this.ready || !element) return null;
        const duration = ms / 1000;
        gsap.killTweensOf(element, 'boxShadow,filter');
        const timeline = gsap.timeline({
            onComplete: () => {
                this.statefulTweens.delete(timeline);
                // Sin clearProps de x/y: borraría todo el transform (p. ej. el
                // centrado con xPercent del pipeline). El último tween ya los deja en 0.
                gsap.set(element, { clearProps: 'boxShadow,filter' });
            }
        });
        timeline.fromTo(element,
            { boxShadow: `0 0 0px ${color}`, filter: 'brightness(1)' },
            { boxShadow: `0 0 38px ${color}`, filter: 'brightness(1.32)', duration, ease: 'power2.in', immediateRender: true }, 0);
        if (!this.isReducedMotion()) {
            const tremble = { amount: 0 };
            timeline.to(tremble, {
                amount: 1,
                duration,
                ease: 'power2.in',
                onUpdate: () => {
                    const amplitude = 0.4 + (tremble.amount * 2.8);
                    gsap.set(element, { x: (Math.random() * 2 - 1) * amplitude, y: (Math.random() * 2 - 1) * amplitude * 0.6 });
                }
            }, 0);
        }
        timeline.to(element, { boxShadow: `0 0 0px ${color}`, filter: 'brightness(1)', x: 0, y: 0, duration: 0.35, ease: 'power2.out' });
        this.statefulTweens.add(timeline);
        return timeline;
    },

    // stamp(elemento, texto): sello que cae sobre el elemento y rebota (CustomEase fxStamp).
    stamp(target, text, options = {}, context = {}) {
        const element = this.resolveElement(target, context);
        if (!this.ready || !element || !text || !this.isVisible(element)) return null;
        const { ms = 1400 } = options;
        const rect = element.getBoundingClientRect();
        const stamp = document.createElement('div');
        stamp.className = 'fx-stamp';
        stamp.textContent = String(text);
        stamp.style.left = `${rect.left + rect.width / 2}px`;
        stamp.style.top = `${rect.top + rect.height / 2}px`;
        this.layer.appendChild(stamp);
        this.transient.add(stamp);

        const timeline = gsap.timeline({ onComplete: () => this.removeTransient(stamp) });
        if (this.isReducedMotion()) {
            timeline.fromTo(stamp, { xPercent: -50, yPercent: -50, rotation: -8, opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: true });
        } else {
            // Caída de 80 ms (el golpe suena al llegar) y rebote al asentarse.
            timeline
                .fromTo(stamp, { xPercent: -50, yPercent: -50, scale: 3.4, rotation: -24, opacity: 0 },
                    { scale: 1, rotation: -8, opacity: 1, duration: 0.08, ease: 'power3.in', immediateRender: true })
                .fromTo(stamp, { scale: 0.8 }, { scale: 1, duration: 0.42, ease: window.CustomEase ? 'fxStamp' : 'elastic.out(1, 0.4)' });
        }
        timeline.to(stamp, { opacity: 0, scale: 1.12, duration: 0.35 }, `+=${Math.max(0.2, ms / 1000 - 0.85)}`);
        return timeline;
    },

    // floater(elemento, texto): número que sube desde el elemento y se desvanece.
    floater(target, text, context = {}) {
        const element = this.resolveElement(target, context);
        if (!this.ready || !element || text === undefined || text === null || text === '' || !this.isVisible(element)) return null;
        const rect = element.getBoundingClientRect();
        const floater = document.createElement('div');
        floater.className = 'fx-floater';
        floater.textContent = String(text);
        floater.style.left = `${rect.left + rect.width / 2}px`;
        floater.style.top = `${rect.top + Math.min(rect.height / 2, 28)}px`;
        this.layer.appendChild(floater);
        this.transient.add(floater);
        const rise = this.isReducedMotion() ? 0 : -46;
        return gsap.fromTo(floater,
            { xPercent: -50, yPercent: -50, y: 0, opacity: 1 },
            { y: rise, opacity: 0, duration: 0.95, ease: 'power2.out', immediateRender: true, onComplete: () => this.removeTransient(floater) });
    },

    // === CHISPAS Y AURA DE RACHA ===
    spawnSpark(element, colors, burst = false) {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const spark = document.createElement('div');
        spark.className = 'fx-spark';
        const color = colors[Math.floor(Math.random() * colors.length)];
        spark.style.background = color;
        spark.style.boxShadow = `0 0 6px ${color}`;
        const startX = rect.left + Math.random() * rect.width;
        const startY = burst ? rect.top + rect.height / 2 : rect.top + rect.height * (0.25 + Math.random() * 0.5);
        spark.style.left = `${startX}px`;
        spark.style.top = `${startY}px`;
        this.layer.appendChild(spark);
        this.transient.add(spark);
        this.auraSparks++;

        const angle = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const distance = burst ? 40 + Math.random() * 70 : 26 + Math.random() * 46;
        gsap.fromTo(spark, { x: 0, y: 0, scale: 1, opacity: 1 }, {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance - (burst ? 18 : 0),
            scale: 0.2,
            opacity: 0,
            duration: 0.5 + Math.random() * 0.5,
            ease: 'power2.out',
            immediateRender: true,
            onComplete: () => this.removeTransient(spark)
        });
    },

    // sparks(elemento, n, nivel): ráfaga de chispas con los colores del nivel de racha.
    sparks(target, count = 12, level = 1, context = {}) {
        const element = this.resolveElement(target, context);
        if (!this.ready || !element || this.isReducedMotion() || !this.isVisible(element)) return;
        const palette = CONFIG.STREAK_AURA_FX.COLORS;
        const colors = palette[Math.max(0, Math.min(palette.length - 1, (level || 1) - 1))];
        // La cantidad respeta el perfil de rendimiento visual (móvil/equipos lentos).
        const scale = uiModule.getVisualPerformanceProfile?.().confettiScale ?? 1;
        const amount = Math.max(3, Math.round((count || 12) * scale));
        for (let i = 0; i < amount; i++) this.spawnSpark(element, colors, true);
    },

    // setAura(nivel): aura persistente (CSS) sobre el contador de racha y el botón,
    // más un goteo de chispas que crece con el nivel. 0 la apaga.
    setAura(level = 0) {
        const config = CONFIG.STREAK_AURA_FX;
        const safeLevel = Math.max(0, Math.min(config.COLORS.length, level));
        if (safeLevel === this.auraLevel) return;
        this.auraLevel = safeLevel;
        const colors = config.COLORS[safeLevel - 1];

        config.TARGETS.forEach(selector => {
            const element = document.querySelector(selector);
            if (!element) return;
            if (safeLevel > 0) {
                element.dataset.aura = String(safeLevel);
                element.style.setProperty('--aura-a', colors[0]);
                element.style.setProperty('--aura-b', colors[1]);
            } else {
                delete element.dataset.aura;
                element.style.removeProperty('--aura-a');
                element.style.removeProperty('--aura-b');
            }
        });

        clearInterval(this.auraTimer);
        this.auraTimer = null;
        if (safeLevel > 0 && this.ready) {
            const rate = config.SPARKS_PER_SECOND[safeLevel - 1] || 5;
            this.auraTimer = setInterval(() => this.emitAuraSpark(), 1000 / rate);
        }
    },

    emitAuraSpark() {
        const config = CONFIG.STREAK_AURA_FX;
        if (document.hidden || this.isReducedMotion() || this.auraLevel <= 0) return;
        this.auraSparks = [...this.transient].filter(node => node.classList?.contains('fx-spark')).length;
        if (this.auraSparks >= config.MAX_SPARKS) return;
        const targets = config.TARGETS.map(selector => document.querySelector(selector)).filter(element => this.isVisible(element));
        if (!targets.length) return;
        const element = targets[Math.floor(Math.random() * targets.length)];
        this.spawnSpark(element, config.COLORS[this.auraLevel - 1]);
    },

    // === MONEDAS ===
    // coins(punto, contador, n, { landSound, pitchStep, endSound, endVolume }):
    // monedas que vuelan en arco hasta el contador. Cada una suena al llegar, un
    // poco más aguda que la anterior; la última cierra con endSound.
    coins(point, target, count = 8, options = {}, context = {}) {
        if (!this.ready) return null;
        const total = Math.max(1, Math.round(Number(count) || 8));
        const origin = this.resolvePoint(point || 'context', context);
        const destination = this.resolveElement(target, context);
        const destPoint = this.isVisible(destination)
            ? this.resolvePoint(destination, context)
            : { x: window.innerWidth / 2, y: 24 };
        const { landSound = 'coin', pitchStep = 1, endSound = null, endVolume = 0.8 } = options;
        let landed = 0;
        const land = () => {
            landed++;
            if (landSound) audioModule.play(landSound, { pitch: Math.min(12, (landed - 1) * pitchStep), volume: 0.55 });
            if (destination) this.pulse(destination, 1.14, 160, context);
            if (landed === total && endSound) audioModule.play(endSound, { volume: endVolume });
        };

        // Sin movimiento: no vuelan; las llegadas suenan igual, escalonadas.
        if (this.isReducedMotion()) {
            const timers = [];
            for (let i = 0; i < total; i++) timers.push(setTimeout(land, 420 + i * 70));
            if (destination) this.glow(destination, 'rgba(255, 215, 0, 0.8)', 900, context);
            return { kill: () => timers.forEach(clearTimeout) };
        }

        for (let i = 0; i < total; i++) {
            const coin = document.createElement('div');
            coin.className = 'fx-coin';
            coin.style.left = `${origin.x}px`;
            coin.style.top = `${origin.y}px`;
            this.layer.appendChild(coin);
            this.transient.add(coin);

            // Salen desparramadas desde la explosión y vuelan en arco.
            const scatterAngle = Math.random() * Math.PI * 2;
            const scatter = 20 + Math.random() * 60;
            const start = { x: Math.cos(scatterAngle) * scatter, y: Math.sin(scatterAngle) * scatter };
            const end = { x: destPoint.x - origin.x, y: destPoint.y - origin.y };
            const arc = 80 + Math.random() * 120;
            const flight = { t: 0 };
            gsap.set(coin, { xPercent: -50, yPercent: -50, x: start.x, y: start.y, scale: 0.6 + Math.random() * 0.5 });
            const tween = gsap.to(flight, {
                t: 1,
                duration: 0.48 + Math.random() * 0.12,
                delay: 0.12 + i * 0.07,
                ease: 'power2.in',
                onUpdate: () => {
                    if (!coin.isConnected) return;
                    const t = flight.t;
                    gsap.set(coin, {
                        x: start.x + (end.x - start.x) * t,
                        y: start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * arc,
                        rotation: t * 540
                    });
                },
                onComplete: () => {
                    if (!coin.isConnected) return; // saltada: sin sonido
                    this.removeTransient(coin);
                    land();
                }
            });
            coin._fxTweens = [tween];
        }
        return null;
    },

    // === DESBLOQUEO: BLOQUE CIFRADO CON CANDADO ===
    // encrypt(pestaña): la pestaña aparece como bloque cifrado con candado. Deja en
    // el contexto label (texto a descifrar), lock y lockPoint (dónde se rompe el
    // candado: el propio candado o, si la pestaña no se ve, context.anchor).
    encrypt(target, context = {}) {
        const element = this.resolveElement(target, context);
        if (!element) return null;
        if (!element._fxEncrypted) {
            element._fxOriginal = element.innerHTML;
            element._fxEncrypted = true;
            this.encrypted.add(element);
        }
        const text = String(context.text || element.textContent.trim());
        const glyphs = '01#$%&*<>/\\{}[]';
        const lock = document.createElement('i');
        lock.className = 'fas fa-lock fx-lock-icon';
        const label = document.createElement('span');
        label.className = 'fx-cipher-text';
        label.textContent = Array.from(text, char => (char === ' ' ? ' ' : glyphs[Math.floor(Math.random() * glyphs.length)])).join('');
        element.replaceChildren(lock, ' ', label);
        element.classList.add('fx-encrypted');

        context.label = label;
        context.lock = lock;
        const visible = this.isVisible(element);
        context.lockPoint = visible ? lock : (context.anchor || element);
        // Lo que se rompe: la pestaña cifrada o, si no se ve, el botón que lleva a ellas.
        context.shatterTarget = visible ? element : (context.anchor || element);
        if (this.ready && visible && !this.isReducedMotion()) {
            gsap.fromTo(element, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.2)', immediateRender: true, clearProps: 'opacity,scale' });
        }
        return element;
    },

    // reveal(pestaña): quita el cifrado y devuelve la pestaña original.
    reveal(target, context = {}, instant = false) {
        const element = this.resolveElement(target, context);
        if (!element?._fxEncrypted) return null;
        element.innerHTML = element._fxOriginal;
        delete element._fxOriginal;
        delete element._fxEncrypted;
        element.classList.remove('fx-encrypted');
        this.encrypted.delete(element);
        if (this.ready && !instant) {
            gsap.fromTo(element, { filter: 'brightness(1.9)' }, { filter: 'brightness(1)', duration: 0.6, ease: 'power2.out', clearProps: 'filter' });
        }
        return element;
    },

    // === PIPELINE DE RELEASE ===
    // pipeline(ancla, ms): Build → Test → Deploy sobre la tarjeta de release (o al
    // centro si no se ve). Deja pipelineEl y pipelineStages en el contexto.
    pipeline(target, ms = 2500, context = {}) {
        if (!this.ready) return null;
        const anchor = this.resolveElement(target, context);
        const point = this.isVisible(anchor)
            ? (() => { const rect = anchor.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height / 2, 90) }; })()
            : { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };

        const element = document.createElement('div');
        element.className = 'fx-pipeline';
        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;
        const stages = CONFIG.RELEASE_PIPELINE_STAGES.map((label, index) => {
            if (index > 0) {
                const link = document.createElement('span');
                link.className = 'fx-pipe-link';
                element.appendChild(link);
            }
            const stage = document.createElement('span');
            stage.className = 'fx-pipe-stage';
            stage.dataset.status = 'pending';
            stage.innerHTML = '<i class="fas fa-circle-notch"></i>';
            const text = document.createElement('span');
            text.textContent = label;
            stage.appendChild(text);
            element.appendChild(stage);
            return stage;
        });
        this.layer.appendChild(element);
        this.transient.add(element);
        context.pipelineEl = element;
        context.pipelineStages = stages;

        const reduced = this.isReducedMotion();
        const timeline = gsap.timeline({ onComplete: () => this.removeTransient(element) });
        timeline.fromTo(element,
            { xPercent: -50, yPercent: -50, opacity: 0, y: reduced ? 0 : 14, scale: reduced ? 1 : 0.92 },
            { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'back.out(1.8)', immediateRender: true });
        timeline.to(element, { opacity: 0, duration: 0.3 }, Math.max(0.3, ms / 1000 - 0.3));
        element._fxTweens = [timeline];
        return timeline;
    },

    // pipelineStage(i, 'ok'|'warn'|'fail'): marca la etapa y avanza el conector.
    pipelineStage(index, status = 'ok', context = {}) {
        const stage = context.pipelineStages?.[index];
        if (!stage) return null;
        const icons = { ok: 'fa-check', warn: 'fa-triangle-exclamation', fail: 'fa-xmark' };
        stage.dataset.status = status;
        stage.querySelector('i').className = `fas ${icons[status] || icons.ok}`;
        stage.previousElementSibling?.classList.add('is-done');
        return this.pulse(stage, status === 'fail' ? 1.25 : 1.18, 380, context, 'bounce');
    },

    // rocket(punto): cohete que despega desde el pipeline (desde la etapa Deploy).
    rocket(point, context = {}) {
        if (!this.ready) return null;
        const source = context.pipelineStages?.[context.pipelineStages.length - 1] || point;
        const origin = this.resolvePoint(source || 'center', context);
        const rocket = document.createElement('div');
        rocket.className = 'fx-rocket';
        rocket.innerHTML = '<i class="fas fa-rocket"></i>';
        rocket.style.left = `${origin.x}px`;
        rocket.style.top = `${origin.y}px`;
        this.layer.appendChild(rocket);
        this.transient.add(rocket);

        const timeline = gsap.timeline({ onComplete: () => this.removeTransient(rocket) });
        if (this.isReducedMotion()) {
            timeline.fromTo(rocket, { xPercent: -50, yPercent: -50, opacity: 0 }, { opacity: 1, duration: 0.25, immediateRender: true })
                .to(rocket, { opacity: 0, duration: 0.5 }, '+=0.5');
            return timeline;
        }
        timeline
            .fromTo(rocket, { xPercent: -50, yPercent: -50, y: 0, x: 0, scale: 0.6, opacity: 1 },
                { scale: 1.15, duration: 0.12, ease: 'power2.out', immediateRender: true })
            .to(rocket, { y: -(origin.y + 120), x: (Math.random() - 0.5) * 80, duration: 0.95, ease: 'power3.in' });
        return timeline;
    },

    // glitch(elemento, ms): glitch RGB breve (separación de canales y cortes).
    // Con "Reducir movimiento": solo el tinte, sin desplazamientos.
    glitch(target, ms = 400, context = {}) {
        const element = this.resolveElement(target, context);
        if (!this.ready || !element) return null;
        const className = this.isReducedMotion() ? 'fx-glitch-soft' : 'fx-glitch';
        clearTimeout(this.glitched.get(element));
        element.classList.add(className);
        // Temporizador real: el glitch no se alarga con un slowmo.
        this.glitched.set(element, setTimeout(() => this.clearGlitch(element), ms));
        return element;
    },

    clearGlitch(element) {
        clearTimeout(this.glitched.get(element));
        element.classList.remove('fx-glitch', 'fx-glitch-soft');
        this.glitched.delete(element);
    },

    // callback: llama a context[nombre] una sola vez (también al saltar o descartar).
    runCallback(name, context = {}) {
        const fn = context[name];
        context.__calledBack = context.__calledBack || {};
        if (typeof fn !== 'function' || context.__calledBack[name]) return;
        context.__calledBack[name] = true;
        try {
            fn();
        } catch (error) {
            console.warn('⚠️ Callback de coreografía falló:', error);
        }
    },

    // === RENDIMIENTO ===
    // Equipo lento: menos de PERF.MIN_CORES núcleos, o una animación por debajo de MIN_FPS.
    // En ese caso: piezas mínimas en el shatter y sin blur (body[data-fx-lite]).
    isLite() {
        if (this.liteMode) return true;
        const cores = navigator.hardwareConcurrency;
        return Number.isFinite(cores) && cores < CONFIG.PERF.MIN_CORES;
    },

    applyLiteMode() {
        document.body.dataset.fxLite = this.isLite() ? 'true' : 'false';
    },

    // Medidor de fps (rAF) mientras dura una coreografía grande.
    fpsStart() {
        if (this.fpsRunning) return;
        this.fpsRunning = true;
        this.fpsFrames = [];
        let last = performance.now();
        const loop = now => {
            if (!this.fpsRunning) return;
            this.fpsFrames.push(now - last);
            if (this.fpsFrames.length > 90) this.fpsFrames.shift();
            last = now;
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    fpsStop() {
        this.fpsRunning = false;
    },

    // Media de fps de las últimas muestras (o null si aún hay pocas). Los frames con la
    // pestaña oculta o tras un freeze largo no cuentan (> 250 ms).
    fpsAverage(last = null) {
        const recent = last ? (this.fpsFrames || []).slice(-last) : (this.fpsFrames || []);
        const frames = recent.filter(ms => ms < 250);
        if (last) return frames.length >= Math.min(last, 8) ? 1000 / (frames.reduce((sum, ms) => sum + ms, 0) / frames.length) : null;
        if (frames.length < CONFIG.PERF.FPS_MIN_SAMPLES) return null;
        return 1000 / (frames.reduce((sum, ms) => sum + ms, 0) / frames.length);
    },

    // Si la animación va por debajo de MIN_FPS se pasa a modo ligero para el resto de la sesión.
    checkFps() {
        const fps = this.fpsAverage();
        if (fps !== null && fps < CONFIG.PERF.MIN_FPS && !this.liteMode) {
            this.liteMode = true;
            this.applyLiteMode();
        }
        return fps;
    },

    // Piezas del shatter: entre MIN y MAX según el área de la pantalla; MIN en modo ligero.
    getShatterPieces(requested = null) {
        const { MIN, MAX, AREA_PER_PIECE } = CONFIG.PRESTIGE_SCENE.PIECES;
        if (this.isLite()) return MIN;
        const wanted = Number.isFinite(requested) ? requested : Math.round((window.innerWidth * window.innerHeight) / AREA_PER_PIECE);
        return Math.max(MIN, Math.min(MAX, wanted));
    },

    // === ROMPER LO VIEJO: SHATTER ===
    // Recorta un polígono por el semiplano n·p <= c (Sutherland–Hodgman).
    clipPolygon(polygon, nx, ny, c) {
        const result = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];
            const da = (nx * a.x) + (ny * a.y) - c;
            const db = (nx * b.x) + (ny * b.y) - c;
            if (da <= 0) result.push(a);
            if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
                const t = da / (da - db);
                result.push({ x: a.x + ((b.x - a.x) * t), y: a.y + ((b.y - a.y) * t) });
            }
        }
        return result;
    },

    // Voronoi simple: `count` semillas con más densidad cerca del impacto (las celdas
    // salen más chicas allí) y cada celda = el rectángulo recortado por las mediatrices.
    voronoiCells(width, height, impact, count) {
        const seeds = [{ x: impact.x, y: impact.y }];
        const reach = Math.hypot(width, height);
        const minGap = Math.max(4, Math.sqrt((width * height) / count) * 0.18);
        let guard = 0;
        while (seeds.length < count && guard++ < count * 40) {
            const radius = reach * Math.pow(Math.random(), 1.9);
            const angle = Math.random() * Math.PI * 2;
            const x = impact.x + (Math.cos(angle) * radius);
            const y = impact.y + (Math.sin(angle) * radius);
            if (x < 0 || y < 0 || x > width || y > height) continue;
            if (seeds.some(seed => Math.hypot(seed.x - x, seed.y - y) < minGap)) continue;
            seeds.push({ x, y });
        }

        const box = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
        return seeds.map((seed, i) => {
            let cell = box;
            for (let j = 0; j < seeds.length && cell.length >= 3; j++) {
                if (j === i) continue;
                const nx = seeds[j].x - seed.x;
                const ny = seeds[j].y - seed.y;
                const c = (nx * (seed.x + seeds[j].x) / 2) + (ny * (seed.y + seeds[j].y) / 2);
                cell = this.clipPolygon(cell, nx, ny, c);
            }
            return cell;
        }).filter(cell => cell.length >= 3);
    },

    // Copia los estilos calculados al clon (un clon suelto en la capa de efectos ya no
    // hereda reglas del DOM original). Solo para elementos chicos; la foto de la UI
    // (clase fx-ghost) vive en el mismo documento y no lo necesita.
    bakeStyles(source, clone) {
        clone.style.cssText = getComputedStyle(source).cssText;
        const sourceChildren = source.children;
        const cloneChildren = clone.children;
        for (let i = 0; i < sourceChildren.length; i++) {
            if (cloneChildren[i]) this.bakeStyles(sourceChildren[i], cloneChildren[i]);
        }
    },

    // shatter(elemento, puntoDeImpacto, contexto, { pieces, restoreMs, onRestore, prepare }):
    //   rompe el elemento en 30–60 polígonos irregulares (más chicos cerca del impacto). Cada
    //   fragmento es un clon visual del elemento recortado con clip-path (sin html2canvas) y
    //   el original se oculta. Físicas con Physics2D; solo transform y opacity (will-change).
    //   restoreMs: el original reaparece (con un fundido) a los N ms; si no, al terminar.
    //   prepare: construye los clones ya, invisibles, y devuelve un handle con fire() para
    //   soltarlos más tarde (así el coste de clonar no cae en el frame del impacto).
    // Devuelve { fire(), cancel(), timeline }.
    shatter(target, point = null, context = {}, options = {}) {
        if (!this.ready) return null;
        const element = this.resolveElement(target, context);
        if (!element || !this.isVisible(element)) {
            // Sin nada que romper: al menos el estado final (p. ej. revelar la pestaña).
            options.onRestore?.();
            return null;
        }

        const rect = element.getBoundingClientRect();
        const handle = { fired: false, cancelled: false, timeline: null, wrappers: [], element, restoreTimer: null };
        const isGhost = element.classList.contains('fx-ghost');
        const previousVisibility = element.style.visibility;

        const restore = () => {
            clearTimeout(handle.restoreTimer);
            if (!handle.restorePending) return;
            handle.restorePending = false;
            this.shatterRestores.delete(handle);
            options.onRestore?.();
            if (!isGhost) {
                element.style.visibility = previousVisibility;
                if (!this.isReducedMotion()) gsap.fromTo(element, { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' });
            }
        };
        handle.restore = restore;

        // Con "Reducir movimiento": sin fragmentos; el original se desvanece y vuelve.
        if (this.isReducedMotion()) {
            handle.fire = () => {
                if (handle.fired) return handle;
                handle.fired = true;
                handle.restorePending = true;
                this.shatterRestores.add(handle);
                if (isGhost) gsap.to(element, { opacity: 0, duration: 0.5 });
                handle.restoreTimer = setTimeout(restore, options.restoreMs ?? 400);
                return handle;
            };
            handle.cancel = () => restore();
            return options.prepare ? handle : handle.fire();
        }

        const pieces = this.getShatterPieces(options.pieces);
        const local = {
            x: Math.max(0, Math.min(rect.width, (this.resolvePoint(point || 'center', context).x) - rect.left)),
            y: Math.max(0, Math.min(rect.height, (this.resolvePoint(point || 'center', context).y) - rect.top))
        };
        const cells = this.voronoiCells(rect.width, rect.height, local, pieces);

        // Plantilla del clon, una sola vez; cada fragmento es una copia suya.
        const template = element.cloneNode(true);
        if (!isGhost) {
            this.bakeStyles(element, template);
            template.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
            template.removeAttribute('id');
        }
        template.classList.add('fx-ghost');
        template.removeAttribute('inert');
        Object.assign(template.style, {
            position: 'absolute', margin: '0', transform: 'none', translate: 'none',
            width: `${rect.width}px`, height: `${rect.height}px`, visibility: 'visible', opacity: '1', boxSizing: 'border-box'
        });

        const maxDistance = Math.hypot(rect.width, rect.height);
        const sizeFactor = Math.max(0.3, Math.min(1.2, Math.max(rect.width, rect.height) / 700));
        // Geometría de cada fragmento (barata); los clones se construyen aparte, por trozos.
        const plans = cells.map(cell => {
            // Centro de la celda y caja envolvente.
            let cx = 0, cy = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            cell.forEach(p => {
                cx += p.x; cy += p.y;
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
            cx /= cell.length; cy /= cell.length;
            // Se ensancha 0,6 px para que no queden líneas finas entre fragmentos.
            const points = cell.map(p => {
                const dx = p.x - cx, dy = p.y - cy, len = Math.hypot(dx, dy) || 1;
                return { x: p.x + (dx / len) * 0.6, y: p.y + (dy / len) * 0.6 };
            });
            const bx = Math.max(0, minX - 1), by = Math.max(0, minY - 1);
            const bw = Math.min(rect.width, maxX + 1) - bx, bh = Math.min(rect.height, maxY + 1) - by;

            return {
                cx, cy,
                css: `left:${(rect.left + bx).toFixed(1)}px;top:${(rect.top + by).toFixed(1)}px;width:${bw.toFixed(1)}px;height:${bh.toFixed(1)}px;opacity:0.01;`,
                clip: `polygon(${points.map(p => `${(p.x - bx).toFixed(1)}px ${(p.y - by).toFixed(1)}px`).join(',')})`,
                offsetX: -bx,
                offsetY: -by
            };
        });

        // Construye los siguientes `limit` fragmentos: clon recortado, invisible (0,01) para que
        // el navegador lo rasterice antes de que haga falta.
        const fragments = [];
        const buildSome = limit => {
            const end = Math.min(plans.length, fragments.length + limit);
            while (fragments.length < end) {
                const plan = plans[fragments.length];
                const wrapper = document.createElement('div');
                wrapper.className = 'fx-fragment';
                wrapper.style.cssText = plan.css;
                // El clip-path va en un hijo estático: el elemento que se anima (transform y
                // opacity) no lo lleva, así el navegador no crea una capa de máscara por fragmento.
                const clipper = document.createElement('div');
                clipper.className = 'fx-fragment-clip';
                clipper.style.clipPath = plan.clip;
                const inner = template.cloneNode(true);
                inner.style.left = `${plan.offsetX}px`;
                inner.style.top = `${plan.offsetY}px`;
                clipper.appendChild(inner);
                wrapper.appendChild(clipper);
                this.layer.appendChild(wrapper);
                this.transient.add(wrapper);
                handle.wrappers.push(wrapper);
                fragments.push({ wrapper, cx: plan.cx, cy: plan.cy });
            }
        };

        const finish = () => {
            clearTimeout(handle.watchdog);
            handle.wrappers.forEach(wrapper => this.removeTransient(wrapper));
            handle.wrappers = [];
            restore();
        };

        handle.fire = () => {
            if (handle.fired || handle.cancelled) return handle;
            handle.fired = true;
            handle.restorePending = true;
            this.shatterRestores.add(handle);

            // Mismo frame: el original se oculta y los fragmentos aparecen (lo que falte por
            // construir se construye ahora). Opacidad directa: no depende del reloj de GSAP,
            // que puede estar en freeze.
            buildSome(Infinity);
            element.style.visibility = 'hidden';
            handle.wrappers.forEach(wrapper => { wrapper.style.opacity = '1'; });

            const timeline = gsap.timeline({ onComplete: finish });
            fragments.forEach(({ wrapper, cx, cy }) => {
                const dx = cx - local.x;
                const dy = cy - local.y;
                const distance = Math.hypot(dx, dy);
                const proximity = 1 - Math.min(1, distance / maxDistance);
                const angle = (Math.atan2(dy, dx) * 180 / Math.PI) + ((Math.random() - 0.5) * 36);
                const duration = 1.3 + (Math.random() * 0.7);
                const delay = (distance / maxDistance) * 0.12;
                timeline.to(wrapper, {
                    physics2D: {
                        velocity: (230 + (proximity * 720) + (Math.random() * 240)) * Math.max(0.45, sizeFactor),
                        angle,
                        gravity: (700 + (900 * sizeFactor))
                    },
                    rotation: (Math.random() < 0.5 ? -1 : 1) * (120 + (Math.random() * 480)),
                    duration,
                    ease: 'none'
                }, delay);
                timeline.to(wrapper, { opacity: 0, duration: duration * 0.55, ease: 'power2.in' }, delay + (duration * 0.4));
            });
            handle.timeline = timeline;

            // Vigilante de fps durante el vuelo (solo si hay medidor, es decir, en momentos
            // grandes): si va por debajo de MIN_FPS, los fragmentos se desvanecen enseguida y
            // el resto de la sesión usa piezas mínimas y sin blur.
            if (this.fpsRunning) {
                handle.watchdog = setTimeout(() => {
                    const fps = this.fpsAverage(12);
                    if (fps === null || fps >= CONFIG.PERF.MIN_FPS || handle.cancelled || !handle.wrappers.length) return;
                    this.liteMode = true;
                    this.applyLiteMode();
                    timeline.kill();
                    handle.wrappers.forEach(wrapper => gsap.to(wrapper, { opacity: 0, duration: 0.25, ease: 'power1.in' }));
                    setTimeout(finish, 300);
                }, 350);
            }
            const restoreMs = options.restoreMs;
            if (Number.isFinite(restoreMs)) {
                // Temporizador real: el original no debe esperar a un slowmo.
                handle.restoreTimer = setTimeout(restore, restoreMs);
            }
            return handle;
        };
        handle.cancel = () => {
            handle.cancelled = true;
            finish();
        };

        if (options.prepare) {
            // Se prepara en trozos de 3 fragmentos por frame (p. ej. durante el freeze).
            const pump = () => {
                if (handle.cancelled || handle.fired) return;
                buildSome(3);
                if (fragments.length < plans.length) requestAnimationFrame(pump);
            };
            requestAnimationFrame(pump);
            return handle;
        }
        return handle.fire();
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
        node._fxTweens?.forEach(tween => tween.kill());
        node.remove();
        this.transient.delete(node);
    },

    // Lleva todo a su estado final: completa scramble/odometer y retira lo pasajero.
    finishAll() {
        if (!this.ready) return;
        [...this.statefulTweens].forEach(tween => tween.progress(1));
        this.statefulTweens.clear();
        // Escena del prestige y shatters en curso: se devuelven a su estado final.
        this.sceneEnd?.();
        [...this.shatterRestores].forEach(handle => handle.restore());
        [...this.transient].forEach(node => this.removeTransient(node));
        [...this.particleContainers].forEach(record => this.destroyParticles(record));
        [...this.encrypted].forEach(element => this.reveal(element, {}, true));
        [...this.glitched.keys()].forEach(element => this.clearGlitch(element));
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
        if (spec.type === 'reveal') this.reveal(spec.target, context, true);
        if (spec.type === 'shatter' && spec.reveal) this.reveal(context.element, context, true);
        if (spec.type === 'sceneEnd') this.sceneEnd?.(context);
        if (spec.type === 'tier') uiModule.setCodeTier(spec.power);
        if (spec.type === 'callback') this.runCallback(spec.name, context);
    }
};

console.log('✅ FX MODULE loaded');
