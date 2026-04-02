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

        // Progreso
        this.code = 0;
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
        this.code += amount;
        this.totalCode += amount;
    }
    
    addCommit() {
        this.commits++;
        this.releaseCharge++;
        this.code = Math.max(0, this.code - CONFIG.CODE_PER_COMMIT);
    }

    addPrestigePoints(amount) {
        this.prestigePoints += amount;
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
        if (this.totalCode < upgrade.cost) return false;
        
        this.totalCode -= upgrade.cost;
        upgrade.owned++;
        this.codePerClick *= upgrade.multiplier;
        return true;
    }
    
    buyLanguage(key) {
        const language = this.languages[key];
        if (!language) return false;
        if (this.totalCode < language.cost) return false;
        
        this.totalCode -= language.cost;
        language.owned++;
        this.passiveGeneration += language.generation;
        language.cost = Math.floor(language.cost * 1.15);
        return true;
    }
    
    buyFramework(key) {
        const framework = this.frameworks[key];
        if (!framework) return false;
        if (this.totalCode < framework.cost) return false;
        
        this.totalCode -= framework.cost;
        framework.owned++;
        framework.cost = Math.floor(framework.cost * 1.15);
        return true;
    }

    buyTeamMember(key) {
        const member = this.team[key];
        if (!member) return false;
        if (this.totalCode < member.cost) return false;

        this.totalCode -= member.cost;
        member.owned++;
        member.cost = Math.floor(member.cost * 1.2);
        return true;
    }

    buyArtifact(key) {
        const artifact = this.artifacts[key];
        if (!artifact || artifact.owned > 0) return false;
        if (this.prestigePoints < artifact.cost) return false;

        this.prestigePoints -= artifact.cost;
        artifact.owned = 1;
        return true;
    }

    assignSpecialization(key) {
        if (!CONFIG.SPECIALIZATIONS[key]) return false;
        if (this.currentSpecialization === key) return true;

        if (this.currentSpecialization && this.totalCode < CONFIG.SPECIALIZATION_SWITCH_COST) {
            return false;
        }

        if (this.currentSpecialization) {
            this.totalCode -= CONFIG.SPECIALIZATION_SWITCH_COST;
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
        return { ...selected };
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

    getMissionProgress(slot) {
        const mission = this.missions?.[slot];
        if (!mission) return { current: 0, target: 1, percent: 0, complete: false };

        const current = this.getMissionMetric(mission.metric);
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
        return Object.values(this.team).reduce((sum, member) => sum + ((member.clickBoost || 0) * member.owned), 0);
    }

    getTeamPassiveBonus() {
        return Object.values(this.team).reduce((sum, member) => sum + ((member.passiveBoost || 0) * member.owned), 0);
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
        return Object.values(this.team).reduce((sum, member) => {
            return sum + (member.generation * member.owned);
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

    canPublishRelease() {
        return this.releaseCharge >= CONFIG.RELEASE_CHARGE_REQUIRED;
    }

    publishRelease() {
        if (!this.canPublishRelease()) return null;

        const reward = this.getReleaseRewardPreview();
        this.addCode(reward.code);
        this.addPrestigePoints(reward.rep);
        this.releaseCount++;
        this.releaseCharge = 0;
        this.incrementVersion();

        return {
            ...reward,
            version: this.getVersionLabel()
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

        this.addCode(earned);
        this.offlineReport = {
            seconds: Math.floor(elapsedSeconds),
            codeEarned: Math.floor(earned)
        };
        this.lastSavedAt = now;
    }

    calculateClickPower() {
        const specialization = this.getSpecialization();
        const clickBonus = (specialization?.clickBoost || 0) + this.getTeamClickBonus() + this.getArtifactBonus('clickBoost');
        return this.codePerClick * this.getPrestigeMultiplier() * (1 + clickBonus) * this.activeEffects.clickMultiplier;
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

        return base * this.getPrestigeMultiplier() * (1 + passiveBonus) * this.activeEffects.passiveMultiplier;
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
            currentTrend: this.currentTrend,
            activeEffects: this.activeEffects,
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
        const saved = localStorage.getItem(CONFIG.SAVE_KEY);
        if (!saved) return;

        const data = JSON.parse(saved);

        this.code = data.code ?? this.code;
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
        this.currentTrend = data.currentTrend ?? this.currentTrend;
        this.soundEnabled = data.soundEnabled ?? this.soundEnabled;
        this.theme = data.theme ?? this.theme;
        this.lastSavedAt = data.lastSavedAt ?? this.lastSavedAt;
        this.lastPersistAt = 0;
        this.activeEffects = {
            ...this.activeEffects,
            ...(data.activeEffects || {})
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
