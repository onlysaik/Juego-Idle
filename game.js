// Audio Manager
const audioManager = {
    enabled: true,
    sounds: {},
    init() {
        // Simple beep sounds via Web Audio API
        this.enabled = true;
    },
    play(sound) {
        if (this.enabled && window.Howl) {
            try { 
                if (sound === 'click') this.playBeep(400, 0.1);
                if (sound === 'commit') this.playBeep(800, 0.2);
            } catch(e) {}
        }
    },
    playBeep(freq, duration) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch(e) {}
    }
};

// Game State
const gameState = {
    code: 0,
    totalCode: 0,
    codePerClick: 10,
    clicks: 0,
    commits: 0,
    streak: 0,
    maxStreak: 0,
    soundEnabled: true,
    theme: 'dark',
    passiveGeneration: 0,
    eventCooldown: 0,
    
    languages: {
        javascript: { owned: 0, cost: 100, generation: 1, name: 'JavaScript', icon: 'fab fa-js-square' },
        python: { owned: 0, cost: 250, generation: 2, name: 'Python', icon: 'fab fa-python' },
        rust: { owned: 0, cost: 500, generation: 3, name: 'Rust', icon: 'fas fa-cog' },
        typescript: { owned: 0, cost: 1000, generation: 5, name: 'TypeScript', icon: 'fas fa-cube' }
    },
    
    upgrades: {
        keyboard: { owned: 0, cost: 50, multiplier: 1.1, name: 'Teclado Mecánico', icon: 'fas fa-keyboard', desc: '+10% por click' },
        monitor: { owned: 0, cost: 150, multiplier: 1.15, name: 'Monitor 4K', icon: 'fas fa-tv', desc: '+15% velocidad' },
        coffee: { owned: 0, cost: 500, multiplier: 1.25, name: 'Café', icon: 'fas fa-mug-hot', desc: '+25% productividad' },
        vscode: { owned: 0, cost: 1000, multiplier: 1.5, name: 'VS Code Pro', icon: 'fas fa-code', desc: '+50% eficiencia' }
    },
    
    frameworks: {
        react: { owned: 0, cost: 5000, boost: 0.5, name: 'React', icon: 'fab fa-react', req: 'javascript', desc: '+50% JavaScript' },
        django: { owned: 0, cost: 7000, boost: 0.6, name: 'Django', icon: 'fas fa-database', req: 'python', desc: '+60% Python' }
    },
    
    achievements: {
        firstClick: { name: 'Primer Click', desc: 'Haz tu primer click', icon: 'fas fa-play', unlocked: false },
        firstCommit: { name: 'Primer Commit', desc: 'Completa tu primer commit', icon: 'fas fa-code-branch', unlocked: false },
        hundred: { name: 'Century', desc: 'Completa 100 commits', icon: 'fas fa-trophy', unlocked: false },
        polyglot: { name: 'Poliglota', desc: 'Domina 3 lenguajes', icon: 'fas fa-language', unlocked: false },
        speedster: { name: 'Velocista', desc: 'Haz 10 clicks con racha', icon: 'fas fa-bolt', unlocked: false },
        millionaire: { name: 'Millonario', desc: 'Acumula 1 millón de código', icon: 'fas fa-coins', unlocked: false }
    },
    
    timestamps: {
        lastUpdate: Date.now(),
        clickSequenceStart: Date.now()
    }
};

// Events System
const eventSystem = {
    events: [
        { name: ' Bug Crítico', desc: 'Pierdes el 10% código', action: () => { gameState.code *= 0.9; showNotification('¡Bug! -10% código', 'warning'); }, weight: 3 },
        { name: ' Code Review', desc: '+2x temporal', action: () => { const orig = gameState.codePerClick; gameState.codePerClick *= 2; showNotification('Code Review! x2', 'success'); setTimeout(() => { gameState.codePerClick = orig; }, 20000); }, weight: 2 },
        { name: ' Hackathon', desc: '+3x generación', action: () => { const orig = gameState.passiveGeneration; gameState.passiveGeneration *= 3; showNotification('¡Hackathon! x3', 'success'); setTimeout(() => { gameState.passiveGeneration = orig; }, 10000); }, weight: 2 },
        { name: ' Coffee Break', desc: '+50% generación', action: () => { const orig = gameState.passiveGeneration; gameState.passiveGeneration *= 1.5; showNotification('Café activo! +50%', 'success'); setTimeout(() => { gameState.passiveGeneration = orig; }, 15000); }, weight: 2 },
        { name: ' Documentación', desc: '+500 código', action: () => { gameState.code += 500; gameState.totalCode += 500; showNotification('+500 código bonus!', 'success'); }, weight: 3 }
    ],
    trigger() {
        if (gameState.eventCooldown > 0) return;
        const totalWeight = this.events.reduce((a,e) => a + e.weight, 0);
        let random = Math.random() * totalWeight;
        for (const event of this.events) {
            random -= event.weight;
            if (random <= 0) {
                const alertEl = document.getElementById('eventAlert');
                alertEl.innerHTML = `<h3>${event.name}</h3><p>${event.desc}</p>`;
                alertEl.classList.add('show');
                event.action();
                gameState.eventCooldown = 30;
                setTimeout(() => alertEl.classList.remove('show'), 3000);
                break;
            }
        }
    }
};

