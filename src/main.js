/**
 * MAIN.JS - Punto de entrada de la aplicación
 * Responsabilidad: Inicializar todos los módulos y configurar eventos
 */

const app = {
    visualPerformanceProfile: null,
    viewportProfile: null,
    mobileViewportBaseline: null,
    viewportOrientation: null,

    // === INICIALIZACIÓN COMPLETA ===
    init() {
        console.log('🚀 CodeIdle iniciando...');
        
        // 1. Inicializar módulos en orden
        audioModule.init();
        themesModule.init();
        gameState.load(); // Ya cargado en state.js pero lo hacemos explícito
        adminModule.init();
        
        // 2. Crear UI inicial
        uiModule.createUpgradesUI();
        uiModule.createLanguagesUI();
        uiModule.createAchievementsUI();
        uiModule.createMissionsUI();
        uiModule.createLabUI();
        uiModule.createMetaUI();
        monitor4kModule.init();
        editorModule.init();
        this.applyVisualPerformanceProfile();
        this.applyShellDensityProfile();
        this.applyViewportEnvironmentProfile({ resetBaseline: true });
        uiModule.update();
        uiModule.showOfflineReport();
        
        // 3. Inicializar partículas
        this.initializeParticles();
        
        // 4. Setup event listeners
        this.setupEventListeners();
        
        // 5. Iniciar game loops
        gameEngine.startGameLoop();
        gameEngine.startEventLoop();
        
        console.log('✅ CodeIdle listo para jugar!');
    },

    applyVisualPerformanceProfile() {
        const profile = uiModule.getVisualPerformanceProfile(window.innerWidth);
        this.visualPerformanceProfile = profile;
        document.body.dataset.visualPerformance = profile.key;
        monitor4kModule.setPerformanceProfile?.(profile.monitorQuality);
        return profile;
    },

    applyShellDensityProfile() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        let screenProfile = 'desktop';
        if (width <= 991.98) {
            screenProfile = 'mobile';
        } else if (width <= 1200) {
            screenProfile = 'tablet';
        }

        let density = 'roomy';
        if (screenProfile === 'mobile') {
            density = height <= 740 ? 'tight' : 'compact';
        } else if (screenProfile === 'tablet') {
            density = height <= 820 ? 'tight' : 'compact';
        } else if (height <= 760) {
            density = 'tight';
        } else if (height <= 920) {
            density = 'compact';
        }

        document.body.dataset.shellDensity = density;
        document.body.dataset.shellHeight = height <= 760 ? 'short' : height <= 920 ? 'medium' : 'tall';

        return { screenProfile, density, height };
    },

    applyViewportEnvironmentProfile(options = {}) {
        const { resetBaseline = false } = options;
        const viewport = window.visualViewport;
        const liveWidth = Math.round(viewport?.width ?? window.innerWidth);
        const liveHeight = Math.round(viewport?.height ?? window.innerHeight);
        const offsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
        const offsetLeft = Math.max(0, Math.round(viewport?.offsetLeft ?? 0));
        const orientation = liveWidth > liveHeight ? 'landscape' : 'portrait';
        const isMobileShell = window.innerWidth <= 991.98;
        const activeElement = document.activeElement;
        const isEditableTarget = Boolean(activeElement) && (
            activeElement.matches?.('input, textarea, select') ||
            activeElement.isContentEditable
        );
        const chromeDelta = Math.max(0, Math.round(window.innerHeight - liveHeight - offsetTop));
        const keyboardOpen = isMobileShell && isEditableTarget && chromeDelta > 120;

        if (!isMobileShell) {
            this.mobileViewportBaseline = null;
        } else if (resetBaseline || this.viewportOrientation !== orientation || this.mobileViewportBaseline == null) {
            this.mobileViewportBaseline = liveHeight;
        } else if (!keyboardOpen) {
            this.mobileViewportBaseline = Math.min(this.mobileViewportBaseline, liveHeight);
        }

        const shellHeight = isMobileShell
            ? (this.mobileViewportBaseline || liveHeight)
            : Math.round(window.innerHeight);
        const chromeState = !isMobileShell
            ? 'stable'
            : keyboardOpen
                ? 'keyboard'
                : chromeDelta > 44
                    ? 'expanded'
                    : 'collapsed';

        document.documentElement.style.setProperty('--app-shell-height', `${shellHeight}px`);
        document.documentElement.style.setProperty('--app-live-viewport-height', `${liveHeight}px`);
        document.documentElement.style.setProperty('--app-live-viewport-width', `${liveWidth}px`);
        document.documentElement.style.setProperty('--app-viewport-offset-top', `${offsetTop}px`);
        document.documentElement.style.setProperty('--app-viewport-offset-left', `${offsetLeft}px`);

        document.body.dataset.viewportOrientation = orientation;
        document.body.dataset.mobileChrome = chromeState;
        document.body.dataset.virtualKeyboard = keyboardOpen ? 'open' : 'closed';

        this.viewportOrientation = orientation;
        this.viewportProfile = {
            orientation,
            liveWidth,
            liveHeight,
            shellHeight,
            chromeState,
            keyboardOpen,
            offsetTop,
            offsetLeft
        };

        return this.viewportProfile;
    },
    
    // === SETUP DE EVENTOS DE INTERFAZ ===
    setupEventListeners() {
        const compactHeaderBreakpoint = 1180;
        const headerStatsShell = document.getElementById('headerStatsShell');
        const headerStatsToggle = document.getElementById('headerStatsToggle');
        const managementContentToggle = document.getElementById('managementContentToggle');
        const editorContentToggle = document.getElementById('editorContentToggle');
        const managementContentView = document.getElementById('managementContentView');
        const editorContentView = document.getElementById('editorContentView');
        const projectHealthPeekBtn = document.getElementById('projectHealthPeekBtn');
        const projectHealthCollapseBtn = document.getElementById('projectHealthCollapseBtn');
        const closeHeaderStatsMenu = () => {
            if (!headerStatsShell || !headerStatsToggle) return;
            headerStatsShell.classList.remove('menu-open');
            headerStatsToggle.setAttribute('aria-expanded', 'false');
        };
        let viewportUpdateFrame = null;

        const syncViewportEnvironment = (options = {}) => {
            if (viewportUpdateFrame !== null) {
                window.cancelAnimationFrame(viewportUpdateFrame);
            }

            viewportUpdateFrame = window.requestAnimationFrame(() => {
                viewportUpdateFrame = null;
                this.applyViewportEnvironmentProfile(options);
            });
        };

        let currentManagementSurface = 'editor';
        let currentMobileView = 'clicker';
        let projectHealthPanelOpen = false;

        const syncProjectHealthCard = (options = {}) => {
            const { forceOpen = false, forceClosed = false } = options;
            const projectHealthCard = document.getElementById('projectHealthCard');
            if (!projectHealthCard) return;

            if (forceOpen) {
                projectHealthPanelOpen = true;
            }

            if (forceClosed) {
                projectHealthPanelOpen = false;
            }

            document.body.dataset.managementSurface = currentManagementSurface;
            document.body.dataset.projectHealthPanel = projectHealthPanelOpen ? 'open' : 'closed';
            projectHealthCard.hidden = !projectHealthPanelOpen;

            if (projectHealthPeekBtn) {
                projectHealthPeekBtn.setAttribute('aria-expanded', String(projectHealthPanelOpen));
            }

            if (projectHealthCollapseBtn) {
                projectHealthCollapseBtn.hidden = !projectHealthPanelOpen;
                projectHealthCollapseBtn.setAttribute('aria-expanded', String(projectHealthPanelOpen));
                projectHealthCollapseBtn.setAttribute(
                    'aria-label',
                    projectHealthPanelOpen ? 'Cerrar salud del proyecto' : 'Abrir salud del proyecto'
                );

                const icon = projectHealthCollapseBtn.querySelector('i');
                if (icon) {
                    icon.className = projectHealthPanelOpen ? 'fas fa-times' : 'fas fa-chevron-up';
                }
            }
        };

        const switchManagementSurface = (target) => {
            const showEditor = target === 'editor';
            currentManagementSurface = target;
            managementContentToggle?.classList.toggle('active', !showEditor);
            editorContentToggle?.classList.toggle('active', showEditor);
            managementContentToggle?.setAttribute('aria-pressed', String(!showEditor));
            editorContentToggle?.setAttribute('aria-pressed', String(showEditor));
            managementContentView?.classList.toggle('active', !showEditor);
            editorContentView?.classList.toggle('active', showEditor);

            if (managementContentView) {
                managementContentView.hidden = showEditor;
            }

            if (editorContentView) {
                editorContentView.hidden = !showEditor;
            }

            if (showEditor) {
                projectHealthPanelOpen = false;
            }

            syncProjectHealthCard();
        };

        const switchMobileView = (target) => {
            currentMobileView = target;
            uiModule.switchMobileView(target);
            document.body.dataset.mobileBuildOverlay = target === 'management' ? 'open' : 'closed';
            if (target === 'management') {
                projectHealthPanelOpen = false;
                syncProjectHealthCard();
            }
        };

        const applyResponsiveHierarchy = (options = {}) => {
            const { forceSurface = false, forceMobileView = false } = options;
            const profile = uiModule.getResponsiveHierarchyProfile(window.innerWidth);
            uiModule.applyResponsiveHierarchy(profile);

            if (forceSurface) {
                switchManagementSurface(profile.managementDefaultSurface);
            } else {
                switchManagementSurface(currentManagementSurface);
            }

            if (window.innerWidth <= 991.98) {
                if (forceMobileView) {
                    switchMobileView(profile.mobileDefaultView);
                } else {
                    switchMobileView(currentMobileView);
                }
            }

            if (window.innerWidth > 991.98) {
                currentMobileView = profile.mobileDefaultView;
            }
        };

        const toggleHeaderStatsMenu = () => {
            if (!headerStatsShell || !headerStatsToggle || window.innerWidth > compactHeaderBreakpoint) return;
            const isOpen = headerStatsShell.classList.toggle('menu-open');
            headerStatsToggle.setAttribute('aria-expanded', String(isOpen));
        };

        // Click button
        const clickBtn = document.getElementById('clickBtn');
        const maintenanceBtn = document.getElementById('projectHealthMaintenanceBtn');
        if (clickBtn) {
            clickBtn.addEventListener('click', () => gameLogic.handleClick());
        }
        maintenanceBtn?.addEventListener('click', () => gameLogic.startMaintenance());

        headerStatsToggle?.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleHeaderStatsMenu();
        });

        projectHealthPeekBtn?.addEventListener('click', () => {
            projectHealthPanelOpen = !projectHealthPanelOpen;
            syncProjectHealthCard();
        });

        projectHealthCollapseBtn?.addEventListener('click', () => {
            projectHealthPanelOpen = false;
            syncProjectHealthCard({ forceClosed: true });
        });

        managementContentToggle?.addEventListener('click', () => switchManagementSurface('panel'));
        editorContentToggle?.addEventListener('click', () => switchManagementSurface('editor'));
        applyResponsiveHierarchy({ forceSurface: true, forceMobileView: true });
        syncProjectHealthCard({ forceClosed: true });

        document.addEventListener('click', (event) => {
            if (!headerStatsShell?.classList.contains('menu-open')) return;
            if (headerStatsShell.contains(event.target)) return;
            closeHeaderStatsMenu();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > compactHeaderBreakpoint) {
                closeHeaderStatsMenu();
            }

            this.applyVisualPerformanceProfile();
            this.applyShellDensityProfile();
            syncViewportEnvironment();
            applyResponsiveHierarchy();
            syncProjectHealthCard();
        });

        window.addEventListener('orientationchange', () => {
            syncViewportEnvironment({ resetBaseline: true });
        });

        window.visualViewport?.addEventListener('resize', () => {
            syncViewportEnvironment();
        });

        window.visualViewport?.addEventListener('scroll', () => {
            syncViewportEnvironment();
        });

        document.addEventListener('focusin', () => {
            syncViewportEnvironment();
        });

        document.addEventListener('focusout', () => {
            window.setTimeout(() => syncViewportEnvironment(), 0);
        });
        
        // Tab switching
        document.getElementById('upgrades-tab')?.addEventListener('click', () => uiModule.switchTab('upgrades'));
        document.getElementById('languages-tab')?.addEventListener('click', () => uiModule.switchTab('languages'));
        document.getElementById('achievements-tab')?.addEventListener('click', () => uiModule.switchTab('achievements'));
        document.getElementById('stats-tab')?.addEventListener('click', () => uiModule.switchTab('stats'));
        document.getElementById('passive-tab')?.addEventListener('click', () => uiModule.switchTab('passive'));
        document.getElementById('missions-tab')?.addEventListener('click', () => uiModule.switchTab('missions'));
        document.getElementById('lab-tab')?.addEventListener('click', () => uiModule.switchTab('lab'));
        document.getElementById('meta-tab')?.addEventListener('click', () => uiModule.switchTab('meta'));

        // Mobile view switching
        document.getElementById('clicker-view-tab')?.addEventListener('click', () => switchMobileView('clicker'));
        document.getElementById('management-view-tab')?.addEventListener('click', () => switchMobileView('management'));
        
        // Sound toggle
        document.getElementById('soundToggle')?.addEventListener('click', () => {
            gameState.soundEnabled = audioModule.toggle();
            document.getElementById('soundToggle').style.opacity = gameState.soundEnabled ? '1' : '0.5';
            gameState.save(true);
        });

        document.getElementById('soundToggle').style.opacity = gameState.soundEnabled ? '1' : '0.5';
        
        // Theme selector
        document.getElementById('themeSelector')?.addEventListener('change', (e) => {
            themesModule.toggle(e.target.value);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (adminModule.handleKeydown(e)) {
                return;
            }

            const isHardReloadShortcut =
                (e.ctrlKey && e.code === 'F5') ||
                (e.ctrlKey && e.shiftKey && e.code === 'KeyR');

            if (isHardReloadShortcut) {
                sessionStorage.setItem(CONFIG.HARD_RELOAD_RESET_FLAG_KEY, '1');
            }

            if (e.key === 'Escape') {
                closeHeaderStatsMenu();
            }

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                gameLogic.handleClick();
            }
        });
    },
    
    // === INICIALIZAR PARTÍCULAS DE FONDO ===
    initializeParticles() {
        const container = document.getElementById('particles-container');
        if (!container) return;
        if (container.children.length > 0) return;

        const profile = this.visualPerformanceProfile || this.applyVisualPerformanceProfile();
        if (profile.backgroundParticles <= 0) {
            container.setAttribute('aria-hidden', 'true');
            return;
        }
        
        for (let i = 0; i < profile.backgroundParticles; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 2px;
                height: 2px;
                background: rgba(0, 212, 255, ${Math.random() * 0.5});
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
            `;
            container.appendChild(particle);
            
            anime({
                targets: particle,
                translateY: [0, Math.random() * -100 - 50],
                translateX: [0, Math.sin(Math.random() * Math.PI) * 50],
                opacity: [{ value: 0, duration: 500 }, { value: Math.random() * 0.5, duration: 500 }],
                duration: Math.random() * 3000 + (profile.key === 'balanced' ? 2600 : 3200),
                loop: true,
                easing: 'easeInOutQuad'
            });
        }
    }
};

// Iniciar cuando DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

console.log('✅ MAIN.JS loaded');
