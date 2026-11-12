/**
 * MODULES/GOLDEN-COMMIT.JS - Commit dorado
 * Responsabilidad: hacer aparecer cada 60–180 s (CONFIG.GOLDEN_COMMIT) un botón
 * dorado clicable con recompensa variable. La recompensa se calcula y aplica en
 * gameState; aquí solo vive el ciclo aparecer → clicar/expirar → reprogramar.
 * El temporizador no se guarda: tras recargar se programa uno nuevo.
 */

const goldenCommitModule = {
    el: null,
    active: false,
    nextSpawnAt: 0,
    expiresAt: 0,

    init(now = Date.now()) {
        this.scheduleNext(now);
    },

    scheduleNext(now = Date.now()) {
        const { MIN_INTERVAL_MS, MAX_INTERVAL_MS } = CONFIG.GOLDEN_COMMIT;
        this.nextSpawnAt = now + MIN_INTERVAL_MS + (Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS));
    },

    // Llamado desde el game loop en cada tick.
    tick(now = Date.now()) {
        if (this.active) {
            if (now >= this.expiresAt) {
                this.despawn();
            }
            return;
        }

        // No aparece con la pestaña oculta ni encima de un modal: se perdería.
        if (document.hidden || eventsModule.isModalOpen()) return;
        if (now >= this.nextSpawnAt) {
            this.spawn(now);
        }
    },

    spawn(now = Date.now()) {
        if (this.active) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'golden-commit';
        button.setAttribute('aria-label', 'Commit dorado: clic para reclamar la recompensa');
        button.innerHTML = '<i class="fas fa-code-commit"></i><span>Commit dorado</span>';
        // Posición aleatoria dentro del viewport, lejos de los bordes.
        button.style.left = `${8 + Math.random() * 74}%`;
        button.style.top = `${16 + Math.random() * 62}%`;
        button.addEventListener('click', event => {
            event.stopPropagation();
            this.claim();
        });

        document.body.appendChild(button);
        this.el = button;
        this.active = true;
        this.expiresAt = now + CONFIG.GOLDEN_COMMIT.LIFETIME_MS;
        feedbackModule.play('golden_spawn');
    },

    despawn() {
        if (this.el) {
            this.el.remove();
        }
        this.el = null;
        this.active = false;
        this.scheduleNext();
    },

    claim() {
        if (!this.active) return;

        const origin = this.getCenter();
        const codeBefore = gameState.code;
        const reward = gameState.applyGoldenCommitReward(gameState.rollGoldenCommitReward());
        this.despawn();

        uiModule.showNotification(this.describeReward(reward), 'success', { duration: 4500 });
        uiModule.update();
        // Slowmo + explosión dorada donde estaba el botón; las monedas vuelan al
        // contador (más cuanto mayor la recompensa) y el contador rueda al nuevo valor.
        feedbackModule.play('golden_claim', this.buildClaimContext(origin, codeBefore, reward));
        achievementsModule.checkAll();
        gameState.save(true);
    },

    buildClaimContext(origin, codeBefore, reward = { type: 'code' }) {
        // Contador visible: el de la barra de progreso o, si no se ve, el del header.
        const counter = ['codeDisplay', 'currentCodeHeader']
            .map(id => document.getElementById(id))
            .find(element => element && fxModule.isVisible(element)) || document.getElementById('codeDisplay');
        // Intensidad según la recompensa: segundos de producción que vale (código) o tipo.
        const production = Math.max(1e-9, gameState.getRewardGenerationBase());
        const seconds = reward.type === 'code' ? (reward.amount || 0) / production : 120;
        const count = Math.round(Math.max(6, Math.min(16, 6 + (seconds / 30))));
        return {
            x: origin.x,
            y: origin.y,
            counter,
            count,
            countShort: Math.max(4, Math.round(count / 2)),
            quantity: 30 + (count * 3),
            odometerMs: 300 + (count * 70),
            from: Math.floor(codeBefore),
            to: Math.floor(gameState.code)
        };
    },

    describeReward(reward) {
        if (reward.type === 'code') {
            return `✨ Commit dorado: +${reward.amount.toLocaleString()} código`;
        }
        if (reward.type === 'frenzy') {
            return `✨ Commit dorado: clicks x${reward.factor} durante ${Math.round(reward.durationMs / 1000)} s`;
        }
        return `✨ Commit dorado: +${reward.commits} carga de release`;
    },

    // Centro del botón en píxeles (origen de la explosión).
    getCenter() {
        if (!this.el?.getBoundingClientRect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const rect = this.el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
};

console.log('✅ GOLDEN COMMIT MODULE loaded');
