/**
 * STATE.JS - Gestiona el estado centralizado del juego
 * Patrón: Simple Object con métodos para actualizar datos
 * Facilita debugging, testing y persistencia
 */

class GameState {
    constructor() {
        this.reset();
    }
    
    // === RESET COMPLETO ===
    reset() {
        this.persistenceLocked = false;
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
            highResponsibilitySeconds: 0,
            weakStateReached: false
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
        // Efectos temporales con fecha de expiración: sobreviven a recargas
        // y se expiran solos aunque el juego se cierre a mitad del efecto.
        this.timedEffects = [];

        // Onboarding: features desbloqueadas, tips ya mostrados y pestañas
        // con badge NEW pendiente. Se conservan en el prestige.
        this.unlockedFeatures = [];
        this.seenTips = [];
        this.newTabBadges = [];
        
        // Preferencias
        this.soundEnabled = true;
        this.theme = 'dark';
        this.audioSettings = this.getDefaultAudioSettings();
        this.visualSettings = { ...CONFIG.VISUAL_SETTINGS_DEFAULTS };
        // Veces que se vio cada coreografía (para usar la versión corta después)
        this.seenChoreographies = {};
        // Mayor potencia de 10 de código total ya celebrada (récord: se conserva en el prestige)
        this.codePowerRecord = 0;
        // Contenido para programadores: ticker y nerd stats (se guardan y se conservan en el prestige)
        this.devSettings = { ...CONFIG.DEV_SETTINGS_DEFAULTS };

        // Eventos
        this.eventCooldown = 0;
        
        // Hijos - Inicializar desde CONFIG
        this.initializeCollections();
        // Partida nueva y cada prestige pasan por aquí. Al cargar una partida,
        // applySaveData() pisa estas unidades con las guardadas.
        this.applyStartingLanguages();
        this.refreshAllMissions(true);
        this.refreshTrend(true);
        
        // Timestamps
        this.lastUpdate = Date.now();
        this.lastClickTime = Date.now();
        this.lastSavedAt = Date.now();
        this.lastPersistAt = 0;
    }
    
    // === INICIALIZAR COLECCIONES ===
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
    
    applyStartingLanguages() {
        Object.entries(CONFIG.STARTING_LANGUAGES || {}).forEach(([key, count]) => {
            const language = this.languages[key];
            const definition = CONFIG.LANGUAGES[key];
            const amount = Math.max(0, Math.floor(Number(count) || 0));
            if (!language || !definition || amount === 0) return;

            language.owned += amount;
            language.cost = this.calculateScaledCost(definition.cost, CONFIG.LANGUAGE_COST_SCALING, language.owned);
            this.passiveGeneration += definition.generation * amount;
        });
    }

    // === AJUSTES DE AUDIO Y VISUALES ===
    // Valor 0–100 por slider; el por defecto sale del volumen de su primer bus.
    getDefaultAudioSettings() {
        return Object.fromEntries(CONFIG.AUDIO_SLIDERS.map(slider => [
            slider.key,
            Math.round((CONFIG.AUDIO_BUSES[slider.buses[0]]?.volume ?? 1) * 100)
        ]));
    }

    sanitizeAudioSettings(raw) {
        const defaults = this.getDefaultAudioSettings();
        const source = raw && typeof raw === 'object' ? raw : {};
        return Object.fromEntries(Object.entries(defaults).map(([key, value]) => {
            const candidate = Number(source[key]);
            return [key, Number.isFinite(candidate) ? Math.max(0, Math.min(100, Math.round(candidate))) : value];
        }));
    }

    sanitizeVisualSettings(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        return {
            reduceMotion: typeof source.reduceMotion === 'boolean' ? source.reduceMotion : CONFIG.VISUAL_SETTINGS_DEFAULTS.reduceMotion,
            shortCelebrations: typeof source.shortCelebrations === 'boolean' ? source.shortCelebrations : CONFIG.VISUAL_SETTINGS_DEFAULTS.shortCelebrations
        };
    }

    recordChoreographyView(id) {
        this.seenChoreographies[id] = (this.seenChoreographies[id] || 0) + 1;
        return this.seenChoreographies[id];
    }

    sanitizeDevSettings(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const defaults = CONFIG.DEV_SETTINGS_DEFAULTS;
        return {
            ticker: ['running', 'paused', 'hidden'].includes(source.ticker) ? source.ticker : defaults.ticker,
            nerdStats: typeof source.nerdStats === 'boolean' ? source.nerdStats : defaults.nerdStats
        };
    }

    // Nerd stats: sin elección del jugador se activan solos tras el primer prestige.
    isNerdStatsEnabled() {
        const setting = this.devSettings?.nerdStats;
        return setting === null || setting === undefined ? this.prestigeLevel > 0 : !!setting;
    }

    // Potencia de 10 del código total de la run (1M → 6). 0 sin código.
    getCodePower(totalCode = this.totalCode) {
        if (!(totalCode >= 1)) return 0;
        return Math.floor(Math.log10(totalCode) + 1e-9);
    }

    // === MÉTODOS DE PROGRESO ===
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

    scaleCodePools(multiplier, options = {}) {
        const { affectCommitProgress = true } = options;
        const safeMultiplier = Math.max(0, Number(multiplier) || 0);
        this.code *= safeMultiplier;

        if (affectCommitProgress) {
            this.commitProgress *= safeMultiplier;
        }
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

    addPrestigePoints(amount) {
        this.prestigePoints += amount;
    }

    clampResponsibilityValue(value) {
        return Math.max(0, Math.min(CONFIG.RESPONSIBILITY.MAX, Number(value) || 0));
    }

    addResponsibility(amount) {
        this.responsibility.value = this.clampResponsibilityValue(this.responsibility.value + amount);
        this.responsibility.lastState = this.getResponsibilityState().key;
        this.trackResponsibilityRecovery();
        return this.responsibility.value;
    }

    // Una "recuperación" es volver a un estado sano (responsable/ejemplar)
    // después de haber caído a uno débil, aunque la subida sea gradual.
    trackResponsibilityRecovery() {
        const stateKey = this.getResponsibilityState().key;
        if (['opportunistic', 'negligent'].includes(stateKey)) {
            this.responsibilityStats.weakStateReached = true;
            return;
        }

        if (this.responsibilityStats.weakStateReached && ['accountable', 'exemplary'].includes(stateKey)) {
            this.responsibilityStats.responsibilityRecoveryCount++;
            this.responsibilityStats.weakStateReached = false;
        }
    }

    applyResponsibilityImpact(amount = 0) {
        const previousValue = this.responsibility.value;
        if (amount === 0) {
            return {
                ...this.getResponsibilitySnapshot(),
                previousValue,
                delta: 0,
                requestedDelta: 0
            };
        }

        const modifiers = this.getResponsibilityModifiers();
        const adjustedAmount = amount > 0
            ? amount * modifiers.gainMultiplier
            : amount * modifiers.lossMultiplier;

        this.addResponsibility(adjustedAmount);
        const delta = this.responsibility.value - previousValue;

        return {
            ...this.getResponsibilitySnapshot(),
            previousValue,
            delta,
            requestedDelta: amount
        };
    }

    getResponsibilityState() {
        const value = this.responsibility.value;
        const { STATES } = CONFIG.RESPONSIBILITY;

        if (value >= STATES.exemplary.minValue) {
            return { key: 'exemplary', ...STATES.exemplary };
        }

        if (value >= STATES.accountable.minValue) {
            return { key: 'accountable', ...STATES.accountable };
        }

        if (value >= STATES.strained.minValue) {
            return { key: 'strained', ...STATES.strained };
        }

        if (value >= STATES.opportunistic.minValue) {
            return { key: 'opportunistic', ...STATES.opportunistic };
        }

        return { key: 'negligent', ...STATES.negligent };
    }

    getResponsibilitySnapshot() {
        return {
            value: this.responsibility.value,
            state: this.getResponsibilityState()
        };
    }

    getResponsibilityBaselineValue() {
        return this.clampResponsibilityValue(
            CONFIG.RESPONSIBILITY.STARTING_VALUE
            + Math.min(
                CONFIG.RESPONSIBILITY.PRESTIGE_BASELINE_CAP,
                this.prestigePoints * CONFIG.RESPONSIBILITY.PRESTIGE_BASELINE_PER_POINT
            )
        );
    }

    getResponsibilityModifiers() {
        const specialization = this.getSpecialization() || {};
        const artifactModifiers = Object.values(this.artifacts).reduce((acc, artifact) => {
            if (!artifact || artifact.owned <= 0) return acc;

            acc.gainMultiplier *= artifact.responsibilityGainMultiplier || 1;
            acc.lossMultiplier *= artifact.responsibilityLossMultiplier || 1;
            acc.trustRepBonus += artifact.responsibilityTrustRepBonus || 0;
            acc.trustVolatilityMultiplier *= artifact.responsibilityTrustVolatilityMultiplier || 1;
            return acc;
        }, {
            gainMultiplier: 1,
            lossMultiplier: 1,
            trustRepBonus: 0,
            trustVolatilityMultiplier: 1
        });

        const prestigeGain = Math.min(
            CONFIG.RESPONSIBILITY.PRESTIGE_GAIN_CAP,
            this.prestigePoints * CONFIG.RESPONSIBILITY.PRESTIGE_GAIN_PER_POINT
        );
        const prestigeLossReduction = Math.min(
            CONFIG.RESPONSIBILITY.PRESTIGE_LOSS_REDUCTION_CAP,
            this.prestigePoints * CONFIG.RESPONSIBILITY.PRESTIGE_LOSS_REDUCTION_PER_POINT
        );

        return {
            gainMultiplier: artifactModifiers.gainMultiplier * (specialization.responsibilityGainMultiplier || 1) * (1 + prestigeGain),
            lossMultiplier: artifactModifiers.lossMultiplier * (specialization.responsibilityLossMultiplier || 1) * (1 - prestigeLossReduction),
            trustRepBonus: artifactModifiers.trustRepBonus + (specialization.responsibilityTrustRepBonus || 0),
            trustVolatilityMultiplier: artifactModifiers.trustVolatilityMultiplier * (specialization.responsibilityTrustVolatilityMultiplier || 1),
            baselineValue: this.getResponsibilityBaselineValue()
        };
    }

    getTeamResponsibilityProfile() {
        const responsibility = this.getResponsibilitySnapshot();
        const projectHealth = this.getProjectHealthSnapshot();
        const rules = CONFIG.RESPONSIBILITY.TEAM;
        const normalized = (responsibility.value - 50) / 50;
        const stateStrain = rules.STRAIN_BY_HEALTH_STATE[projectHealth.state.key] ?? 0.08;
        const strainMultiplier = normalized >= 0
            ? 1 - (normalized * rules.POSITIVE_STRAIN_REDUCTION)
            : 1 + (Math.abs(normalized) * rules.NEGATIVE_STRAIN_AMPLIFICATION);
        const effectiveStrain = stateStrain * strainMultiplier;
        const baseMultiplier = Math.max(
            0.7,
            Math.min(
                1.18,
                1 - effectiveStrain + (Math.max(0, normalized) * rules.BASE_RESPONSIBILITY_BOOST) - (Math.max(0, -normalized) * rules.BASE_RESPONSIBILITY_PENALTY)
            )
        );
        const specialistMultiplier = normalized >= 0
            ? 1 + (normalized * rules.SPECIALIST_HIGH_TRUST_BOOST)
            : 1 - (Math.abs(normalized) * rules.SPECIALIST_LOW_TRUST_PENALTY);

        let pressureLabel = 'Carga sostenible';
        if (effectiveStrain >= 0.24) {
            pressureLabel = 'Sobrecarga fuerte';
        } else if (effectiveStrain >= 0.14) {
            pressureLabel = 'Presión operativa';
        } else if (effectiveStrain >= 0.08) {
            pressureLabel = 'Ritmo exigente';
        }

        let ownershipLabel = 'Ownership sólido';
        if (responsibility.state.key === 'negligent') {
            ownershipLabel = 'Ownership débil';
        } else if (responsibility.state.key === 'opportunistic') {
            ownershipLabel = 'Ownership inestable';
        } else if (responsibility.state.key === 'strained') {
            ownershipLabel = 'Ownership tensionado';
        } else if (responsibility.state.key === 'exemplary') {
            ownershipLabel = 'Ownership ejemplar';
        }

        return {
            responsibility,
            projectHealth,
            baseMultiplier,
            specialistMultiplier,
            effectiveStrain,
            pressureLabel,
            ownershipLabel
        };
    }

    trackResponsibilityTime(deltaSeconds) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

        const state = this.getResponsibilityState();
        if (state.key === 'accountable' || state.key === 'exemplary') {
            this.responsibilityStats.highResponsibilitySeconds += deltaSeconds;
        }
    }

