/**
 * MODULES/EDITOR.JS - Editor fake y preview de código
 * Responsabilidad: Manejar tabs, preview, highlighting y estado visual del editor
 */

const editorModule = {
    previewLanguageKey: 'javascript',
    activeEditorFileId: 'language:javascript',
    tabsSignature: '',
    previewSignature: '',

    init() {
        this.sync();
    },

    sync() {
        const activeChanged = this.syncTabs();
        this.updateCodePreview(activeChanged);
        this.updateStatus();
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

    setPreviewLanguage(languageKey) {
        this.previewLanguageKey = languageKey;
        this.activeEditorFileId = `language:${languageKey}`;
        this.sync();
    },

    setPreviewFramework(frameworkKey) {
        const framework = gameState.frameworks[frameworkKey];
        if (!framework) return;

        this.previewLanguageKey = framework.requires;
        this.activeEditorFileId = `framework:${frameworkKey}`;
        this.sync();
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

    syncTabs() {
        const tabsContainer = document.getElementById('editorTabs');
        if (!tabsContainer) return false;

        const files = this.getEditorFiles();
        const availableIds = files.map(file => file.id);
        let activeChanged = false;

        if (!availableIds.includes(this.activeEditorFileId)) {
            this.activeEditorFileId = files[files.length - 1].id;
            const nextFile = this.getActiveEditorFile();
            this.previewLanguageKey = nextFile.parentLanguageKey;
            activeChanged = true;
        }

        const nextSignature = JSON.stringify({
            active: this.activeEditorFileId,
            files: files.map(file => ({ id: file.id, fileName: file.fileName, icon: file.icon }))
        });

        if (this.tabsSignature === nextSignature) {
            return activeChanged;
        }

        this.tabsSignature = nextSignature;

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
                this.sync();
            });
        });

        return true;
    },

    renderCode(code) {
        const container = document.getElementById('codeEditorContent');
        if (!container) return;

        const activeFile = this.getActiveEditorFile();
        const languageKey = activeFile?.parentLanguageKey || 'javascript';
        const fileType = activeFile?.type || 'language';
        const syntaxKey = activeFile?.key || languageKey;
        const lines = code.split('\n');

        container.dataset.editorLanguage = `${fileType}:${syntaxKey}`;
        container.innerHTML = lines.map((line, index) => `
            <div class="code-line ${line.trim() ? '' : 'is-empty'}">
                <span class="line-num">${index + 1}</span>
                <span class="code">${this.highlightLine(line, languageKey, fileType, syntaxKey)}</span>
            </div>
        `).join('');
    },

    escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    getKeywords(languageKey, fileType, syntaxKey) {
        const shared = ['return', 'const', 'let', 'var', 'function', 'class', 'export', 'import', 'from', 'if', 'else', 'for', 'while', 'new', 'true', 'false', 'null'];
        const byLanguage = {
            javascript: [...shared, 'async', 'await'],
            typescript: [...shared, 'type', 'interface', 'number', 'string'],
            python: ['def', 'return', 'class', 'if', 'else', 'elif', 'for', 'while', 'import', 'from', 'None', 'True', 'False', 'in'],
            rust: ['pub', 'fn', 'let', 'mut', 'return', 'struct', 'impl'],
            go: ['func', 'return', 'type', 'struct', 'package'],
            java: ['public', 'class', 'static', 'int', 'return', 'new'],
            csharp: ['public', 'class', 'static', 'int', 'return', 'new'],
            kotlin: ['object', 'fun', 'return', 'val'],
            php: ['function', 'return', 'array', 'use'],
            react: [...shared, 'default', 'useState'],
            vue: ['const', 'ref'],
            django: ['from', 'import', 'class', 'return'],
            nextjs: [...shared, 'default', 'async'],
            fastapi: ['from', 'import', 'def', 'return'],
            spring: ['public', 'class', 'return', 'new'],
            dotnet: ['public', 'class', 'return', 'new'],
            laravel: ['use', 'function', 'return']
        };

        const keywordKey = fileType === 'framework' ? syntaxKey : languageKey;
        return byLanguage[keywordKey] || byLanguage[languageKey] || shared;
    },

    highlightLine(line, languageKey, fileType, syntaxKey) {
        if (!line) {
            return '&nbsp;';
        }

        const placeholders = [];
        const stash = (html) => `__TOKEN_${placeholders.push(html) - 1}__`;
        const restore = (value) => value.replace(/__TOKEN_(\d+)__/g, (_, index) => placeholders[Number(index)] || '');

        let highlighted = this.escapeHtml(line);
        const keywords = this.getKeywords(languageKey, fileType, syntaxKey).join('|');

        highlighted = highlighted.replace(/(&lt;\?php|\?&gt;|&lt;\/?[a-zA-Z][^\s&]*?&gt;)/g, (match) => stash(`<span class="code-token tag">${match}</span>`));
        highlighted = highlighted.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, (match) => stash(`<span class="code-token string">${match}</span>`));
        highlighted = highlighted.replace(/(\/\/.*$|#.*$)/g, (match) => stash(`<span class="code-token comment">${match}</span>`));
        highlighted = highlighted.replace(new RegExp(`\\b(${keywords})\\b`, 'g'), '<span class="code-token keyword">$1</span>');
        highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-token number">$1</span>');
        highlighted = highlighted.replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, '<span class="code-token type">$1</span>');
        highlighted = highlighted.replace(/\b([a-zA-Z_$][\w$]*)(?=\s*\()/g, '<span class="code-token function">$1</span>');

        return restore(highlighted);
    },

    updateCodePreview(force = false) {
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

        const nextPreviewSignature = `${activeFile.id}::${newCode}`;
        if (!force && this.previewSignature === nextPreviewSignature) {
            return;
        }

        if (typeof gsap !== 'undefined') {
            gsap.fromTo(editorContent, { opacity: 0.35 }, { opacity: 1, duration: 0.26, ease: 'power1.inOut' });
        }

        this.renderCode(newCode);
        this.previewSignature = nextPreviewSignature;
    },

    updateStatus() {
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
        runtimeMeta.textContent = `${gameState.commits.toLocaleString()} commits · ${Math.floor(gameState.totalCode).toLocaleString()} líneas totales · +${gameState.calculateGeneration().toFixed(1)}/s`;
    },

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
            'framework:laravel': `<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n\nRoute::get('/build', function () {\n    return response()->json(['status' => 'ready']);\n});`
        };

        return snippets[file.id] || `// Generando código para ${file.name}...`;
    },

    animateLanguageChange(languageName, frameworkName = null) {
        const codePreview = document.getElementById('codeEditorContent');
        const editorMock = document.querySelector('.editor-mock');
        if (!codePreview || typeof gsap === 'undefined') return;

        if (editorMock) {
            gsap.fromTo(editorMock,
                { backgroundColor: 'rgba(0, 212, 255, 0.15)' },
                { backgroundColor: 'rgba(0, 212, 255, 0)', duration: 0.6, ease: 'power2.out', clearProps: 'backgroundColor' });
        }

        // Pequeño temblor del código (no en movimiento reducido).
        if (!fxModule.isReducedMotion()) {
            gsap.fromTo(codePreview, { x: -10 }, {
                keyframes: { x: [10, -5, 5, 0] },
                duration: 0.3,
                ease: 'power2.out',
                clearProps: 'transform'
            });
        }

        gsap.fromTo('.editor-header',
            { boxShadow: '0 0 0 0 rgba(0, 212, 255, 0.5)' },
            { boxShadow: '0 0 20px 10px rgba(0, 212, 255, 0)', duration: 0.6, ease: 'power2.out', clearProps: 'boxShadow' });
    }
};

console.log('✅ EDITOR MODULE loaded');