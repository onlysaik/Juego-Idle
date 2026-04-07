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
        return this.responsibility.value;
    }

    applyResponsibilityImpact(amount = 0) {
        const previousValue = this.responsibility.value;
        const previousState = this.getResponsibilityState();
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
        const currentState = this.getResponsibilityState();

        if (
            ['opportunistic', 'negligent'].includes(previousState.key)
            && ['accountable', 'exemplary'].includes(currentState.key)
        ) {
            this.responsibilityStats.responsibilityRecoveryCount++;
        }

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

    getTeamMemberResponsibilityMultiplier(key) {
        const profile = this.getTeamResponsibilityProfile();
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
        this.applyProjectHealthImpact({
            quality: CONFIG.MAINTENANCE.QUALITY_RESTORE * modifiers.maintenanceQualityMultiplier,
            debt: -(CONFIG.MAINTENANCE.DEBT_REDUCTION * modifiers.maintenanceDebtReductionMultiplier)
        });

        return {
            ok: true,
            reason: null,
            status: this.getMaintenanceStatus(now),
            cost: check.status.cost
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

    createEffectToken(stat) {
        if (!this.effectTokens[stat]) {
            this.effectTokens[stat] = new Set();
        }

        const token = `${stat}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.effectTokens[stat].add(token);
        return token;
    }

    hasEffectToken(stat, token) {
        return !!this.effectTokens[stat]?.has(token);
    }

    consumeEffectToken(stat, token) {
        this.effectTokens[stat]?.delete(token);
    }

    clearAllEffectTokens() {
        if (!this.effectTokens) return;

        Object.values(this.effectTokens).forEach(tokenSet => {
            if (tokenSet?.clear) tokenSet.clear();
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
                return this.maxStreak;
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
        return {
            ...selected,
            startValue: this.getMissionMetric(selected.metric)
        };
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

        ['short', 'long'].forEach(slot => {
            const mission = this.missions[slot];
            if (!mission) return;

            if (mission.startValue === undefined || mission.startValue === null) {
                mission.startValue = this.getMissionMetric(mission.metric);
            }
        });
    }

    getMissionProgress(slot) {
        const mission = this.missions?.[slot];
        if (!mission) return { current: 0, target: 1, percent: 0, complete: false };

        const rawCurrent = this.getMissionMetric(mission.metric);
        const usesDelta = this.missionUsesDelta(mission.metric);
        const startValue = usesDelta ? (mission.startValue ?? 0) : 0;
        const current = Math.max(0, rawCurrent - startValue);
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

        this.addCode(mission.rewardCode || 0);
        this.addPrestigePoints(mission.rewardRep || 0);

        const claimed = { ...mission };
        this.refreshMission(slot, true);
        return claimed;
    }

    getPrestigeMultiplier() {
        return 1 + (this.prestigePoints * CONFIG.PRESTIGE_BONUS_PER_POINT);
    }

    getTeamClickBonus() {
        return Object.entries(this.team).reduce((sum, [key, member]) => {
            return sum + ((member.clickBoost || 0) * member.owned * this.getTeamMemberResponsibilityMultiplier(key));
        }, 0);
    }

    getTeamPassiveBonus() {
        return Object.entries(this.team).reduce((sum, [key, member]) => {
            return sum + ((member.passiveBoost || 0) * member.owned * this.getTeamMemberResponsibilityMultiplier(key));
        }, 0);
    }

    getBasePassiveGeneration() {
        return Object.values(this.languages).reduce((sum, language) => {
            return sum + (language.generation * language.owned);
        }, 0);
    }

    getArtifactBonus(type) {
        return Object.values(this.artifacts).reduce((sum, artifact) => {
            return sum + ((artifact[type] || 0) * (artifact.owned || 0));
        }, 0);
    }

    getTeamGeneration() {
        return Object.entries(this.team).reduce((sum, [key, member]) => {
            return sum + (member.generation * member.owned * this.getTeamMemberResponsibilityMultiplier(key));
        }, 0);
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
        if (!force && this.currentTrend && now < this.currentTrend.expiresAt) {
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
        const elapsedSeconds = Math.min(
            CONFIG.OFFLINE_CAP_SECONDS,
            Math.max(0, (now - (this.lastSavedAt || now)) / 1000)
        );

        if (elapsedSeconds < 30) {
            this.lastSavedAt = now;
            return;
        }

        const generation = this.calculateGeneration();
        const earned = generation * elapsedSeconds;
        if (earned <= 0) {
            this.lastSavedAt = now;
            return;
        }

        this.earnCode(earned);
        this.offlineReport = {
            seconds: Math.floor(elapsedSeconds),
            codeEarned: Math.floor(earned)
        };
        this.lastSavedAt = now;
    }

    calculateClickPower() {
        const specialization = this.getSpecialization();
        const clickBonus = (specialization?.clickBoost || 0) + this.getTeamClickBonus() + this.getArtifactBonus('clickBoost');
        const streakBonus = Math.min(
            CONFIG.STREAK_CLICK_BONUS_CAP,
            this.streak * CONFIG.STREAK_CLICK_BONUS_PER_STACK
        );
        const maintenanceMultiplier = this.getMaintenanceStatus().clickMultiplier;
        return this.codePerClick * this.getPrestigeMultiplier() * (1 + clickBonus + streakBonus) * this.activeEffects.clickMultiplier * maintenanceMultiplier;
    }
    
    // === CÁLCULOS ===
    calculateGeneration() {
        const specialization = this.getSpecialization();
        const passiveBonus = (specialization?.passiveBoost || 0) + this.getTeamPassiveBonus() + this.getArtifactBonus('passiveBoost');
        const base = this.getBasePassiveGeneration()
            + this.getTeamGeneration()
            + this.getSpecializationLanguageBonus()
            + this.getFrameworkSynergyBonus()
            + this.getTrendLanguageBonus()
            + this.getTrendFrameworkBonus();
        this.passiveGeneration = base;

        const maintenanceMultiplier = this.getMaintenanceStatus().passiveMultiplier;
        return base * this.getPrestigeMultiplier() * (1 + passiveBonus) * this.activeEffects.passiveMultiplier * maintenanceMultiplier;
    }

    calculatePrestigeCost() {
        return Math.floor(CONFIG.PRESTIGE_BASE_COST * Math.pow(CONFIG.PRESTIGE_COST_SCALING, this.prestigeLevel));
    }

    calculatePrestigeReward() {
        const cost = this.calculatePrestigeCost();
        if (this.totalCode < cost) return 0;

        const ratio = this.totalCode / cost;
        return Math.max(1, Math.floor(Math.sqrt(ratio)));
    }

    canPrestige() {
        return this.calculatePrestigeReward() > 0;
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
            achievements: this.achievements
        };

        this.reset();
        this.soundEnabled = preserved.soundEnabled;
        this.theme = preserved.theme;
        this.prestigePoints = preserved.prestigePoints;
        this.prestigeLevel = preserved.prestigeLevel;
        this.currentSpecialization = preserved.currentSpecialization;
        this.artifacts = preserved.artifacts;
        this.achievements = preserved.achievements;
        this.responsibility.value = this.getResponsibilityBaselineValue();
        this.responsibility.lastState = this.getResponsibilityState().key;
        this.lastUpdate = Date.now();
        this.refreshTrend(true);
        this.lastSavedAt = Date.now();

        return reward;
    }
    
    // === PERSISTENCIA ===
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
            lastReleaseReport: this.lastReleaseReport,
            maintenance: this.maintenance,
            projectHealth: this.projectHealth,
            responsibility: this.responsibility,
            responsibilityStats: this.responsibilityStats,
            healthStats: this.healthStats,
            currentTrend: this.currentTrend,
            activeEffects: this.activeEffects,
            admin: this.admin,
            soundEnabled: this.soundEnabled,
            theme: this.theme,
            languages: this.languages,
            upgrades: this.upgrades,
            frameworks: this.frameworks,
            artifacts: this.artifacts,
            team: this.team,
            achievements: this.achievements,
            missions: this.missions,
            lastSavedAt: now
        };
        localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
        this.lastPersistAt = now;
        this.lastSavedAt = now;
        return true;
    }
    
    load() {
        const hardReloadResetFlag = sessionStorage.getItem(CONFIG.HARD_RELOAD_RESET_FLAG_KEY);
        if (hardReloadResetFlag === '1') {
            localStorage.removeItem(CONFIG.SAVE_KEY);
            sessionStorage.removeItem(CONFIG.HARD_RELOAD_RESET_FLAG_KEY);
            this.reset();
            return;
        }

        const saved = localStorage.getItem(CONFIG.SAVE_KEY);
        if (!saved) return;

        const data = JSON.parse(saved);

        this.code = data.code ?? this.code;
        this.commitProgress = data.commitProgress ?? Math.max(0, data.code ?? this.commitProgress);
        this.totalCode = data.totalCode ?? this.totalCode;
        this.codePerClick = data.codePerClick ?? this.codePerClick;
        this.clicks = data.clicks ?? this.clicks;
        this.commits = data.commits ?? this.commits;
        this.streak = data.streak ?? this.streak;
        this.maxStreak = data.maxStreak ?? this.maxStreak;
        this.passiveGeneration = data.passiveGeneration ?? this.passiveGeneration;
        this.prestigePoints = data.prestigePoints ?? this.prestigePoints;
        this.prestigeLevel = data.prestigeLevel ?? this.prestigeLevel;
        this.currentSpecialization = data.currentSpecialization ?? this.currentSpecialization;
        this.releaseCharge = data.releaseCharge ?? this.releaseCharge;
        this.releaseCount = data.releaseCount ?? this.releaseCount;
        this.releaseVersion = data.releaseVersion ?? this.releaseVersion;
        this.lastReleaseReport = data.lastReleaseReport ?? this.lastReleaseReport;
        this.maintenance = {
            ...this.maintenance,
            ...(data.maintenance || {})
        };
        this.projectHealth = {
            ...this.projectHealth,
            ...(data.projectHealth || {})
        };
        this.responsibility = {
            ...this.responsibility,
            ...(data.responsibility || {})
        };
        this.responsibilityStats = {
            ...this.responsibilityStats,
            ...(data.responsibilityStats || {})
        };
        this.healthStats = {
            ...this.healthStats,
            ...(data.healthStats || {})
        };
        this.projectHealth.quality = this.clampProjectHealthValue(this.projectHealth.quality, CONFIG.PROJECT_HEALTH.QUALITY_MAX);
        this.projectHealth.technicalDebt = this.clampProjectHealthValue(this.projectHealth.technicalDebt, CONFIG.PROJECT_HEALTH.DEBT_MAX);
        this.projectHealth.lastState = this.getProjectHealthState().key;
        this.responsibility.value = this.clampResponsibilityValue(this.responsibility.value);
        this.responsibility.lastState = this.getResponsibilityState().key;
        this.currentTrend = data.currentTrend ?? this.currentTrend;
        this.soundEnabled = data.soundEnabled ?? this.soundEnabled;
        this.theme = data.theme ?? this.theme;
        this.lastSavedAt = data.lastSavedAt ?? this.lastSavedAt;
        this.lastPersistAt = 0;
        this.activeEffects = {
            ...this.activeEffects,
            ...(data.activeEffects || {})
        };
        this.admin = {
            ...this.admin,
            ...(data.admin || {})
        };

        this.mergeCollection(this.languages, data.languages);
        this.mergeCollection(this.upgrades, data.upgrades);
        this.mergeCollection(this.frameworks, data.frameworks);
        this.mergeCollection(this.artifacts, data.artifacts);
        this.mergeCollection(this.team, data.team);
        this.mergeCollection(this.achievements, data.achievements);

        if (data.missions) {
            this.missions = data.missions;
        }
        this.refreshAllMissions();
        this.refreshTrend();
        this.applyOfflineProgress();
        this.lastUpdate = Date.now();
    }

    mergeCollection(target, source) {
        if (!source) return;
        Object.entries(source).forEach(([key, value]) => {
            if (!target[key]) return;
            target[key] = {
                ...target[key],
                ...value
            };
        });
    }
}

// Instancia global
const gameState = new GameState();
gameState.load();

console.log('✅ STATE loaded');
