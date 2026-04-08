/**
 * MODULES/UI/UI.JS - Actualización de interfaz de usuario
 * Responsabilidad: Renderizar y actualizar todos los elementos visuales
 * Separado completamente de la lógica del juego
 * 
 * Nota: Este módulo es grande. En futuro, considerar dividir en:
 *   - ui-stats.js (actualización de estadísticas)
 *   - ui-commerce.js (UI de compras)
 *   - ui-animations.js (animaciones y efectos visuales)
 */

const uiModule = {
    isCreativeModeActive() {
        return gameState.isCreativeModeEnabled();
    },

    formatCodeCost(cost) {
        return this.isCreativeModeActive() ? '🛠 Gratis' : `💾 ${cost.toLocaleString()}`;
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
        document.getElementById('cpv').textContent = Math.floor(gameState.calculateClickPower());
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
                `;
                container.appendChild(item);
            }
        });
        
        if (!hasPassive) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Compra un lenguaje para generar código automáticamente</p>';
        }
    },
    
    updateStatistics() {
        document.getElementById('totalClicks').textContent = gameState.clicks.toLocaleString();
        document.getElementById('currentSpeed').textContent = gameState.calculateGeneration().toFixed(1) + ' líneas/seg';
        document.getElementById('totalCommits').textContent = gameState.commits;
        document.getElementById('lifetimeCode').textContent = Math.floor(gameState.totalCode).toLocaleString();
        document.getElementById('maxStreak').textContent = gameState.maxStreak;
    },

    // === REFRESCAR TODO ===
    update() {
        this.updateStats();
        this.updateProgress();
        this.updatePassive();
        this.updateStatistics();
    },
    
    // === CREAR TARJETAS DE UPGRADES ===
    createUpgradesUI() {
        const container = document.getElementById('upgradesContainer');
        container.innerHTML = '';
        
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
            notification.remove();
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
    
    // === BOTÓN CLICK CON ANIMACIÓN ===
    animateClickButton() {
        const button = document.getElementById('clickBtn');
        button.style.transform = 'scale(0.95)';
        setTimeout(() => { button.style.transform = 'scale(1)'; }, 100);
    },
    
    // === COMMIT ANIMATION ===
    animateCommit() {
        const button = document.getElementById('clickBtn');
        const bar = document.getElementById('codeBar').parentElement;
        
        button.style.transform = 'scale(1.15)';
        setTimeout(() => { button.style.transform = 'scale(1)'; }, 300);
    },
    
    // === TAB SWITCHING ===
    switchTab(tabName) {
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('show', 'active'));
        
        document.getElementById(tabName + '-tab').classList.add('active');
        document.getElementById(tabName + '-content').classList.add('show', 'active');
    }
};

console.log('✅ UI MODULE loaded');
