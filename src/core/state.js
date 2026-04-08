/**
 * STATE.JS - Gestiona el estado centralizado del juego
 * Patrón: Simple Object con métodos para actualizar datos
 * Facilita debugging, testing y persistencia
 * 
 * Nota: Este archivo es muy largo (>6000 líneas). 
 * En el futuro, considerar dividir en:
 *   - state-progress.js (clicks, commits, prestige)
 *   - state-health.js (project health, responsibility)
 *   - state-collections.js (languages, upgrades, team)
 *   - state-persistence.js (save/load/migration)
 */

// El contenido completo de state.js va aquí
// Por brevedad en esta demostración, se incluye el esqueleto
// En la implementación real, copiado desde src/state.js

class GameState {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.clearAllEffectTokens();
        this.admin = this.admin || {
            enabled: false,
            creativeMode: false
        };

        // Progreso
        this.code = 0;
        this.commitProgress = 0;
        this.totalCode = 0;
        this.codePerClick = CONFIG.INITIAL_CODE_PER_CLICK;
        this.clicks = 0;
        this.commits = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.passiveGeneration = 0;
        this.prestigePoints = 0;
        this.prestigeLevel = 0;
        this.currentSpecialization = null;
        this.releaseCharge = 0;
        this.releaseCount = 0;
        this.releaseVersion = { major: 0, minor: 1, patch: 0 };
        this.lastReleaseReport = null;
        this.maintenance = {
            activeUntil: 0,
            cooldownUntil: 0
        };
        this.projectHealth = {
            quality: CONFIG.PROJECT_HEALTH.STARTING_QUALITY,
            technicalDebt: CONFIG.PROJECT_HEALTH.STARTING_DEBT,
            lastState: 'stable'
        };
        this.responsibility = {
            value: CONFIG.RESPONSIBILITY.STARTING_VALUE,
            lastState: 'accountable'
        };
        this.responsibilityStats = {
            trustedReleaseCount: 0,
            responsibilityRecoveryCount: 0,
            highResponsibilitySeconds: 0
        };
        this.healthStats = {
            maintenanceCount: 0,
            healthyReleaseCount: 0,
            cleanReleaseCount: 0,
            riskyReleaseCount: 0,
            healthySeconds: 0
        };
        this.currentTrend = null;
        this.offlineReport = null;
        this.activeEffects = {
            clickMultiplier: 1,
            passiveMultiplier: 1
        };
        this.effectTokens = {
            clickMultiplier: new Set(),
            passiveMultiplier: new Set()
        };
        
        // Preferencias
        this.soundEnabled = true;
        this.theme = 'dark';
        
        // Eventos
        this.eventCooldown = 0;
        
        // Hijos - Inicializar desde CONFIG
        this.initializeCollections();
        this.refreshAllMissions(true);
        this.refreshTrend(true);
        
