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

    // === ACTUALIZACIÓN DE STATS ===
    updateStats() {
        document.getElementById('currentCodeHeader').textContent = Math.floor(gameState.code).toLocaleString();
        document.getElementById('commits').textContent = gameState.commits;
        document.getElementById('streak').textContent = gameState.streak;
        document.getElementById('achievementCount').textContent = achievementsModule.getCount();
        document.getElementById('prestigePoints').textContent = gameState.prestigePoints;
    },
    
    updateProgress() {
        document.getElementById('codeDisplay').textContent = Math.floor(gameState.code).toLocaleString();
        const rawProgressPercent = (gameState.commitProgress / CONFIG.CODE_PER_COMMIT) * 100;
        const progressPercent = Math.max(0, Math.min(100, rawProgressPercent));
        document.getElementById('codeBar').style.width = progressPercent + '%';
        const commitProgressMeta = document.getElementById('commitProgressMeta');
        if (commitProgressMeta) {
            const progressValue = Math.floor(gameState.commitProgress).toLocaleString();
            const goalValue = CONFIG.CODE_PER_COMMIT.toLocaleString();
            commitProgressMeta.textContent = `Commit ${progressValue} / ${goalValue}`;
        }
        document.getElementById('cpv').textContent = Math.floor(gameState.calculateClickPower());
        
        // MEJORA 1: Aura de progresión - cambiar clase si power es alto
        const button = document.getElementById('clickBtn');
        const clickPower = gameState.calculateClickPower();
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
    
    updatePassive() {
        const container = document.getElementById('passiveContainer');
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
                        <p>+${(lang.generation * lang.owned).toLocaleString()} líneas/seg</p>
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
                        <p>+${(member.generation * member.owned).toLocaleString()} líneas/seg</p>
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
                    <p>${gameState.calculateGeneration().toFixed(1)} líneas/seg</p>
                </div>
            `;
            container.prepend(total);
        }
    },
    
    updateStatistics() {
        document.getElementById('totalClicks').textContent = gameState.clicks.toLocaleString();
        document.getElementById('currentSpeed').textContent = gameState.calculateGeneration().toFixed(1) + ' líneas/seg';
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
            : `${gameState.calculatePrestigeCost().toLocaleString()} rep`;
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
        });
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

        if (releaseVersion) releaseVersion.textContent = gameState.getVersionLabel();
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

            card.classList.toggle('purchased', artifact.owned > 0);
            const cost = card.querySelector('.artifact-cost');
            const status = card.querySelector('.artifact-status');

            if (cost) {
                cost.textContent = artifact.owned > 0 ? 'Comprado' : this.formatPrestigeCost(artifact.cost);
                cost.classList.toggle('affordable', gameState.canAffordPrestigeCost(artifact.cost) && artifact.owned === 0);
            }

            if (status) {
                status.textContent = artifact.owned > 0 ? 'Activo' : 'Disponible';
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
        this.updateStats();
        this.updateProgress();
        this.updateProjectHealthUI();
        this.updatePassive();
        this.updateStatistics();
        this.updateMissionsUI();
        this.updateLabUI();
        this.updateMetaUI();
    },
    
    // === CREAR TARJETAS DE UPGRADES ===
    createUpgradesUI() {
        const container = document.getElementById('upgradesContainer');
        container.innerHTML = '';
        
        // Upgrades
        Object.entries(gameState.upgrades).forEach(([key, upgrade]) => {
            const card = document.createElement('div');
            card.className = `upgrade-card ${upgrade.owned > 0 ? 'purchased' : ''}`;
            card.innerHTML = `
                <i class="upgrade-icon ${upgrade.icon}"></i>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-desc">${upgrade.desc}</div>
                <div class="upgrade-cost ${gameState.canAffordCodeCost(upgrade.cost) ? 'affordable' : ''}">
                    ${this.formatCodeCost(upgrade.cost)}
                </div>
                <div style="font-size: 0.75rem; color: var(--accent);">x${upgrade.owned}</div>
            `;
            card.addEventListener('click', () => gameLogic.buyUpgrade(key));
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
                <div class="upgrade-cost ${gameState.canAffordCodeCost(framework.cost) ? 'affordable' : ''}">
                    ${this.formatCodeCost(framework.cost)}
                </div>
                <div style="font-size: 0.75rem; color: var(--accent);">x${framework.owned}</div>
            `;
            card.addEventListener('click', () => gameLogic.buyFramework(key));
            container.appendChild(card);
        });
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
                <div style="font-size: 0.8rem; color: var(--text-secondary);">+${lang.generation} líneas/seg</div>
                <div class="language-cost ${gameState.canAffordCodeCost(lang.cost) ? 'affordable' : ''}">
                    ${this.formatCodeCost(lang.cost)}
                </div>
                <div style="font-size: 0.75rem; color: var(--accent);">x${lang.owned}</div>
            `;
            card.addEventListener('click', () => gameLogic.buyLanguage(key));
            container.appendChild(card);
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
            const rewardParts = [`💾 ${mission.rewardCode.toLocaleString()}`];
            if (mission.rewardRep > 0) {
                rewardParts.push(`⭐ ${mission.rewardRep} rep`);
            }

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
                        <span class="shell-tier-secondary">${rewardParts.join(' · ')}</span>
                    </div>
                    <button class="mission-claim-btn" id="${slot}MissionClaim" type="button">En progreso</button>
                </div>
            `;
        }).join('');

        document.getElementById('shortMissionClaim')?.addEventListener('click', () => gameLogic.claimMission('short'));
        document.getElementById('longMissionClaim')?.addEventListener('click', () => gameLogic.claimMission('long'));
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

        anime({
            targets: notification,
            opacity: 0,
            translateX: 100,
            duration: 220,
            easing: 'easeOutQuad',
            complete: () => notification.remove()
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

        const visibleNotifications = container.querySelectorAll('.notification');
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
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('show', 'active'));
        
        document.getElementById(tabName + '-tab').classList.add('active');
        document.getElementById(tabName + '-content').classList.add('show', 'active');
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

        const button = document.getElementById('clickBtn');
        anime({
            targets: button,
            scale: [1, 0.95, 1],
            duration: 100
        });
    },
    
    // === COMMIT ANIMATION ===
    animateCommit() {
        if (!this.getVisualPerformanceProfile().enableCommitAnimation) return;

        // MEJORA 3: Efecto commit en cascada
        const button = document.getElementById('clickBtn');
        const bar = document.getElementById('codeBar').parentElement;
        
        // Flash de la barra
        anime({
            targets: bar,
            boxShadow: [
                '0 0 10px rgba(0, 255, 136, 0)',
                '0 0 50px rgba(0, 255, 136, 0.9)',
                '0 0 10px rgba(0, 255, 136, 0)'
            ],
            duration: 400,
            easing: 'easeOutQuad'
        });
        
        // Reset de la barra (se pone a 0 con animación)
        anime({
            targets: button,
            scale: [1, 1.15, 1],
            duration: 300,
            easing: 'easeOutQuad'
        });
        
        // Pulse de la barra de progreso
        anime({
            targets: {progress: 100},
            progress: [100, 0],
            duration: 300,
            update: function(anim) {
                // La barra ya vuelve a 0 en el código, esto es solo visual feedback
            }
        });
    }
};

console.log('✅ UI MODULE loaded');