// Achievements
function checkAchievements() {
    const ach = gameState.achievements;
    if (gameState.clicks >= 1 && !ach.firstClick.unlocked) unlockAchievement('firstClick');
    if (gameState.commits >= 1 && !ach.firstCommit.unlocked) unlockAchievement('firstCommit');
    if (gameState.commits >= 100 && !ach.hundred.unlocked) unlockAchievement('hundred');
    if (Object.values(gameState.languages).filter(l => l.owned > 0).length >= 3 && !ach.polyglot.unlocked) unlockAchievement('polyglot');
    if (gameState.maxStreak >= 10 && !ach.speedster.unlocked) unlockAchievement('speedster');
    if (gameState.totalCode >= 1000000 && !ach.millionaire.unlocked) unlockAchievement('millionaire');
}

function unlockAchievement(key) {
    const ach = gameState.achievements[key];
    ach.unlocked = true;
    showNotification(` Logro: ${ach.name}!`, 'success');
    if (typeof confetti !== 'undefined') confetti({ particleCount: 100, spread: 70 });
    createAchievementsUI();
}

function getAchievementCount() {
    return Object.values(gameState.achievements).filter(a => a.unlocked).length;
}

function calculateGenerationWithSynergies() {
    let baseGen = gameState.passiveGeneration;
    if (gameState.frameworks.react.owned > 0 && gameState.languages.javascript.owned > 0) {
        baseGen += gameState.languages.javascript.generation * gameState.frameworks.react.boost * gameState.frameworks.react.owned;
    }
    if (gameState.frameworks.django.owned > 0 && gameState.languages.python.owned > 0) {
        baseGen += gameState.languages.python.generation * gameState.frameworks.django.boost * gameState.frameworks.django.owned;
    }
    return baseGen;
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    audioManager.init();
    initializeGame();
    setupEventListeners();
    initializeParticles();
    createUpgradesUI();
    createLanguagesUI();
    createAchievementsUI();
    startGameLoop();
    startEventLoop();
    loadTheme();
});

function initializeGame() {
    const saved = localStorage.getItem('codeIdleGame');
    if (saved) Object.assign(gameState, JSON.parse(saved));
    updateUI();
}

function setupEventListeners() {
    document.getElementById('clickBtn').addEventListener('click', handleClick);
    document.getElementById('upgrades-tab').addEventListener('click', () => switchTab('upgrades'));
    document.getElementById('languages-tab').addEventListener('click', () => switchTab('languages'));
    document.getElementById('achievements-tab').addEventListener('click', () => switchTab('achievements'));
    document.getElementById('stats-tab').addEventListener('click', () => switchTab('stats'));
    document.getElementById('passive-tab').addEventListener('click', () => switchTab('passive'));
    document.getElementById('soundToggle').addEventListener('click', toggleSound);
    document.getElementById('themeSelector').addEventListener('change', (e) => { gameState.theme = e.target.value; loadTheme(); saveGame(); });
}

function toggleSound() {
    gameState.soundEnabled = !gameState.soundEnabled;
    audioManager.enabled = gameState.soundEnabled;
    document.getElementById('soundToggle').style.opacity = gameState.soundEnabled ? '1' : '0.5';
    saveGame();
}

function loadTheme() {
    document.body.className = `theme-${gameState.theme}`;
    document.getElementById('themeSelector').value = gameState.theme;
}

function handleClick() {
    const button = document.getElementById('clickBtn');
    anime({ targets: button, scale: [1, 0.95, 1], duration: 100 });
    audioManager.play('click');
    
    const amount = gameState.codePerClick;
    gameState.code += amount;
    gameState.totalCode += amount;
    gameState.clicks++;
    
    const now = Date.now();
    if (now - gameState.timestamps.clickSequenceStart < 5000) {
        gameState.streak++;
    } else {
        gameState.streak = 1;
    }
    gameState.timestamps.clickSequenceStart = now;
    if (gameState.streak > gameState.maxStreak) gameState.maxStreak = gameState.streak;
    
    createFloatingText(amount);
    checkAchievements();
    if (gameState.code >= 1000) makeCommit();
    updateUI();
    saveGame();
}

