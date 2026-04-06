/**
 * CONFIG.JS - Configuración centralizada del juego
 * Define todas las constantes, valores iniciales y configuraciones globales
 * Permite cambiar valores fácilmente sin tocar la lógica
 */

const CONFIG = {
    // === MECÁNICAS DE JUEGO ===
    CODE_PER_COMMIT: 1000,
    INITIAL_CODE_PER_CLICK: 10,
    STREAK_TIMEOUT: 5000, // ms
    STREAK_CLICK_BONUS_PER_STACK: 0.012,
    STREAK_CLICK_BONUS_CAP: 0.75,
    PRESTIGE_BASE_COST: 60000,
    PRESTIGE_COST_SCALING: 1.4,
    PRESTIGE_BONUS_PER_POINT: 0.045,
    SPECIALIZATION_SWITCH_COST: 5000,
    RELEASE_CHARGE_REQUIRED: 10,
    RELEASE_REWARD_PER_COMMIT: 500,
    RELEASE_REP_PER_LAUNCH: 0,
    TREND_REFRESH_INTERVAL: 120000,
    TREND_LANGUAGE_MULTIPLIER: 0.28,
    TREND_FRAMEWORK_MULTIPLIER: 0.35,
    OFFLINE_CAP_SECONDS: 14400,
    SAVE_THROTTLE_MS: 3000,
    COMMIT_BATCH_LIMIT: 500,
    UPGRADE_COST_SCALING: 1.45,
    UPGRADE_MAX_OWNED: 6,
    LANGUAGE_COST_SCALING: 1.19,
    FRAMEWORK_COST_SCALING: 1.22,
    TEAM_COST_SCALING: 1.17,
    
    // === IDIOMAS (PASIVA GENERATION) ===
    LANGUAGES: {
        javascript: {
            cost: 140,
            generation: 1,
            name: 'JavaScript',
            icon: 'fab fa-js-square'
        },
        python: {
            cost: 360,
            generation: 2,
            name: 'Python',
            icon: 'fab fa-python'
        },
        rust: {
            cost: 820,
            generation: 3,
            name: 'Rust',
            icon: 'fas fa-cog'
        },
        typescript: {
            cost: 1550,
            generation: 5,
            name: 'TypeScript',
            icon: 'fas fa-cube'
        },
        go: {
            cost: 3000,
            generation: 8,
            name: 'Go',
            icon: 'fas fa-wind'
        },
        java: {
            cost: 5600,
            generation: 12,
            name: 'Java',
            icon: 'fab fa-java'
        },
        csharp: {
            cost: 9200,
            generation: 17,
            name: 'C#',
            icon: 'fas fa-hashtag'
        },
        kotlin: {
            cost: 12800,
            generation: 23,
            name: 'Kotlin',
            icon: 'fas fa-mobile-screen'
        },
        php: {
            cost: 17000,
            generation: 30,
            name: 'PHP',
            icon: 'fab fa-php'
        }
    },
    
    // === UPGRADES (MULTIPLICADORES) ===
    UPGRADES: {
        keyboard: {
            cost: 60,
            multiplier: 1.08,
            name: 'Teclado Mecánico',
            icon: 'fas fa-keyboard',
            desc: '+8% por click'
        },
        monitor: {
            cost: 220,
            multiplier: 1.12,
            name: 'Monitor 4K',
            icon: 'fas fa-tv',
            desc: '+12% velocidad'
        },
        coffee: {
            cost: 700,
            multiplier: 1.2,
            name: 'Café',
            icon: 'fas fa-mug-hot',
            desc: '+20% productividad'
        },
        vscode: {
            cost: 1800,
            multiplier: 1.35,
            name: 'VS Code Pro',
            icon: 'fas fa-code',
            desc: '+35% eficiencia'
        }
    },
    
    // === FRAMEWORKS (SINERGIAS) ===
    FRAMEWORKS: {
        react: {
            cost: 3600,
            boost: 0.45,
            name: 'React',
            icon: 'fab fa-react',
            requires: 'javascript',
            desc: '+45% JavaScript'
        },
        django: {
            cost: 5200,
            boost: 0.55,
            name: 'Django',
            icon: 'fas fa-database',
            requires: 'python',
            desc: '+55% Python'
        },
        vue: {
            cost: 6200,
            boost: 0.5,
            name: 'Vue',
            icon: 'fab fa-vuejs',
            requires: 'javascript',
            desc: '+50% JavaScript'
        },
        nextjs: {
            cost: 11500,
            boost: 0.6,
            name: 'Next.js',
            icon: 'fas fa-forward',
            requires: 'typescript',
            desc: '+60% TypeScript'
        },
        fastapi: {
            cost: 10500,
            boost: 0.68,
            name: 'FastAPI',
            icon: 'fas fa-bolt',
            requires: 'python',
            desc: '+68% Python'
        },
        spring: {
            cost: 21000,
            boost: 0.75,
            name: 'Spring Boot',
            icon: 'fas fa-leaf',
            requires: 'java',
            desc: '+75% Java'
        },
        dotnet: {
            cost: 24500,
            boost: 0.78,
            name: 'ASP.NET Core',
            icon: 'fas fa-layer-group',
            requires: 'csharp',
            desc: '+78% C#'
        },
        laravel: {
            cost: 27000,
            boost: 0.82,
            name: 'Laravel',
            icon: 'fab fa-laravel',
            requires: 'php',
            desc: '+82% PHP'
        }
    },

    // === ARTEFACTOS / OPEN SOURCE ===
    ARTIFACTS: {
        stackOverflow: {
            name: 'StackOverflow Gold',
            icon: 'fab fa-stack-overflow',
            cost: 2,
            clickBoost: 0.18,
            passiveBoost: 0,
            releaseBoost: 0.12,
            desc: 'Tus respuestas antiguas te ahorran tiempo en cada click.'
        },
        copilot: {
            name: 'AI Copilot',
            icon: 'fas fa-wand-magic-sparkles',
            cost: 4,
            clickBoost: 0.24,
            passiveBoost: 0.12,
            releaseBoost: 0,
            desc: 'Autocompleta y reduce el tiempo de entrega.'
        },
        ciPipeline: {
            name: 'Pipeline CI/CD',
            icon: 'fas fa-code-branch',
            cost: 5,
            clickBoost: 0,
            passiveBoost: 0.24,
            releaseBoost: 0.2,
            desc: 'El proyecto genera más valor mientras duerme.'
        },
        terminalFu: {
            name: 'Terminal Fu',
            icon: 'fas fa-terminal',
            cost: 6,
            clickBoost: 0.3,
            passiveBoost: 0,
            releaseBoost: 0.08,
            desc: 'Automatizas tareas a una velocidad absurda.'
        },
        dockerCluster: {
            name: 'Docker Cluster',
            icon: 'fab fa-docker',
            cost: 7,
            clickBoost: 0,
            passiveBoost: 0.28,
            releaseBoost: 0.22,
            desc: 'Escalas el stack y las releases salen con menos drama.'
        },
        observability: {
            name: 'Observability Suite',
            icon: 'fas fa-chart-column',
            cost: 8,
            clickBoost: 0.14,
            passiveBoost: 0.24,
            releaseBoost: 0.24,
            desc: 'Menos tiempo apagando incendios, más tiempo produciendo.'
        }
    },

    // === ESPECIALIZACIONES ===
    SPECIALIZATIONS: {
        frontend: {
            name: 'Frontend',
            icon: 'fas fa-window-maximize',
            desc: '+28% click, bonus a JavaScript/TypeScript y React',
            clickBoost: 0.28,
            passiveBoost: 0,
            languageBoosts: {
                javascript: 0.65,
                typescript: 0.5
            },
            frameworkBoosts: {
                react: 0.32
            }
        },
        backend: {
            name: 'Backend',
            icon: 'fas fa-server',
            desc: '+24% pasiva, bonus a Python/Rust y Django',
            clickBoost: 0,
            passiveBoost: 0.24,
            languageBoosts: {
                python: 0.55,
                rust: 0.38
            },
            frameworkBoosts: {
                django: 0.4
            }
        },
        data: {
            name: 'Data',
            icon: 'fas fa-chart-line',
            desc: '+14% click, +28% pasiva y mejor provecho de Python',
            clickBoost: 0.14,
            passiveBoost: 0.28,
            languageBoosts: {
                python: 0.42,
                typescript: 0.24
            },
            frameworkBoosts: {}
        },
        devops: {
            name: 'DevOps',
            icon: 'fas fa-cloud',
            desc: '+32% pasiva y el equipo rinde mejor',
            clickBoost: 0,
            passiveBoost: 0.32,
            languageBoosts: {
                rust: 0.32,
                javascript: 0.2
            },
            frameworkBoosts: {}
        },
        mobile: {
            name: 'Mobile',
            icon: 'fas fa-mobile-alt',
            desc: '+22% click, +12% pasiva y bonus a Kotlin y TypeScript',
            clickBoost: 0.22,
            passiveBoost: 0.12,
            languageBoosts: {
                kotlin: 0.62,
                typescript: 0.3
            },
            frameworkBoosts: {}
        }
    },

    // === EQUIPO ===
    TEAM: {
        junior: {
            name: 'Junior Dev',
            icon: 'fas fa-user-graduate',
            cost: 1700,
            generation: 10,
            clickBoost: 0,
            passiveBoost: 0,
            desc: 'Produce código base mientras aprendes a delegar.'
        },
        senior: {
            name: 'Senior Dev',
            icon: 'fas fa-user-tie',
            cost: 7800,
            generation: 30,
            clickBoost: 0.16,
            passiveBoost: 0.08,
            desc: 'Acelera clicks y procesos con experiencia real.'
        },
        qa: {
            name: 'QA',
            icon: 'fas fa-bug-slash',
            cost: 5000,
            generation: 14,
            clickBoost: 0,
            passiveBoost: 0.12,
            desc: 'Reduce fricción y mejora la salida sostenida.'
        },
        devops: {
            name: 'DevOps',
            icon: 'fas fa-network-wired',
            cost: 11200,
            generation: 22,
            clickBoost: 0,
            passiveBoost: 0.22,
            desc: 'Multiplica la automatización de todo el stack.'
        },
        architect: {
            name: 'Software Architect',
            icon: 'fas fa-sitemap',
            cost: 20500,
            generation: 42,
            clickBoost: 0.18,
            passiveBoost: 0.18,
            desc: 'Convierte complejidad en throughput y decisiones rentables.'
        },
        product: {
            name: 'Product Engineer',
            icon: 'fas fa-lightbulb',
            cost: 28500,
            generation: 52,
            clickBoost: 0.14,
            passiveBoost: 0.24,
            desc: 'Encuentra features que sí mueven la aguja.'
        }
    },

    // === MISIONES ===
    MISSIONS: {
        short: [
            {
                id: 'rapid-clicks',
                name: 'Sprint de Teclado',
                desc: 'Haz 75 clicks.',
                metric: 'clicks',
                target: 75,
                rewardCode: 2500,
                rewardRep: 0
            },
            {
                id: 'commit-rush',
                name: 'Push del Día',
                desc: 'Consigue 8 commits.',
                metric: 'commits',
                target: 8,
                rewardCode: 3500,
                rewardRep: 0
            },
            {
                id: 'streak-run',
                name: 'Flow State',
                desc: 'Llega a racha 20.',
                metric: 'streak',
                target: 20,
                rewardCode: 3000,
                rewardRep: 0
            },
            {
                id: 'tool-up',
                name: 'Preparar Setup',
                desc: 'Compra 4 upgrades.',
                metric: 'upgradesOwned',
                target: 4,
                rewardCode: 3200,
                rewardRep: 0
            },
            {
                id: 'release-prep',
                name: 'Congelar Release',
                desc: 'Carga una release con 10 commits.',
                metric: 'releaseCharge',
                target: 10,
                rewardCode: 4500,
                rewardRep: 0
            },
            {
                id: 'artifact-hunt',
                name: 'Loot Técnico',
                desc: 'Compra 1 artefacto.',
                metric: 'artifactsOwned',
                target: 1,
                rewardCode: 5000,
                rewardRep: 1
            }
        ],
        long: [
            {
                id: 'first-squad',
                name: 'Armar Equipo',
                desc: 'Contrata 4 miembros del equipo.',
                metric: 'teamOwned',
                target: 4,
                rewardCode: 12000,
                rewardRep: 1
            },
            {
                id: 'poly-stack',
                name: 'Stack Completo',
                desc: 'Desbloquea 4 lenguajes.',
                metric: 'languagesOwned',
                target: 4,
                rewardCode: 15000,
                rewardRep: 1
            },
            {
                id: 'shipping-machine',
                name: 'Shipping Machine',
                desc: 'Consigue 40 commits.',
                metric: 'commits',
                target: 40,
                rewardCode: 18000,
                rewardRep: 1
            },
            {
                id: 'scale-up',
                name: 'Escalar Producto',
                desc: 'Acumula 150,000 de código total.',
                metric: 'totalCode',
                target: 150000,
                rewardCode: 22000,
                rewardRep: 2
            },
            {
                id: 'release-train',
                name: 'Release Train',
                desc: 'Publica 3 releases.',
                metric: 'releaseCount',
                target: 3,
                rewardCode: 26000,
                rewardRep: 2
            },
            {
                id: 'artifact-collector',
                name: 'Arsenal Dev',
                desc: 'Compra 3 artefactos.',
                metric: 'artifactsOwned',
                target: 3,
                rewardCode: 30000,
                rewardRep: 3
            }
        ]
    },
    
    // === LOGROS ===
    ACHIEVEMENTS: {
        firstClick: {
            name: 'Primer Click',
            desc: 'Haz tu primer click',
            icon: 'fas fa-play'
        },
        firstCommit: {
            name: 'Primer Commit',
            desc: 'Completa tu primer commit',
            icon: 'fas fa-code-branch'
        },
        hundred: {
            name: 'Century',
            desc: 'Completa 100 commits',
            icon: 'fas fa-trophy'
        },
        polyglot: {
            name: 'Poliglota',
            desc: 'Domina 3 lenguajes',
            icon: 'fas fa-language'
        },
        speedster: {
            name: 'Velocista',
            desc: 'Haz 10 clicks con racha',
            icon: 'fas fa-bolt'
        },
        millionaire: {
            name: 'Millonario',
            desc: 'Acumula 1 millón de código',
            icon: 'fas fa-coins'
        },
        firstPrestige: {
            name: 'Reinicio Inteligente',
            desc: 'Haz tu primer prestige',
            icon: 'fas fa-star'
        },
        teamLead: {
            name: 'Team Lead',
            desc: 'Contrata 5 miembros del equipo',
            icon: 'fas fa-users'
        },
        specialist: {
            name: 'Especialista',
            desc: 'Elige una especialización',
            icon: 'fas fa-medal'
        },
        releaseEngineer: {
            name: 'Release Engineer',
            desc: 'Publica tu primera release',
            icon: 'fas fa-rocket'
        },
        collector: {
            name: 'Coleccionista de Tooling',
            desc: 'Compra 3 artefactos',
            icon: 'fas fa-toolbox'
        },
        enterprise: {
            name: 'Enterprise Survivor',
            desc: 'Desbloquea 8 lenguajes',
            icon: 'fas fa-building'
        }
    },
    
    // === TEMAS ===
    THEMES: {
        dark: { label: 'Dark' },
        cyberpunk: { label: 'Cyberpunk' },
        hacker: { label: 'Hacker' },
        light: { label: 'Light' }
    },
    
    // === GAME LOOP ===
    UPDATE_RATE: 100, // ms
    EVENT_CHECK_INTERVAL: 5000, // ms
    EVENT_CHANCE: 0.05, // 5%
    EVENT_COOLDOWN: 30, // segundos
    
    // === DURACIONES DE EVENTOS ===
    EVENT_DURATIONS: {
        codeReview: 20000, // 20s
        hackathon: 10000, // 10s
        coffeeBreak: 15000, // 15s
        technicalDebt: 18000,
        refactorBoost: 25000
    },
    
    // === LOCAL STORAGE ===
    SAVE_KEY: 'codeIdleGame',
    HARD_RELOAD_RESET_FLAG_KEY: 'codeIdleHardReloadReset',
};

console.log('✅ CONFIG loaded');
