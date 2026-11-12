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
    // Rep por prestige = max(1, floor((totalCode / coste) ^ (1 / ROOT))). 3 = raíz cúbica.
    PRESTIGE_REWARD_ROOT: 3,
    PRESTIGE_BONUS_PER_POINT: 0.15,
    PRESTIGE_HEALTH_REDUCTION_PER_POINT: 0.015,
    PRESTIGE_HEALTH_REDUCTION_CAP: 0.3,
    PRESTIGE_RELEASE_SCORE_PER_POINT: 0.8,
    PRESTIGE_RELEASE_SCORE_CAP: 12,
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
    // Cada click suma esta fracción de la producción pasiva por segundo
    // (sin efectos temporales ni mantenimiento), para que el click escale con la partida.
    CLICK_PASSIVE_SHARE: 0.05,
    LANGUAGE_COST_SCALING: 1.19,
    FRAMEWORK_COST_SCALING: 1.22,
    TEAM_COST_SCALING: 1.17,
    PROJECT_HEALTH: {
        QUALITY_MAX: 100,
        DEBT_MAX: 100,
        STARTING_QUALITY: 72,
        STARTING_DEBT: 8,
        CLICK_QUALITY_DECAY: 0.02,
        CLICK_DEBT_GAIN: 0.09,
        COMMIT_QUALITY_DECAY: 0.08,
        COMMIT_DEBT_GAIN: 0.45,
        LANGUAGE_QUALITY_GAIN: 0.6,
        FRAMEWORK_QUALITY_GAIN: 1.8,
        UPGRADE_EFFECTS: {
            keyboard: { quality: -0.4, debt: 1.2 },
            monitor: { quality: 1.2, debt: -0.4 },
            coffee: { quality: -0.8, debt: 1.4 },
            vscode: { quality: 4.5, debt: -2.2 }
        },
        TEAM_EFFECTS: {
            junior: { quality: -0.4, debt: 0.8 },
            senior: { quality: 1.6, debt: -0.5 },
            qa: { quality: 5.5, debt: -3.2 },
            devops: { quality: 3.2, debt: -1.6 },
            architect: { quality: 6.5, debt: -4.2 },
            product: { quality: 1.8, debt: 0.6 }
        },
        STATES: {
            premium: {
                minQuality: 85,
                maxDebt: 20,
                label: 'Premium',
                badge: 'Alta confianza',
                description: 'El proyecto está limpio, confiable y listo para escalar.'
            },
            stable: {
                minQuality: 56,
                maxDebt: 45,
                label: 'Estable',
                badge: 'Buen ritmo',
                description: 'El stack se mantiene sano y responde bien al crecimiento.'
            },
            underPressure: {
                minQuality: 40,
                maxDebt: 65,
                label: 'Bajo presión',
                badge: 'Tensión media',
                description: 'Empiezan a aparecer atajos. Todavía puedes corregir sin drama.'
            },
            fragile: {
                minQuality: 25,
                maxDebt: 82,
                label: 'Frágil',
                badge: 'Riesgo alto',
                description: 'La base técnica se resiente. Conviene estabilizar antes de escalar.'
            },
            critical: {
                minQuality: 0,
                maxDebt: 100,
                label: 'Crítico',
                badge: 'Zona roja',
                description: 'El proyecto depende de parches y velocidad bruta. Necesita atención.'
            }
        }
    },
    RESPONSIBILITY: {
        MAX: 100,
        STARTING_VALUE: 58,
        PRESTIGE_BASELINE_PER_POINT: 1.2,
        PRESTIGE_BASELINE_CAP: 18,
        PRESTIGE_GAIN_PER_POINT: 0.02,
        PRESTIGE_GAIN_CAP: 0.24,
        PRESTIGE_LOSS_REDUCTION_PER_POINT: 0.025,
        PRESTIGE_LOSS_REDUCTION_CAP: 0.28,
        RELEASE: {
            EXPECTED_MULTIPLIER_SHIFT: 0.05,
            VOLATILITY_INFLUENCE: 0.32,
            LOW_TRUST_MAX: 41,
            HIGH_TRUST_MIN: 72,
            CLEAN_GAIN: 2,
            NORMAL_GAIN: 1,
            RISKY_LOSS: 2,
            UNSTABLE_LOSS: 4
        },
        TEAM: {
            STRAIN_BY_HEALTH_STATE: {
                premium: 0.02,
                stable: 0.05,
                underPressure: 0.12,
                fragile: 0.2,
                critical: 0.3
            },
            BASE_RESPONSIBILITY_BOOST: 0.08,
            BASE_RESPONSIBILITY_PENALTY: 0.1,
            POSITIVE_STRAIN_REDUCTION: 0.65,
            NEGATIVE_STRAIN_AMPLIFICATION: 0.55,
            SPECIALIST_HIGH_TRUST_BOOST: 0.18,
            SPECIALIST_LOW_TRUST_PENALTY: 0.12
        },
        STATES: {
            exemplary: {
                minValue: 82,
                label: 'Ejemplar',
                badge: 'Alta confianza',
                description: 'Cumples lo que prometes y el proyecto transmite liderazgo confiable.'
            },
            accountable: {
                minValue: 60,
                label: 'Responsable',
                badge: 'Buena señal',
                description: 'Gestionas bien expectativas y sostienes decisiones con criterio.'
            },
            strained: {
                minValue: 42,
                label: 'Exigida',
                badge: 'Tensión visible',
                description: 'Todavía mantienes control, pero ya empiezan a notarse promesas ajustadas.'
            },
            opportunistic: {
                minValue: 24,
                label: 'Oportunista',
                badge: 'Confianza inestable',
                description: 'El proyecto avanza, pero la forma de comprometerte empieza a pasar factura.'
            },
            negligent: {
                minValue: 0,
                label: 'Negligente',
                badge: 'Riesgo reputacional',
                description: 'Se acumulan promesas rotas, señales confusas y poca disciplina de ownership.'
            }
        }
    },
    RELEASE_HEALTH: {
        CLEAN_MIN_SCORE: 55,
        NORMAL_MIN_SCORE: 20,
        RISKY_MIN_SCORE: -12,
        BANDS: {
            clean: {
                label: 'Release limpia',
                riskLabel: 'Riesgo bajo',
                baseMultiplier: 1.18,
                volatility: 0.06,
                repBonus: 1,
                qualityShift: 4,
                debtShift: -5,
                tone: 'success'
            },
            normal: {
                label: 'Release sólida',
                riskLabel: 'Riesgo moderado',
                baseMultiplier: 1,
                volatility: 0.1,
                repBonus: 0,
                qualityShift: 1,
                debtShift: -1,
                tone: 'success'
            },
            risky: {
                label: 'Release arriesgada',
                riskLabel: 'Riesgo alto',
                baseMultiplier: 0.82,
                volatility: 0.18,
                repBonus: 0,
                qualityShift: -2,
                debtShift: 5,
                tone: 'warning'
            },
            unstable: {
                label: 'Release inestable',
                riskLabel: 'Riesgo crítico',
                baseMultiplier: 0.55,
                volatility: 0.28,
                repBonus: -1,
                qualityShift: -6,
                debtShift: 10,
                tone: 'warning'
            }
        }
    },
    MAINTENANCE: {
        BASE_COST: 2200,
        COST_PER_DEBT: 55,
        DURATION_MS: 18000,
        COOLDOWN_MS: 45000,
        QUALITY_RESTORE: 12,
        DEBT_REDUCTION: 16,
        CLICK_MULTIPLIER: 0.82,
        PASSIVE_MULTIPLIER: 0.72
    },
    
    // === IDIOMAS (PASIVA GENERATION) ===
    // Lenguajes con los que empieza una partida nueva y cada run tras un prestige.
    // No se aplican al cargar una partida guardada.
    STARTING_LANGUAGES: {
        javascript: 1
    },

    LANGUAGES: {
        javascript: {
            cost: 50,
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
            cost: 3,
            clickBoost: 0.18,
            passiveBoost: 0,
            releaseBoost: 0.12,
            clickDebtMultiplier: 0.9,
            responsibilityLossMultiplier: 0.92,
            desc: 'Tus respuestas antiguas te ahorran tiempo en cada click, reducen atajos torpes y amortiguan errores de criterio.'
        },
        copilot: {
            name: 'AI Copilot',
            icon: 'fas fa-wand-magic-sparkles',
            cost: 6,
            clickBoost: 0.24,
            passiveBoost: 0.12,
            releaseBoost: 0,
            clickQualityDecayMultiplier: 0.88,
            responsibilityGainMultiplier: 1.08,
            desc: 'Autocompleta, reduce el tiempo de entrega y ayuda a sostener decisiones más consistentes.'
        },
        ciPipeline: {
            name: 'Pipeline CI/CD',
            icon: 'fas fa-code-branch',
            cost: 10,
            clickBoost: 0,
            passiveBoost: 0.24,
            releaseBoost: 0.2,
            releaseHealthBonus: 8,
            responsibilityLossMultiplier: 0.88,
            responsibilityTrustRepBonus: 1,
            desc: 'El proyecto genera más valor mientras duerme y vuelve más creíble cada entrega.'
        },
        terminalFu: {
            name: 'Terminal Fu',
            icon: 'fas fa-terminal',
            cost: 15,
            clickBoost: 0.3,
            passiveBoost: 0,
            releaseBoost: 0.08,
            clickDebtMultiplier: 0.92,
            responsibilityGainMultiplier: 0.96,
            desc: 'Automatizas tareas a una velocidad absurda, pero no siempre mejora cómo gestionas expectativas.'
        },
        dockerCluster: {
            name: 'Docker Cluster',
            icon: 'fab fa-docker',
            cost: 22,
            clickBoost: 0,
            passiveBoost: 0.28,
            releaseBoost: 0.22,
            releaseHealthBonus: 6,
            responsibilityTrustRepBonus: 1,
            responsibilityTrustVolatilityMultiplier: 0.92,
            desc: 'Escalas el stack y las releases salen con menos drama y más confianza.'
        },
        observability: {
            name: 'Observability Suite',
            icon: 'fas fa-chart-column',
            cost: 30,
            clickBoost: 0.14,
            passiveBoost: 0.24,
            releaseBoost: 0.24,
            maintenanceCostMultiplier: 0.8,
            maintenanceQualityMultiplier: 1.12,
            releaseHealthBonus: 4,
            responsibilityGainMultiplier: 1.12,
            responsibilityLossMultiplier: 0.9,
            desc: 'Menos tiempo apagando incendios, más tiempo produciendo y más claridad para sostener ownership.'
        }
    },

    // === ESPECIALIZACIONES ===
    SPECIALIZATIONS: {
        frontend: {
            name: 'Frontend',
            icon: 'fas fa-window-maximize',
            desc: '+28% click, bonus a JavaScript/TypeScript y React. Iteras rápido, pero sostener compromiso cuesta más.',
            clickBoost: 0.28,
            passiveBoost: 0,
            clickQualityDecayMultiplier: 0.86,
            responsibilityLossMultiplier: 1.08,
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
            desc: '+24% pasiva, bonus a Python/Rust y Django. Más disciplina y releases más creíbles.',
            clickBoost: 0,
            passiveBoost: 0.24,
            releaseHealthBonus: 6,
            maintenanceCostMultiplier: 0.94,
            responsibilityLossMultiplier: 0.92,
            responsibilityTrustRepBonus: 1,
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
            desc: '+14% click, +28% pasiva y mejor provecho de Python. Gana flexibilidad, pero la responsabilidad sube más lento.',
            clickBoost: 0.14,
            passiveBoost: 0.28,
            clickDebtMultiplier: 0.88,
            responsibilityGainMultiplier: 0.95,
            responsibilityLossMultiplier: 1.04,
            languageBoosts: {
                python: 0.42,
                typescript: 0.24
            },
            frameworkBoosts: {}
        },
        devops: {
            name: 'DevOps',
            icon: 'fas fa-cloud',
            desc: '+32% pasiva y el equipo rinde mejor. Refuerza ownership, baja pérdidas de responsabilidad y estabiliza la confianza.',
            clickBoost: 0,
            passiveBoost: 0.32,
            maintenanceCostMultiplier: 0.82,
            maintenanceDebtReductionMultiplier: 1.18,
            releaseHealthBonus: 8,
            responsibilityGainMultiplier: 1.12,
            responsibilityLossMultiplier: 0.88,
            responsibilityTrustVolatilityMultiplier: 0.9,
            languageBoosts: {
                rust: 0.32,
                javascript: 0.2
            },
            frameworkBoosts: {}
        },
        mobile: {
            name: 'Mobile',
            icon: 'fas fa-mobile-alt',
            desc: '+22% click, +12% pasiva y bonus a Kotlin y TypeScript. Buena recuperación de responsabilidad tras iteraciones rápidas.',
            clickBoost: 0.22,
            passiveBoost: 0.12,
            clickDebtMultiplier: 0.9,
            maintenanceQualityMultiplier: 1.08,
            responsibilityGainMultiplier: 1.06,
            responsibilityTrustVolatilityMultiplier: 0.96,
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
                id: 'quality-gate',
                name: 'Quality Gate',
                desc: 'Sube la calidad del proyecto a {target}.',
                metric: 'quality',
                target: 72,
                minGain: 6, // el objetivo siempre queda al menos 6 puntos por encima del valor inicial
                maxTarget: 100,
                rewardCode: 3600,
                rewardRep: 0
            },
            {
                id: 'trust-signal',
                name: 'Señal Correcta',
                desc: 'Lleva la responsabilidad a {target}.',
                metric: 'responsibility',
                target: 64,
                minGain: 6,
                maxTarget: 100,
                rewardCode: 3800,
                rewardRep: 0
            },
            {
                id: 'first-refactor',
                name: 'Pagar Deuda',
                desc: 'Activa mantenimiento 1 vez.',
                metric: 'maintenanceCount',
                target: 1,
                rewardCode: 4200,
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
                id: 'healthy-ship',
                name: 'Ship sin Drama',
                desc: 'Publica 1 release limpia o estable.',
                metric: 'healthyReleaseCount',
                target: 1,
                rewardCode: 5200,
                rewardRep: 1
            },
            {
                id: 'trusted-release',
                name: 'Entrega Creíble',
                desc: 'Publica 1 release con confianza sólida o premium.',
                metric: 'trustedReleaseCount',
                target: 1,
                rewardCode: 5600,
                rewardRep: 1
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
                id: 'stable-ops',
                name: 'Operación Estable',
                desc: 'Mantén el proyecto sano durante 120s.',
                metric: 'healthySeconds',
                target: 120,
                rewardCode: 18000,
                rewardRep: 1
            },
            {
                id: 'rebuild-trust',
                name: 'Reconstruir Confianza',
                desc: 'Recupera responsabilidad 2 veces desde un estado débil.',
                metric: 'responsibilityRecoveryCount',
                target: 2,
                rewardCode: 21000,
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
                id: 'ownership-window',
                name: 'Ownership Sostenido',
                desc: 'Mantén responsabilidad alta durante 150s.',
                metric: 'highResponsibilitySeconds',
                target: 150,
                rewardCode: 29000,
                rewardRep: 2
            },
            {
                id: 'refactor-culture',
                name: 'Cultura de Refactor',
                desc: 'Completa 4 mantenimientos.',
                metric: 'maintenanceCount',
                target: 4,
                rewardCode: 24000,
                rewardRep: 1
            },
            {
                id: 'release-discipline',
                name: 'Disciplina de Release',
                desc: 'Publica 3 releases limpias o estables.',
                metric: 'healthyReleaseCount',
                target: 3,
                rewardCode: 28000,
                rewardRep: 2
            },
            {
                id: 'clean-room',
                name: 'Clean Room',
                desc: 'Publica 2 releases limpias.',
                metric: 'cleanReleaseCount',
                target: 2,
                rewardCode: 32000,
                rewardRep: 2
            },
            {
                id: 'credibility-run',
                name: 'Credibilidad Operativa',
                desc: 'Publica 3 releases con confianza sólida o premium.',
                metric: 'trustedReleaseCount',
                target: 3,
                rewardCode: 34000,
                rewardRep: 3
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
    // Si entre dos ticks pasan más segundos que esto (portátil suspendido,
    // pestaña congelada), el hueco se trata como progreso offline con tope.
    LIVE_TICK_GAP_SECONDS: 120,

    // === DURACIONES DE EVENTOS ===
    EVENT_DURATIONS: {
        codeReview: 20000, // 20s
        hackathon: 10000, // 10s
        coffeeBreak: 15000, // 15s
        hiringWave: 14000,
        technicalDebt: 18000,
        refactorBoost: 25000
    },
    TIMED_EFFECT_STATS: ['clickMultiplier', 'passiveMultiplier'],
    TIMED_EFFECT_MAX_FACTOR: 10, // tope de seguridad al cargar partidas

    // === RECOMPENSAS ESCALADAS ===
    // Las recompensas de código se expresan en segundos de producción pasiva
    // (calculateGeneration sin efectos temporales) con un mínimo fijo para el
    // early game, cuando la producción todavía es ~0.
    MISSION_REWARD: {
        // Si una misión no define rewardSeconds: rewardSeconds = rewardCode / CODE_PER_SECOND
        // (2.500 → ~62 s, 12.000 → 300 s, 34.000 → 850 s). rewardCode queda como mínimo.
        CODE_PER_SECOND: 40
    },
    EVENT_REWARDS: {
        documentation: { seconds: 30, min: 500 },
        trustedLaunch: { seconds: 60, min: 1200 },
        clientDeadlineAggressive: { seconds: 90, min: 4000 },
        clientDeadlineFallback: { seconds: 40, min: 1500 }
    },

    // === MISIONES ===
    MISSION_REROLL_COST: {
        short: { seconds: 30, min: 1500 },
        long: { seconds: 120, min: 6000 }
    },

    // === HITOS POR UNIDAD ===
    // Cada lenguaje y cada miembro del equipo duplica su producción base
    // al alcanzar estas cantidades (x2, x4, x8, x16).
    MILESTONES: {
        THRESHOLDS: [10, 25, 50, 100],
        MULTIPLIER: 2
    },

    // === ONBOARDING ===
    ONBOARDING: {
        CHECK_INTERVAL_MS: 1000, // frecuencia máxima de checkFeatureUnlocks() desde el loop
        // true: una feature solo se desbloquea cuando todas las anteriores de
        // FEATURE_UNLOCKS ya lo están (las pestañas salen en el orden de la lista).
        // false: cada una en cuanto cumple su condición (stats saldría con el primer click).
        SEQUENTIAL_UNLOCKS: true,
        // Máximo de features nuevas por chequeo: evita varios tips de golpe
        // cuando se cumplen varias condiciones a la vez.
        MAX_UNLOCKS_PER_CHECK: 1,
        TIP_DURATION_MS: 6000,
        WELCOME_HINT: '// Escribe código: haz click o presiona Espacio',
        EMPTY_PANEL: '// Aún no hay nada que gestionar: sigue escribiendo código.',
        NEW_BADGE: 'NEW',
        // Partidas guardadas antes del onboarding (sin unlockedFeatures):
        // si ya hicieron prestige lo han visto todo y se desbloquea todo;
        // si no, se desbloquea lo que ya cumple su condición. Nunca hay avisos.
        LEGACY_UNLOCK_ALL_IF_PRESTIGED: true
    },

    // Desbloqueo progresivo de pestañas y paneles, en orden.
    // condition: { metric, op, value } o { any: [condiciones] }.
    // Métricas: totalCode, commits, languagesOwned, technicalDebt, releaseCount,
    // prestigeProgress (totalCode / coste de prestige), achievementsUnlocked, prestigeLevel.
    // tabIds: botones de pestaña (index.html). panelIds: secciones dentro de una pestaña
    // compartida. Una pestaña se ve si alguna feature que la lista está desbloqueada.
    FEATURE_UNLOCKS: [
        {
            key: 'shop',
            tabIds: ['upgrades-tab', 'languages-tab'],
            condition: { metric: 'totalCode', op: '>=', value: 40 },
            goal: 'Escribe 40 líneas para abrir la tienda',
            tip: { type: 'feat', text: 'tienda abierta: los upgrades potencian el click y los lenguajes escriben código solos' }
        },
        {
            key: 'missions',
            tabIds: ['missions-tab'],
            condition: { metric: 'commits', op: '>=', value: 1 },
            goal: 'Haz tu primer commit',
            tip: { type: 'feat', text: 'misiones disponibles: objetivos cortos y largos con recompensa' }
        },
        {
            key: 'team',
            tabIds: ['passive-tab', 'meta-tab'],
            panelIds: ['teamContainer'],
            condition: { metric: 'languagesOwned', op: '>=', value: 3 },
            goal: 'Ten 3 lenguajes distintos',
            tip: { type: 'feat', text: 'equipo disponible en Meta: contrata devs que programan por ti' }
        },
        {
            key: 'releases',
            tabIds: ['lab-tab'],
            condition: { metric: 'commits', op: '>=', value: 5 },
            goal: 'Llega a 5 commits',
            tip: { type: 'feat', text: 'lab abierto: junta 10 commits y publica una release' }
        },
        {
            key: 'health',
            tabIds: ['health-tab'],
            condition: {
                any: [
                    { metric: 'technicalDebt', op: '>', value: 20 },
                    { metric: 'releaseCount', op: '>=', value: 1 }
                ]
            },
            goal: 'La deuda técnica supera 20',
            tip: { type: 'warn', text: 'la deuda técnica sube: vigila la salud del proyecto y refactoriza a tiempo' }
        },
        {
            key: 'prestige',
            tabIds: ['meta-tab'],
            panelIds: ['metaSummaryContainer'],
            condition: { metric: 'prestigeProgress', op: '>=', value: 0.5 },
            goal: 'Acércate al prestige',
            tip: { type: 'feat', text: 'prestige a la vista: reinicia la run a cambio de reputación permanente' }
        },
        {
            key: 'stats',
            tabIds: ['achievements-tab', 'stats-tab'],
            condition: { metric: 'achievementsUnlocked', op: '>=', value: 1 },
            goal: 'Consigue tu primer logro',
            tip: { type: 'feat', text: 'logros y estadísticas: desde aquí también puedes exportar tu partida' }
        },
        {
            key: 'specialization',
            tabIds: ['meta-tab'],
            panelIds: ['specializationContainer'],
            condition: { metric: 'prestigeLevel', op: '>=', value: 1 },
            goal: 'Haz tu primer prestige',
            tip: { type: 'feat', text: 'especializaciones: elige una ruta que potencie tu build' }
        }
    ],

    // Barra "// TODO:" bajo el contador de código. Se usa la primera regla que aplique.
    // Tipos:
    //   feature   → próxima feature bloqueada (en orden de FEATURE_UNLOCKS), salvo las de `skip`
    //   milestone → lenguaje más cerca de su próximo hito, si le faltan ≤ maxMissingUnits
    //   mission   → misión (onlyClaimable: solo si ya se puede cobrar; slot: fija la ranura)
    //   prestige  → prestige (onlyWhenAvailable: solo si ya da rep)
    // Plantillas: {name}, {target}, {multiplier}, {reward}.
    NEXT_GOAL_RULES: [
        // 'specialization' depende del primer prestige: la cubre la regla de prestige.
        { type: 'feature', skip: ['specialization'] },
        { type: 'milestone', maxMissingUnits: 5, label: '{name} x{multiplier}: llega a {target}' },
        { type: 'mission', onlyClaimable: true, label: 'cobra la misión "{name}"' },
        { type: 'prestige', onlyWhenAvailable: true, label: 'prestige disponible: +{reward} rep' },
        { type: 'mission', slot: 'short', label: 'misión "{name}"' },
        { type: 'prestige', onlyWhenAvailable: false, label: 'llega al prestige' }
    ],

    // === AUDIO ===
    // Buses de mezcla. bus, volume y pitchRange de cada sonido se leen de
    // SOUND_MANIFEST (assets/audio/sounds.js); aquí solo va la mezcla.
    // El volumen efectivo de un sonido = manifest.volume × bus × master.
    AUDIO_BUSES: {
        master: { volume: 1 },
        ui: { volume: 0.7 },
        sfx: { volume: 0.8 },
        music: { volume: 0.4 },
        ambient: { volume: 0.4 }
    },
    // Sliders del panel de sonido (0–100). El valor por defecto sale de AUDIO_BUSES.
    // "Música" controla también el bus ambient (aura de racha): no hay pistas de música todavía.
    AUDIO_SLIDERS: [
        { key: 'ui', label: 'Interfaz', buses: ['ui'] },
        { key: 'sfx', label: 'Efectos', buses: ['sfx'] },
        { key: 'music', label: 'Música', buses: ['music', 'ambient'] }
    ],
    AUDIO: {
        PRELOAD_BUSES_ON_INIT: ['ui'], // el resto se precarga tras la primera interacción
        // Limitador en el master (solo con Web Audio): evita saturar cuando se apilan sonidos.
        // Compresor (threshold/knee/ratio/attack/release) + recorte suave final:
        // lineal hasta KNEE_START y nunca por encima de CEILING (0.98 ≈ -0.2 dBFS).
        LIMITER: { threshold: -3, knee: 0, ratio: 20, attack: 0.002, release: 0.12, KNEE_START: 0.7, CEILING: 0.98 },
        // Teclado mecánico: pool de instancias de ui_click con perfil según el nivel del upgrade.
        KEYBOARD: {
            SOUND: 'ui_click',
            POOL_SIZE: 6, // máximo de teclas sonando a la vez; la más vieja se corta
            BASE: { volume: 0.55, rate: 1.06 }, // sin Teclado Mecánico
            PER_LEVEL: { volume: 0.05, rate: -0.025 }, // cada nivel: más cuerpo y tono más grave
            LIMITS: { volume: 0.9, rate: 0.9 },
            JITTER: 0.06 // ± variación de tono por pulsación
        },
        // Racha: aura en bucle (bus ambient) mientras la racha supera el umbral.
        STREAK_AURA: { SOUND: 'aura_loop', MIN_STREAK: 50, VOLUME: 0.5, FADE_MS: 600 },
        STREAK_CHORDS: [25, 50, 100] // coreografía 'streak' al alcanzar estas rachas
    },
    // Respaldo con ZzFX (parámetros de zzfx()). Se usa si los archivos de un sonido
    // fallan, o para sonidos que no existen en SOUND_MANIFEST. Los ids sin entrada
    // usan el respaldo de su bus.
    SOUND_FALLBACKS: {
        ui_click: [0.6, 0.05, 1400, 0, 0.005, 0.02, 1, 2],
        ui_error: [0.8, 0.05, 180, 0.01, 0.06, 0.16, 2, 1, -12],
        coin: [0.8, 0.05, 1500, 0, 0.03, 0.18, 1, 1.5, 0, 0, 400, 0.05],
        glitch_error: [0.8, 0.4, 320, 0, 0.06, 0.12, 3, 1, 0, 0, 0, 0, 0.02, 8, 0, 0.5],
        impact_heavy: [1, 0.05, 55, 0.01, 0.12, 0.7, 4, 2, -2, 0, 0, 0, 0, 1],
        braam: [1, 0.05, 70, 0.05, 0.6, 1.2, 2, 1.5, -1, 0, 0, 0, 0, 0.4],
        fanfare: [0.9, 0.05, 520, 0.01, 0.25, 0.4, 0, 1, 6, 0, 200, 0.1]
    },
    SOUND_FALLBACK_BY_BUS: {
        ui: [0.6, 0.05, 900, 0, 0.01, 0.04, 1],
        sfx: [0.8, 0.05, 420, 0.01, 0.08, 0.3, 0, 1, 5],
        music: null,
        ambient: null // un bucle sintético molestaría más que el silencio
    },

    // === FEEDBACK (coreografías audio + visual) ===
    FEEDBACK: {
        PRIORITIES: { small: 1, medium: 2, big: 3 },
        MEDIUM_MIN_GAP_MS: 1500, // dos medianos nunca se superponen: uno cada 1,5 s como mínimo
        MEDIUM_QUEUE_MAX: 2, // medianos en espera; el resto se descarta
        SHORT_AFTER_VIEWS: 3 // a partir de la 4.ª vez se usa la versión corta (si existe)
    },
    VISUAL_SETTINGS_DEFAULTS: {
        reduceMotion: null, // null = seguir prefers-reduced-motion del sistema
        shortCelebrations: false
    },

    // Coreografías: pasos { at (ms), sound, soundOptions, fx (objeto o lista), duck }.
    // Valores 'context.x' se leen del contexto que pasa quien la dispara
    // (x, y, element, text, from, to, banner...). Destinos: 'context', '#id', '.clase'.
    // Puntos: 'context' (x,y o centro del elemento), 'center' o un selector.
    CHOREOGRAPHIES: {
        purchase: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'ui_confirm', fx: { type: 'pulse', target: 'context', scale: 1.06, ms: 220 } }
            ]
        },
        purchase_fail: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'ui_error', fx: { type: 'shake', target: 'context', intensity: 0.35, ms: 220 } }
            ]
        },
        keyboard_upgrade: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'ui_click', soundOptions: { pitch: -2 } },
                { at: 45, sound: 'ui_click', soundOptions: { pitch: 2 } },
                { at: 90, sound: 'ui_confirm', fx: { type: 'pulse', target: 'context', scale: 1.06, ms: 220 } }
            ]
        },
        commit: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'ui_pop', fx: [
                    { type: 'pulse', target: '#clickBtn', scale: 1.12, ms: 300 },
                    { type: 'glow', target: '.progress-section .progress', color: 'rgba(0, 255, 136, 0.9)', ms: 400 }
                ] }
            ]
        },
        event_good: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'ui_beep', fx: { type: 'flash', color: 'rgba(0, 212, 255, 0.18)', ms: 380 } }
            ]
        },
        event_bad: {
            priority: 'medium',
            steps: [
                { at: 0, sound: 'glitch_error', fx: [
                    { type: 'flash', color: 'rgba(255, 0, 80, 0.25)', ms: 300 },
                    { type: 'shake', intensity: 0.5, ms: 280 }
                ] },
                { at: 120, sound: 'crack', fx: { type: 'crack', target: '#clickBtn', point: '#clickBtn' } }
            ],
            short: [
                { at: 0, sound: 'glitch_error', fx: { type: 'flash', color: 'rgba(255, 0, 80, 0.2)', ms: 260 } }
            ]
        },
        decision: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'ui_decode' }
            ]
        },
        maintenance: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'whoosh', fx: { type: 'flash', color: 'rgba(0, 150, 255, 0.16)', ms: 420 } }
            ]
        },
        achievement: {
            priority: 'medium',
            steps: [
                { at: 0, sound: 'powerup', fx: { type: 'flash', color: 'rgba(255, 215, 0, 0.18)', ms: 360 } },
                { at: 60, fx: { type: 'burst', preset: 'confettiExplosions', point: 'center', ms: 1600 } }
            ],
            short: [
                { at: 0, sound: 'powerup', fx: { type: 'flash', color: 'rgba(255, 215, 0, 0.14)', ms: 300 } }
            ]
        },
        mission: {
            priority: 'medium',
            steps: [
                { at: 0, sound: 'mission', fx: { type: 'pulse', target: 'context', scale: 1.05, ms: 260 } },
                { at: 80, fx: { type: 'odometer', target: '#codeDisplay', from: 'context.from', to: 'context.to', ms: 900, tick: true } },
                { at: 80, fx: { type: 'odometer', target: '#currentCodeHeader', from: 'context.from', to: 'context.to', ms: 900 } }
            ]
        },
        unlock: {
            priority: 'medium',
            steps: [
                { at: 0, sound: 'reveal_arp', fx: { type: 'flash', color: 'rgba(0, 255, 136, 0.12)', ms: 420 } },
                { at: 40, sound: 'ui_decode', soundOptions: { volume: 0.6 }, fx: { type: 'scramble', target: 'context', text: 'context.text', ms: 900 } }
            ],
            short: [
                { at: 0, sound: 'reveal_arp', fx: { type: 'scramble', target: 'context', text: 'context.text', ms: 500 } }
            ]
        },
        milestone: {
            priority: 'medium',
            steps: [
                { at: 0, sound: 'metal_hit', fx: [
                    { type: 'shake', intensity: 0.45, ms: 160 },
                    { type: 'flash', color: 'rgba(0, 212, 255, 0.2)', ms: 300 }
                ] },
                { at: 0, sound: 'crack', soundOptions: { volume: 0.5 }, fx: { type: 'crack', target: 'context', point: 'context' } },
                { at: 90, sound: 'confetti_whoosh', fx: { type: 'burst', preset: 'confettiExplosions', point: 'context', ms: 1500 } },
                { at: 90, fx: { type: 'banner', text: 'context.banner', tone: 'accent', ms: 1300 } }
            ],
            short: [
                { at: 0, sound: 'metal_hit', fx: [
                    { type: 'flash', color: 'rgba(0, 212, 255, 0.16)', ms: 280 },
                    { type: 'pulse', target: 'context', scale: 1.08, ms: 260 }
                ] }
            ]
        },
        streak: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'streak_chord', soundOptions: { pitch: 'context.pitch' }, fx: { type: 'pulse', target: '#streak', scale: 1.4, ms: 320 } }
            ]
        },
        golden_spawn: {
            priority: 'small',
            steps: [
                { at: 0, sound: 'coin', soundOptions: { volume: 0.6 } }
            ]
        },
        golden_claim: {
            priority: 'medium',
            steps: [
                { at: 0, sound: 'coin', soundOptions: { pitch: 0 }, fx: { type: 'flash', color: 'rgba(255, 215, 0, 0.2)', ms: 260 } },
                { at: 90, sound: 'coin', soundOptions: { pitch: 4 } },
                { at: 180, sound: 'coin', soundOptions: { pitch: 7 } },
                { at: 260, sound: 'coin_burst', fx: { type: 'burst', preset: 'confettiExplosions', point: 'context', ms: 1300, colors: ['#ffd700', '#ffb703', '#fff3b0'] } },
                { at: 260, fx: { type: 'odometer', target: '#codeDisplay', from: 'context.from', to: 'context.to', ms: 800, tick: true } },
                { at: 260, fx: { type: 'odometer', target: '#currentCodeHeader', from: 'context.from', to: 'context.to', ms: 800 } }
            ],
            short: [
                { at: 0, sound: 'coin_burst', fx: { type: 'flash', color: 'rgba(255, 215, 0, 0.18)', ms: 260 } }
            ]
        },
        release_clean: {
            priority: 'big',
            steps: [
                { at: 0, sound: 'riser_short', duck: { bus: 'ambient', amount: 0.3, ms: 2600 } },
                { at: 0, fx: { type: 'scramble', target: '#labReleaseVersion', text: 'context.version', ms: 700 } },
                { at: 700, sound: 'rocket', soundOptions: { volume: 0.7 } },
                { at: 1100, sound: 'impact_light', fx: [
                    { type: 'flash', color: 'rgba(255, 255, 255, 0.35)', ms: 300 },
                    { type: 'shake', intensity: 0.4, ms: 200 }
                ] },
                { at: 1100, sound: 'fireworks', fx: { type: 'burst', preset: 'fireworks', point: 'center', ms: 2600 } },
                { at: 1250, sound: 'fanfare_small', fx: { type: 'banner', text: 'context.banner', tone: 'accent', ms: 1500 } }
            ],
            short: [
                { at: 0, sound: 'fanfare_small', fx: [
                    { type: 'flash', color: 'rgba(0, 255, 136, 0.16)', ms: 320 },
                    { type: 'scramble', target: '#labReleaseVersion', text: 'context.version', ms: 400 }
                ] }
            ]
        },
        release_normal: {
            priority: 'medium',
            steps: [
                { at: 0, sound: 'fanfare_small', fx: [
                    { type: 'flash', color: 'rgba(0, 212, 255, 0.16)', ms: 320 },
                    { type: 'scramble', target: '#labReleaseVersion', text: 'context.version', ms: 600 }
                ] },
                { at: 120, fx: { type: 'burst', preset: 'confettiExplosions', point: 'center', ms: 1300 } }
            ],
            short: [
                { at: 0, sound: 'fanfare_small', fx: { type: 'scramble', target: '#labReleaseVersion', text: 'context.version', ms: 400 } }
            ]
        },
        release_unstable: {
            priority: 'medium',
            steps: [
                { at: 0, sound: 'glitch_error', fx: [
                    { type: 'flash', color: 'rgba(255, 0, 80, 0.28)', ms: 320 },
                    { type: 'shake', intensity: 0.6, ms: 320 },
                    { type: 'scramble', target: '#labReleaseVersion', text: 'context.version', ms: 600, chars: '!<>-_\\/[]{}—=+*^?#' }
                ] },
                { at: 150, sound: 'crack', fx: { type: 'crack', target: '#labReleaseVersion', point: '#labReleaseVersion' } }
            ],
            short: [
                { at: 0, sound: 'glitch_error', fx: { type: 'scramble', target: '#labReleaseVersion', text: 'context.version', ms: 400 } }
            ]
        },
        prestige: {
            priority: 'big',
            steps: [
                { at: 0, sound: 'riser_long', duck: { bus: 'ambient', amount: 0.1, ms: 5200 }, fx: { type: 'slowmo', factor: 0.35, ms: 1100 } },
                { at: 0, sound: 'drone_low', soundOptions: { volume: 0.6 } },
                { at: 1200, sound: 'braam', fx: [
                    { type: 'freeze', ms: 140 },
                    { type: 'flash', color: 'rgba(255, 255, 255, 0.55)', ms: 500 },
                    { type: 'shake', intensity: 1, ms: 520 }
                ] },
                { at: 1200, sound: 'sub_drop' },
                { at: 1250, sound: 'shatter', fx: { type: 'shards', point: 'center', count: 26 } },
                { at: 1450, sound: 'fireworks', fx: { type: 'burst', preset: 'fireworks', point: 'center', ms: 3000 } },
                { at: 1500, sound: 'fanfare', fx: { type: 'banner', text: 'context.banner', tone: 'gold', ms: 2200 } },
                { at: 1600, fx: { type: 'scramble', target: '#prestigePoints', text: 'context.points', ms: 900 } },
                { at: 3200, sound: 'reveal_chord', soundOptions: { volume: 0.7 } }
            ],
            short: [
                { at: 0, sound: 'braam', soundOptions: { volume: 0.8 }, fx: [
                    { type: 'flash', color: 'rgba(255, 255, 255, 0.4)', ms: 420 },
                    { type: 'shake', intensity: 0.6, ms: 300 }
                ] },
                { at: 100, sound: 'fanfare_small', fx: { type: 'banner', text: 'context.banner', tone: 'gold', ms: 1500 } },
                { at: 150, fx: { type: 'scramble', target: '#prestigePoints', text: 'context.points', ms: 500 } }
            ]
        }
    },

    // === COMMIT DORADO ===
    GOLDEN_COMMIT: {
        MIN_INTERVAL_MS: 60000,
        MAX_INTERVAL_MS: 180000,
        LIFETIME_MS: 13000,
        REWARDS: [
            {
                type: 'code',
                weight: 6,
                minSeconds: 60,
                maxSeconds: 300,
                // Para builds de clicks: nunca menos que estos clicks a potencia actual
                minClicks: 25,
                maxClicks: 120
            },
            {
                type: 'frenzy',
                weight: 3,
                factor: 7,
                durationMs: 12000
            },
            {
                type: 'release',
                weight: 2,
                commits: 3
            }
        ]
    },

    // === LOCAL STORAGE ===
    SAVE_KEY: 'codeIdleGame',
    SAVE_VERSION: 3, // v3: unlockedFeatures, seenTips y newTabBadges
    OFFLINE_MIN_SECONDS: 30
};

console.log('✅ CONFIG loaded');