function makeCommit() {
    gameState.commits++;
    gameState.code = 0;
    audioManager.play('commit');
    showNotification('¡Commit realizado!', 'success');
    if (typeof confetti !== 'undefined') confetti({ particleCount: 50, spread: 45 });
    anime({ targets: '.progress-bar', backgroundColor: 'rgba(0, 255, 136, 0.8)', duration: 300, direction: 'alternate' });
    checkAchievements();
}

function createFloatingText(amount) {
    const container = document.getElementById('floatingTexts');
    const text = document.createElement('div');
    text.className = 'floating-number';
    text.textContent = `+${Math.floor(amount)}`;
    text.style.left = Math.random() * 100 + 'px';
    container.appendChild(text);
    setTimeout(() => text.remove(), 1000);
}

function buyUpgrade(key) {
    const upgrade = gameState.upgrades[key];
    if (gameState.totalCode >= upgrade.cost) {
        gameState.totalCode -= upgrade.cost;
        upgrade.owned++;
        gameState.codePerClick *= upgrade.multiplier;
        showNotification(` ${upgrade.name}!`, 'success');
        createUpgradesUI();
        checkAchievements();
        updateUI();
        saveGame();
    } else {
        showNotification('Código insuficiente', 'warning');
    }
}

function buyLanguage(key) {
    const language = gameState.languages[key];
    if (gameState.totalCode >= language.cost) {
        gameState.totalCode -= language.cost;
        language.owned++;
        gameState.passiveGeneration += language.generation;
        language.cost = Math.floor(language.cost * 1.15);
        showNotification(` ${language.name} desbloqueado!`, 'success');
        createLanguagesUI();
        checkAchievements();
        updateUI();
        saveGame();
    } else {
        showNotification('Código insuficiente', 'warning');
    }
}

function buyFramework(key) {
    const framework = gameState.frameworks[key];
    if (gameState.totalCode >= framework.cost) {
        gameState.totalCode -= framework.cost;
        framework.owned++;
        framework.cost = Math.floor(framework.cost * 1.15);
        showNotification(` ${framework.name} integrado!`, 'success');
        createUpgradesUI();
        updateUI();
        saveGame();
    } else {
        showNotification('Código insuficiente', 'warning');
    }
}

function createUpgradesUI() {
    const container = document.getElementById('upgradesContainer');
    container.innerHTML = '';
    Object.entries(gameState.upgrades).forEach(([key, upgrade]) => {
        const card = document.createElement('div');
        card.className = `upgrade-card ${upgrade.owned > 0 ? 'purchased' : ''}`;
        card.innerHTML = `<i class="upgrade-icon ${upgrade.icon}"></i><div class="upgrade-name">${upgrade.name}</div><div class="upgrade-desc">${upgrade.desc}</div><div class="upgrade-cost ${gameState.totalCode >= upgrade.cost ? 'affordable' : ''}"> ${upgrade.cost.toLocaleString()}</div><div style="font-size: 0.75rem; color: var(--accent);">x${upgrade.owned}</div>`;
        card.addEventListener('click', () => buyUpgrade(key));
        container.appendChild(card);
    });
    Object.entries(gameState.frameworks).forEach(([key, framework]) => {
        const req = gameState.languages[framework.req];
        if (req.owned === 0) return;
        const card = document.createElement('div');
        card.className = `upgrade-card ${framework.owned > 0 ? 'purchased' : ''}`;
        card.innerHTML = `<i class="upgrade-icon ${framework.icon}"></i><div class="upgrade-name">${framework.name}</div><div class="upgrade-desc">${framework.desc}</div><div class="upgrade-cost ${gameState.totalCode >= framework.cost ? 'affordable' : ''}"> ${framework.cost.toLocaleString()}</div><div style="font-size: 0.75rem; color: var(--accent);">x${framework.owned}</div>`;
        card.addEventListener('click', () => buyFramework(key));
        container.appendChild(card);
    });
}

function createLanguagesUI() {
    const container = document.getElementById('languagesContainer');
    container.innerHTML = '';
    Object.entries(gameState.languages).forEach(([key, language]) => {
        const card = document.createElement('div');
        card.className = `language-card ${language.owned > 0 ? 'purchased' : ''}`;
        card.innerHTML = `<i class="language-icon ${language.icon}"></i><div class="language-name">${language.name}</div><div style="font-size: 0.8rem; color: var(--text-secondary);">+${language.generation} líneas/seg</div><div class="language-cost ${gameState.totalCode >= language.cost ? 'affordable' : ''}"> ${language.cost.toLocaleString()}</div><div style="font-size: 0.75rem; color: var(--accent);">x${language.owned}</div>`;
        card.addEventListener('click', () => buyLanguage(key));
        container.appendChild(card);
    });
}