    getTeamMemberResponsibilityMultiplier(key, profile = this.getTeamResponsibilityProfile()) {
        const specialistKeys = new Set(['qa', 'devops', 'architect']);
        const roleMultiplier = specialistKeys.has(key) ? profile.specialistMultiplier : 1;
        return profile.baseMultiplier * roleMultiplier;
    }

    clampProjectHealthValue(value, max) {
        return Math.max(0, Math.min(max, Number(value) || 0));
    }

    addQuality(amount) {
        this.projectHealth.quality = this.clampProjectHealthValue(
            this.projectHealth.quality + amount,
            CONFIG.PROJECT_HEALTH.QUALITY_MAX
        );

        return this.projectHealth.quality;
    }

    addTechnicalDebt(amount) {
        this.projectHealth.technicalDebt = this.clampProjectHealthValue(
            this.projectHealth.technicalDebt + amount,
            CONFIG.PROJECT_HEALTH.DEBT_MAX
        );

        return this.projectHealth.technicalDebt;
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

    getClickProjectHealthImpact() {
        const modifiers = this.getHealthModifiers();
        const streakPressure = 1 + Math.min(this.streak / 80, 0.75);
        return {
            quality: -(CONFIG.PROJECT_HEALTH.CLICK_QUALITY_DECAY * streakPressure * modifiers.clickQualityDecayMultiplier),
            debt: CONFIG.PROJECT_HEALTH.CLICK_DEBT_GAIN * streakPressure * modifiers.clickDebtMultiplier
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

    getProjectHealthSnapshot() {
        return {
            quality: this.projectHealth.quality,
            technicalDebt: this.projectHealth.technicalDebt,
            state: this.getProjectHealthState()
        };
    }

    trackProjectHealthTime(deltaSeconds) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

        const state = this.getProjectHealthState();
        if (state.key === 'stable' || state.key === 'premium') {
            this.healthStats.healthySeconds += deltaSeconds;
        }
    }

    getMaintenanceCost() {
        const modifiers = this.getHealthModifiers();
        return Math.max(
            300,
            Math.floor((CONFIG.MAINTENANCE.BASE_COST + (this.projectHealth.technicalDebt * CONFIG.MAINTENANCE.COST_PER_DEBT)) * modifiers.maintenanceCostMultiplier)
        );
    }

    getMaintenanceStatus(now = Date.now()) {
        const activeRemainingMs = Math.max(0, (this.maintenance?.activeUntil || 0) - now);
        const cooldownRemainingMs = Math.max(0, (this.maintenance?.cooldownUntil || 0) - now);
        const isActive = activeRemainingMs > 0;
        const isCoolingDown = !isActive && cooldownRemainingMs > 0;

        return {
            isActive,
            isCoolingDown,
            activeRemainingMs,
            cooldownRemainingMs,
            cost: this.getMaintenanceCost(),
            clickMultiplier: isActive ? CONFIG.MAINTENANCE.CLICK_MULTIPLIER : 1,
            passiveMultiplier: isActive ? CONFIG.MAINTENANCE.PASSIVE_MULTIPLIER : 1
        };
    }

    canStartMaintenance(now = Date.now()) {
        const status = this.getMaintenanceStatus(now);
        if (status.isActive) {
            return { ok: false, reason: 'active', status };
        }

        if (status.isCoolingDown) {
            return { ok: false, reason: 'cooldown', status };
        }

        if (!this.canAffordCodeCost(status.cost)) {
            return { ok: false, reason: 'cost', status };
        }

        return { ok: true, reason: null, status };
    }

    startMaintenance(now = Date.now()) {
        const check = this.canStartMaintenance(now);
        if (!check.ok) {
            return check;
        }

        this.spendCode(check.status.cost);
        this.maintenance.activeUntil = now + CONFIG.MAINTENANCE.DURATION_MS;
        this.maintenance.cooldownUntil = now + CONFIG.MAINTENANCE.DURATION_MS + CONFIG.MAINTENANCE.COOLDOWN_MS;
        this.healthStats.maintenanceCount++;
        const modifiers = this.getHealthModifiers();
        const qualityRestore = CONFIG.MAINTENANCE.QUALITY_RESTORE * modifiers.maintenanceQualityMultiplier;
        const debtReduction = CONFIG.MAINTENANCE.DEBT_REDUCTION * modifiers.maintenanceDebtReductionMultiplier;
        this.applyProjectHealthImpact({
            quality: qualityRestore,
            debt: -debtReduction
        });

        return {
            ok: true,
            reason: null,
            status: this.getMaintenanceStatus(now),
            cost: check.status.cost,
            qualityRestore,
            debtReduction
        };
    }

    isAdminEnabled() {
        return !!this.admin?.enabled;
    }

    setAdminEnabled(value) {
        this.admin.enabled = !!value;
        if (!this.admin.enabled) {
            this.admin.creativeMode = false;
        }
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

    canAffordCodeCost(amount) {
        return this.isCreativeModeEnabled() || this.code >= amount;
    }

    canAffordPrestigeCost(amount) {
        return this.isCreativeModeEnabled() || this.prestigePoints >= amount;
    }

    spendCode(amount) {
        if (this.isCreativeModeEnabled()) return true;
        if (this.code < amount) return false;

        this.code -= amount;
        return true;
    }

    spendPrestigePoints(amount) {
        if (this.isCreativeModeEnabled()) return true;
        if (this.prestigePoints < amount) return false;

        this.prestigePoints -= amount;
        return true;
    }

    clearOfflineReport() {
        this.offlineReport = null;
    }

    // === EFECTOS TEMPORALES ===
    addTimedEffect({ stat, factor, durationMs, endMessage = null }, now = Date.now()) {
        if (!CONFIG.TIMED_EFFECT_STATS.includes(stat)) return null;

        const effect = {
            id: `${stat}-${now}-${Math.random().toString(36).slice(2, 8)}`,
            stat,
            factor: Number(factor) || 1,
            expiresAt: now + Math.max(0, Number(durationMs) || 0),
            endMessage
        };
        this.timedEffects.push(effect);
        return effect;
    }

    getEffectMultiplier(stat, now = Date.now()) {
        return this.timedEffects.reduce((multiplier, effect) => {
            if (effect.stat !== stat || effect.expiresAt <= now) return multiplier;
            return multiplier * effect.factor;
        }, 1);
    }

    pruneExpiredEffects(now = Date.now()) {
        const expired = [];
        this.timedEffects = this.timedEffects.filter(effect => {
            if (effect.expiresAt <= now) {
                expired.push(effect);
                return false;
            }
            return true;
        });
        return expired;
    }

    sanitizeTimedEffects(rawEffects) {
        if (!Array.isArray(rawEffects)) return [];

        return rawEffects
            .filter(effect => effect
                && CONFIG.TIMED_EFFECT_STATS.includes(effect.stat)
                && Number.isFinite(effect.factor)
                && effect.factor > 0
                && effect.factor <= CONFIG.TIMED_EFFECT_MAX_FACTOR
                && Number.isFinite(effect.expiresAt))
            .map(effect => ({
                id: String(effect.id || `${effect.stat}-${effect.expiresAt}`),
                stat: effect.stat,
                factor: effect.factor,
                expiresAt: effect.expiresAt,
                endMessage: typeof effect.endMessage === 'string' ? effect.endMessage : null
            }));
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
    
    // === COMPRAS ===
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

    buyTeamMember(key) {
        const member = this.team[key];
        if (!member) return false;
        if (!this.canAffordCodeCost(member.cost)) return false;

        this.spendCode(member.cost);
        member.owned++;
        member.cost = Math.floor(member.cost * CONFIG.TEAM_COST_SCALING);
        this.applyProjectHealthImpact(CONFIG.PROJECT_HEALTH.TEAM_EFFECTS[key]);
        return true;
    }

    buyArtifact(key) {
        const artifact = this.artifacts[key];
        if (!artifact || artifact.owned > 0) return false;
        if (!this.canAffordPrestigeCost(artifact.cost)) return false;

        this.spendPrestigePoints(artifact.cost);
        artifact.owned = 1;
        return true;
    }

    assignSpecialization(key) {
        if (!CONFIG.SPECIALIZATIONS[key]) return false;
        if (this.currentSpecialization === key) return true;

        if (this.currentSpecialization && !this.canAffordCodeCost(CONFIG.SPECIALIZATION_SWITCH_COST)) {
            return false;
        }

        if (this.currentSpecialization) {
            this.spendCode(CONFIG.SPECIALIZATION_SWITCH_COST);
        }

        this.currentSpecialization = key;
        return true;
    }
    
    // === LOGROS ===
    unlockAchievement(key) {
        const ach = this.achievements[key];
        if (ach && !ach.unlocked) {
            ach.unlocked = true;
            return true;
        }
        return false;
    }
    
    getUnlockedAchievements() {
        return Object.values(this.achievements).filter(a => a.unlocked).length;
    }

    getSpecialization() {
        return this.currentSpecialization ? CONFIG.SPECIALIZATIONS[this.currentSpecialization] : null;
    }

    getHealthModifiers() {
        const specialization = this.getSpecialization() || {};
        const artifactModifiers = Object.values(this.artifacts).reduce((acc, artifact) => {
            if (!artifact || artifact.owned <= 0) return acc;

            acc.clickDebtMultiplier *= artifact.clickDebtMultiplier || 1;
            acc.clickQualityDecayMultiplier *= artifact.clickQualityDecayMultiplier || 1;
            acc.maintenanceCostMultiplier *= artifact.maintenanceCostMultiplier || 1;
            acc.maintenanceQualityMultiplier *= artifact.maintenanceQualityMultiplier || 1;
            acc.maintenanceDebtReductionMultiplier *= artifact.maintenanceDebtReductionMultiplier || 1;
            acc.releaseHealthBonus += artifact.releaseHealthBonus || 0;
            return acc;
        }, {
            clickDebtMultiplier: 1,
            clickQualityDecayMultiplier: 1,
            maintenanceCostMultiplier: 1,
            maintenanceQualityMultiplier: 1,
            maintenanceDebtReductionMultiplier: 1,
            releaseHealthBonus: 0
        });

        const prestigeReduction = Math.min(
            CONFIG.PRESTIGE_HEALTH_REDUCTION_CAP,
            this.prestigePoints * CONFIG.PRESTIGE_HEALTH_REDUCTION_PER_POINT
        );

        return {
            clickDebtMultiplier: artifactModifiers.clickDebtMultiplier * (specialization.clickDebtMultiplier || 1) * (1 - prestigeReduction),
            clickQualityDecayMultiplier: artifactModifiers.clickQualityDecayMultiplier * (specialization.clickQualityDecayMultiplier || 1) * (1 - (prestigeReduction * 0.85)),
            maintenanceCostMultiplier: artifactModifiers.maintenanceCostMultiplier * (specialization.maintenanceCostMultiplier || 1),
            maintenanceQualityMultiplier: artifactModifiers.maintenanceQualityMultiplier * (specialization.maintenanceQualityMultiplier || 1),
            maintenanceDebtReductionMultiplier: artifactModifiers.maintenanceDebtReductionMultiplier * (specialization.maintenanceDebtReductionMultiplier || 1),
            releaseHealthBonus: artifactModifiers.releaseHealthBonus
                + (specialization.releaseHealthBonus || 0)
                + Math.min(CONFIG.PRESTIGE_RELEASE_SCORE_CAP, this.prestigePoints * CONFIG.PRESTIGE_RELEASE_SCORE_PER_POINT)
        };
    }

    getHealthOverview() {
        const snapshot = this.getProjectHealthSnapshot();
        const modifiers = this.getHealthModifiers();
        const responsibility = this.getResponsibilitySnapshot();
        const releasePreview = this.getReleaseOutcomePreview();
        const strongestLevers = [];

        if (modifiers.releaseHealthBonus >= 6) {
            strongestLevers.push('releases más confiables');
        }
        if (modifiers.maintenanceCostMultiplier <= 0.9) {
            strongestLevers.push('mantenimiento más barato');
        }
        if (modifiers.clickDebtMultiplier <= 0.92 || modifiers.clickQualityDecayMultiplier <= 0.9) {
            strongestLevers.push('menos desgaste por iteración');
        }

        let recommendation = 'Tu build está equilibrada, pero conviene seguir mirando salud técnica, deuda y confianza de entrega.';
        if (snapshot.state.key === 'critical' || snapshot.state.key === 'fragile') {
            recommendation = 'La prioridad es estabilizar: mantenimiento, QA, DevOps o una ruta con menos deuda tienen más valor que empujar velocidad pura.';
        } else if (releasePreview.band.key === 'clean') {
            recommendation = 'La build ya soporta releases limpias. Puedes monetizar esa estabilidad con más cadence o ir por objetivos largos.';
        } else if (strongestLevers.length > 0) {
            recommendation = `Tu build favorece ${strongestLevers.join(', ')}.`;
        }

        let systemFocus = 'Calidad = salud del código · Deuda = fragilidad técnica · Responsabilidad = fiabilidad al prometer y sostener entregas.';
        if (responsibility.state.key === 'negligent' || responsibility.state.key === 'opportunistic') {
            systemFocus = 'La base técnica puede aguantar, pero la confianza operativa está floja: responsabilidad baja castiga expectativas y releases más que el código bruto.';
        } else if (snapshot.state.key === 'fragile' || snapshot.state.key === 'critical') {
            systemFocus = 'Tu liderazgo puede estar bien, pero la deuda ya está dañando la base técnica: aquí calidad y deuda pesan más que la confianza.';
        } else if (responsibility.state.key === 'accountable' || responsibility.state.key === 'exemplary') {
            systemFocus = 'La disciplina de entrega ya acompaña a la salud técnica: puedes convertir estabilidad en releases más creíbles y equipo más sólido.';
        }

        return {
            snapshot,
            responsibility,
            modifiers,
            releasePreview,
            maintenanceCost: this.getMaintenanceCost(),
            healthyReleases: this.healthStats.healthyReleaseCount,
            cleanReleases: this.healthStats.cleanReleaseCount,
            healthySeconds: this.healthStats.healthySeconds,
            recommendation,
            systemFocus
        };
    }

    getOwnedCount(collection) {
        return Object.values(collection).reduce((sum, item) => sum + (item.owned || 0), 0);
    }

    getMissionMetric(metric) {
        switch (metric) {
            case 'clicks':
                return this.clicks;
            case 'commits':
                return this.commits;
            case 'streak':
                // Racha actual: la misión registra su propio pico (mission.peak),
                // así una racha histórica no completa misiones nuevas.
                return this.streak;
            case 'quality':
                return this.projectHealth.quality;
            case 'responsibility':
                return this.responsibility.value;
            case 'upgradesOwned':
                return this.getOwnedCount(this.upgrades);
            case 'languagesOwned':
                return Object.values(this.languages).filter(language => language.owned > 0).length;
            case 'teamOwned':
                return this.getOwnedCount(this.team);
            case 'totalCode':
                return this.totalCode;
            case 'releaseCharge':
                return this.releaseCharge;
            case 'releaseCount':
                return this.releaseCount;
            case 'maintenanceCount':
                return this.healthStats.maintenanceCount;
            case 'healthyReleaseCount':
                return this.healthStats.healthyReleaseCount;
            case 'cleanReleaseCount':
                return this.healthStats.cleanReleaseCount;
            case 'trustedReleaseCount':
                return this.responsibilityStats.trustedReleaseCount;
            case 'responsibilityRecoveryCount':
                return this.responsibilityStats.responsibilityRecoveryCount;
            case 'healthySeconds':
                return this.healthStats.healthySeconds;
            case 'highResponsibilitySeconds':
                return this.responsibilityStats.highResponsibilitySeconds;
            case 'artifactsOwned':
                return this.getOwnedCount(this.artifacts);
            default:
                return 0;
        }
    }

    createMission(slot, forceDifferentId = null) {
        const pool = CONFIG.MISSIONS[slot];
        if (!pool || pool.length === 0) return null;

        const available = pool.filter(mission => mission.id !== forceDifferentId);
        const source = available.length > 0 ? available : pool;
        const selected = source[Math.floor(Math.random() * source.length)];
        return this.buildMission(selected, this.getMissionMetric(selected.metric), 0);
    }

    // Construye la misión activa a partir de la definición de CONFIG.
    // Solo id, startValue y peak se persisten; el resto sale siempre de CONFIG.
    buildMission(definition, startValue, peak = 0) {
        const safeStart = Number.isFinite(startValue) ? startValue : this.getMissionMetric(definition.metric);
        let target = definition.target;
        if (definition.minGain) {
            target = Math.max(target, Math.ceil(safeStart + definition.minGain));
            target = Math.min(target, definition.maxTarget ?? Infinity);
        }

        return {
            ...definition,
            target,
            desc: String(definition.desc).replace('{target}', target.toLocaleString()),
            startValue: safeStart,
            peak: Number.isFinite(peak) ? peak : 0
        };
    }

    hydrateMission(slot, saved) {
        if (!saved?.id) return null;
        const definition = (CONFIG.MISSIONS[slot] || []).find(mission => mission.id === saved.id);
        if (!definition) return null;
        return this.buildMission(definition, Number(saved.startValue), Number(saved.peak));
    }

    missionUsesDelta(metric) {
        return !['releaseCharge', 'streak', 'quality', 'responsibility'].includes(metric);
    }

    refreshMission(slot, force = false) {
        const current = this.missions?.[slot] || null;
        if (!force && current) return current;

        this.missions[slot] = this.createMission(slot, current?.id);
        return this.missions[slot];
    }

    refreshAllMissions(force = false) {
        this.missions = this.missions || { short: null, long: null };
        this.refreshMission('short', force || !this.missions.short);
        this.refreshMission('long', force || !this.missions.long);
    }

    getMissionRerollCost(slot) {
        const rule = CONFIG.MISSION_REROLL_COST[slot];
        return rule ? this.getGenerationReward(rule) : 0;
    }

    rerollMission(slot) {
        if (!this.missions?.[slot]) return { ok: false, reason: 'missing' };
        const cost = this.getMissionRerollCost(slot);
        if (!this.canAffordCodeCost(cost)) return { ok: false, reason: 'cost', cost };

        this.spendCode(cost);
        return { ok: true, cost, mission: this.refreshMission(slot, true) };
    }

    // Usado por admin para completar misiones sin hackear contadores.
    forceCompleteMission(slot) {
        const mission = this.missions?.[slot];
        if (!mission) return null;

        if (this.missionUsesDelta(mission.metric)) {
            mission.startValue = this.getMissionMetric(mission.metric) - mission.target;
        } else {
            mission.peak = Math.max(mission.peak || 0, mission.target);
        }

        return this.claimMission(slot);
    }

    getMissionProgress(slot) {
        const mission = this.missions?.[slot];
        if (!mission) return { current: 0, target: 1, percent: 0, complete: false };

        const rawCurrent = this.getMissionMetric(mission.metric);
        let current;
        if (this.missionUsesDelta(mission.metric)) {
            current = Math.max(0, rawCurrent - (mission.startValue ?? 0));
        } else {
            // Métricas que suben y bajan (racha, calidad, carga de release...):
            // se recuerda el mejor valor alcanzado desde que empezó la misión.
            mission.peak = Math.max(mission.peak || 0, rawCurrent);
            current = mission.peak;
        }
        const target = mission.target;
        const percent = Math.max(0, Math.min(100, (current / target) * 100));

        return {
            current,
            target,
            percent,
            complete: current >= target
        };
    }

    claimMission(slot) {
        const mission = this.missions?.[slot];
        const progress = this.getMissionProgress(slot);
        if (!mission || !progress.complete) return null;

        const rewardCode = this.getMissionRewardCode(mission);
        this.addCode(rewardCode);
        this.addPrestigePoints(mission.rewardRep || 0);

        const claimed = { ...mission, rewardCode };
        this.refreshMission(slot, true);
        return claimed;
    }

    getPrestigeMultiplier() {
        return 1 + (this.prestigePoints * CONFIG.PRESTIGE_BONUS_PER_POINT);
    }

    // Suma una propiedad del equipo ponderada por responsabilidad.
    // El perfil se calcula una sola vez por suma (antes se recalculaba por miembro).
    sumTeamStat(stat, { applyMilestones = false } = {}) {
        const members = Object.entries(this.team).filter(([, member]) => member.owned > 0 && member[stat]);
        if (members.length === 0) return 0;

        const profile = this.getTeamResponsibilityProfile();
        return members.reduce((sum, [key, member]) => {
            const milestoneMultiplier = applyMilestones ? this.getMilestoneMultiplier(member.owned) : 1;
            return sum + (member[stat] * member.owned * milestoneMultiplier * this.getTeamMemberResponsibilityMultiplier(key, profile));
        }, 0);
    }

    getTeamClickBonus() {
        return this.sumTeamStat('clickBoost');
    }

    getTeamPassiveBonus() {
        return this.sumTeamStat('passiveBoost');
    }

    getBasePassiveGeneration() {
        return Object.values(this.languages).reduce((sum, language) => {
            return sum + (language.generation * language.owned * this.getMilestoneMultiplier(language.owned));
        }, 0);
    }

    // === HITOS POR UNIDAD ===
    // Derivados de `owned`: no se guardan, así que las partidas viejas
    // reciben automáticamente los hitos que ya cumplían.
    getMilestoneLevel(owned) {
        return CONFIG.MILESTONES.THRESHOLDS.filter(threshold => owned >= threshold).length;
    }

    getMilestoneMultiplier(owned) {
        return Math.pow(CONFIG.MILESTONES.MULTIPLIER, this.getMilestoneLevel(owned));
    }

    getMilestoneProgress(owned) {
        const thresholds = CONFIG.MILESTONES.THRESHOLDS;
        const level = this.getMilestoneLevel(owned);
        const multiplier = this.getMilestoneMultiplier(owned);
        const next = thresholds[level] ?? null;
        const previous = level > 0 ? thresholds[level - 1] : 0;

        return {
            level,
            multiplier,
            next,
            previous,
            complete: next === null,
            nextMultiplier: next === null ? multiplier : multiplier * CONFIG.MILESTONES.MULTIPLIER,
            percent: next === null ? 100 : Math.max(0, Math.min(100, ((owned - previous) / (next - previous)) * 100))
        };
    }

    // === RECOMPENSAS ESCALADAS ===
    // Producción por segundo usada como base de recompensas: sin efectos
    // temporales ni mantenimiento, para que no se pueda inflar con un hackathon activo.
    getRewardGenerationBase() {
        return this.calculateGeneration({ includeTimedEffects: false, includeMaintenance: false });
    }

    getGenerationReward({ seconds = 0, min = 0 } = {}) {
        return Math.floor(Math.max(min, this.getRewardGenerationBase() * seconds));
    }

    getMissionRewardSeconds(mission) {
        if (!mission) return 0;
        return mission.rewardSeconds ?? ((mission.rewardCode || 0) / CONFIG.MISSION_REWARD.CODE_PER_SECOND);
    }

    getMissionRewardCode(mission) {
        if (!mission) return 0;
        return this.getGenerationReward({
            seconds: this.getMissionRewardSeconds(mission),
            min: mission.rewardCode || 0
        });
    }

    getArtifactBonus(type) {
        return Object.values(this.artifacts).reduce((sum, artifact) => {
            return sum + ((artifact[type] || 0) * (artifact.owned || 0));
        }, 0);
    }

    getTeamGeneration() {
        // Los hitos solo multiplican la producción, no los bonus de click/pasivo.
        return this.sumTeamStat('generation', { applyMilestones: true });
    }

    getSpecializationLanguageBonus() {
        const specialization = this.getSpecialization();
        if (!specialization) return 0;

        return Object.entries(specialization.languageBoosts || {}).reduce((sum, [key, boost]) => {
            const language = this.languages[key];
            if (!language || language.owned === 0) return sum;
            return sum + (language.generation * language.owned * boost);
        }, 0);
    }

    getFrameworkSynergyBonus() {
        const specialization = this.getSpecialization();

        return Object.entries(this.frameworks).reduce((sum, [key, framework]) => {
            if (framework.owned === 0) return sum;

            const language = this.languages[framework.requires];
            if (!language || language.owned === 0) return sum;

            let boost = framework.boost;
            if (specialization?.frameworkBoosts?.[key]) {
                boost += specialization.frameworkBoosts[key];
            }

            return sum + (language.generation * language.owned * boost * framework.owned);
        }, 0);
    }

    getTrendLanguageBonus() {
        if (!this.currentTrend?.languageKey) return 0;
        const language = this.languages[this.currentTrend.languageKey];
        if (!language || language.owned === 0) return 0;

        return language.generation * language.owned * (this.currentTrend.languageMultiplier || CONFIG.TREND_LANGUAGE_MULTIPLIER);
    }

    getTrendFrameworkBonus() {
        if (!this.currentTrend?.frameworkKey) return 0;
        const framework = this.frameworks[this.currentTrend.frameworkKey];
        if (!framework || framework.owned === 0) return 0;
        const requirement = this.languages[framework.requires];
        if (!requirement || requirement.owned === 0) return 0;

        return requirement.generation * requirement.owned * (this.currentTrend.frameworkMultiplier || CONFIG.TREND_FRAMEWORK_MULTIPLIER) * framework.owned;
    }

    getReleaseRewardPreview() {
        if (this.releaseCharge < CONFIG.RELEASE_CHARGE_REQUIRED) {
            return { code: 0, rep: 0 };
        }

        const releaseMultiplier = 1 + this.getArtifactBonus('releaseBoost');
        return {
            code: Math.floor(this.releaseCharge * CONFIG.RELEASE_REWARD_PER_COMMIT * releaseMultiplier),
            rep: CONFIG.RELEASE_REP_PER_LAUNCH + Math.floor(this.releaseCharge / CONFIG.RELEASE_CHARGE_REQUIRED)
        };
    }

    getReleaseOutcomeBand(score) {
        const rules = CONFIG.RELEASE_HEALTH;

        if (score >= rules.CLEAN_MIN_SCORE) {
            return { key: 'clean', ...rules.BANDS.clean };
        }

        if (score >= rules.NORMAL_MIN_SCORE) {
            return { key: 'normal', ...rules.BANDS.normal };
        }

        if (score >= rules.RISKY_MIN_SCORE) {
            return { key: 'risky', ...rules.BANDS.risky };
        }

        return { key: 'unstable', ...rules.BANDS.unstable };
    }

    getReleaseHealthScore() {
        const snapshot = this.getProjectHealthSnapshot();
        const modifiers = this.getHealthModifiers();
        return Math.round(snapshot.quality - snapshot.technicalDebt + ((snapshot.quality - 50) * 0.22) + modifiers.releaseHealthBonus);
    }

    getReleaseTrustProfile(band = null) {
        const snapshot = this.getResponsibilitySnapshot();
        const normalized = (snapshot.value - 50) / 50;
        const rules = CONFIG.RESPONSIBILITY.RELEASE;
        const modifiers = this.getResponsibilityModifiers();
        let repModifier = Math.round(normalized * 2);

        if (band?.key === 'clean' && snapshot.value >= rules.HIGH_TRUST_MIN) {
            repModifier += 1;
        }

        if ((band?.key === 'risky' || band?.key === 'unstable') && snapshot.value <= rules.LOW_TRUST_MAX) {
            repModifier -= band.key === 'unstable' ? 2 : 1;
        }

        const trustLabelByState = {
            exemplary: 'Confianza premium',
            accountable: 'Confianza sólida',
            strained: 'Confianza sensible',
            opportunistic: 'Confianza especulativa',
            negligent: 'Confianza rota'
        };

        return {
            snapshot,
            label: trustLabelByState[snapshot.state.key] || 'Confianza moderada',
            expectedMultiplierShift: normalized * rules.EXPECTED_MULTIPLIER_SHIFT,
            volatilityMultiplier: Math.max(0.72, Math.min(1.28, (1 - (normalized * rules.VOLATILITY_INFLUENCE)) * modifiers.trustVolatilityMultiplier)),
            repModifier: repModifier + modifiers.trustRepBonus
        };
    }

    getReleaseResponsibilityDelta(preview) {
        const value = this.getResponsibilitySnapshot().value;
        const rules = CONFIG.RESPONSIBILITY.RELEASE;

        if (preview.band.key === 'clean') {
            return value >= rules.HIGH_TRUST_MIN ? rules.CLEAN_GAIN : 1;
        }

        if (preview.band.key === 'normal') {
            return value >= 50 ? rules.NORMAL_GAIN : 0;
        }

        if (preview.band.key === 'risky') {
            return value <= rules.LOW_TRUST_MAX ? -rules.RISKY_LOSS : -1;
        }

        return value <= rules.LOW_TRUST_MAX ? -rules.UNSTABLE_LOSS : -(rules.UNSTABLE_LOSS - 1);
    }

    getReleaseOutcomePreview() {
        const baseReward = this.getReleaseRewardPreview();
        const snapshot = this.getProjectHealthSnapshot();
        const healthScore = this.getReleaseHealthScore();
        const band = this.getReleaseOutcomeBand(healthScore);
        const trust = this.getReleaseTrustProfile(band);
        const debtRatio = snapshot.technicalDebt / CONFIG.PROJECT_HEALTH.DEBT_MAX;
        const qualityRatio = snapshot.quality / CONFIG.PROJECT_HEALTH.QUALITY_MAX;
        const expectedMultiplier = Math.max(
            0.35,
            band.baseMultiplier + (qualityRatio - 0.5) * 0.24 - debtRatio * 0.12 + trust.expectedMultiplierShift
        );
        const volatility = band.volatility * (0.8 + debtRatio * 0.9) * trust.volatilityMultiplier;
        const minMultiplier = Math.max(0.2, expectedMultiplier - volatility);
        const maxMultiplier = Math.max(minMultiplier, expectedMultiplier + volatility);
        const expectedRep = Math.max(0, baseReward.rep + band.repBonus + (snapshot.quality >= 85 ? 1 : 0) - (snapshot.technicalDebt >= 85 ? 1 : 0) + trust.repModifier);

        return {
            ready: this.canPublishRelease(),
            baseReward,
            score: healthScore,
            band,
            trust,
            expectedCode: Math.floor(baseReward.code * expectedMultiplier),
            minCode: Math.floor(baseReward.code * minMultiplier),
            maxCode: Math.floor(baseReward.code * maxMultiplier),
            expectedRep,
            projectHealth: snapshot
        };
    }

    canPublishRelease() {
        return this.releaseCharge >= CONFIG.RELEASE_CHARGE_REQUIRED;
    }

    publishRelease() {
        if (!this.canPublishRelease()) return null;

        const preview = this.getReleaseOutcomePreview();
        const randomSwing = (Math.random() * 2 - 1) * ((preview.maxCode - preview.minCode) / 2) / Math.max(1, preview.baseReward.code);
        const multiplier = Math.max(0.2, (preview.expectedCode / Math.max(1, preview.baseReward.code)) + randomSwing);
        const codeReward = Math.max(0, Math.floor(preview.baseReward.code * multiplier));
        const repReward = Math.max(0, preview.expectedRep);

        this.addCode(codeReward);
        this.addPrestigePoints(repReward);
        this.releaseCount++;
        this.releaseCharge = 0;
        this.applyProjectHealthImpact({
            quality: preview.band.qualityShift,
            debt: preview.band.debtShift
        });
        const responsibilityDelta = this.getReleaseResponsibilityDelta(preview);
        const responsibilityResult = this.applyResponsibilityImpact(responsibilityDelta);
        this.incrementVersion();

        if (preview.band.key === 'clean') {
            this.healthStats.cleanReleaseCount++;
        }

        if (preview.band.key === 'clean' || preview.band.key === 'normal') {
            this.healthStats.healthyReleaseCount++;
        }

        if (preview.band.key === 'risky' || preview.band.key === 'unstable') {
            this.healthStats.riskyReleaseCount++;
        }

        if (
            ['clean', 'normal'].includes(preview.band.key)
            && ['accountable', 'exemplary'].includes(preview.trust.snapshot.state.key)
        ) {
            this.responsibilityStats.trustedReleaseCount++;
        }

        this.lastReleaseReport = {
            version: this.getVersionLabel(),
            code: codeReward,
            rep: repReward,
            band: preview.band,
            score: preview.score,
            trust: preview.trust,
            responsibilityDelta: responsibilityResult.delta
        };

        return {
            version: this.getVersionLabel(),
            code: codeReward,
            rep: repReward,
            band: preview.band,
            score: preview.score,
            trust: preview.trust,
            responsibilityDelta: responsibilityResult.delta,
            projectHealth: this.getProjectHealthSnapshot()
        };
    }

    incrementVersion() {
        this.releaseVersion.patch++;
        if (this.releaseVersion.patch >= 10) {
            this.releaseVersion.patch = 0;
            this.releaseVersion.minor++;
        }
        if (this.releaseVersion.minor >= 10) {
            this.releaseVersion.minor = 0;
            this.releaseVersion.major++;
        }
    }

    getVersionLabel() {
        const { major, minor, patch } = this.releaseVersion;
        return `v${major}.${minor}.${patch}`;
    }

    refreshTrend(force = false) {
        const now = Date.now();
        const trendIsValid = this.currentTrend
            && CONFIG.LANGUAGES[this.currentTrend.languageKey]
            && CONFIG.FRAMEWORKS[this.currentTrend.frameworkKey];
        if (!force && trendIsValid && now < this.currentTrend.expiresAt) {
            return;
        }

        const languageKeys = Object.keys(CONFIG.LANGUAGES);
        const frameworkKeys = Object.keys(CONFIG.FRAMEWORKS);
        const languageKey = languageKeys[Math.floor(Math.random() * languageKeys.length)];
        const frameworkKey = frameworkKeys[Math.floor(Math.random() * frameworkKeys.length)];

        this.currentTrend = {
            languageKey,
            frameworkKey,
            languageMultiplier: CONFIG.TREND_LANGUAGE_MULTIPLIER,
            frameworkMultiplier: CONFIG.TREND_FRAMEWORK_MULTIPLIER,
            expiresAt: now + CONFIG.TREND_REFRESH_INTERVAL
        };
    }

    getTrendTimeRemaining() {
        if (!this.currentTrend?.expiresAt) return 0;
        return Math.max(0, this.currentTrend.expiresAt - Date.now());
    }

    applyOfflineProgress() {
        const now = Date.now();
        const elapsedSeconds = Math.max(0, (now - (this.lastSavedAt || now)) / 1000);
        this.applyElapsedIdleTime(elapsedSeconds);
        this.lastSavedAt = now;
    }

    // Aplica un periodo largo sin ticks (juego cerrado, portátil suspendido,
    // pestaña congelada). Respeta OFFLINE_CAP_SECONDS y no usa efectos
    // temporales, porque no se puede saber cuánto de ese tiempo estuvieron activos.
    applyElapsedIdleTime(rawSeconds) {
        const elapsedSeconds = Math.min(CONFIG.OFFLINE_CAP_SECONDS, Math.max(0, Number(rawSeconds) || 0));
        if (elapsedSeconds < CONFIG.OFFLINE_MIN_SECONDS) return 0;

        const generation = this.calculateGeneration({ includeTimedEffects: false, includeMaintenance: false });
        const earned = generation * elapsedSeconds;
        if (earned <= 0) return 0;

        this.earnCode(earned);
        this.offlineReport = {
            seconds: Math.floor(elapsedSeconds),
            codeEarned: Math.floor(earned)
        };
        return earned;
    }

    // Potencia propia del click: upgrades, prestige, bonus, racha, efectos y mantenimiento.
    calculateBaseClickPower() {
        return this.getClickBreakdown().baseClick;
    }

    // Desglose del poder de click (para "nerd stats"). calculateClickPower() devuelve su total.
    getClickBreakdown() {
        const specialization = this.getSpecialization();
        const bonus = {
            specialization: specialization?.clickBoost || 0,
            team: this.getTeamClickBonus(),
            artifacts: this.getArtifactBonus('clickBoost'),
            streak: Math.min(CONFIG.STREAK_CLICK_BONUS_CAP, this.streak * CONFIG.STREAK_CLICK_BONUS_PER_STACK)
        };
        const clickBonus = bonus.specialization + bonus.team + bonus.artifacts;
        const prestige = this.getPrestigeMultiplier();
        const effects = this.getEffectMultiplier('clickMultiplier');
        const maintenance = this.getMaintenanceStatus().clickMultiplier;
        const baseClick = this.codePerClick * prestige * (1 + clickBonus + bonus.streak) * effects * maintenance;
        const passiveShare = this.calculateClickPassiveBonus();
        return {
            base: this.codePerClick,
            bonus,
            bonusMultiplier: 1 + clickBonus + bonus.streak,
            prestige,
            effects,
            maintenance,
            baseClick,
            passiveShare,
            total: baseClick + passiveShare
        };
    }

    // Parte del click que viene de la producción pasiva (CLICK_PASSIVE_SHARE).
    // Se suma sin multiplicadores de click: el frenesí o la racha no la amplifican.
    // Sin recursión: calculateGeneration() nunca llama a calculateClickPower().
    calculateClickPassiveBonus() {
        return CONFIG.CLICK_PASSIVE_SHARE * this.calculateGeneration({ includeTimedEffects: false, includeMaintenance: false });
    }

    calculateClickPower() {
        return this.calculateBaseClickPower() + this.calculateClickPassiveBonus();
    }

    // === CÁLCULOS ===
    calculateGeneration(options = {}) {
        const breakdown = this.getGenerationBreakdown(options);
        this.passiveGeneration = breakdown.base;
        return breakdown.total;
    }

    // Desglose de la producción por segundo (para "nerd stats"). calculateGeneration()
    // devuelve su total, así que lo que se muestra coincide por construcción.
    getGenerationBreakdown(options = {}) {
        const { includeTimedEffects = true, includeMaintenance = true, detail = false } = options;
        const specialization = this.getSpecialization();
        const bonus = {
            specialization: specialization?.passiveBoost || 0,
            team: this.getTeamPassiveBonus(),
            artifacts: this.getArtifactBonus('passiveBoost')
        };
        const passiveBonus = bonus.specialization + bonus.team + bonus.artifacts;
        const sources = {
            languages: this.getBasePassiveGeneration(),
            team: this.getTeamGeneration(),
            specialization: this.getSpecializationLanguageBonus(),
            frameworks: this.getFrameworkSynergyBonus(),
            trendLanguage: this.getTrendLanguageBonus(),
            trendFramework: this.getTrendFrameworkBonus()
        };
        const base = sources.languages + sources.team + sources.specialization + sources.frameworks + sources.trendLanguage + sources.trendFramework;

        // Lo que aportan los hitos (ya está dentro de languages y team). Solo con { detail: true }:
        // calculateGeneration() corre muchas veces por segundo y no lo necesita.
        let milestoneExtra = null;
        if (detail) {
            const languagesWithoutMilestones = Object.values(this.languages).reduce((sum, language) => sum + (language.generation * language.owned), 0);
            milestoneExtra = (sources.languages - languagesWithoutMilestones) + (sources.team - this.sumTeamStat('generation'));
        }

        const prestige = this.getPrestigeMultiplier();
        const effects = includeTimedEffects ? this.getEffectMultiplier('passiveMultiplier') : 1;
        const maintenance = includeMaintenance ? this.getMaintenanceStatus().passiveMultiplier : 1;
        return {
            sources,
            milestoneExtra,
            base,
            bonus,
            bonusMultiplier: 1 + passiveBonus,
            prestige,
            effects,
            maintenance,
            total: base * prestige * (1 + passiveBonus) * effects * maintenance
        };
    }

    // Producción por segundo que añadiría comprar una unidad más (languages o team). ROI = coste / esto.
    getMarginalGeneration(collection, key) {
        const item = this[collection]?.[key];
        if (!item) return 0;
        const before = this.calculateGeneration();
        item.owned++;
        const after = this.calculateGeneration();
        item.owned--;
        this.calculateGeneration(); // restaura passiveGeneration
        return after - before;
    }

    // Segundos de producción que tarda en amortizarse una compra (Infinity si no produce).
    getPurchaseRoi(collection, key) {
        const item = this[collection]?.[key];
        const delta = this.getMarginalGeneration(collection, key);
        if (!item || !(delta > 1e-9)) return Infinity;
        return item.cost / delta;
    }

    recalculateCodePerClick() {
        this.codePerClick = Object.values(this.upgrades).reduce((power, upgrade) => {
            return power * Math.pow(upgrade.multiplier || 1, upgrade.owned || 0);
        }, CONFIG.INITIAL_CODE_PER_CLICK);
        return this.codePerClick;
    }

    // El coste se deriva de la definición de CONFIG y las unidades compradas,
    // así los cambios de balance en config.js también aplican a partidas viejas.
    calculateScaledCost(baseCost, scaling, owned) {
        let cost = baseCost;
        for (let i = 0; i < owned; i++) {
            cost = Math.floor(cost * scaling);
        }
        return cost;
    }

    calculatePrestigeCost() {
        return Math.floor(CONFIG.PRESTIGE_BASE_COST * Math.pow(CONFIG.PRESTIGE_COST_SCALING, this.prestigeLevel));
    }

    calculatePrestigeReward() {
        const cost = this.calculatePrestigeCost();
        if (this.totalCode < cost) return 0;

        const ratio = this.totalCode / cost;
        // +1e-9: Math.pow(64, 1/3) da 3.999…; sin la tolerancia, justo en el
        // umbral (cost * n^ROOT) se perdería un punto que la vista previa promete.
        return Math.max(1, Math.floor(Math.pow(ratio, 1 / CONFIG.PRESTIGE_REWARD_ROOT) + 1e-9));
    }

    canPrestige() {
        return this.calculatePrestigeReward() > 0;
    }

    // Vista previa en vivo del reinicio: rep a ganar, multiplicador antes/después
    // y cuánto código total falta para el siguiente punto de reputación.
    getPrestigePreview() {
        // Misma función que performPrestige(): lo mostrado es lo que se obtiene.
        const reward = this.calculatePrestigeReward();
        const cost = this.calculatePrestigeCost();
        // reward = floor((totalCode / cost)^(1/ROOT)) → reward + 1 exige cost * (reward + 1)^ROOT
        const nextRepAt = reward === 0 ? cost : cost * Math.pow(reward + 1, CONFIG.PRESTIGE_REWARD_ROOT);

        return {
            reward,
            cost,
            currentMultiplier: this.getPrestigeMultiplier(),
            nextMultiplier: 1 + ((this.prestigePoints + reward) * CONFIG.PRESTIGE_BONUS_PER_POINT),
            nextRepAt,
            missingForNextRep: Math.max(0, nextRepAt - this.totalCode),
            progressToNextRep: Math.max(0, Math.min(100, (this.totalCode / nextRepAt) * 100))
        };
    }

    // === COMMIT DORADO ===
    rollGoldenCommitReward() {
        const rewards = CONFIG.GOLDEN_COMMIT.REWARDS;
        const totalWeight = rewards.reduce((sum, reward) => sum + reward.weight, 0);
        let roll = Math.random() * totalWeight;
        const picked = rewards.find(reward => (roll -= reward.weight) <= 0) || rewards[0];

        if (picked.type === 'code') {
            const t = Math.random();
            const seconds = picked.minSeconds + ((picked.maxSeconds - picked.minSeconds) * t);
            const clicks = picked.minClicks + ((picked.maxClicks - picked.minClicks) * t);
            const amount = Math.floor(Math.max(
                this.getRewardGenerationBase() * seconds,
                this.calculateClickPower() * clicks
            ));
            return { type: 'code', amount, seconds: Math.round(seconds) };
        }

        if (picked.type === 'frenzy') {
            return { type: 'frenzy', factor: picked.factor, durationMs: picked.durationMs };
        }

        return { type: 'release', commits: picked.commits };
    }

    applyGoldenCommitReward(reward) {
        if (!reward) return null;

        if (reward.type === 'code') {
            this.addCode(reward.amount);
        } else if (reward.type === 'frenzy') {
            this.addTimedEffect({
                stat: 'clickMultiplier',
                factor: reward.factor,
                durationMs: reward.durationMs,
                endMessage: 'El frenesí del commit dorado terminó'
            });
        } else if (reward.type === 'release') {
            this.releaseCharge += reward.commits;
        }

        return reward;
    }

    performPrestige() {
        const reward = this.calculatePrestigeReward();
        if (reward <= 0) return 0;

        const preserved = {
            soundEnabled: this.soundEnabled,
            theme: this.theme,
            prestigePoints: this.prestigePoints + reward,
            prestigeLevel: this.prestigeLevel + 1,
            currentSpecialization: this.currentSpecialization,
            artifacts: this.artifacts,
            achievements: this.achievements,
            // Lo ya aprendido no se vuelve a ocultar ni a explicar.
            unlockedFeatures: this.unlockedFeatures,
            seenTips: this.seenTips,
            newTabBadges: this.newTabBadges,
            // Preferencias del jugador
            audioSettings: this.audioSettings,
            visualSettings: this.visualSettings,
            seenChoreographies: this.seenChoreographies,
            codePowerRecord: this.codePowerRecord,
            devSettings: this.devSettings
        };

        this.reset();
        this.soundEnabled = preserved.soundEnabled;
        this.theme = preserved.theme;
        this.prestigePoints = preserved.prestigePoints;
        this.prestigeLevel = preserved.prestigeLevel;
        this.currentSpecialization = preserved.currentSpecialization;
        this.artifacts = preserved.artifacts;
        this.achievements = preserved.achievements;
        this.unlockedFeatures = preserved.unlockedFeatures;
        this.seenTips = preserved.seenTips;
        this.newTabBadges = preserved.newTabBadges;
        this.audioSettings = preserved.audioSettings;
        this.visualSettings = preserved.visualSettings;
        this.seenChoreographies = preserved.seenChoreographies;
        this.codePowerRecord = preserved.codePowerRecord;
        this.devSettings = preserved.devSettings;
        this.responsibility.value = this.getResponsibilityBaselineValue();
        this.responsibility.lastState = this.getResponsibilityState().key;
        this.lastUpdate = Date.now();
        this.refreshTrend(true);
        this.lastSavedAt = Date.now();

        return reward;
    }

    // === ONBOARDING: DESBLOQUEO PROGRESIVO ===
    getFeatureDefinition(key) {
        return CONFIG.FEATURE_UNLOCKS.find(feature => feature.key === key) || null;
    }

    isFeatureUnlocked(key) {
        return this.unlockedFeatures.includes(key);
    }

    // Valor actual y meta de una métrica de desbloqueo (para evaluar y para la barra TODO).
    getUnlockMetricProgress(metric, value) {
        switch (metric) {
            case 'totalCode':
                return { current: this.totalCode, target: value };
            case 'commits':
                return { current: this.commits, target: value };
            case 'languagesOwned':
                return { current: this.getMissionMetric('languagesOwned'), target: value };
            case 'technicalDebt':
                return { current: this.projectHealth.technicalDebt, target: value };
            case 'releaseCount':
                return { current: this.releaseCount, target: value };
            case 'prestigeProgress':
                // Se muestra en código: totalCode frente a la fracción del coste de prestige.
                return { current: this.totalCode, target: value * this.calculatePrestigeCost() };
            case 'achievementsUnlocked':
                return { current: this.getUnlockedAchievements(), target: value };
            case 'prestigeLevel':
                return { current: this.prestigeLevel, target: value };
            default:
                return { current: 0, target: Infinity };
        }
    }

    evaluateUnlockCondition(condition) {
        if (!condition) return false;
        if (Array.isArray(condition.any)) {
            return condition.any.some(part => this.evaluateUnlockCondition(part));
        }

        const { current, target } = this.getUnlockMetricProgress(condition.metric, condition.value);
        switch (condition.op) {
            case '>': return current > target;
            case '>=': return current >= target;
            case '<': return current < target;
            case '<=': return current <= target;
            default: return false;
        }
    }

    // Para condiciones `any`, la parte más avanzada.
    getUnlockConditionProgress(condition) {
        if (Array.isArray(condition?.any)) {
            return condition.any
                .map(part => this.getUnlockConditionProgress(part))
                .sort((a, b) => b.ratio - a.ratio)[0];
        }

        const { current, target } = this.getUnlockMetricProgress(condition.metric, condition.value);
        const ratio = target > 0 && Number.isFinite(target) ? Math.min(1, current / target) : 0;
        return { metric: condition.metric, current, target, ratio };
    }

    // Desbloquea las features cuya condición ya se cumple y devuelve las nuevas.
    // Cada feature nueva deja badge NEW en sus pestañas hasta que se abran.
    // En modo secuencial se detiene en la primera feature bloqueada que no cumple.
    checkFeatureUnlocks() {
        const { SEQUENTIAL_UNLOCKS: sequential, MAX_UNLOCKS_PER_CHECK: maxUnlocks } = CONFIG.ONBOARDING;
        const newlyUnlocked = [];

        for (const feature of CONFIG.FEATURE_UNLOCKS) {
            if (this.isFeatureUnlocked(feature.key)) continue;
            if (!this.evaluateUnlockCondition(feature.condition)) {
                if (sequential) break;
                continue;
            }

            this.unlockedFeatures.push(feature.key);
            (feature.tabIds || []).forEach(tabId => {
                if (!this.newTabBadges.includes(tabId)) this.newTabBadges.push(tabId);
            });
            newlyUnlocked.push(feature.key);
            if (maxUnlocks && newlyUnlocked.length >= maxUnlocks) break;
        }
        return newlyUnlocked;
    }

    // Desbloqueo sin avisos ni badges (admin unlockall y migración de partidas viejas).
    unlockFeaturesSilently(keys) {
        keys.forEach(key => {
            if (!this.getFeatureDefinition(key)) return;
            if (!this.unlockedFeatures.includes(key)) this.unlockedFeatures.push(key);
            if (!this.seenTips.includes(key)) this.seenTips.push(key);
        });
    }

    unlockAllFeatures() {
        this.unlockFeaturesSilently(CONFIG.FEATURE_UNLOCKS.map(feature => feature.key));
    }

    // Partida guardada antes del onboarding: el jugador veterano no debe ver cambios.
    migrateLegacyFeatures() {
        const alreadyPrestiged = this.prestigeLevel >= 1 && CONFIG.ONBOARDING.LEGACY_UNLOCK_ALL_IF_PRESTIGED;
        const keys = CONFIG.FEATURE_UNLOCKS
            .filter(feature => alreadyPrestiged || this.evaluateUnlockCondition(feature.condition))
            .map(feature => feature.key);
        this.unlockFeaturesSilently(keys);
        this.newTabBadges = [];
    }

    hasSeenTip(key) {
        return this.seenTips.includes(key);
    }

    markTipSeen(key) {
        if (!this.seenTips.includes(key)) this.seenTips.push(key);
    }

    markTabSeen(tabId) {
        this.newTabBadges = this.newTabBadges.filter(id => id !== tabId);
    }

    // === ONBOARDING: PRÓXIMO OBJETIVO ===
    // Devuelve { label, current, target, metric } de la primera regla de
    // NEXT_GOAL_RULES que aplique, o null.
    getNextGoal() {
        for (const rule of CONFIG.NEXT_GOAL_RULES) {
            const goal = this.evaluateNextGoalRule(rule);
            if (goal) return goal;
        }
        return null;
    }

    evaluateNextGoalRule(rule) {
        const fill = (template, values) => String(template || '').replace(/\{(\w+)\}/g, (match, key) => (
            values[key] !== undefined ? values[key] : match
        ));

        if (rule.type === 'feature') {
            const skip = rule.skip || [];
            const feature = CONFIG.FEATURE_UNLOCKS.find(item => !this.isFeatureUnlocked(item.key) && !skip.includes(item.key));
            if (!feature) return null;
            const progress = this.getUnlockConditionProgress(feature.condition);
            return { label: feature.goal, current: progress.current, target: progress.target, metric: progress.metric };
        }

        if (rule.type === 'milestone') {
            const candidates = Object.values(this.languages)
                .filter(language => language.owned > 0)
                .map(language => ({ language, progress: this.getMilestoneProgress(language.owned) }))
                .filter(({ language, progress }) => !progress.complete && (progress.next - language.owned) <= (rule.maxMissingUnits ?? Infinity))
                .sort((a, b) => (a.progress.next - a.language.owned) - (b.progress.next - b.language.owned));
            if (candidates.length === 0) return null;
            const { language, progress } = candidates[0];
            return {
                label: fill(rule.label, { name: language.name, target: progress.next, multiplier: progress.nextMultiplier }),
                current: language.owned,
                target: progress.next,
                metric: 'units'
            };
        }

        if (rule.type === 'mission') {
            const slots = rule.slot ? [rule.slot] : ['short', 'long'];
            for (const slot of slots) {
                const mission = this.missions?.[slot];
                if (!mission) continue;
                const progress = this.getMissionProgress(slot);
                if (rule.onlyClaimable && !progress.complete) continue;
                return {
                    label: fill(rule.label, { name: mission.name }),
                    current: Math.min(progress.current, progress.target),
                    target: progress.target,
                    metric: mission.metric
                };
            }
            return null;
        }

        if (rule.type === 'prestige') {
            const preview = this.getPrestigePreview();
            if (rule.onlyWhenAvailable && preview.reward <= 0) return null;
            return {
                label: fill(rule.label, { reward: preview.reward }),
                current: Math.min(this.totalCode, preview.cost),
                target: preview.cost,
                metric: 'totalCode'
            };
        }

        return null;
    }
    
    // === PERSISTENCIA ===
    getCollectionSpecs() {
        return [
            { key: 'languages', config: CONFIG.LANGUAGES, scaling: CONFIG.LANGUAGE_COST_SCALING },
            { key: 'upgrades', config: CONFIG.UPGRADES, scaling: CONFIG.UPGRADE_COST_SCALING, maxOwned: CONFIG.UPGRADE_MAX_OWNED },
            { key: 'frameworks', config: CONFIG.FRAMEWORKS, scaling: CONFIG.FRAMEWORK_COST_SCALING },
            { key: 'team', config: CONFIG.TEAM, scaling: CONFIG.TEAM_COST_SCALING },
            { key: 'artifacts', config: CONFIG.ARTIFACTS, maxOwned: 1 }
        ];
    }

    // Solo se persiste el progreso del jugador; nombres, costes base,
    // multiplicadores y textos se leen siempre de CONFIG.
    serialize(now = Date.now()) {
        const pickOwned = collection => Object.fromEntries(
            Object.entries(collection).map(([key, item]) => [key, { owned: item.owned || 0 }])
        );
        const pickMission = mission => (mission
            ? { id: mission.id, startValue: mission.startValue, peak: mission.peak || 0 }
            : null);

        return {
            saveVersion: CONFIG.SAVE_VERSION,
            code: this.code,
            commitProgress: this.commitProgress,
            totalCode: this.totalCode,
            clicks: this.clicks,
            commits: this.commits,
            streak: this.streak,
            maxStreak: this.maxStreak,
            prestigePoints: this.prestigePoints,
            prestigeLevel: this.prestigeLevel,
            currentSpecialization: this.currentSpecialization,
            releaseCharge: this.releaseCharge,
            releaseCount: this.releaseCount,
            releaseVersion: this.releaseVersion,
            lastReleaseReport: this.lastReleaseReport,
            maintenance: this.maintenance,
            projectHealth: this.projectHealth,
            responsibility: this.responsibility,
            responsibilityStats: this.responsibilityStats,
            healthStats: this.healthStats,
            currentTrend: this.currentTrend,
            timedEffects: this.timedEffects,
            eventCooldown: this.eventCooldown,
            admin: this.admin,
            soundEnabled: this.soundEnabled,
            theme: this.theme,
            languages: pickOwned(this.languages),
            upgrades: pickOwned(this.upgrades),
            frameworks: pickOwned(this.frameworks),
            artifacts: pickOwned(this.artifacts),
            team: pickOwned(this.team),
            achievements: Object.fromEntries(
                Object.entries(this.achievements).map(([key, achievement]) => [key, { unlocked: !!achievement.unlocked }])
            ),
            missions: {
                short: pickMission(this.missions?.short),
                long: pickMission(this.missions?.long)
            },
            unlockedFeatures: this.unlockedFeatures,
            seenTips: this.seenTips,
            newTabBadges: this.newTabBadges,
            audioSettings: this.audioSettings,
            visualSettings: this.visualSettings,
            seenChoreographies: this.seenChoreographies,
            codePowerRecord: this.codePowerRecord,
            devSettings: this.devSettings,
            lastSavedAt: now
        };
    }

    save(force = false) {
        if (this.persistenceLocked) return false;

        const now = Date.now();
        if (!force && now - this.lastPersistAt < CONFIG.SAVE_THROTTLE_MS) {
            return false;
        }

        try {
            localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(this.serialize(now)));
        } catch (error) {
            console.warn('No se pudo guardar la partida:', error);
            return false;
        }

        this.lastPersistAt = now;
        this.lastSavedAt = now;
        return true;
    }

    // Bloquea el guardado (antes de recargar tras importar o reiniciar),
    // para que el game loop no sobrescriba los datos nuevos.
    lockPersistence() {
        this.persistenceLocked = true;
    }

    load() {
        let saved = null;
        try {
            saved = localStorage.getItem(CONFIG.SAVE_KEY);
        } catch (error) {
            console.warn('localStorage no disponible:', error);
            return false;
        }
        if (!saved) return false;

        try {
            const data = JSON.parse(saved);
            if (!data || typeof data !== 'object') {
                throw new Error('Formato de guardado inválido');
            }
            this.applySaveData(data);
            return true;
        } catch (error) {
            console.error('Partida guardada corrupta, se inicia una nueva:', error);
            try {
                localStorage.setItem(`${CONFIG.SAVE_KEY}:corrupt`, saved);
            } catch (backupError) {
                console.warn('No se pudo respaldar la partida corrupta:', backupError);
            }
            this.reset();
            this.loadError = 'Tu partida guardada estaba dañada. Se respaldó y empezaste una nueva.';
            return false;
        }
    }

    applySaveData(data) {
        const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
        const obj = value => (value && typeof value === 'object' ? value : {});

        this.code = Math.max(0, num(data.code, this.code));
        this.commitProgress = Math.max(0, num(data.commitProgress, this.code));
        this.totalCode = Math.max(0, num(data.totalCode, this.totalCode));
        this.clicks = num(data.clicks, this.clicks);
        this.commits = num(data.commits, this.commits);
        this.streak = num(data.streak, this.streak);
        this.maxStreak = num(data.maxStreak, this.maxStreak);
        this.prestigePoints = num(data.prestigePoints, this.prestigePoints);
        this.prestigeLevel = num(data.prestigeLevel, this.prestigeLevel);
        this.currentSpecialization = CONFIG.SPECIALIZATIONS[data.currentSpecialization] ? data.currentSpecialization : null;
        this.releaseCharge = num(data.releaseCharge, this.releaseCharge);
        this.releaseCount = num(data.releaseCount, this.releaseCount);
        this.releaseVersion = { ...this.releaseVersion, ...obj(data.releaseVersion) };
        this.lastReleaseReport = data.lastReleaseReport ?? this.lastReleaseReport;
        this.maintenance = { ...this.maintenance, ...obj(data.maintenance) };
        this.projectHealth = { ...this.projectHealth, ...obj(data.projectHealth) };
        this.responsibility = { ...this.responsibility, ...obj(data.responsibility) };
        this.responsibilityStats = { ...this.responsibilityStats, ...obj(data.responsibilityStats) };
        this.healthStats = { ...this.healthStats, ...obj(data.healthStats) };
        this.projectHealth.quality = this.clampProjectHealthValue(this.projectHealth.quality, CONFIG.PROJECT_HEALTH.QUALITY_MAX);
        this.projectHealth.technicalDebt = this.clampProjectHealthValue(this.projectHealth.technicalDebt, CONFIG.PROJECT_HEALTH.DEBT_MAX);
        this.projectHealth.lastState = this.getProjectHealthState().key;
        this.responsibility.value = this.clampResponsibilityValue(this.responsibility.value);
        this.responsibility.lastState = this.getResponsibilityState().key;
        this.currentTrend = data.currentTrend ?? this.currentTrend;
        this.eventCooldown = Math.max(0, num(data.eventCooldown, 0));
        this.soundEnabled = typeof data.soundEnabled === 'boolean' ? data.soundEnabled : this.soundEnabled;
        this.theme = typeof data.theme === 'string' ? data.theme : this.theme;
        // Partidas anteriores no tienen estos campos: se usan los valores por defecto.
        this.audioSettings = this.sanitizeAudioSettings(data.audioSettings);
        this.visualSettings = this.sanitizeVisualSettings(data.visualSettings);
        this.seenChoreographies = Object.fromEntries(
            Object.entries(obj(data.seenChoreographies))
                .filter(([id, count]) => CONFIG.CHOREOGRAPHIES[id] && Number.isFinite(count) && count > 0)
                .map(([id, count]) => [id, Math.floor(count)])
        );
        // Partidas sin el campo: lo ya alcanzado cuenta como celebrado (no se dispara al cargar).
        this.codePowerRecord = Number.isFinite(data.codePowerRecord) && data.codePowerRecord >= 0
            ? Math.floor(data.codePowerRecord)
            : this.getCodePower(this.totalCode);
        // Partidas anteriores no tienen devSettings: valores por defecto.
        this.devSettings = this.sanitizeDevSettings(data.devSettings);
        this.lastSavedAt = num(data.lastSavedAt, this.lastSavedAt);
        this.lastPersistAt = 0;
        this.admin = { ...this.admin, ...obj(data.admin) };

        // Los guardados v1 tenían `activeEffects` sin fecha de fin: se descartan a propósito
        // (eran la causa de multiplicadores permanentes tras recargar).
        this.timedEffects = this.sanitizeTimedEffects(data.timedEffects);
        this.pruneExpiredEffects();

        this.getCollectionSpecs().forEach(spec => {
            this.restoreOwned(this[spec.key], data[spec.key], spec);
        });
        Object.entries(obj(data.achievements)).forEach(([key, value]) => {
            if (this.achievements[key]) {
                this.achievements[key].unlocked = !!value?.unlocked;
            }
        });
        this.recalculateCodePerClick();

        // Onboarding. Las partidas sin `unlockedFeatures` son anteriores al
        // sistema: se migran en silencio (sin tips ni badges).
        if (Array.isArray(data.unlockedFeatures)) {
            const validKeys = new Set(CONFIG.FEATURE_UNLOCKS.map(feature => feature.key));
            const validTabs = new Set(CONFIG.FEATURE_UNLOCKS.flatMap(feature => feature.tabIds || []));
            const unique = list => [...new Set(Array.isArray(list) ? list : [])];
            this.unlockedFeatures = unique(data.unlockedFeatures).filter(key => validKeys.has(key));
            this.seenTips = unique(data.seenTips).filter(key => validKeys.has(key));
            this.newTabBadges = unique(data.newTabBadges).filter(tabId => validTabs.has(tabId));
        } else {
            this.migrateLegacyFeatures();
        }

        const savedMissions = obj(data.missions);
        this.missions = {
            short: this.hydrateMission('short', savedMissions.short),
            long: this.hydrateMission('long', savedMissions.long)
        };
        this.refreshAllMissions();
        this.refreshTrend();
        this.applyOfflineProgress();
        this.lastUpdate = Date.now();
    }

    restoreOwned(target, source, spec) {
        // Partir de cero: una partida guardada solo tiene lo que compró
        // (no recibe STARTING_LANGUAGES ni nada aplicado por reset()).
        Object.entries(target).forEach(([key, item]) => {
            item.owned = 0;
            if (spec.scaling && spec.config[key]) {
                item.cost = spec.config[key].cost;
            }
        });

        if (!source || typeof source !== 'object') return;

        Object.entries(source).forEach(([key, value]) => {
            const item = target[key];
            const definition = spec.config[key];
            if (!item || !definition) return;

            let owned = Math.max(0, Math.floor(Number(value?.owned) || 0));
            if (spec.maxOwned !== undefined) {
                owned = Math.min(owned, spec.maxOwned);
            }
            item.owned = owned;
            if (spec.scaling) {
                item.cost = this.calculateScaledCost(definition.cost, spec.scaling, owned);
            }
        });
    }

    // === EXPORTAR / IMPORTAR ===
    exportSave() {
        const json = JSON.stringify(this.serialize());
        return btoa(unescape(encodeURIComponent(json)));
    }

    // Valida el texto exportado y lo deja en localStorage; quien llama recarga la página.
    importSave(encoded) {
        const text = String(encoded || '').trim();
        if (!text) return { ok: false, error: 'El texto está vacío.' };

        let data;
        try {
            data = JSON.parse(decodeURIComponent(escape(atob(text))));
        } catch (error) {
            return { ok: false, error: 'El texto no es una partida exportada válida.' };
        }

        if (!data || typeof data !== 'object' || !Number.isFinite(data.code) || !data.languages) {
            return { ok: false, error: 'La partida no tiene el formato esperado.' };
        }

        try {
            localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
        } catch (error) {
            return { ok: false, error: 'No se pudo escribir en el almacenamiento del navegador.' };
        }

        this.lockPersistence();
        return { ok: true };
    }

    wipeSave() {
        try {
            localStorage.removeItem(CONFIG.SAVE_KEY);
        } catch (error) {
            console.warn('No se pudo borrar la partida:', error);
        }
        this.lockPersistence();
    }
}

// Instancia global (la carga la hace app.init() en main.js)
const gameState = new GameState();

console.log('✅ STATE loaded');