        // Timestamps
        this.lastUpdate = Date.now();
        this.lastClickTime = Date.now();
        this.lastSavedAt = Date.now();
        this.lastPersistAt = 0;
    }
    
    initializeCollections() {
        // Lenguajes
        this.languages = {};
        Object.entries(CONFIG.LANGUAGES).forEach(([key, config]) => {
            this.languages[key] = {
                ...config,
                owned: 0,
                cost: config.cost
            };
        });
        
        // Upgrades
        this.upgrades = {};
        Object.entries(CONFIG.UPGRADES).forEach(([key, config]) => {
            this.upgrades[key] = {
                ...config,
                owned: 0,
                cost: config.cost
            };
        });
        
        // Frameworks
        this.frameworks = {};
        Object.entries(CONFIG.FRAMEWORKS).forEach(([key, config]) => {
            this.frameworks[key] = {
                ...config,
                owned: 0,
                cost: config.cost
            };
        });

        this.artifacts = {};
        Object.entries(CONFIG.ARTIFACTS).forEach(([key, config]) => {
            this.artifacts[key] = {
                ...config,
                owned: 0
            };
        });

        // Equipo
        this.team = {};
        Object.entries(CONFIG.TEAM).forEach(([key, config]) => {
            this.team[key] = {
                ...config,
                owned: 0,
                cost: config.cost
            };
        });
        
        // Logros
        this.achievements = {};
        Object.entries(CONFIG.ACHIEVEMENTS).forEach(([key, config]) => {
            this.achievements[key] = {
                ...config,
                unlocked: false
            };
        });
    }

    // Métodos esenciales
    addCode(amount) {
        const safeAmount = Math.max(0, Number(amount) || 0);
        this.code += safeAmount;
        this.totalCode += safeAmount;
    }

    earnCode(amount) {
        const safeAmount = Math.max(0, Number(amount) || 0);
        this.addCode(safeAmount);
        this.commitProgress += safeAmount;
    }

    addCommit() {
        this.commits++;
        this.releaseCharge++;
        this.commitProgress = Math.max(0, this.commitProgress - CONFIG.CODE_PER_COMMIT);
        this.applyProjectHealthImpact({
            quality: -CONFIG.PROJECT_HEALTH.COMMIT_QUALITY_DECAY,
            debt: CONFIG.PROJECT_HEALTH.COMMIT_DEBT_GAIN
        });
    }

    updateStreak(now = Date.now()) {
        if (now - this.lastClickTime < CONFIG.STREAK_TIMEOUT) {
            this.streak++;
        } else {
            this.streak = 1;
        }
        this.lastClickTime = now;
        
        if (this.streak > this.maxStreak) {
            this.maxStreak = this.streak;
        }
    }

    canAffordCodeCost(amount) {
        return this.isCreativeModeEnabled() || this.code >= amount;
    }

    spendCode(amount) {
        if (this.isCreativeModeEnabled()) return true;
        if (this.code < amount) return false;

        this.code -= amount;
        return true;
    }

    isCreativeModeEnabled() {
        return !!this.admin?.creativeMode;
    }

    setCreativeMode(value) {
        this.admin.creativeMode = !!value;
        if (this.admin.creativeMode) {
            this.admin.enabled = true;
        }
    }

    calculateGeneration() {
        const base = this.passiveGeneration;
        return base * this.getPrestigeMultiplier() * this.activeEffects.passiveMultiplier;
    }

    calculateClickPower() {
        return this.codePerClick * this.getPrestigeMultiplier() * this.activeEffects.clickMultiplier;
    }

    getPrestigeMultiplier() {
        return 1 + (this.prestigePoints * CONFIG.PRESTIGE_BONUS_PER_POINT);
    }

    getProjectHealthSnapshot() {
        return {
            quality: this.projectHealth.quality,
            technicalDebt: this.projectHealth.technicalDebt,
            state: this.getProjectHealthState()
        };
    }

    getProjectHealthState() {
        const { quality, technicalDebt } = this.projectHealth;
        const { STATES } = CONFIG.PROJECT_HEALTH;

        if (quality >= STATES.premium.minQuality && technicalDebt <= STATES.premium.maxDebt) {
            return { key: 'premium', ...STATES.premium };
        }

        if (quality >= STATES.stable.minQuality && technicalDebt <= STATES.stable.maxDebt) {
            return { key: 'stable', ...STATES.stable };
        }

        if (quality >= STATES.underPressure.minQuality && technicalDebt <= STATES.underPressure.maxDebt) {
            return { key: 'underPressure', ...STATES.underPressure };
        }

        if (quality >= STATES.fragile.minQuality && technicalDebt <= STATES.fragile.maxDebt) {
            return { key: 'fragile', ...STATES.fragile };
        }

        return { key: 'critical', ...STATES.critical };
    }

    applyProjectHealthImpact({ quality = 0, debt = 0 } = {}) {
        if (quality !== 0) {
            this.addQuality(quality);
        }

        if (debt !== 0) {
            this.addTechnicalDebt(debt);
        }

        const state = this.getProjectHealthState();
        this.projectHealth.lastState = state.key;
        return this.getProjectHealthSnapshot();
    }

    addQuality(amount) {
        this.projectHealth.quality = Math.max(0, Math.min(CONFIG.PROJECT_HEALTH.QUALITY_MAX, this.projectHealth.quality + amount));
        return this.projectHealth.quality;
    }

    addTechnicalDebt(amount) {
        this.projectHealth.technicalDebt = Math.max(0, Math.min(CONFIG.PROJECT_HEALTH.DEBT_MAX, this.projectHealth.technicalDebt + amount));
        return this.projectHealth.technicalDebt;
    }

    // Métodos de compra
    buyUpgrade(key) {
        const upgrade = this.upgrades[key];
        if (!upgrade) return false;
        if (upgrade.owned >= CONFIG.UPGRADE_MAX_OWNED) return false;
        if (!this.canAffordCodeCost(upgrade.cost)) return false;
        
        this.spendCode(upgrade.cost);
        upgrade.owned++;
        this.codePerClick *= upgrade.multiplier;
        upgrade.cost = Math.floor(upgrade.cost * CONFIG.UPGRADE_COST_SCALING);
        this.applyProjectHealthImpact(CONFIG.PROJECT_HEALTH.UPGRADE_EFFECTS[key]);
        return true;
    }
    
    buyLanguage(key) {
        const language = this.languages[key];
        if (!language) return false;
        if (!this.canAffordCodeCost(language.cost)) return false;
        
        this.spendCode(language.cost);
        language.owned++;
        this.passiveGeneration += language.generation;
        language.cost = Math.floor(language.cost * CONFIG.LANGUAGE_COST_SCALING);
        this.applyProjectHealthImpact({ quality: CONFIG.PROJECT_HEALTH.LANGUAGE_QUALITY_GAIN, debt: 0.15 });
        return true;
    }
    
    buyFramework(key) {
        const framework = this.frameworks[key];
        if (!framework) return false;
        if (!this.canAffordCodeCost(framework.cost)) return false;
        
        this.spendCode(framework.cost);
        framework.owned++;
        framework.cost = Math.floor(framework.cost * CONFIG.FRAMEWORK_COST_SCALING);
        this.applyProjectHealthImpact({ quality: CONFIG.PROJECT_HEALTH.FRAMEWORK_QUALITY_GAIN, debt: -0.35 });
        return true;
    }

    // Persistencia
    save(force = false) {
        const now = Date.now();
        if (!force && now - this.lastPersistAt < CONFIG.SAVE_THROTTLE_MS) {
            return false;
        }

        const data = {
            code: this.code,
            commitProgress: this.commitProgress,
            totalCode: this.totalCode,
            codePerClick: this.codePerClick,
            clicks: this.clicks,
            commits: this.commits,
            streak: this.streak,
            maxStreak: this.maxStreak,
            passiveGeneration: this.passiveGeneration,
            prestigePoints: this.prestigePoints,
            prestigeLevel: this.prestigeLevel,
            currentSpecialization: this.currentSpecialization,
            releaseCharge: this.releaseCharge,
            releaseCount: this.releaseCount,
            releaseVersion: this.releaseVersion,
            projectHealth: this.projectHealth,
            responsibility: this.responsibility,
            soundEnabled: this.soundEnabled,
            theme: this.theme,
            languages: this.languages,
            upgrades: this.upgrades,
            frameworks: this.frameworks,
            artifacts: this.artifacts,
            team: this.team,
            achievements: this.achievements,
            lastSavedAt: now
        };
        localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
        this.lastPersistAt = now;
        this.lastSavedAt = now;
        return true;
    }
    
    load() {
        const saved = localStorage.getItem(CONFIG.SAVE_KEY);
        if (!saved) return;

        const data = JSON.parse(saved);
        this.code = data.code ?? this.code;
        this.totalCode = data.totalCode ?? this.totalCode;
        this.codePerClick = data.codePerClick ?? this.codePerClick;
        this.clicks = data.clicks ?? this.clicks;
        this.commits = data.commits ?? this.commits;
        this.soundEnabled = data.soundEnabled ?? this.soundEnabled;
        this.theme = data.theme ?? this.theme;
        this.lastSavedAt = data.lastSavedAt ?? this.lastSavedAt;
    }

    clearAllEffectTokens() {
        if (!this.effectTokens) return;
        Object.values(this.effectTokens).forEach(tokenSet => {
            if (tokenSet?.clear) tokenSet.clear();
        });
    }
}

// Instancia global
const gameState = new GameState();
gameState.load();

console.log('✅ STATE loaded');
