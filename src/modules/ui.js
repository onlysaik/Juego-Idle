/**
 * MODULES/UI.JS - Actualización de interfaz de usuario
 * Responsabilidad: Renderizar y actualizar todos los elementos visuales
 * Separado completamente de la lógica del juego
 */

const uiModule = {
    // === ACTUALIZACIÓN DE STATS ===
    updateStats() {
        document.getElementById('totalXP').textContent = Math.floor(gameState.totalCode).toLocaleString();
        document.getElementById('commits').textContent = gameState.commits;
        document.getElementById('streak').textContent = gameState.streak;
        document.getElementById('achievementCount').textContent = achievementsModule.getCount();
        document.getElementById('prestigePoints').textContent = gameState.prestigePoints;
    },
    
    updateProgress() {
        document.getElementById('codeDisplay').textContent = Math.floor(gameState.code).toLocaleString();
        document.getElementById('codeBar').style.width = ((gameState.code / CONFIG.CODE_PER_COMMIT) * 100) + '%';
        document.getElementById('cpv').textContent = Math.floor(gameState.calculateClickPower());
        this.updateCodePreview();
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
        document.getElementById('maxStreak').textContent = gameState.maxStreak;
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
                progressLabel.textContent = `${Math.min(progress.current, progress.target).toLocaleString()} / ${progress.target.toLocaleString()}`;
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

    updateMetaUI() {
        const prestigePoints = document.getElementById('metaPrestigePoints');
        const prestigeLevel = document.getElementById('metaPrestigeLevel');
        const prestigeBoost = document.getElementById('metaPrestigeBoost');
        const prestigeReward = document.getElementById('metaPrestigeReward');
        const prestigeCost = document.getElementById('metaPrestigeCost');
        const specializationName = document.getElementById('metaSpecialization');
        const teamSize = document.getElementById('metaTeamSize');
        const prestigeButton = document.getElementById('prestigeActionBtn');

        if (prestigePoints) prestigePoints.textContent = gameState.prestigePoints.toLocaleString();
        if (prestigeLevel) prestigeLevel.textContent = gameState.prestigeLevel.toLocaleString();
        if (prestigeBoost) prestigeBoost.textContent = `x${gameState.getPrestigeMultiplier().toFixed(2)}`;
        if (prestigeReward) prestigeReward.textContent = `+${gameState.calculatePrestigeReward()} rep`;
        if (prestigeCost) prestigeCost.textContent = gameState.calculatePrestigeCost().toLocaleString();
        if (specializationName) {
            specializationName.textContent = gameState.getSpecialization()?.name || 'Sin definir';
        }
        if (teamSize) {
            teamSize.textContent = gameState.getOwnedCount(gameState.team).toLocaleString();
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
                cost.textContent = `💾 ${member.cost.toLocaleString()}`;
                cost.classList.toggle('affordable', gameState.totalCode >= member.cost);
            }
        });
    },

    updateLabUI() {
        const releaseVersion = document.getElementById('labReleaseVersion');
        const releaseCharge = document.getElementById('labReleaseCharge');
        const releaseReward = document.getElementById('labReleaseReward');
        const releaseButton = document.getElementById('releaseActionBtn');
        const trendLanguage = document.getElementById('labTrendLanguage');
        const trendFramework = document.getElementById('labTrendFramework');
        const trendTimer = document.getElementById('labTrendTimer');

        const reward = gameState.getReleaseRewardPreview();
        const remainingMs = gameState.getTrendTimeRemaining();
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const trendLanguageData = CONFIG.LANGUAGES[gameState.currentTrend?.languageKey];
        const trendFrameworkData = CONFIG.FRAMEWORKS[gameState.currentTrend?.frameworkKey];

        if (releaseVersion) releaseVersion.textContent = gameState.getVersionLabel();
        if (releaseCharge) releaseCharge.textContent = `${gameState.releaseCharge}/${CONFIG.RELEASE_CHARGE_REQUIRED}`;
        if (releaseReward) releaseReward.textContent = reward.code > 0 ? `+${reward.code.toLocaleString()} código · +${reward.rep} rep` : 'Carga commits para publicar';
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
                cost.textContent = artifact.owned > 0 ? 'Comprado' : `⭐ ${artifact.cost}`;
                cost.classList.toggle('affordable', gameState.prestigePoints >= artifact.cost && artifact.owned === 0);
            }

            if (status) {
                status.textContent = artifact.owned > 0 ? 'Activo' : 'Disponible';
            }
        });
    },

    updateCodePreview() {
        const codePreview = document.getElementById('code-progress');
        if (!codePreview) return;

        const topLanguage = Object.values(gameState.languages)
            .filter(language => language.owned > 0)
            .sort((a, b) => b.owned - a.owned)[0];
        const topFramework = Object.values(gameState.frameworks)
            .filter(framework => framework.owned > 0)
            .sort((a, b) => b.owned - a.owned)[0];

        if (!topLanguage) {
            codePreview.textContent = '  return shipFeature("hello-world");';
            return;
        }

        const stackParts = [topLanguage.name];
        if (topFramework) stackParts.push(topFramework.name);
        if (gameState.currentSpecialization) stackParts.push(CONFIG.SPECIALIZATIONS[gameState.currentSpecialization].name);

        codePreview.textContent = `  return deployStack("${stackParts.join(' + ')}");`;
    },

    showOfflineReport() {
        if (!gameState.offlineReport) return;

        const { seconds, codeEarned } = gameState.offlineReport;
        const minutes = Math.floor(seconds / 60);
        const label = minutes > 0 ? `${minutes} min` : `${seconds}s`;

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Resumen Offline',
                text: `Mientras estabas fuera, tu stack generó ${codeEarned.toLocaleString()} líneas en ${label}.`,
                icon: 'success',
                background: '#1a1f3a',
                color: '#ffffff',
                confirmButtonText: 'Seguir programando'
            });
        } else {
            this.showNotification(`Offline: +${codeEarned.toLocaleString()} código`, 'success');
        }

        gameState.clearOfflineReport();
    },
    
    // === REFRESCAR TODO ===
    update() {
        this.updateStats();
        this.updateProgress();
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
                <div class="upgrade-cost ${gameState.totalCode >= upgrade.cost ? 'affordable' : ''}">
                    💾 ${upgrade.cost.toLocaleString()}
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
                <div class="upgrade-cost ${gameState.totalCode >= framework.cost ? 'affordable' : ''}">
                    💾 ${framework.cost.toLocaleString()}
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
                <div class="language-cost ${gameState.totalCode >= lang.cost ? 'affordable' : ''}">
                    💾 ${lang.cost.toLocaleString()}
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
            <div class="meta-card release-card">
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
                    <button class="meta-action-btn" id="releaseActionBtn" type="button">Publicar release</button>
                </div>
            </div>
            <div class="meta-card trend-card">
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
            <button class="artifact-card" data-artifact="${key}" type="button">
                <i class="${artifact.icon}"></i>
                <span class="artifact-name">${artifact.name}</span>
                <span class="artifact-desc">${artifact.desc}</span>
                <span class="artifact-cost">⭐ ${artifact.cost}</span>
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
                <div class="mission-card ${slot}">
                    <div class="mission-badge">${slot === 'short' ? 'Misión corta' : 'Misión larga'}</div>
                    <div class="mission-name">${mission.name}</div>
                    <div class="mission-desc">${mission.desc}</div>
                    <div class="mission-progress-track">
                        <div class="mission-progress-fill" id="${slot}MissionBar" style="width: 0%"></div>
                    </div>
                    <div class="mission-footer">
                        <span id="${slot}MissionProgress">0 / 0</span>
                        <span>${rewardParts.join(' · ')}</span>
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
            <div class="meta-card prestige-card">
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
                    <span id="metaPrestigeReward">+0 rep</span>
                    <button class="meta-action-btn" id="prestigeActionBtn" type="button">Reiniciar con bonus</button>
                </div>
            </div>
            <div class="meta-card summary-card">
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
                </div>
            </div>
        `;

        specializationContainer.innerHTML = Object.entries(CONFIG.SPECIALIZATIONS).map(([key, specialization]) => `
            <button class="specialization-card" data-specialization="${key}" type="button">
                <i class="${specialization.icon}"></i>
                <span class="specialization-name">${specialization.name}</span>
                <span class="specialization-desc">${specialization.desc}</span>
            </button>
        `).join('');

        teamContainer.innerHTML = Object.entries(gameState.team).map(([key, member]) => `
            <button class="team-card" data-team="${key}" type="button">
                <i class="${member.icon}"></i>
                <span class="team-name">${member.name}</span>
                <span class="team-desc">${member.desc}</span>
                <span class="team-cost">💾 ${member.cost.toLocaleString()}</span>
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
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationsContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        if (type === 'warning') icon = 'fas fa-exclamation-circle';
        
        notification.innerHTML = `<i class="notification-icon ${icon} ${type}"></i><span>${message}</span>`;
        container.appendChild(notification);
        
        setTimeout(() => {
            anime({
                targets: notification,
                opacity: 0,
                translateX: 100,
                duration: 300,
                complete: () => notification.remove()
            });
        }, 3000);
    },
    
    // === FLOATING TEXT (números que flotan) ===
    createFloatingText(amount) {
        const container = document.getElementById('floatingTexts');
        const text = document.createElement('div');
        text.className = 'floating-number';
        text.textContent = `+${Math.floor(amount)}`;
        text.style.left = Math.random() * 100 + 'px';
        container.appendChild(text);
        
        setTimeout(() => text.remove(), 1000);
    },
    
    // === TAB SWITCHING ===
    switchTab(tabName) {
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('show', 'active'));
        
        document.getElementById(tabName + '-tab').classList.add('active');
        document.getElementById(tabName + '-content').classList.add('show', 'active');
    },

    switchMobileView(viewName) {
        document.querySelectorAll('.mobile-view-btn').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.mobile-view-panel').forEach(el => el.classList.remove('active'));

        document.getElementById(viewName + '-view-tab')?.classList.add('active');
        document.getElementById(viewName + '-view-panel')?.classList.add('active');
    },
    
    // === BOTÓN CLICK CON ANIMACIÓN ===
    animateClickButton() {
        const button = document.getElementById('clickBtn');
        anime({
            targets: button,
            scale: [1, 0.95, 1],
            duration: 100
        });
    },
    
    // === COMMIT ANIMATION ===
    animateCommit() {
        anime({
            targets: '.progress-bar',
            backgroundColor: 'rgba(0, 255, 136, 0.8)',
            duration: 300,
            direction: 'alternate'
        });
    }
};

console.log('✅ UI MODULE loaded');
