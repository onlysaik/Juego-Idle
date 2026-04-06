/**
 * MODULES/UI.JS - Actualización de interfaz de usuario
 * Responsabilidad: Renderizar y actualizar todos los elementos visuales
 * Separado completamente de la lógica del juego
 */

const uiModule = {
    previewLanguageKey: 'javascript',
    activeEditorFileId: 'language:javascript',
    editorTabsSignature: '',
    editorPreviewSignature: '',

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
        const progressPercent = (gameState.code / CONFIG.CODE_PER_COMMIT) * 100;
        document.getElementById('codeBar').style.width = progressPercent + '%';
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
        
        this.syncEditorTabs();
        this.updateEditorStatus();
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

    getOwnedPreviewLanguages() {
        return Object.entries(gameState.languages)
            .filter(([, language]) => language.owned > 0)
            .map(([key, language]) => ({ key, ...language }));
    },

    getFileNameForLanguage(languageKey) {
        const fileMap = {
            javascript: 'app.js',
            python: 'app.py',
            rust: 'main.rs',
            typescript: 'server.ts',
            go: 'api.go',
            java: 'Application.java',
            csharp: 'Program.cs',
            kotlin: 'App.kt',
            php: 'index.php'
        };

        return fileMap[languageKey] || 'main.txt';
    },

    getFileNameForFramework(frameworkKey) {
        const fileMap = {
            react: 'App.jsx',
            django: 'views.py',
            vue: 'App.vue',
            nextjs: 'page.tsx',
            fastapi: 'api.py',
            spring: 'CodeController.java',
            dotnet: 'CodeController.cs',
            laravel: 'routes.php'
        };

        return fileMap[frameworkKey] || 'feature.txt';
    },

    getPreferredFrameworkForLanguage(languageKey) {
        const ownedFrameworks = Object.entries(gameState.frameworks)
            .filter(([, framework]) => framework.owned > 0 && framework.requires === languageKey)
            .map(([key, framework]) => ({ key, ...framework }))
            .sort((a, b) => b.owned - a.owned || b.cost - a.cost);

        return ownedFrameworks[0] || null;
    },

    setPreviewLanguage(languageKey) {
        this.previewLanguageKey = languageKey;
        this.activeEditorFileId = `language:${languageKey}`;
        this.syncEditorTabs();
        this.updateCodePreview();
        this.updateEditorStatus();
    },

    setPreviewFramework(frameworkKey) {
        const framework = gameState.frameworks[frameworkKey];
        if (!framework) return;
        this.previewLanguageKey = framework.requires;
        this.activeEditorFileId = `framework:${frameworkKey}`;
        this.syncEditorTabs();
        this.updateCodePreview();
        this.updateEditorStatus();
    },

    getEditorFiles() {
        const languageFiles = this.getOwnedPreviewLanguages().map(language => ({
            id: `language:${language.key}`,
            type: 'language',
            key: language.key,
            parentLanguageKey: language.key,
            name: language.name,
            icon: language.icon,
            fileName: this.getFileNameForLanguage(language.key)
        }));

        const frameworkFiles = Object.entries(gameState.frameworks)
            .filter(([, framework]) => framework.owned > 0)
            .map(([key, framework]) => ({
                id: `framework:${key}`,
                type: 'framework',
                key,
                parentLanguageKey: framework.requires,
                name: framework.name,
                icon: framework.icon,
                fileName: this.getFileNameForFramework(key)
            }));

        if (languageFiles.length === 0) {
            return [{
                id: 'language:javascript',
                type: 'language',
                key: 'javascript',
                parentLanguageKey: 'javascript',
                name: 'JavaScript',
                icon: CONFIG.LANGUAGES.javascript.icon,
                fileName: this.getFileNameForLanguage('javascript')
            }];
        }

        return [...languageFiles, ...frameworkFiles];
    },

    getActiveEditorFile() {
        const files = this.getEditorFiles();
        return files.find(file => file.id === this.activeEditorFileId) || files[0];
    },

    syncEditorTabs() {
        const tabsContainer = document.getElementById('editorTabs');
        if (!tabsContainer) return;

        const files = this.getEditorFiles();
        const availableIds = files.map(file => file.id);
        if (!availableIds.includes(this.activeEditorFileId)) {
            this.activeEditorFileId = files[files.length - 1].id;
        }

        const nextSignature = JSON.stringify({
            active: this.activeEditorFileId,
            files: files.map(file => ({ id: file.id, fileName: file.fileName, icon: file.icon }))
        });

        if (this.editorTabsSignature === nextSignature) {
            return;
        }

        this.editorTabsSignature = nextSignature;

        tabsContainer.innerHTML = files.map(file => `
            <button
                class="editor-tab ${file.id === this.activeEditorFileId ? 'active' : ''}"
                type="button"
                data-file-id="${file.id}"
                title="Abrir ${file.fileName}"
            >
                <i class="${file.icon}"></i>
                <span>${file.fileName}</span>
            </button>
        `).join('');

        tabsContainer.querySelectorAll('.editor-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const { fileId } = tab.dataset;
                if (fileId === this.activeEditorFileId) return;
                this.activeEditorFileId = fileId;
                const file = this.getActiveEditorFile();
                this.previewLanguageKey = file.parentLanguageKey;
                this.animateLanguageChange(file.name);
                this.syncEditorTabs();
                this.updateCodePreview();
                this.updateEditorStatus();
            });
        });
    },

    renderEditorCode(code) {
        const container = document.getElementById('codeEditorContent');
        if (!container) return;

        const lines = code.split('\n');
        container.innerHTML = lines.map((line, index) => `
            <div class="code-line">
                <span class="line-num">${index + 1}</span>
                <span class="code">${line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')}</span>
            </div>
        `).join('');
    },

    updateCodePreview() {
        const editorContent = document.getElementById('codeEditorContent');
        if (!editorContent) return;

        const activeFile = this.getActiveEditorFile();
        const activeLanguageKey = activeFile.parentLanguageKey;
        const activeLanguage = CONFIG.LANGUAGES[activeLanguageKey];

        let newCode = [
            'console.log("Hello, World!");',
            '// Proyecto inicial'
        ].join('\n');

        if (activeLanguage && activeFile) {
            const codeSnippet = this.generateCodeSnippet(activeFile);
            const header = `// ${activeFile.fileName} · ${activeFile.name}`;
            newCode = [header, codeSnippet].join('\n');
        }

        if (this.editorPreviewSignature !== newCode) {
            anime({
                targets: editorContent,
                opacity: [1, 0.35, 1],
                duration: 260,
                easing: 'easeInOutQuad'
            });
            this.renderEditorCode(newCode);
            this.editorPreviewSignature = newCode;
        }
    },

    updateEditorStatus() {
        const activeFile = this.getActiveEditorFile();
        const fileMeta = document.getElementById('editorFileMeta');
        const runtimeMeta = document.getElementById('editorRuntimeMeta');
        if (!activeFile || !fileMeta || !runtimeMeta) return;

        const language = CONFIG.LANGUAGES[activeFile.parentLanguageKey];
        const framework = activeFile.type === 'framework' ? gameState.frameworks[activeFile.key] : null;
        const stackLabel = framework
            ? `${language?.name || activeFile.parentLanguageKey} + ${framework.name}`
            : (language?.name || activeFile.name);

        fileMeta.textContent = `${activeFile.fileName} · ${stackLabel}`;
        runtimeMeta.textContent = `${gameState.commits.toLocaleString()} commits · ${Math.floor(gameState.totalCode).toLocaleString()} lineas · +${gameState.calculateGeneration().toFixed(1)}/s`;
    },
    
    // === Generar snippets de código realistas ===
    generateCodeSnippet(file) {
        const snippets = {
            'language:javascript': `const projectState = {\n  lines: 0,\n  commits: 0\n};\n\nexport function shipFeature() {\n  return projectState.lines + 12;\n}`,
            'language:python': `def build_release(lines: int) -> dict:\n    return {\n        'lines': lines,\n        'status': 'shipping'\n    }`,
            'language:rust': `pub fn compile_release(lines: i32) -> i32 {\n    lines.saturating_add(32)\n}`,
            'language:typescript': `type BuildStats = {\n  lines: number;\n  velocity: number;\n};\n\nexport const buildStats: BuildStats = {\n  lines: 0,\n  velocity: 0\n};`,
            'language:go': `type Build struct {\n    Lines int\n    Commits int\n}\n\nfunc NewBuild() Build {\n    return Build{Lines: 0, Commits: 0}\n}`,
            'language:java': `public class Application {\n    public static int buildRelease(int lines) {\n        return lines + 24;\n    }\n}`,
            'language:csharp': `public static class Program\n{\n    public static int BuildRelease(int lines)\n    {\n        return lines + 18;\n    }\n}`,
            'language:kotlin': `object BuildEngine {\n    fun ship(lines: Int): Int {\n        return lines + 20\n    }\n}`,
            'language:php': `<?php\nfunction ship_release(int $lines): array\n{\n    return ['lines' => $lines, 'status' => 'ready'];\n}`,
            'framework:react': `import { useState } from 'react';\n\nexport default function App() {\n  const [lines, setLines] = useState(0);\n  return <main>{lines}</main>;\n}`,
            'framework:django': `from django.http import JsonResponse\nfrom django.views import View\n\nclass BuildView(View):\n    def get(self, request):\n        return JsonResponse({'status': 'ready'})`,
            'framework:vue': `<script setup>\nconst lines = ref(0);\n</script>\n\n<template>\n  <main>{{ lines }}</main>\n</template>`,
            'framework:nextjs': `export default async function Page() {\n  const stats = await getBuildStats();\n  return <section>{stats.lines}</section>;\n}`,
            'framework:fastapi': `from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get('/build')\ndef build_status():\n    return {'status': 'ready'}`,
            'framework:spring': `@RestController\n@RequestMapping("/build")\npublic class CodeController {\n    @GetMapping\n    public Map<String, String> status() {\n        return Map.of("status", "ready");\n    }\n}`,
            'framework:dotnet': `[ApiController]\n[Route("api/build")]\npublic class CodeController : ControllerBase\n{\n    [HttpGet]\n    public IActionResult Status() => Ok(new { status = "ready" });\n}`,
            'framework:laravel': `<?php\n\nuse Illuminate\Support\Facades\Route;\n\nRoute::get('/build', function () {\n    return response()->json(['status' => 'ready']);\n});`
        };

        return snippets[file.id] || `// Generando código para ${file.name}...`;
    },
    
    // === ANIMAR CAMBIO DE LENGUAJE/FRAMEWORK ===
    animateLanguageChange(languageName, frameworkName = null) {
        const codePreview = document.getElementById('codeEditorContent');
        const editorMock = document.querySelector('.editor-mock');
        if (!codePreview) return;
        
        // Flash del editor
        anime({
            targets: editorMock,
            backgroundColor: ['rgba(0, 212, 255, 0.15)', 'rgba(0, 212, 255, 0)', 'rgba(0, 212, 255, 0.1)'],
            duration: 600,
            easing: 'easeOutQuad'
        });
        
        // Agitar el preview
        anime({
            targets: codePreview,
            translateX: [-10, 10, -5, 5, 0],
            duration: 300,
            easing: 'easeOutQuad'
        });
        
        // Pulse del editor
        anime({
            targets: '.editor-header',
            boxShadow: [
                { value: '0 0 0 0 rgba(0, 212, 255, 0.5)' },
                { value: '0 0 20px 10px rgba(0, 212, 255, 0)' }
            ],
            duration: 600,
            easing: 'easeOutQuad'
        });
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
                confirmButtonText: 'Seguir programando',
                buttonsStyling: false,
                customClass: {
                    popup: 'codeidle-alert-popup',
                    title: 'codeidle-alert-title',
                    htmlContainer: 'codeidle-alert-html',
                    actions: 'codeidle-alert-actions',
                    confirmButton: 'codeidle-alert-confirm'
                }
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
    
    // === MEJORA 4: PARTÍCULAS DE CÓDIGO FLOTANTE (Generación pasiva visual) ===
    createPassiveCodeParticle(fromX, fromY, amount) {
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
        
        setTimeout(() => particle.remove(), 1200);
    },
    
    // === Animar partículas pasivas cada 0.5s ===
    animatePassiveGeneration() {
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
        const count = Math.min(Math.ceil(generation / 2), 3);
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
