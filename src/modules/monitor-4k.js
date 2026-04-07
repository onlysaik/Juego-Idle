/**
 * MODULES/MONITOR-4K.JS - Renderer procedural del upgrade Monitor 4K
 * Responsabilidad: Manejar ciclo de vida, resize y render del display 4K
 */

const monitor4kModule = {
    initialized: false,
    canvas: null,
    ctx: null,
    frameId: 0,
    resizeHandler: null,
    visibilityHandler: null,
    active: false,
    performanceMode: 'full',
    renderProfile: null,
    lastFrameTime: 0,
    width: 0,
    height: 0,
    dpr: 1,
    columns: [],
    traces: [],
    pulses: [],

    init() {
        if (this.initialized) return;

        const canvas = document.getElementById('monitor4kCanvas');
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        this.canvas = canvas;
        this.ctx = ctx;
        this.initialized = true;
        this.resizeHandler = () => this.resize();
        this.visibilityHandler = () => this.handleVisibilityChange();

        window.addEventListener('resize', this.resizeHandler);
        document.addEventListener('visibilitychange', this.visibilityHandler);
        this.resize();
    },

    destroy() {
        if (!this.initialized) return;

        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = 0;
        }

        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
        }

        this.initialized = false;
        this.canvas = null;
        this.ctx = null;
        this.resizeHandler = null;
        this.visibilityHandler = null;
        this.active = false;
        this.performanceMode = 'full';
        this.renderProfile = null;
        this.lastFrameTime = 0;
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        this.columns = [];
        this.traces = [];
        this.pulses = [];
    },

    canAnimate() {
        return !document.hidden;
    },

    setPerformanceProfile(mode = 'full') {
        if (this.performanceMode === mode) return;

        this.performanceMode = mode;
        this.lastFrameTime = 0;

        if (this.initialized) {
            this.resize();
        }
    },

    getRenderProfile(width = this.width || window.innerWidth) {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || this.performanceMode === 'low' || width <= 768) {
            return {
                dprCap: 1,
                columnDivisor: 38,
                minColumns: 7,
                traceCount: 2,
                pulseCount: 1,
                verticalDivisor: 68,
                frameIntervalMs: 48
            };
        }

        if (this.performanceMode === 'medium' || width <= 991.98) {
            return {
                dprCap: 1.25,
                columnDivisor: 32,
                minColumns: 8,
                traceCount: 3,
                pulseCount: 2,
                verticalDivisor: 58,
                frameIntervalMs: 32
            };
        }

        return {
            dprCap: 1.6,
            columnDivisor: 26,
            minColumns: 10,
            traceCount: 5,
            pulseCount: 3,
            verticalDivisor: 48,
            frameIntervalMs: 16
        };
    },

    handleVisibilityChange() {
        if (!this.initialized) return;

        if (document.hidden) {
            if (this.frameId) {
                cancelAnimationFrame(this.frameId);
                this.frameId = 0;
            }
            this.paintFrame(0);
            return;
        }

        if (this.active && !this.frameId) {
            this.frameId = requestAnimationFrame((timestamp) => this.render(timestamp));
        }
    },

    resize() {
        if (!this.canvas || !this.ctx) return;

        const bounds = this.canvas.getBoundingClientRect();
        const width = Math.max(1, Math.floor(bounds.width));
        const height = Math.max(1, Math.floor(bounds.height));
        const renderProfile = this.getRenderProfile(width);
        const dpr = Math.min(window.devicePixelRatio || 1, renderProfile.dprCap);

        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.renderProfile = renderProfile;

        const columnCount = Math.max(renderProfile.minColumns, Math.floor(width / renderProfile.columnDivisor));
        this.columns = Array.from({ length: columnCount }, (_, index) => ({
            x: ((index + 0.5) / columnCount) * width,
            width: 1 + (index % 3),
            speed: 48 + (index % 6) * 12,
            trail: 44 + (index % 5) * 14,
            phase: index * 0.173,
            alpha: 0.18 + (index % 4) * 0.05
        }));

        this.traces = Array.from({ length: renderProfile.traceCount }, (_, index) => ({
            y: height * (0.22 + index * 0.14),
            speed: 0.08 + index * 0.018,
            phase: index * 0.21,
            length: width * (0.18 + index * 0.03),
            color: index % 2 === 0 ? '76, 228, 255' : '107, 162, 255'
        }));

        this.pulses = Array.from({ length: renderProfile.pulseCount }, (_, index) => ({
            y: height * (0.7 + index * 0.09),
            width: width * (0.26 + index * 0.12),
            speed: 0.12 + index * 0.03,
            phase: index * 0.29
        }));

        this.paintFrame(0);
    },

    sync(isActive) {
        if (!this.initialized) {
            this.init();
        }

        this.active = Boolean(isActive);

        if (this.active) {
            if (!this.frameId && this.canAnimate()) {
                this.frameId = requestAnimationFrame((timestamp) => this.render(timestamp));
            } else if (!this.canAnimate()) {
                this.paintFrame(0);
            }
            return;
        }

        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = 0;
        }

        this.paintFrame(0);
    },

    render(timestamp) {
        if (!this.active || !this.canAnimate()) {
            this.frameId = 0;
            this.lastFrameTime = 0;
            return;
        }

        const renderProfile = this.renderProfile || this.getRenderProfile();
        if (this.lastFrameTime && timestamp - this.lastFrameTime < renderProfile.frameIntervalMs) {
            this.frameId = requestAnimationFrame((nextTimestamp) => this.render(nextTimestamp));
            return;
        }

        this.paintFrame(timestamp * 0.001);
        this.lastFrameTime = timestamp;
        this.frameId = requestAnimationFrame((nextTimestamp) => this.render(nextTimestamp));
    },

    paintFrame(time) {
        const { ctx, width, height, columns, traces, pulses } = this;
        if (!ctx || !width || !height) return;

        ctx.clearRect(0, 0, width, height);

        const background = ctx.createLinearGradient(0, 0, 0, height);
        background.addColorStop(0, 'rgba(8, 18, 34, 0.14)');
        background.addColorStop(0.55, 'rgba(12, 30, 58, 0.1)');
        background.addColorStop(1, 'rgba(4, 10, 18, 0.3)');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const horizonY = height * 0.2;
        const floorY = height * 0.9;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        for (let index = 0; index < 9; index += 1) {
            const t = index / 8;
            const y = horizonY + Math.pow(t, 1.9) * (floorY - horizonY);
            ctx.strokeStyle = `rgba(86, 222, 255, ${0.08 + t * 0.18})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(width * 0.08, y);
            ctx.lineTo(width * 0.92, y);
            ctx.stroke();
        }

        const verticalDivisor = this.renderProfile?.verticalDivisor || 48;
        const verticalCount = Math.max(8, Math.floor(width / verticalDivisor));
        for (let index = -verticalCount; index <= verticalCount; index += 1) {
            const spread = index / verticalCount;
            const topX = centerX + spread * width * 0.16;
            const bottomX = centerX + spread * width * 0.56;
            ctx.strokeStyle = `rgba(86, 222, 255, ${0.03 + (1 - Math.abs(spread)) * 0.18})`;
            ctx.beginPath();
            ctx.moveTo(topX, horizonY);
            ctx.lineTo(bottomX, floorY);
            ctx.stroke();
        }

        columns.forEach((column, index) => {
            const travel = (time * column.speed + column.phase * height) % (height + column.trail * 3);
            const headY = travel - column.trail * 1.5;
            const gradient = ctx.createLinearGradient(column.x, headY - column.trail, column.x, headY + column.trail);
            gradient.addColorStop(0, 'rgba(76, 228, 255, 0)');
            gradient.addColorStop(0.45, `rgba(76, 228, 255, ${column.alpha})`);
            gradient.addColorStop(1, 'rgba(76, 228, 255, 0)');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = column.width;
            ctx.beginPath();
            ctx.moveTo(column.x, Math.max(horizonY, headY - column.trail));
            ctx.lineTo(column.x, Math.min(floorY, headY + column.trail));
            ctx.stroke();

            if (index % 4 === 0) {
                const blockY = horizonY + ((time * (26 + index) + column.phase * 100) % (floorY - horizonY));
                ctx.fillStyle = 'rgba(130, 230, 255, 0.18)';
                ctx.fillRect(column.x - 7, blockY, 14, 2.5);
            }
        });

        traces.forEach((trace) => {
            const x = ((time * trace.speed + trace.phase) % 1.35) * (width + trace.length) - trace.length;
            const traceGradient = ctx.createLinearGradient(x, trace.y, x + trace.length, trace.y);
            traceGradient.addColorStop(0, `rgba(${trace.color}, 0)`);
            traceGradient.addColorStop(0.3, `rgba(${trace.color}, 0.12)`);
            traceGradient.addColorStop(0.65, `rgba(${trace.color}, 0.55)`);
            traceGradient.addColorStop(1, `rgba(${trace.color}, 0)`);
            ctx.strokeStyle = traceGradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, trace.y);
            ctx.lineTo(x + trace.length, trace.y);
            ctx.stroke();
        });

        pulses.forEach((pulse, index) => {
            const wave = (Math.sin((time + pulse.phase) * (1.4 + index * 0.2)) + 1) / 2;
            const pulseWidth = pulse.width * (0.65 + wave * 0.45);
            const pulseX = width * 0.14 + ((time * pulse.speed + pulse.phase) % 0.72) * width * 0.52;
            const pulseGradient = ctx.createLinearGradient(pulseX, pulse.y, pulseX + pulseWidth, pulse.y);
            pulseGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
            pulseGradient.addColorStop(0.15, 'rgba(118, 219, 255, 0.2)');
            pulseGradient.addColorStop(0.5, 'rgba(118, 219, 255, 0.68)');
            pulseGradient.addColorStop(0.85, 'rgba(82, 125, 255, 0.22)');
            pulseGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = pulseGradient;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(pulseX, pulse.y);
            ctx.lineTo(pulseX + pulseWidth, pulse.y);
            ctx.stroke();
        });

        const coreGlow = ctx.createRadialGradient(centerX, height * 0.46, 0, centerX, height * 0.46, width * 0.3);
        coreGlow.addColorStop(0, 'rgba(76, 228, 255, 0.16)');
        coreGlow.addColorStop(0.45, 'rgba(76, 228, 255, 0.05)');
        coreGlow.addColorStop(1, 'rgba(76, 228, 255, 0)');
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(centerX, height * 0.46, width * 0.28, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
};

console.log('✅ MONITOR 4K MODULE loaded');