function createAchievementsUI() {
    const container = document.getElementById('achievementsContainer');
    container.innerHTML = '';
    Object.entries(gameState.achievements).forEach(([key, ach]) => {
        const card = document.createElement('div');
        card.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
        card.innerHTML = `<i class="achievement-icon ${ach.icon}"></i><div class="achievement-name">${ach.name}</div><div class="achievement-desc">${ach.desc}</div>`;
        container.appendChild(card);
    });
}

function createPassiveUI() {
    const container = document.getElementById('passiveContainer');
    const ownedLanguages = Object.entries(gameState.languages).filter(([key, language]) => language.owned > 0);
    
    container.innerHTML = '';
    
    if (ownedLanguages.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Compra un lenguaje para generar código automáticamente</p>';
        return;
    }
    
    ownedLanguages.forEach(([key, language]) => {
        const item = document.createElement('div');
        item.className = 'passive-item';
        item.innerHTML = `<i class="passive-icon ${language.icon}"></i><div class="passive-info"><h4>${language.name}</h4><p>+${(language.generation * language.owned).toLocaleString()} líneas/seg</p></div><div style="margin-left: auto; color: var(--accent); font-weight: 700;">x${language.owned}</div>`;
        container.appendChild(item);
    });
}

function updateUI() {
    document.getElementById('totalXP').textContent = Math.floor(gameState.totalCode).toLocaleString();
    document.getElementById('commits').textContent = gameState.commits;
    document.getElementById('streak').textContent = gameState.streak;
    document.getElementById('achievementCount').textContent = getAchievementCount();
    document.getElementById('codeDisplay').textContent = Math.floor(gameState.code).toLocaleString();
    document.getElementById('codeBar').style.width = ((gameState.code / 1000) * 100) + '%';
    document.getElementById('cpv').textContent = Math.floor(gameState.codePerClick);
    document.getElementById('totalClicks').textContent = gameState.clicks.toLocaleString();
    document.getElementById('currentSpeed').textContent = calculateGenerationWithSynergies().toFixed(1) + ' líneas/seg';
    document.getElementById('totalCommits').textContent = gameState.commits;
    document.getElementById('maxStreak').textContent = gameState.maxStreak;
}

function saveGame() {
    localStorage.setItem('codeIdleGame', JSON.stringify(gameState));
}

function startGameLoop() {
    setInterval(() => {
        const now = Date.now();
        const deltaTime = (now - gameState.timestamps.lastUpdate) / 1000;
        gameState.timestamps.lastUpdate = now;
        gameState.code += calculateGenerationWithSynergies() * deltaTime;
        gameState.totalCode += calculateGenerationWithSynergies() * deltaTime;
        if (gameState.code >= 1000) makeCommit();
        if (gameState.eventCooldown > 0) gameState.eventCooldown--;
        updateUI();
        saveGame();
    }, 100);
}

function startEventLoop() {
    setInterval(() => {
        if (Math.random() < 0.05) eventSystem.trigger();
    }, 5000);
}

function switchTab(tab) {
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('show', 'active'));
    document.getElementById(tab + '-tab').classList.add('active');
    document.getElementById(tab + '-content').classList.add('show', 'active');
    
    // Actualizar la pestaña pasiva solo cuando entra
    if (tab === 'passive') {
        createPassiveUI();
    }
}

function showNotification(message, type = 'info') {
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
}

function initializeParticles() {
    const particlesContainer = document.getElementById('particles-container');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `position: absolute;width: 2px;height: 2px;background: rgba(0, 212, 255, ${Math.random() * 0.5});border-radius: 50%;left: ${Math.random() * 100}%;top: ${Math.random() * 100}%;`;
        particlesContainer.appendChild(particle);
        anime({
            targets: particle,
            translateY: [0, Math.random() * -100 - 50],
            translateX: [0, Math.sin(Math.random() * Math.PI) * 50],
            opacity: [{ value: 0, duration: 500 }, { value: Math.random() * 0.5, duration: 500 }],
            duration: Math.random() * 3000 + 2000,
            loop: true,
            easing: 'easeInOutQuad'
        });
    }
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        document.getElementById('clickBtn').click();
    }
});

document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.click-button')) e.preventDefault();
});
