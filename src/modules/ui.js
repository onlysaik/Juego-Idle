/**
 * MODULES/UI.JS - Actualización de interfaz de usuario
 * Responsabilidad: Renderizar y actualizar todos los elementos visuales
 * Separado completamente de la lógica del juego
 */

const uiModule = {
    maxVisibleNotifications: 4,
    activeNotifications: {},

    isCreativeModeActive() {
        return gameState.isCreativeModeEnabled();
    },

    formatCodeCost(cost) {
        return this.isCreativeModeActive() ? '🛠 Gratis' : `💾 ${cost.toLocaleString()}`;
    },

    formatPrestigeCost(cost) {
        return this.isCreativeModeActive() ? '🛠 Gratis' : `⭐ ${cost}`;
    },

    prefersReducedMotion() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    },

    getVisualPerformanceProfile(width = window.innerWidth) {
        const reducedMotion = this.prefersReducedMotion();
        const isCompactMobile = width <= 768;
        const isTabletLike = width <= 991.98;

        if (reducedMotion) {
            return {
                key: 'reduced',
                backgroundParticles: 0,
                passiveParticleBurst: 0,
                floatingTextDuration: 700,
                confettiScale: 0.35,
                enableClickAnimation: false,
                enableCommitAnimation: false,
                monitorQuality: 'low'
            };
        }

        if (isCompactMobile) {
            return {
                key: 'compact',
                backgroundParticles: 14,
                passiveParticleBurst: 1,
                floatingTextDuration: 800,
                confettiScale: 0.5,
                enableClickAnimation: true,
                enableCommitAnimation: true,
                monitorQuality: 'low'
            };
        }

        if (isTabletLike) {
            return {
                key: 'balanced',
                backgroundParticles: 26,
                passiveParticleBurst: 2,
                floatingTextDuration: 900,
                confettiScale: 0.75,
                enableClickAnimation: true,
                enableCommitAnimation: true,
                monitorQuality: 'medium'
            };
        }

        return {
            key: 'full',
            backgroundParticles: 50,
            passiveParticleBurst: 3,
            floatingTextDuration: 1000,
            confettiScale: 1,
            enableClickAnimation: true,
            enableCommitAnimation: true,
            monitorQuality: 'full'
        };
    },

    scaleCelebrationCount(baseCount) {
        const profile = this.getVisualPerformanceProfile();
        return Math.max(18, Math.round(baseCount * profile.confettiScale));
    },

    rebuildCommerceUI() {
        this.createUpgradesUI();
        this.createLanguagesUI();
        this.createLabUI();
        this.createMetaUI();
    },

    rebuildAllPrimaryUI() {
        this.rebuildCommerceUI();
        this.createAchievementsUI();
        this.createMissionsUI();
        this.update();
    },

    // Escribe un texto salvo que un efecto (scramble/odometer) lo esté animando.
    setText(elementOrId, text) {
        const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (!element || element.dataset.fxLock) return;
        const value = String(text);
        if (element.textContent !== value) element.textContent = value;
    },

    // === ACTUALIZACIÓN DE STATS ===
    updateStats() {
        this.setText('currentCodeHeader', Math.floor(gameState.code).toLocaleString());
        document.getElementById('commits').textContent = gameState.commits;
        document.getElementById('streak').textContent = gameState.streak;
        document.getElementById('achievementCount').textContent = achievementsModule.getCount();
        this.setText('prestigePoints', gameState.prestigePoints);
        this.updateRunBadge();
    },

    // Insignia "Run N" del header: aparece desde el primer prestige. La escena del prestige
    // la retiene (data-fx-lock) hasta su momento.
    updateRunBadge() {
        const badge = document.getElementById('runBadge');
        if (!badge || badge.dataset.fxLock) return;
        const reached = gameState.prestigeLevel > 0;
        badge.hidden = !reached;
        if (reached) this.setText(badge, CONFIG.PRESTIGE_SCENE.RUN_BADGE.replace('{n}', gameState.prestigeLevel + 1));
    },

    // === TIER DEL CONTADOR (potencias de 10 del código total) ===
    getCodeTierColor(power) {
        const { MIN_POWER, TIER_COLORS } = CONFIG.CODE_POWER;
        if (power < MIN_POWER) return null;
        return TIER_COLORS[Math.min(TIER_COLORS.length - 1, power - MIN_POWER)];
    },

    // El color cambia en el impacto de la coreografía 'code_power' (paso 'tier'),
    // no en cuanto se cruza la cifra. Al cargar se toma del récord guardado.
    setCodeTier(power) {
        this.codeTier = Number(power) || 0;
        const color = this.getCodeTierColor(this.codeTier);
        ['codeDisplay', 'currentCodeHeader'].forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;
            if (color) {
                element.dataset.codeTier = String(this.codeTier);
                element.style.setProperty('--code-tier-color', color);
            } else {
                delete element.dataset.codeTier;
                element.style.removeProperty('--code-tier-color');
            }
        });
    },

    updateProgress() {
        if (this.codeTier === undefined) this.setCodeTier(gameState.codePowerRecord);
        this.setText('codeDisplay', Math.floor(gameState.code).toLocaleString());
        const rawProgressPercent = (gameState.commitProgress / CONFIG.CODE_PER_COMMIT) * 100;
        const progressPercent = Math.max(0, Math.min(100, rawProgressPercent));
        document.getElementById('codeBar').style.width = progressPercent + '%';
        const commitProgressMeta = document.getElementById('commitProgressMeta');
        if (commitProgressMeta) {
            const progressValue = Math.floor(gameState.commitProgress).toLocaleString();
            const goalValue = CONFIG.CODE_PER_COMMIT.toLocaleString();
            commitProgressMeta.textContent = `Commit ${progressValue} / ${goalValue}`;
        }
        const passiveClickBonus = gameState.calculateClickPassiveBonus();
        const clickPower = gameState.calculateBaseClickPower() + passiveClickBonus;
        document.getElementById('cpv').textContent = Math.floor(clickPower).toLocaleString();

        // Desglose: cuánto del click viene de la producción pasiva.
        const passiveShareLabel = document.getElementById('clickPassiveShare');
        if (passiveShareLabel) {
            const sharePercent = Math.round(CONFIG.CLICK_PASSIVE_SHARE * 100);
            passiveShareLabel.hidden = passiveClickBonus < 1;
            passiveShareLabel.textContent = `incluye +${this.formatCompactNumber(passiveClickBonus)} (${sharePercent}% de tu producción)`;
        }

        // MEJORA 1: Aura de progresión - cambiar clase si power es alto
        const button = document.getElementById('clickBtn');
        const maxPowerForLow = CONFIG.INITIAL_CODE_PER_CLICK * 100; // Escala dinámica
        if (clickPower > maxPowerForLow) {
            button.classList.add('power-high');
        } else {
            button.classList.remove('power-high');
        }
        
        // MEJORA 2: Barra pulsante cuando estamos cerca del commit (>80%)
        const progressBar = document.getElementById('codeBar').parentElement;
        if (progressPercent > 80 && progressPercent < 100) {
            progressBar.classList.add('near-commit');
        } else {
            progressBar.classList.remove('near-commit');
        }
        
        editorModule.sync();
    },
    
    // Solo reconstruye la lista cuando cambian las unidades compradas;
    // en cada tick únicamente se actualiza el texto del ritmo total.
    updatePassive(generation = gameState.calculateGeneration()) {
        const container = document.getElementById('passiveContainer');
        if (!container) return;

        const signature = [gameState.languages, gameState.team]
            .map(collection => Object.values(collection).map(item => item.owned).join(','))
            .join('|');

        if (signature !== this.passiveSignature) {
            this.passiveSignature = signature;
            this.renderPassiveList(container);
        }

        const totalLabel = container.querySelector('[data-passive-total]');
        if (totalLabel) {
            totalLabel.textContent = `${generation.toFixed(1)} líneas/seg (con bonus)`;
        }
    },

    renderPassiveList(container) {
        container.innerHTML = '';

        let hasPassive = false;
        Object.entries(gameState.languages).forEach(([key, lang]) => {
            if (lang.owned > 0) {
                hasPassive = true;
                const item = document.createElement('div');
                item.className = 'passive-item';
                item.innerHTML = `
                    <i class="passive-icon ${lang.icon}"></i>
                    <div class="passive-info">
                        <h4>${lang.name}</h4>
                        <p>+${(lang.generation * lang.owned * gameState.getMilestoneMultiplier(lang.owned)).toLocaleString()} líneas/seg base${gameState.getMilestoneLevel(lang.owned) > 0 ? ` · hito x${gameState.getMilestoneMultiplier(lang.owned)}` : ''}</p>
                    </div>
                    <div style="margin-left: auto; color: var(--accent); font-weight: 700;">x${lang.owned}</div>
                `;
                container.appendChild(item);
            }
        });

        Object.entries(gameState.team).forEach(([key, member]) => {
            if (member.owned > 0) {
                hasPassive = true;
                const item = document.createElement('div');
                item.className = 'passive-item';
                item.innerHTML = `
                    <i class="passive-icon ${member.icon}"></i>
                    <div class="passive-info">
                        <h4>${member.name}</h4>
                        <p>+${(member.generation * member.owned * gameState.getMilestoneMultiplier(member.owned)).toLocaleString()} líneas/seg base${gameState.getMilestoneLevel(member.owned) > 0 ? ` · hito x${gameState.getMilestoneMultiplier(member.owned)}` : ''}</p>
                    </div>
                    <div style="margin-left: auto; color: var(--accent); font-weight: 700;">x${member.owned}</div>
                `;
                container.appendChild(item);
            }
        });
        
        if (!hasPassive) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Compra un lenguaje para generar código automáticamente</p>';
        } else {
            const total = document.createElement('div');
            total.className = 'passive-item';
            total.innerHTML = `
                <i class="passive-icon fas fa-wave-square"></i>
                <div class="passive-info">
                    <h4>Ritmo total</h4>
                    <p data-passive-total data-nerd="generation"></p>
                </div>
            `;
            container.prepend(total);
        }
    },
    
    updateStatistics(generation = gameState.calculateGeneration()) {
        document.getElementById('totalClicks').textContent = gameState.clicks.toLocaleString();
        document.getElementById('currentSpeed').textContent = generation.toFixed(1) + ' líneas/seg';
        document.getElementById('totalCommits').textContent = gameState.commits;
        document.getElementById('lifetimeCode').textContent = Math.floor(gameState.totalCode).toLocaleString();
        document.getElementById('maxStreak').textContent = gameState.maxStreak;
    },

    updateProjectHealthUI() {
        const card = document.getElementById('projectHealthCard');
        const stateLabel = document.getElementById('projectHealthState');
        const stateBadge = document.getElementById('projectHealthBadge');
        const peekState = document.getElementById('projectHealthPeekState');
        const peekMetrics = document.getElementById('projectHealthPeekMetrics');
        const qualityValue = document.getElementById('projectHealthQualityValue');
        const qualityBar = document.getElementById('projectHealthQualityBar');
        const debtValue = document.getElementById('projectHealthDebtValue');
        const debtBar = document.getElementById('projectHealthDebtBar');
        const copy = document.getElementById('projectHealthCopy');
        const responsibilityState = document.getElementById('projectResponsibilityState');
        const responsibilityBadge = document.getElementById('projectResponsibilityBadge');
        const responsibilityValue = document.getElementById('projectResponsibilityValue');
        const responsibilityBar = document.getElementById('projectResponsibilityBar');
        const responsibilityCopy = document.getElementById('projectResponsibilityCopy');
        const maintenanceButton = document.getElementById('projectHealthMaintenanceBtn');
        const maintenanceStatus = document.getElementById('projectHealthMaintenanceStatus');
        if (!card || !stateLabel || !stateBadge || !qualityValue || !qualityBar || !debtValue || !debtBar || !copy || !responsibilityState || !responsibilityBadge || !responsibilityValue || !responsibilityBar || !responsibilityCopy || !maintenanceButton || !maintenanceStatus) return;

        const snapshot = gameState.getProjectHealthSnapshot();
        const responsibility = gameState.getResponsibilitySnapshot();
        const maintenance = gameState.getMaintenanceStatus();
        card.dataset.state = snapshot.state.key;
        stateLabel.textContent = snapshot.state.label;
        stateBadge.textContent = snapshot.state.badge;
        if (peekState) peekState.textContent = snapshot.state.label;
        if (peekMetrics) peekMetrics.textContent = `Q${Math.round(snapshot.quality)} · D${Math.round(snapshot.technicalDebt)} · O${Math.round(responsibility.value)}`;
        qualityValue.textContent = Math.round(snapshot.quality).toString();
        debtValue.textContent = Math.round(snapshot.technicalDebt).toString();
        qualityBar.style.width = `${snapshot.quality}%`;
        debtBar.style.width = `${snapshot.technicalDebt}%`;
        copy.textContent = snapshot.state.description;
        responsibilityState.textContent = responsibility.state.label;
        responsibilityBadge.textContent = responsibility.state.badge;
        responsibilityValue.textContent = Math.round(responsibility.value).toString();
        responsibilityBar.style.width = `${responsibility.value}%`;
        responsibilityCopy.textContent = responsibility.state.description;

        if (maintenance.isActive) {
            maintenanceButton.disabled = true;
            maintenanceButton.textContent = 'Refactor en curso';
            maintenanceStatus.textContent = `Mantenimiento activo · ${Math.ceil(maintenance.activeRemainingMs / 1000)}s restantes · throughput reducido`;
        } else if (maintenance.isCoolingDown) {
            maintenanceButton.disabled = true;
            maintenanceButton.textContent = 'Cooldown de refactor';
            maintenanceStatus.textContent = `Vuelve a estar disponible en ${Math.ceil(maintenance.cooldownRemainingMs / 1000)}s`;
        } else {
            maintenanceButton.disabled = !gameState.canAffordCodeCost(maintenance.cost);
            maintenanceButton.textContent = `Refactorizar · ${maintenance.cost.toLocaleString()} código`;
            maintenanceStatus.textContent = 'Recupera calidad y reduce deuda a cambio de frenar el ritmo temporalmente';
        }
    },

    updateMissionsUI() {
        ['short', 'long'].forEach(slot => {
            const mission = gameState.missions?.[slot];
            const progress = gameState.getMissionProgress(slot);
            if (!mission) return;

            const progressLabel = document.getElementById(`${slot}MissionProgress`);
            const progressBar = document.getElementById(`${slot}MissionBar`);
            const claimButton = document.getElementById(`${slot}MissionClaim`);

            if (progressLabel) {
                progressLabel.textContent = `${this.formatMissionValue(mission.metric, Math.min(progress.current, progress.target))} / ${this.formatMissionValue(mission.metric, progress.target)}`;
            }

            if (progressBar) {
                progressBar.style.width = `${progress.percent}%`;
            }

            if (claimButton) {
                claimButton.disabled = !progress.complete;
                claimButton.textContent = progress.complete ? 'Cobrar' : 'En progreso';
            }

            // Recompensa y coste de cambio escalan con la producción actual.
            const rewardLabel = document.getElementById(`${slot}MissionReward`);
            if (rewardLabel) {
                rewardLabel.textContent = this.formatCompactNumber(gameState.getMissionRewardCode(mission));
            }

            const rerollCost = gameState.getMissionRerollCost(slot);
            const rerollCostLabel = document.getElementById(`${slot}MissionRerollCost`);
            if (rerollCostLabel) {
                rerollCostLabel.textContent = this.formatCompactNumber(rerollCost);
            }

            const rerollButton = document.getElementById(`${slot}MissionReroll`);
            if (rerollButton) {
                // No tiene sentido descartar una misión ya completada.
                rerollButton.disabled = progress.complete || !gameState.canAffordCodeCost(rerollCost);
            }
        });
    },

    formatMissionValue(metric, value) {
        if (metric === 'healthySeconds' || metric === 'highResponsibilitySeconds') {
            const totalSeconds = Math.max(0, Math.floor(value));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        }

        return Math.floor(value).toLocaleString();
    },

    prefersCompactContent() {
        return window.innerWidth <= 560;
    },

    formatCompactNumber(value) {
        const numericValue = Number(value) || 0;
        const absoluteValue = Math.abs(numericValue);

        if (absoluteValue >= 1000000) {
            return `${(numericValue / 1000000).toFixed(absoluteValue >= 10000000 ? 0 : 1)}M`;
        }

        if (absoluteValue >= 1000) {
            return `${(numericValue / 1000).toFixed(absoluteValue >= 10000 ? 0 : 1)}k`;
        }

        return Math.round(numericValue).toLocaleString();
    },

    updateMetaUI() {
        const compactContent = this.prefersCompactContent();
        const prestigePoints = document.getElementById('metaPrestigePoints');
        const prestigeLevel = document.getElementById('metaPrestigeLevel');
        const prestigeBoost = document.getElementById('metaPrestigeBoost');
        const prestigeReward = document.getElementById('metaPrestigeReward');
        const prestigeCost = document.getElementById('metaPrestigeCost');
        const specializationName = document.getElementById('metaSpecialization');
        const teamSize = document.getElementById('metaTeamSize');
        const healthState = document.getElementById('metaHealthState');
        const healthMaintenanceCost = document.getElementById('metaMaintenanceCost');
        const healthReleaseBias = document.getElementById('metaReleaseBias');
        const healthCleanReleases = document.getElementById('metaCleanReleases');
        const healthInsight = document.getElementById('metaHealthInsight');
        const teamPressure = document.getElementById('metaTeamPressure');
        const teamOwnership = document.getElementById('metaTeamOwnership');
        const responsibilityBias = document.getElementById('metaResponsibilityBias');
        const responsibilityBaseline = document.getElementById('metaResponsibilityBaseline');
        const systemGlossary = document.getElementById('metaSystemGlossary');
        const prestigeButton = document.getElementById('prestigeActionBtn');
        const overview = gameState.getHealthOverview();
        const teamProfile = gameState.getTeamResponsibilityProfile();
        const responsibilityModifiers = gameState.getResponsibilityModifiers();

        if (prestigePoints) prestigePoints.textContent = gameState.prestigePoints.toLocaleString();
        if (prestigeLevel) prestigeLevel.textContent = gameState.prestigeLevel.toLocaleString();
        if (prestigeBoost) prestigeBoost.textContent = `x${gameState.getPrestigeMultiplier().toFixed(2)}`;
        if (prestigeReward) prestigeReward.textContent = `+${gameState.calculatePrestigeReward()} rep`;
        if (prestigeCost) prestigeCost.textContent = this.isCreativeModeActive()
            ? 'Gratis / admin'
            : `${gameState.calculatePrestigeCost().toLocaleString()} código total`;
        if (specializationName) {
            specializationName.textContent = gameState.getSpecialization()?.name || 'Sin definir';
        }
        if (teamSize) {
            teamSize.textContent = gameState.getOwnedCount(gameState.team).toLocaleString();
        }
        if (healthState) {
            healthState.textContent = overview.snapshot.state.label;
        }
        if (healthMaintenanceCost) {
            healthMaintenanceCost.textContent = compactContent
                ? `${this.formatCompactNumber(overview.maintenanceCost)} cod`
                : `${overview.maintenanceCost.toLocaleString()} código`;
        }
        if (healthReleaseBias) {
            const releaseBonus = overview.modifiers.releaseHealthBonus;
            healthReleaseBias.textContent = `${releaseBonus >= 0 ? '+' : ''}${Math.round(releaseBonus)} score`;
        }
        if (healthCleanReleases) {
            healthCleanReleases.textContent = compactContent
                ? `${overview.cleanReleases} limp. · ${overview.healthyReleases} sanas`
                : `${overview.cleanReleases} limpias / ${overview.healthyReleases} sanas`;
        }
        if (healthInsight) {
            healthInsight.textContent = overview.recommendation;
        }
        if (systemGlossary) {
            systemGlossary.textContent = overview.systemFocus;
        }
        if (teamPressure) {
            teamPressure.textContent = compactContent
                ? `${teamProfile.pressureLabel} · x${teamProfile.baseMultiplier.toFixed(2)}`
                : `${teamProfile.pressureLabel} · x${teamProfile.baseMultiplier.toFixed(2)}`;
        }
        if (teamOwnership) {
            teamOwnership.textContent = compactContent
                ? `${teamProfile.ownershipLabel} · esp. x${teamProfile.specialistMultiplier.toFixed(2)}`
                : `${teamProfile.ownershipLabel} · especialistas x${teamProfile.specialistMultiplier.toFixed(2)}`;
        }
        if (responsibilityBias) {
            responsibilityBias.textContent = compactContent
                ? `G x${responsibilityModifiers.gainMultiplier.toFixed(2)} · P x${responsibilityModifiers.lossMultiplier.toFixed(2)}`
                : `Ganancia x${responsibilityModifiers.gainMultiplier.toFixed(2)} · pérdida x${responsibilityModifiers.lossMultiplier.toFixed(2)}`;
        }
        if (responsibilityBaseline) {
            responsibilityBaseline.textContent = compactContent
                ? `Piso ${Math.round(responsibilityModifiers.baselineValue)} · conf. ${responsibilityModifiers.trustRepBonus >= 0 ? '+' : ''}${responsibilityModifiers.trustRepBonus} rep`
                : `Piso ${Math.round(responsibilityModifiers.baselineValue)} · confianza ${responsibilityModifiers.trustRepBonus >= 0 ? '+' : ''}${responsibilityModifiers.trustRepBonus} rep`;
        }
        if (prestigeButton) {
            prestigeButton.disabled = !gameState.canPrestige();
        }

        this.updatePrestigePreview(compactContent);

        document.querySelectorAll('.specialization-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.specialization === gameState.currentSpecialization);
        });

        document.querySelectorAll('.team-card').forEach(card => {
            const key = card.dataset.team;
            const member = gameState.team[key];
            if (!member) return;

            const count = card.querySelector('.team-owned');
            const cost = card.querySelector('.team-cost');
            if (count) count.textContent = `x${member.owned}`;
            if (cost) {
                cost.textContent = this.formatCodeCost(member.cost);
                cost.classList.toggle('affordable', gameState.canAffordCodeCost(member.cost));
            }
            this.updateMilestoneElement(card, member.owned);
        });
    },

    updatePrestigePreview(compactContent = this.prefersCompactContent()) {
        const gain = document.getElementById('metaPrestigePreviewGain');
        const multiplier = document.getElementById('metaPrestigePreviewMultiplier');
        const nextBar = document.getElementById('metaPrestigeNextBar');
        const nextRep = document.getElementById('metaPrestigeNextRep');
        if (!gain || !multiplier) return;

        const preview = gameState.getPrestigePreview();
        const format = value => (compactContent ? this.formatCompactNumber(value) : Math.ceil(value).toLocaleString());

        gain.textContent = `+${preview.reward} rep`;
        gain.classList.toggle('ready', preview.reward > 0);
        multiplier.textContent = `x${preview.currentMultiplier.toFixed(2)} → x${preview.nextMultiplier.toFixed(2)}`;
        if (nextBar) nextBar.style.width = `${preview.progressToNextRep}%`;
        if (nextRep) {
            nextRep.textContent = preview.reward === 0
                ? `Faltan ${format(preview.missingForNextRep)} de código total para el primer punto`
                : `+1 rep más con ${format(preview.missingForNextRep)} de código total adicional`;
        }
    },

    updateLabUI() {
        const compactContent = this.prefersCompactContent();
        const releaseVersion = document.getElementById('labReleaseVersion');
        const releaseCharge = document.getElementById('labReleaseCharge');
        const releaseReward = document.getElementById('labReleaseReward');
        const releaseTrust = document.getElementById('labReleaseTrust');
        const releaseOutlook = document.getElementById('labReleaseOutlook');
        const releaseLastOutcome = document.getElementById('labReleaseLastOutcome');
        const releaseButton = document.getElementById('releaseActionBtn');
        const trendLanguage = document.getElementById('labTrendLanguage');
        const trendFramework = document.getElementById('labTrendFramework');
        const trendTimer = document.getElementById('labTrendTimer');

        const reward = gameState.getReleaseRewardPreview();
        const preview = gameState.getReleaseOutcomePreview();
        const remainingMs = gameState.getTrendTimeRemaining();
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const trendLanguageData = CONFIG.LANGUAGES[gameState.currentTrend?.languageKey];
        const trendFrameworkData = CONFIG.FRAMEWORKS[gameState.currentTrend?.frameworkKey];

        if (releaseVersion) this.setText(releaseVersion, gameState.getVersionLabel());
        if (releaseCharge) releaseCharge.textContent = `${gameState.releaseCharge}/${CONFIG.RELEASE_CHARGE_REQUIRED}`;
        if (releaseReward) {
            releaseReward.textContent = reward.code > 0
                ? (compactContent
                    ? `Esp: +${this.formatCompactNumber(preview.expectedCode)} cod · +${preview.expectedRep} rep`
                    : `Esperado: +${preview.expectedCode.toLocaleString()} código · +${preview.expectedRep} rep`)
                : (compactContent ? 'Carga commits' : 'Carga commits para publicar');
        }
        if (releaseTrust) {
            releaseTrust.textContent = preview.ready
                ? (compactContent
                    ? `${preview.trust.label} · lid. ${Math.round(preview.trust.snapshot.value)} · ${preview.trust.repModifier >= 0 ? '+' : ''}${preview.trust.repModifier} rep`
                    : `${preview.trust.label} · liderazgo ${Math.round(preview.trust.snapshot.value)} · conversión ${preview.trust.repModifier >= 0 ? '+' : ''}${preview.trust.repModifier} rep`)
                : (compactContent
                    ? 'Confianza y salud se calculan al cerrar la release'
                    : 'La confianza de entrega depende de responsabilidad; la salud técnica se evalúa aparte cuando la release está lista');
        }
        if (releaseOutlook) {
            releaseOutlook.textContent = preview.ready
                ? (compactContent
                    ? `${preview.band.label} · ${preview.projectHealth.state.label} · ${this.formatCompactNumber(preview.minCode)}-${this.formatCompactNumber(preview.maxCode)} cod`
                    : `${preview.band.label} · ${preview.band.riskLabel} · salud ${preview.projectHealth.state.label} · ${preview.minCode.toLocaleString()}-${preview.maxCode.toLocaleString()} código`)
                : 'Necesitas más commits para estimar la release';
        }
        if (releaseLastOutcome) {
            const last = gameState.lastReleaseReport;
            releaseLastOutcome.textContent = last
                ? (compactContent
                    ? `Última: ${last.band.label} · +${this.formatCompactNumber(last.code)} cod · +${last.rep} rep`
                    : `Última: ${last.band.label} · ${last.trust?.label || 'Confianza moderada'} · +${last.code.toLocaleString()} código · +${last.rep} rep`)
                : 'Aún no has publicado una release en esta run';
        }
        if (releaseButton) releaseButton.disabled = !gameState.canPublishRelease();
        if (trendLanguage) trendLanguage.textContent = trendLanguageData ? `${trendLanguageData.name} x${(1 + CONFIG.TREND_LANGUAGE_MULTIPLIER).toFixed(2)}` : 'Sin tendencia';
        if (trendFramework) trendFramework.textContent = trendFrameworkData ? `${trendFrameworkData.name} x${(1 + CONFIG.TREND_FRAMEWORK_MULTIPLIER).toFixed(2)}` : 'Sin framework hot';
        if (trendTimer) trendTimer.textContent = `${Math.max(0, remainingSeconds)}s`;

        document.querySelectorAll('.artifact-card').forEach(card => {
            const key = card.dataset.artifact;
            const artifact = gameState.artifacts[key];
            if (!artifact) return;

            const owned = artifact.owned > 0;
            const affordable = gameState.canAffordPrestigeCost(artifact.cost);
            card.classList.toggle('purchased', owned);
            card.classList.toggle('unaffordable', !owned && !affordable);
            const cost = card.querySelector('.artifact-cost');
            const status = card.querySelector('.artifact-status');

            if (cost) {
                cost.textContent = owned ? 'Comprado' : this.formatPrestigeCost(artifact.cost);
                cost.classList.toggle('affordable', affordable && !owned);
            }

            if (status) {
                const missing = Math.max(0, artifact.cost - gameState.prestigePoints);
                status.textContent = owned
                    ? 'Activo'
                    : (affordable ? 'Disponible' : `No alcanza · faltan ${missing} ⭐`);
            }
        });
    },

    setPreviewLanguage(languageKey) {
        editorModule.setPreviewLanguage(languageKey);
    },

    setPreviewFramework(frameworkKey) {
        editorModule.setPreviewFramework(frameworkKey);
    },

    syncEditorTabs() {
        return editorModule.syncTabs();
    },

    updateCodePreview(force = false) {
        editorModule.updateCodePreview(force);
    },

    updateEditorStatus() {
        editorModule.updateStatus();
    },

    animateLanguageChange(languageName, frameworkName = null) {
        editorModule.animateLanguageChange(languageName, frameworkName);
    },

    showOfflineReport() {
        if (!gameState.offlineReport) return;

        const { seconds, codeEarned } = gameState.offlineReport;
        const minutes = Math.floor(seconds / 60);
        const label = minutes > 0 ? `${minutes} min` : `${seconds}s`;

        this.showNotification(
            `Resumen offline: +${codeEarned.toLocaleString()} líneas en ${label}`,
            'success',
            { duration: 5500, cssClass: 'notification-offline' }
        );

        gameState.clearOfflineReport();
    },
    
    // === REFRESCAR TODO ===
    update() {
        const generation = gameState.calculateGeneration();
        this.updateStats();
        this.updateProgress();
        this.updateProjectHealthUI();
        this.updatePassive(generation);
        this.updateStatistics(generation);
        this.updateMissionsUI();
        this.updateLabUI();
        this.updateMetaUI();
        this.updateShopAffordability();
        onboardingModule.updateNextGoal();
        nerdStatsModule.update();
    },

    // Mantiene al día el indicador "se puede comprar" de upgrades, frameworks
    // y lenguajes sin reconstruir las tarjetas.
    updateShopAffordability() {
        document.querySelectorAll('[data-shop-collection]').forEach(costEl => {
            const collection = gameState[costEl.dataset.shopCollection];
            const item = collection?.[costEl.dataset.shopKey];
            if (!item) return;

            const isMaxed = costEl.dataset.shopCollection === 'upgrades' && item.owned >= CONFIG.UPGRADE_MAX_OWNED;
            costEl.classList.toggle('affordable', !isMaxed && gameState.canAffordCodeCost(item.cost));
        });
    },
    
    // === CREAR TARJETAS DE UPGRADES ===
    createUpgradesUI() {
        const container = document.getElementById('upgradesContainer');
        container.innerHTML = '';
        
        // Upgrades
        Object.entries(gameState.upgrades).forEach(([key, upgrade]) => {
            const isMaxed = upgrade.owned >= CONFIG.UPGRADE_MAX_OWNED;
            const card = document.createElement('div');
            card.className = `upgrade-card ${upgrade.owned > 0 ? 'purchased' : ''} ${isMaxed ? 'maxed' : ''}`;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-disabled', String(isMaxed));
            card.innerHTML = `
                <i class="upgrade-icon ${upgrade.icon}"></i>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-desc">${upgrade.desc}</div>
                <div class="upgrade-cost ${isMaxed ? 'maxed' : ''} ${gameState.canAffordCodeCost(upgrade.cost) && !isMaxed ? 'affordable' : ''}" data-shop-collection="upgrades" data-shop-key="${key}">
                    ${isMaxed ? 'MAX NIVEL' : this.formatCodeCost(upgrade.cost)}
                </div>
                <div class="upgrade-level ${isMaxed ? 'maxed' : ''}">x${upgrade.owned}/${CONFIG.UPGRADE_MAX_OWNED}</div>
                ${isMaxed ? '<div class="upgrade-limit-badge">Límite alcanzado</div>' : ''}
            `;

            if (!isMaxed) {
                card.addEventListener('click', () => gameLogic.buyUpgrade(key));
            }

            container.appendChild(card);
        });
        
        // Frameworks (solo si tienes el requisito)
        Object.entries(gameState.frameworks).forEach(([key, framework]) => {
            const req = gameState.languages[framework.requires];
            if (!req || req.owned === 0) return;
            
            const card = document.createElement('div');
            card.className = `upgrade-card ${framework.owned > 0 ? 'purchased' : ''}`;
            card.innerHTML = `
                <i class="upgrade-icon ${framework.icon}"></i>
                <div class="upgrade-name">${framework.name}</div>
                <div class="upgrade-desc">${framework.desc}</div>
                <div class="upgrade-cost ${gameState.canAffordCodeCost(framework.cost) ? 'affordable' : ''}" data-shop-collection="frameworks" data-shop-key="${key}">
                    ${this.formatCodeCost(framework.cost)}
                </div>
                <div style="font-size: 0.75rem; color: var(--accent);">x${framework.owned}</div>
            `;
            card.addEventListener('click', () => gameLogic.buyFramework(key));
            container.appendChild(card);
        });
    },
    
    // === HITOS ===
    // Marcado vacío; updateMilestoneElement lo rellena según `owned`.
    renderMilestoneBar() {
        return `
            <div class="milestone" data-milestone>
                <div class="milestone-track"><div class="milestone-fill" data-milestone-fill></div></div>
                <span class="milestone-label" data-milestone-label></span>
            </div>
        `;
    },

    updateMilestoneElement(container, owned) {
        const fill = container?.querySelector('[data-milestone-fill]');
        const label = container?.querySelector('[data-milestone-label]');
        if (!fill || !label) return;

        const progress = gameState.getMilestoneProgress(owned);
        fill.style.width = `${progress.percent}%`;
        container.querySelector('[data-milestone]')?.classList.toggle('complete', progress.complete);
        label.textContent = progress.complete
            ? `Todos los hitos · x${progress.multiplier}`
            : `Hito ${owned}/${progress.next} → x${progress.nextMultiplier}`;
    },

    // === CREAR TARJETAS DE LENGUAJES ===
    createLanguagesUI() {
        const container = document.getElementById('languagesContainer');
        container.innerHTML = '';
        
        Object.entries(gameState.languages).forEach(([key, lang]) => {
            const card = document.createElement('div');
            card.className = `language-card ${lang.owned > 0 ? 'purchased' : ''}`;
            card.innerHTML = `
                <i class="language-icon ${lang.icon}"></i>
                <div class="language-name">${lang.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">+${(lang.generation * gameState.getMilestoneMultiplier(lang.owned)).toLocaleString()} líneas/seg c/u</div>
                <div class="language-cost ${gameState.canAffordCodeCost(lang.cost) ? 'affordable' : ''}" data-shop-collection="languages" data-shop-key="${key}">
                    ${this.formatCodeCost(lang.cost)}
                </div>
                <div style="font-size: 0.75rem; color: var(--accent);">x${lang.owned}</div>
                <div class="roi-label" data-roi-collection="languages" data-roi-key="${key}"></div>
                ${this.renderMilestoneBar()}
            `;
            card.addEventListener('click', () => gameLogic.buyLanguage(key));
            container.appendChild(card);
            this.updateMilestoneElement(card, lang.owned);
        });
    },

    createLabUI() {
        const summaryContainer = document.getElementById('labSummaryContainer');
        const artifactContainer = document.getElementById('artifactContainer');
        if (!summaryContainer || !artifactContainer) return;

        summaryContainer.innerHTML = `
            <div class="meta-card shell-compact-card release-card">
                <div class="meta-card-header">
                    <h3><i class="fas fa-rocket"></i> Release Train</h3>
                    <span class="meta-chip">Ship it</span>
                </div>
                <div class="meta-stats-grid compact">
                    <div>
                        <span class="meta-label">Versión actual</span>
                        <strong id="labReleaseVersion">v0.1.0</strong>
                    </div>
                    <div>
                        <span class="meta-label">Carga de release</span>
                        <strong id="labReleaseCharge">0/10</strong>
                    </div>
                </div>
                <div class="meta-card-footer column">
                    <span id="labReleaseReward">Carga commits para publicar</span>
                    <span id="labReleaseTrust" class="shell-tier-secondary">La confianza de release se calcula cuando tienes una entrega lista</span>
                    <span id="labReleaseOutlook" class="shell-tier-secondary">Necesitas más commits para estimar la release</span>
                    <span id="labReleaseLastOutcome" class="shell-tier-tertiary">Aún no has publicado una release en esta run</span>
                    <button class="meta-action-btn" id="releaseActionBtn" type="button">Publicar release</button>
                </div>
            </div>
            <div class="meta-card shell-compact-card trend-card">
                <div class="meta-card-header">
                    <h3><i class="fas fa-fire"></i> Hype del Ecosistema</h3>
                    <span class="meta-chip">Trending</span>
                </div>
                <div class="meta-stats-grid compact">
                    <div>
                        <span class="meta-label">Lenguaje hot</span>
                        <strong id="labTrendLanguage">Sin tendencia</strong>
                    </div>
                    <div>
                        <span class="meta-label">Framework hot</span>
                        <strong id="labTrendFramework">Sin framework hot</strong>
                    </div>
                    <div>
                        <span class="meta-label">Actualiza en</span>
                        <strong id="labTrendTimer">0s</strong>
                    </div>
                </div>
            </div>
        `;

        artifactContainer.innerHTML = Object.entries(gameState.artifacts).map(([key, artifact]) => `
            <button class="artifact-card shell-compact-card" data-artifact="${key}" type="button">
                <i class="${artifact.icon}"></i>
                <span class="artifact-name">${artifact.name}</span>
                <span class="artifact-desc shell-tier-secondary">${artifact.desc}</span>
                <span class="artifact-cost">${this.formatPrestigeCost(artifact.cost)}</span>
                <span class="artifact-status">Disponible</span>
            </button>
        `).join('');

        document.getElementById('releaseActionBtn')?.addEventListener('click', () => gameLogic.publishRelease());
        artifactContainer.querySelectorAll('.artifact-card').forEach(card => {
            card.addEventListener('click', () => gameLogic.buyArtifact(card.dataset.artifact));
        });

        this.updateLabUI();
    },
    
    // === CREAR TARJETAS DE LOGROS ===
    createAchievementsUI() {
        const container = document.getElementById('achievementsContainer');
        container.innerHTML = '';
        
        Object.entries(gameState.achievements).forEach(([key, ach]) => {
            const card = document.createElement('div');
            card.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
            card.innerHTML = `
                <i class="achievement-icon ${ach.icon}"></i>
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-desc">${ach.desc}</div>
            `;
            container.appendChild(card);
        });
    },

    createMissionsUI() {
        const container = document.getElementById('missionsContainer');
        if (!container) return;

        const shortMission = gameState.missions.short;
        const longMission = gameState.missions.long;

        container.innerHTML = [shortMission, longMission].map((mission, index) => {
            const slot = index === 0 ? 'short' : 'long';
            const repText = mission.rewardRep > 0 ? ` · ⭐ ${mission.rewardRep} rep` : '';

            return `
                <div class="mission-card shell-compact-card ${slot}">
                    <div class="mission-badge">${slot === 'short' ? 'Misión corta' : 'Misión larga'}</div>
                    <div class="mission-name">${mission.name}</div>
                    <div class="mission-desc shell-tier-secondary">${mission.desc}</div>
                    <div class="mission-progress-track">
                        <div class="mission-progress-fill" id="${slot}MissionBar" style="width: 0%"></div>
                    </div>
                    <div class="mission-footer">
                        <span id="${slot}MissionProgress">0 / 0</span>
                        <span class="shell-tier-secondary" title="${Math.round(gameState.getMissionRewardSeconds(mission))} s de producción (mínimo ${(mission.rewardCode || 0).toLocaleString()})">💾 <span id="${slot}MissionReward">0</span>${repText}</span>
                    </div>
                    <div class="mission-actions">
                        <button class="mission-claim-btn" id="${slot}MissionClaim" type="button">En progreso</button>
                        <button class="mission-reroll-btn" id="${slot}MissionReroll" type="button" title="Cambiar por otra misión">
                            <i class="fas fa-rotate"></i> <span id="${slot}MissionRerollCost">0</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        ['short', 'long'].forEach(slot => {
            document.getElementById(`${slot}MissionClaim`)?.addEventListener('click', () => gameLogic.claimMission(slot));
            document.getElementById(`${slot}MissionReroll`)?.addEventListener('click', () => gameLogic.rerollMission(slot));
        });
        this.updateMissionsUI();
    },

    createMetaUI() {
        const summaryContainer = document.getElementById('metaSummaryContainer');
        const specializationContainer = document.getElementById('specializationContainer');
        const teamContainer = document.getElementById('teamContainer');
        if (!summaryContainer || !specializationContainer || !teamContainer) return;

        summaryContainer.innerHTML = `
            <div class="meta-card shell-compact-card prestige-card">
                <div class="meta-card-header">
                    <h3><i class="fas fa-star"></i> Prestige</h3>
                    <span class="meta-chip">Meta-progreso</span>
                </div>
                <div class="meta-stats-grid">
                    <div>
                        <span class="meta-label">Reputación</span>
                        <strong id="metaPrestigePoints">0</strong>
                    </div>
                    <div>
                        <span class="meta-label">Nivel</span>
                        <strong id="metaPrestigeLevel">0</strong>
                    </div>
                    <div>
                        <span class="meta-label">Bonus global</span>
                        <strong id="metaPrestigeBoost">x1.00</strong>
                    </div>
                    <div>
                        <span class="meta-label">Próximo costo</span>
                        <strong id="metaPrestigeCost">0</strong>
                    </div>
                </div>
                <div class="prestige-preview" aria-live="polite">
                    <div class="prestige-preview-row">
                        <span class="meta-label">Si reinicias ahora</span>
                        <strong id="metaPrestigePreviewGain">+0 rep</strong>
                    </div>
                    <div class="prestige-preview-row">
                        <span class="meta-label">Bonus global</span>
                        <strong id="metaPrestigePreviewMultiplier">x1.00 → x1.00</strong>
                    </div>
                    <div class="milestone-track"><div class="milestone-fill" id="metaPrestigeNextBar"></div></div>
                    <span class="prestige-preview-next shell-tier-secondary" id="metaPrestigeNextRep"></span>
                </div>
                <div class="meta-card-footer">
                    <span id="metaPrestigeReward" class="shell-tier-secondary">+0 rep</span>
                    <button class="meta-action-btn" id="prestigeActionBtn" type="button">Reiniciar con bonus</button>
                </div>
            </div>
            <div class="meta-card shell-compact-card summary-card">
                <div class="meta-card-header">
                    <h3><i class="fas fa-route"></i> Build actual</h3>
                    <span class="meta-chip">Ruta</span>
                </div>
                <div class="meta-stats-grid compact">
                    <div>
                        <span class="meta-label">Especialización</span>
                        <strong id="metaSpecialization">Sin definir</strong>
                    </div>
                    <div>
                        <span class="meta-label">Equipo activo</span>
                        <strong id="metaTeamSize">0</strong>
                    </div>
                    <div>
                        <span class="meta-label">Estado del proyecto</span>
                        <strong id="metaHealthState">Estable</strong>
                    </div>
                    <div>
                        <span class="meta-label">Costo de mantenimiento</span>
                        <strong id="metaMaintenanceCost">0 código</strong>
                    </div>
                    <div class="shell-tier-secondary">
                        <span class="meta-label">Bias de release</span>
                        <strong id="metaReleaseBias">+0 score</strong>
                    </div>
                    <div class="shell-tier-secondary">
                        <span class="meta-label">Historial sano</span>
                        <strong id="metaCleanReleases">0 limpias / 0 sanas</strong>
                    </div>
                    <div class="shell-tier-secondary">
                        <span class="meta-label">Presión del equipo</span>
                        <strong id="metaTeamPressure">Carga sostenible · x1.00</strong>
                    </div>
                    <div class="shell-tier-secondary">
                        <span class="meta-label">Ownership operativo</span>
                        <strong id="metaTeamOwnership">Ownership sólido · especialistas x1.00</strong>
                    </div>
                    <div class="shell-tier-tertiary">
                        <span class="meta-label">Bias de responsabilidad</span>
                        <strong id="metaResponsibilityBias">Ganancia x1.00 · pérdida x1.00</strong>
                    </div>
                    <div class="shell-tier-tertiary">
                        <span class="meta-label">Piso meta</span>
                        <strong id="metaResponsibilityBaseline">Piso 58 · confianza +0 rep</strong>
                    </div>
                </div>
                <div class="meta-card-footer column compact-copy">
                    <span id="metaHealthInsight" class="shell-tier-secondary">Tu build está equilibrada, pero conviene seguir mirando salud técnica, deuda y confianza de entrega.</span>
                    <span id="metaSystemGlossary" class="meta-system-glossary shell-tier-tertiary">Calidad = salud del código · Deuda = fragilidad técnica · Responsabilidad = fiabilidad al prometer y sostener entregas.</span>
                </div>
            </div>
        `;

        specializationContainer.innerHTML = Object.entries(CONFIG.SPECIALIZATIONS).map(([key, specialization]) => `
            <button class="specialization-card shell-compact-card" data-specialization="${key}" type="button">
                <i class="${specialization.icon}"></i>
                <span class="specialization-name">${specialization.name}</span>
                <span class="specialization-desc shell-tier-secondary">${specialization.desc}</span>
            </button>
        `).join('');

        teamContainer.innerHTML = Object.entries(gameState.team).map(([key, member]) => `
            <button class="team-card shell-compact-card" data-team="${key}" type="button">
                <i class="${member.icon}"></i>
                <span class="team-name">${member.name}</span>
                <span class="team-desc shell-tier-secondary">${member.desc}</span>
                <span class="team-cost">${this.formatCodeCost(member.cost)}</span>
                <span class="team-owned">x${member.owned}</span>
                <span class="roi-label" data-roi-collection="team" data-roi-key="${key}"></span>
                ${this.renderMilestoneBar()}
            </button>
        `).join('');

        document.getElementById('prestigeActionBtn')?.addEventListener('click', () => gameLogic.prestige());
        specializationContainer.querySelectorAll('.specialization-card').forEach(card => {
            card.addEventListener('click', () => gameLogic.chooseSpecialization(card.dataset.specialization));
        });
        teamContainer.querySelectorAll('.team-card').forEach(card => {
            card.addEventListener('click', () => gameLogic.buyTeam(card.dataset.team));
        });

        this.updateMetaUI();
    },
    
    // === NOTIFICACIONES ===
    dismissNotification(notification) {
        if (!notification) return;

        const key = notification.dataset.notificationKey;
        if (key && this.activeNotifications[key] === notification) {
            delete this.activeNotifications[key];
        }

        if (notification.__dismissTimer) {
            clearTimeout(notification.__dismissTimer);
            notification.__dismissTimer = null;
        }

        if (typeof gsap === 'undefined') {
            notification.remove();
            return;
        }
        gsap.to(notification, {
            opacity: 0,
            x: fxModule.isReducedMotion() ? 0 : 100,
            duration: 0.22,
            ease: 'power2.out',
            onComplete: () => notification.remove()
        });
    },

    getNotificationKey(message, type, options = {}) {
        if (options.dedupe === false) return null;
        if (options.dedupeKey) return options.dedupeKey;
        return `${type}:${message}`;
    },

    scheduleNotificationDismiss(notification, duration) {
        if (notification.__dismissTimer) {
            clearTimeout(notification.__dismissTimer);
        }

        notification.__dismissTimer = setTimeout(() => {
            this.dismissNotification(notification);
        }, duration);
    },

    bumpNotification(notification, duration) {
        notification.__count = (notification.__count || 1) + 1;
        const counter = notification.querySelector('.notification-count');
        if (counter) {
            counter.textContent = `x${notification.__count}`;
            counter.hidden = false;
        }

        notification.classList.remove('notification-bump');
        void notification.offsetWidth;
        notification.classList.add('notification-bump');
        this.scheduleNotificationDismiss(notification, duration);
    },

    showNotification(message, type = 'info', options = {}) {
        const { duration = 3000, cssClass = '' } = options;
        const container = document.getElementById('notificationsContainer');
        if (!container) return;

        const key = this.getNotificationKey(message, type, options);
        if (key && this.activeNotifications[key]?.isConnected) {
            this.bumpNotification(this.activeNotifications[key], duration);
            return;
        }

        // Los tips de onboarding no se expulsan por la avalancha de avisos normales.
        const visibleNotifications = container.querySelectorAll('.notification:not(.notification-tip)');
        if (visibleNotifications.length >= this.maxVisibleNotifications) {
            this.dismissNotification(visibleNotifications[0]);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type} ${cssClass}`.trim();
        
        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        if (type === 'warning') icon = 'fas fa-exclamation-circle';

        if (key) {
            notification.dataset.notificationKey = key;
            this.activeNotifications[key] = notification;
        }

        notification.__count = 1;
        notification.innerHTML = `<i class="notification-icon ${icon} ${type}"></i><span class="notification-message">${message}</span><span class="notification-count" hidden>x1</span>`;
        container.appendChild(notification);

        this.scheduleNotificationDismiss(notification, duration);
    },
    
    // Tip de onboarding con estilo de mensaje de commit:
    // "a1b2c3d feat(shop): texto" en monospace, con botón para cerrar.
    showCommitTip(scope, tip) {
        const container = document.getElementById('notificationsContainer');
        if (!container || !tip) return null;

        const type = tip.type === 'warn' ? 'warn' : 'feat';
        const notification = document.createElement('div');
        notification.className = `notification notification-tip tip-${type}`;
        notification.setAttribute('role', 'status');

        const hash = document.createElement('span');
        hash.className = 'commit-tip-hash';
        hash.textContent = Math.random().toString(16).slice(2, 9).padEnd(7, '0');

        const prefix = document.createElement('span');
        prefix.className = `commit-tip-prefix ${type}`;
        prefix.textContent = `${type}(${scope}):`;

        const message = document.createElement('span');
        message.className = 'commit-tip-text';
        message.textContent = tip.text;

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'commit-tip-close';
        close.setAttribute('aria-label', 'Cerrar aviso');
        close.innerHTML = '<i class="fas fa-xmark"></i>';
        close.addEventListener('click', () => this.dismissNotification(notification));

        const body = document.createElement('div');
        body.className = 'commit-tip-body';
        body.append(hash, ' ', prefix, ' ', message);
        notification.append(body, close);
        container.appendChild(notification);

        this.scheduleNotificationDismiss(notification, CONFIG.ONBOARDING.TIP_DURATION_MS);
        return notification;
    },

    // === FLOATING TEXT (números que flotan) ===
    createFloatingText(amount) {
        const profile = this.getVisualPerformanceProfile();
        if (profile.key === 'reduced') return;

        const container = document.getElementById('floatingTexts');
        const text = document.createElement('div');
        text.className = 'floating-number';
        text.textContent = `+${Math.floor(amount)}`;
        text.style.left = Math.random() * 100 + 'px';
        container.appendChild(text);
        
        setTimeout(() => text.remove(), profile.floatingTextDuration);
    },
    
    // === MEJORA 4: PARTÍCULAS DE CÓDIGO FLOTANTE (Generación pasiva visual) ===
    createPassiveCodeParticle(fromX, fromY, amount) {
        const profile = this.getVisualPerformanceProfile();
        if (profile.passiveParticleBurst <= 0) return;

        const particle = document.createElement('div');
        particle.className = 'code-particle';
        particle.textContent = `+${Math.floor(amount)}`;
        
        // Posición inicial = donde viene el código
        particle.style.left = fromX + 'px';
        particle.style.top = fromY + 'px';
        
        // Destino aleatoria pero hacia arriba y derecha (hacia el contador)
        const toX = window.innerWidth * 0.75 + (Math.random() - 0.5) * 100;
        const toY = 50 + (Math.random() - 0.5) * 50;
        
        const deltaX = toX - fromX;
        const deltaY = toY - fromY;
        
        particle.style.setProperty('--tx', deltaX + 'px');
        particle.style.setProperty('--ty', deltaY + 'px');
        
        document.body.appendChild(particle);
        
        setTimeout(() => particle.remove(), profile.key === 'compact' ? 900 : 1200);
    },
    
    // === Animar partículas pasivas cada 0.5s ===
    animatePassiveGeneration() {
        const profile = this.getVisualPerformanceProfile();
        if (profile.passiveParticleBurst <= 0) return;

        const generation = gameState.calculateGeneration();
        if (generation <= 0) return;
        
        // Mostrar partículas desde elemento pasivo aleatorio
        const passiveItems = document.querySelectorAll('.passive-item');
        if (passiveItems.length === 0) return;
        
        const randomItem = passiveItems[Math.floor(Math.random() * passiveItems.length)];
        const rect = randomItem.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Crear partícula por cada generación (máximo 5 por segundo)
        const count = Math.min(Math.ceil(generation / 2), profile.passiveParticleBurst);
        for (let i = 0; i < count; i++) {
            this.createPassiveCodeParticle(
                centerX + (Math.random() - 0.5) * 30,
                centerY + (Math.random() - 0.5) * 30,
                generation / count
            );
        }
    },
    
    // === TAB SWITCHING ===
    switchTab(tabName) {
        // Una pestaña bloqueada por el onboarding no se puede abrir: se usa la primera visible.
        let tab = document.getElementById(tabName + '-tab');
        if (!tab || tab.closest('.nav-item')?.classList.contains('is-locked')) {
            tab = onboardingModule.getFirstVisibleTab();
            if (!tab) return;
            tabName = tab.id.replace(/-tab$/, '');
        }

        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('show', 'active'));

        tab.classList.add('active');
        document.getElementById(tabName + '-content')?.classList.add('show', 'active');
    },

    switchMobileView(viewName) {
        const isMobileProfile = document.body.dataset.screenProfile === 'mobile';
        document.querySelectorAll('.mobile-view-btn').forEach(el => el.classList.remove('active'));

        if (isMobileProfile) {
            document.getElementById('clicker-view-panel')?.classList.add('active');
            document.getElementById('management-view-panel')?.classList.toggle('active', viewName === 'management');
            document.getElementById(viewName + '-view-tab')?.classList.add('active');
            return;
        }

        document.querySelectorAll('.mobile-view-panel').forEach(el => el.classList.remove('active'));
        document.getElementById(viewName + '-view-tab')?.classList.add('active');
        document.getElementById(viewName + '-view-panel')?.classList.add('active');
    },

    getResponsiveHierarchyProfile(width = window.innerWidth) {
        if (width <= 991.98) {
            return {
                key: 'mobile',
                mobileDefaultView: 'clicker',
                managementDefaultSurface: 'panel',
                managementChip: 'Build móvil',
                managementTitle: 'Gestión primero, editor como apoyo',
                managementDescription: 'En móvil la prioridad es jugar y comprar rápido; el editor queda como contexto secundario dentro del workspace.',
                projectCopy: 'Bucle principal visible: click, progreso, salud y refactor siempre a mano.'
            };
        }

        if (width <= 1200) {
            return {
                key: 'tablet',
                mobileDefaultView: 'clicker',
                managementDefaultSurface: 'panel',
                managementChip: 'Build tablet',
                managementTitle: 'Gestión y lectura por encima del editor',
                managementDescription: 'En tablet conviene priorizar panel, laboratorio y meta; el editor sigue disponible, pero no debería competir por ser la vista inicial.',
                projectCopy: 'La columna de juego sigue marcando el ritmo, pero la gestión gana peso visual al crecer el espacio.'
            };
        }

        return {
            key: 'desktop',
            mobileDefaultView: 'clicker',
            managementDefaultSurface: 'editor',
            managementChip: 'Workspace',
            managementTitle: 'Editor como superficie principal',
            managementDescription: 'En desktop conviene dejar el editor abierto mientras gestionas compras, laboratorio y meta en segundo plano.',
            projectCopy: 'El bucle principal sigue anclado a la izquierda para mantener ritmo y lectura instantánea.'
        };
    },

    applyResponsiveHierarchy(profile = this.getResponsiveHierarchyProfile()) {
        const managementChip = document.getElementById('managementContextChip');
        const managementTitle = document.getElementById('managementContextTitle');
        const managementDescription = document.getElementById('managementContextDescription');
        const projectCopy = document.getElementById('projectContextCopy');

        if (managementChip) managementChip.textContent = profile.managementChip;
        if (managementTitle) managementTitle.textContent = profile.managementTitle;
        if (managementDescription) managementDescription.textContent = profile.managementDescription;
        if (projectCopy) projectCopy.textContent = profile.projectCopy;

        document.body.dataset.screenProfile = profile.key;
    },
    
    // === BOTÓN CLICK CON ANIMACIÓN ===
    animateClickButton() {
        if (!this.getVisualPerformanceProfile().enableClickAnimation) return;
        if (typeof gsap === 'undefined' || fxModule.isReducedMotion()) return;

        // El commit (coreografía 'commit') usa el mismo botón: no pisar su latido.
        const button = document.getElementById('clickBtn');
        if (gsap.isTweening(button)) return;
        // Rebote: se hunde al pulsar y vuelve con un pequeño sobrepaso.
        gsap.fromTo(button, { scale: 0.93 }, { scale: 1, duration: 0.24, ease: 'back.out(4)', immediateRender: true, clearProps: 'scale' });
    }
};

console.log('✅ UI MODULE loaded');
