/**
 * Ollama Local Wrapper - SPA Application
 * Main application script for the browser-based Ollama wrapper
 */

// Global Configuration Object
const DefaultOllamaConfig = {
    apiEndpoint: 'http://127.0.0.1:11434',
    modelManifestUrl: 'manifest.json',
    fetchRetries: 2,
    fetchRetryDelayMs: 450,
    fetchTimeoutMs: 4000,

    libraryUrl: null,
    pullTimeoutMs: 30 * 60 * 1000,

    defaultModel: 'llama2',
    defaultTemperature: 0.7,
    defaultMaxTokens: 512,

    // Embedded cloud models (fallback when manifest.json unavailable)
    embeddedCloudModels: [
        {
            "name": "mistral-large-3:675b-cloud",
            "description": "Mistral Large 3 - Multimodal MoE model for production-grade tasks (675B)",
            "endpoint": "http://127.0.0.1:11434"
        },
        {
            "name": "ministral-3:14b-cloud",
            "description": "Ministral 3 14B - Efficient edge deployment model by Mistral",
            "endpoint": "http://127.0.0.1:11434"
        },
        {
            "name": "cogito-2.1:671b-cloud",
            "description": "Cogito v2.1 - Instruction-tuned generative model (MIT licensed)",
            "endpoint": "http://127.0.0.1:11434"
        },
        {
            "name": "deepseek-v3.1:671b-cloud",
            "description": "DeepSeek-V3.1 - Hybrid model supporting thinking mode and non-thinking mode",
            "endpoint": "http://127.0.0.1:11434"
        },
        {
            "name": "gpt-oss:20b-cloud",
            "description": "GPT-OSS 20B - OpenAI's open-weight model for reasoning and coding",
            "endpoint": "http://127.0.0.1:11434"
        },
        {
            "name": "gpt-oss:120b-cloud",
            "description": "GPT-OSS 120B - Large version for advanced reasoning tasks",
            "endpoint": "http://127.0.0.1:11434"
        },
        {
            "name": "qwen3-coder:480b-cloud",
            "description": "Qwen3-Coder 480B - Alibaba's performant model for agentic and coding tasks",
            "endpoint": "http://127.0.0.1:11434"
        },
        {
            "name": "gemini-3-pro-preview:latest",
            "description": "Google Gemini 3 Pro Preview - Advanced reasoning and multimodal understanding",
            "endpoint": "http://127.0.0.1:11434"
        }
    ],

    // Method to update config from manifest or external source
    loadFromManifest(manifestData) {
        if (manifestData && typeof manifestData === 'object') {
            Object.assign(this, manifestData);
        }
    },

    // Method to get current config
    getConfig() {
        return {
            apiEndpoint: this.apiEndpoint,
            modelManifestUrl: this.modelManifestUrl,
            libraryUrl: this.libraryUrl,
            pullTimeoutMs: this.pullTimeoutMs,
            fetchRetries: this.fetchRetries,
            fetchRetryDelayMs: this.fetchRetryDelayMs,
            fetchTimeoutMs: this.fetchTimeoutMs,
            defaultModel: this.defaultModel,
            defaultTemperature: this.defaultTemperature,
            defaultMaxTokens: this.defaultMaxTokens,
        };
    },
};

const existingConfig = window.OllamaConfig && typeof window.OllamaConfig === 'object' ? window.OllamaConfig : {};
window.OllamaConfig = {
    ...DefaultOllamaConfig,
    ...existingConfig,
};

window.OllamaConfig.loadFromManifest = DefaultOllamaConfig.loadFromManifest;
window.OllamaConfig.getConfig = DefaultOllamaConfig.getConfig;

// History Storage Helper
class HistoryStorage {
    constructor() {
        this.storageKey = 'ollama-chat-history';
        this.maxMessages = typeof window.OllamaConfig?.maxHistoryMessages === 'number' ? window.OllamaConfig.maxHistoryMessages : 1000;
        this.historyPath = window.OllamaConfig?.historyPath || null;
    }

    save(messages) {
        try {
            const messagesToSave = messages.slice(-this.maxMessages);
            const payload = JSON.stringify(messagesToSave);
            
            if (this.historyPath) {
                console.warn('Desktop storage via historyPath not yet implemented in browser context');
            } else {
                localStorage.setItem(this.storageKey, payload);
            }
        } catch (err) {
            console.error('Failed to save chat history:', err);
        }
    }

    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return [];
            
            const messages = JSON.parse(stored);
            if (!Array.isArray(messages)) return [];
            
            return messages;
        } catch (err) {
            console.error('Failed to load chat history:', err);
            return [];
        }
    }

    clear() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (err) {
            console.error('Failed to clear chat history:', err);
        }
    }
}

// Application State
const AppState = {
    currentModel: null,
    temperature: window.OllamaConfig.defaultTemperature,
    maxTokens: window.OllamaConfig.defaultMaxTokens,
    isLoading: false,
    isRefreshingModels: false,
    isStreaming: false,

    messages: [],
    pendingImages: [],

    availableModels: [],

    libraryCatalogModels: [],
    librarySearchQuery: '',
    activeModelPulls: {},
    activeModelDeletes: {},

    // For cancelling streaming requests
    abortController: null,
};

// Initialize History Storage
const historyStorage = new HistoryStorage();

// Theme Manager
class ThemeManager {
    constructor() {
        this.storageKey = 'ollama-theme';
        this.currentTheme = null;
    }

    initialize() {
        this.currentTheme = this.loadTheme();
        this.applyTheme(this.currentTheme);
        this.setupToggleListener();
    }

    loadTheme() {
        // Try localStorage first
        const stored = localStorage.getItem(this.storageKey);
        if (stored && (stored === 'light' || stored === 'dark')) {
            return stored;
        }

        // Fall back to config
        if (window.OllamaConfig.defaultTheme && 
            (window.OllamaConfig.defaultTheme === 'light' || window.OllamaConfig.defaultTheme === 'dark')) {
            return window.OllamaConfig.defaultTheme;
        }

        // Fall back to system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }

        // Default to dark
        return 'dark';
    }

    applyTheme(theme) {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.updateToggleIcon(theme);
    }

    updateToggleIcon(theme) {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;

        const icon = toggle.querySelector('i');
        const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
        
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('title', label);

        if (icon) {
            if (theme === 'dark') {
                icon.className = 'bi bi-sun';
            } else {
                icon.className = 'bi bi-moon-stars';
            }
        }
    }

    toggle() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        localStorage.setItem(this.storageKey, newTheme);
    }

    setupToggleListener() {
        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.addEventListener('click', () => this.toggle());
        }
    }
}

const themeManager = new ThemeManager();

// DOM Elements Cache
const DOMElements = {
    app: null,
    modelSelect: null,
    refreshModelsButton: null,
    modelProvenance: null,
    modelDescription: null,
    errorBanner: null,

    installedModelsList: null,
    installedModelsWarning: null,
    installedModelsCountText: null,

    temperatureSlider: null,
    temperatureValue: null,
    maxTokensInput: null,
    chatTranscript: null,
    messageForm: null,
    messageInput: null,
    sendButton: null,
    stopButton: null,
    clearChatButton: null,
    statusText: null,
    tokenCount: null,
    attachImageButton: null,
    imageInput: null,
    thumbnailStrip: null,

    librarySearchInput: null,
    libraryTableBody: null,
    libraryCountText: null,
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeModelName(name) {
    return String(name || '').trim().toLowerCase();
}

function normalizeBaseUrl(baseUrl) {
    const url = String(baseUrl || '').trim();
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildOllamaUrl(pathname) {
    const base = normalizeBaseUrl(window.OllamaConfig.apiEndpoint);
    return new URL(pathname, base + '/').toString();
}

function buildOllamaUrlForBase(baseUrl, pathname) {
    const base = normalizeBaseUrl(baseUrl);
    return new URL(pathname, base + '/').toString();
}

async function fetchWithTimeout(url, options = {}) {
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : window.OllamaConfig.fetchTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchJsonWithRetry(url, options = {}) {
    const retries = typeof options.retries === 'number' ? options.retries : window.OllamaConfig.fetchRetries;
    const retryDelayMs =
        typeof options.retryDelayMs === 'number' ? options.retryDelayMs : window.OllamaConfig.fetchRetryDelayMs;

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await fetchWithTimeout(url, options);
            if (!response.ok) {
                throw new Error(`Request failed: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                await sleep(retryDelayMs * Math.pow(2, attempt));
            }
        }
    }

    throw lastError;
}

function setErrorBanner(message, variant = 'danger') {
    if (!DOMElements.errorBanner) return;

    if (!message) {
        DOMElements.errorBanner.textContent = '';
        DOMElements.errorBanner.className = 'alert alert-danger d-none mx-3 mt-3 mb-0';
        return;
    }

    DOMElements.errorBanner.textContent = message;
    DOMElements.errorBanner.className = `alert alert-${variant} mx-3 mt-3 mb-0`;
}

function setRefreshModelsButtonLoading(isLoading) {
    if (!DOMElements.refreshModelsButton) return;

    DOMElements.refreshModelsButton.disabled = isLoading;
    DOMElements.refreshModelsButton.innerHTML = isLoading
        ? '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Refreshing'
        : 'Refresh';
}

function setModelSelectLoading(isLoading, label = 'Loading models...') {
    if (!DOMElements.modelSelect) return;

    DOMElements.modelSelect.disabled = isLoading;

    if (!isLoading) return;

    DOMElements.modelSelect.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.disabled = true;
    option.selected = true;
    option.textContent = label;
    DOMElements.modelSelect.appendChild(option);
}

function setModelMeta(model) {
    if (DOMElements.modelProvenance) {
        DOMElements.modelProvenance.innerHTML = '';

        if (model && Array.isArray(model.sources)) {
            for (const source of model.sources) {
                const badge = document.createElement('span');
                badge.className = source === 'local' ? 'badge bg-success' : 'badge bg-primary';
                badge.textContent = source === 'local' ? 'Local' : 'Cloud';
                DOMElements.modelProvenance.appendChild(badge);
            }
        }
    }

    if (DOMElements.modelDescription) {
        if (!model) {
            DOMElements.modelDescription.textContent = '';
            return;
        }

        const parts = [];
        if (model.description) parts.push(model.description);
        if (model.endpoint && model.sources.includes('cloud')) parts.push(`Endpoint: ${model.endpoint}`);
        DOMElements.modelDescription.textContent = parts.join(' • ');
    }
}

function getModelByName(name) {
    const needle = normalizeModelName(name);
    return AppState.availableModels.find((m) => normalizeModelName(m.name) === needle) || null;
}

async function fetchLocalModels() {
    const url = buildOllamaUrl('/api/tags');
    const data = await fetchJsonWithRetry(url, {
        retries: window.OllamaConfig.fetchRetries,
        retryDelayMs: window.OllamaConfig.fetchRetryDelayMs,
        timeoutMs: window.OllamaConfig.fetchTimeoutMs,
    });

    const models = Array.isArray(data?.models) ? data.models : [];

    return models
        .filter((m) => m && m.name)
        .map((m) => {
            const details = m.details || {};
            const detailParts = [];
            if (details.family) detailParts.push(details.family);
            if (details.parameter_size) detailParts.push(details.parameter_size);
            if (details.quantization_level) detailParts.push(details.quantization_level);

            return {
                name: m.name,
                description: detailParts.length > 0 ? detailParts.join(' ') : undefined,
                sources: ['local'],
            };
        });
}

async function fetchCloudModelsFromManifest() {
    const manifestUrl = String(window.OllamaConfig.modelManifestUrl || 'manifest.json').trim();

    try {
        const data = await fetchJsonWithRetry(manifestUrl, {
            retries: 0,
            timeoutMs: window.OllamaConfig.fetchTimeoutMs,
        });

        const models = Array.isArray(data?.cloudModels) ? data.cloudModels : [];

        return models
            .filter((m) => m && m.name)
            .map((m) => ({
                name: m.name,
                description: m.description,
                endpoint: m.endpoint,
                sources: ['cloud'],
            }));
    } catch (err) {
        console.warn('Failed to load manifest.json, using embedded cloud models:', err);
        // Fallback to embedded cloud models when manifest.json cannot be fetched
        return (window.OllamaConfig.embeddedCloudModels || [])
            .map((m) => ({
                name: m.name,
                description: m.description,
                endpoint: m.endpoint,
                sources: ['cloud'],
            }));
    }
}

function mergeModels(localModels, cloudModels) {
    const merged = new Map();

    const upsert = (model, source) => {
        const key = normalizeModelName(model.name);
        const existing = merged.get(key);

        if (!existing) {
            merged.set(key, {
                name: model.name,
                description: model.description,
                endpoint: model.endpoint,
                sources: [source],
            });
            return;
        }

        if (!existing.sources.includes(source)) {
            existing.sources.push(source);
        }

        if (source === 'local') {
            existing.name = model.name;
        }

        if (!existing.description && model.description) {
            existing.description = model.description;
        }

        if (!existing.endpoint && model.endpoint) {
            existing.endpoint = model.endpoint;
        }
    };

    for (const model of cloudModels) upsert(model, 'cloud');
    for (const model of localModels) upsert(model, 'local');

    const list = Array.from(merged.values());

    list.sort((a, b) => {
        const aLocal = a.sources.includes('local');
        const bLocal = b.sources.includes('local');

        if (aLocal !== bLocal) return aLocal ? -1 : 1;

        return a.name.localeCompare(b.name);
    });

    return list;
}

function coerceLibraryPayloadToEntries(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.models)) return payload.models;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
}

function normalizeLibraryCatalogEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const name = entry.name || entry.model || entry.id;
    if (!name) return null;

    const tags = Array.isArray(entry.tags)
        ? entry.tags.filter(Boolean).map((t) => String(t))
        : typeof entry.tags === 'string'
            ? entry.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [];

    return {
        name,
        description: entry.description || entry.summary || entry.title || '',
        tags,
        family: entry.family || entry.details?.family,
        parameterSize: entry.parameter_size || entry.parameterSize || entry.details?.parameter_size,
        pulls: entry.pulls || entry.pull_count || entry.pullCount,
        updatedAt: entry.updated_at || entry.updatedAt,
        endpoint: entry.endpoint,
    };
}

async function fetchLibraryModelsFromEndpoint() {
    const libraryUrl = String(window.OllamaConfig.libraryUrl || '').trim();
    if (!libraryUrl) return [];

    try {
        const data = await fetchJsonWithRetry(libraryUrl, {
            retries: 0,
            timeoutMs: window.OllamaConfig.fetchTimeoutMs,
        });

        const entries = coerceLibraryPayloadToEntries(data);
        return entries.map(normalizeLibraryCatalogEntry).filter(Boolean);
    } catch (err) {
        console.warn('Failed to load library models from libraryUrl:', err);
        return [];
    }
}

function mergeLibraryCatalogModels(manifestModels, libraryEndpointModels) {
    const merged = new Map();

    const upsert = (model, source) => {
        const normalized = normalizeModelName(model.name);
        const existing = merged.get(normalized);

        if (!existing) {
            merged.set(normalized, {
                name: model.name,
                description: model.description || '',
                tags: Array.isArray(model.tags) ? [...new Set(model.tags)] : [],
                family: model.family,
                parameterSize: model.parameterSize,
                pulls: model.pulls,
                updatedAt: model.updatedAt,
                endpoint: model.endpoint,
                catalogSources: [source],
            });
            return;
        }

        if (!existing.catalogSources.includes(source)) {
            existing.catalogSources.push(source);
        }

        if (!existing.description && model.description) {
            existing.description = model.description;
        }

        if (!existing.endpoint && model.endpoint) {
            existing.endpoint = model.endpoint;
        }

        if (!existing.family && model.family) {
            existing.family = model.family;
        }

        if (!existing.parameterSize && model.parameterSize) {
            existing.parameterSize = model.parameterSize;
        }

        if (!existing.pulls && model.pulls) {
            existing.pulls = model.pulls;
        }

        if (!existing.updatedAt && model.updatedAt) {
            existing.updatedAt = model.updatedAt;
        }

        if (Array.isArray(model.tags) && model.tags.length > 0) {
            const nextTags = new Set(existing.tags || []);
            for (const tag of model.tags) nextTags.add(tag);
            existing.tags = Array.from(nextTags);
        }
    };

    for (const model of manifestModels || []) {
        const normalized = normalizeLibraryCatalogEntry(model) || null;
        if (normalized) upsert(normalized, 'manifest');
    }

    for (const model of libraryEndpointModels || []) {
        const normalized = normalizeLibraryCatalogEntry(model) || null;
        if (normalized) upsert(normalized, 'library');
    }

    const list = Array.from(merged.values());
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}

function setLibraryTableMessage(message) {
    if (!DOMElements.libraryTableBody) return;
    DOMElements.libraryTableBody.innerHTML = '';

    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 2;
    cell.className = 'text-muted small';
    cell.textContent = message;
    row.appendChild(cell);
    DOMElements.libraryTableBody.appendChild(row);
}

function setLibraryCountText(message) {
    if (!DOMElements.libraryCountText) return;
    DOMElements.libraryCountText.textContent = message || '';
}

function getLibraryPullKey(modelName) {
    return normalizeModelName(modelName);
}

function getLibraryPullState(modelName) {
    const key = getLibraryPullKey(modelName);
    return AppState.activeModelPulls[key] || null;
}

function setLibraryPullState(modelName, patch) {
    const key = getLibraryPullKey(modelName);
    const existing = AppState.activeModelPulls[key] || { modelName };
    AppState.activeModelPulls[key] = {
        ...existing,
        ...patch,
    };
}

function clearLibraryPullState(modelName) {
    const key = getLibraryPullKey(modelName);
    delete AppState.activeModelPulls[key];
}

function updateLibraryRowFromPullState(modelName) {
    if (!DOMElements.libraryTableBody) return;

    const key = getLibraryPullKey(modelName);
    const row = DOMElements.libraryTableBody.querySelector(`tr[data-model-key="${key}"]`);
    if (!row) return;

    const button = row.querySelector('button[data-action="pull-model"]');
    const spinner = row.querySelector('[data-role="pull-spinner"]');
    const statusText = row.querySelector('[data-role="pull-status-text"]');

    const state = getLibraryPullState(modelName);
    const phase = state?.phase || 'idle';

    if (button) {
        button.disabled = phase === 'pulling' || phase === 'done';
    }

    if (spinner) {
        spinner.classList.toggle('d-none', phase !== 'pulling');
    }

    if (statusText) {
        const message = state?.message || (phase === 'idle' ? 'Not installed' : '');
        statusText.textContent = message;
        statusText.classList.remove('text-danger', 'text-success');
        if (phase === 'error') statusText.classList.add('text-danger');
        if (phase === 'done') statusText.classList.add('text-success');
    }
}

function formatLibraryCatalogMeta(model) {
    const bits = [];
    if (model.family) bits.push(model.family);
    if (model.parameterSize) bits.push(model.parameterSize);
    if (typeof model.pulls === 'number') bits.push(`${model.pulls.toLocaleString()} pulls`);
    if (Array.isArray(model.tags) && model.tags.length > 0) bits.push(model.tags.slice(0, 3).join(', '));
    return bits.join(' • ');
}

function renderLibraryTable() {
    if (!DOMElements.libraryTableBody) return;

    const installedSet = new Set(
        (AppState.availableModels || [])
            .filter((m) => Array.isArray(m.sources) && m.sources.includes('local'))
            .map((m) => normalizeModelName(m.name))
    );

    const query = String(AppState.librarySearchQuery || '').trim().toLowerCase();
    const catalogModels = Array.isArray(AppState.libraryCatalogModels) ? AppState.libraryCatalogModels : [];

    let modelsToShow = catalogModels.filter((m) => !installedSet.has(normalizeModelName(m.name)));

    if (query) {
        modelsToShow = modelsToShow.filter((m) => {
            const haystack = `${m.name} ${m.description || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
            return haystack.includes(query);
        });
    }

    DOMElements.libraryTableBody.innerHTML = '';

    if (catalogModels.length === 0) {
        setLibraryTableMessage('No library sources configured.');
        setLibraryCountText('');
        return;
    }

    if (modelsToShow.length === 0) {
        setLibraryTableMessage(query ? 'No matching models.' : 'All library models are already installed.');
        setLibraryCountText(query ? '0 results' : '');
        return;
    }

    for (const model of modelsToShow) {
        const row = document.createElement('tr');
        row.dataset.modelKey = getLibraryPullKey(model.name);

        const modelCell = document.createElement('td');
        modelCell.className = 'library-model-cell';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'library-model-name';
        nameDiv.textContent = model.name;

        const descDiv = document.createElement('div');
        descDiv.className = 'library-model-description small text-muted';
        descDiv.textContent = model.description || '';

        const metaText = formatLibraryCatalogMeta(model);
        if (metaText) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'library-model-meta small text-muted';
            metaDiv.textContent = metaText;
            modelCell.appendChild(nameDiv);
            modelCell.appendChild(descDiv);
            modelCell.appendChild(metaDiv);
        } else {
            modelCell.appendChild(nameDiv);
            modelCell.appendChild(descDiv);
        }

        const actionCell = document.createElement('td');
        actionCell.className = 'library-action-cell';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-primary btn-sm';
        button.textContent = 'Pull';
        button.dataset.action = 'pull-model';
        button.dataset.modelName = model.name;

        const progressDiv = document.createElement('div');
        progressDiv.className = 'library-progress small text-muted mt-1';

        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm me-1 d-none';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-hidden', 'true');
        spinner.dataset.role = 'pull-spinner';

        const progressText = document.createElement('span');
        progressText.dataset.role = 'pull-status-text';

        progressDiv.appendChild(spinner);
        progressDiv.appendChild(progressText);

        actionCell.appendChild(button);
        actionCell.appendChild(progressDiv);

        row.appendChild(modelCell);
        row.appendChild(actionCell);

        DOMElements.libraryTableBody.appendChild(row);
        updateLibraryRowFromPullState(model.name);
    }

    const suffix = query ? ` (filtered)` : '';
    setLibraryCountText(`${modelsToShow.length} model${modelsToShow.length === 1 ? '' : 's'} available${suffix}`);
}

function getInstalledModelDeleteKey(modelName) {
    return normalizeModelName(modelName);
}

function getInstalledModelDeleteState(modelName) {
    const key = getInstalledModelDeleteKey(modelName);
    return AppState.activeModelDeletes[key] || null;
}

function setInstalledModelDeleteState(modelName, patch) {
    const key = getInstalledModelDeleteKey(modelName);
    const existing = AppState.activeModelDeletes[key] || { modelName };
    AppState.activeModelDeletes[key] = {
        ...existing,
        ...patch,
    };
}

function clearInstalledModelDeleteState(modelName) {
    const key = getInstalledModelDeleteKey(modelName);
    delete AppState.activeModelDeletes[key];
}

function updateInstalledModelRowFromDeleteState(modelName) {
    if (!DOMElements.installedModelsList) return;

    const key = getInstalledModelDeleteKey(modelName);
    const row = DOMElements.installedModelsList.querySelector(`[data-model-key="${key}"]`);
    if (!row) return;

    const deleteButton = row.querySelector('button[data-action="delete-model"]');
    const spinner = row.querySelector('[data-role="delete-spinner"]');
    const statusText = row.querySelector('[data-role="delete-status-text"]');

    const state = getInstalledModelDeleteState(modelName);
    const phase = state?.phase || 'idle';
    const message = state?.message || '';

    if (deleteButton) {
        deleteButton.disabled = AppState.isStreaming || Boolean(AppState.abortController) || phase === 'deleting';
    }

    if (spinner) {
        spinner.classList.toggle('d-none', phase !== 'deleting');
    }

    if (statusText) {
        statusText.textContent = message;
        statusText.classList.remove('text-danger', 'text-success');
        if (phase === 'error') statusText.classList.add('text-danger');
        if (phase === 'done') statusText.classList.add('text-success');
    }
}

function renderInstalledModels() {
    if (!DOMElements.installedModelsList) return;

    const isChatBusy = AppState.isStreaming || Boolean(AppState.abortController);

    if (DOMElements.installedModelsWarning) {
        DOMElements.installedModelsWarning.classList.toggle('d-none', !isChatBusy);
    }

    const localModels = (AppState.availableModels || [])
        .filter((m) => Array.isArray(m.sources) && m.sources.includes('local'))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));

    if (DOMElements.installedModelsCountText) {
        DOMElements.installedModelsCountText.textContent = localModels.length
            ? `${localModels.length}`
            : '';
    }

    DOMElements.installedModelsList.innerHTML = '';

    if (localModels.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'list-group-item text-muted small';
        empty.textContent = 'No installed models found.';
        DOMElements.installedModelsList.appendChild(empty);
        return;
    }

    for (const model of localModels) {
        const item = document.createElement('li');
        item.className = 'list-group-item';
        item.dataset.modelKey = getInstalledModelDeleteKey(model.name);

        const left = document.createElement('div');
        left.className = 'flex-grow-1';

        const header = document.createElement('div');
        header.className = 'd-flex flex-wrap align-items-center gap-2';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'installed-model-name';
        nameSpan.textContent = model.name;
        header.appendChild(nameSpan);

        const isActive = normalizeModelName(AppState.currentModel) === normalizeModelName(model.name);
        if (isActive) {
            item.classList.add('installed-model-row-active');
            const badge = document.createElement('span');
            badge.className = 'badge bg-success';
            badge.textContent = 'Active';
            header.appendChild(badge);
        }

        left.appendChild(header);

        if (model.description) {
            const description = document.createElement('div');
            description.className = 'installed-model-description small text-muted';
            description.textContent = model.description;
            left.appendChild(description);
        }

        const actions = document.createElement('div');
        actions.className = 'installed-model-actions';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-outline-danger btn-sm';
        deleteButton.dataset.action = 'delete-model';
        deleteButton.dataset.modelName = model.name;
        deleteButton.title = `Delete ${model.name}`;
        deleteButton.setAttribute('aria-label', `Delete ${model.name}`);
        deleteButton.innerHTML = '<span class="spinner-border spinner-border-sm d-none" data-role="delete-spinner" role="status" aria-hidden="true"></span><span class="ms-1">🗑</span>';

        const status = document.createElement('div');
        status.className = 'small text-muted';
        status.dataset.role = 'delete-status-text';

        actions.appendChild(deleteButton);
        actions.appendChild(status);

        item.appendChild(left);
        item.appendChild(actions);
        DOMElements.installedModelsList.appendChild(item);

        updateInstalledModelRowFromDeleteState(model.name);
    }
}

function renderModelSelect(models, { preserveSelection = true } = {}) {
    if (!DOMElements.modelSelect) return;

    const previousSelection = preserveSelection ? DOMElements.modelSelect.value : '';

    DOMElements.modelSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = 'Choose a model...';
    DOMElements.modelSelect.appendChild(placeholder);

    if (!Array.isArray(models) || models.length === 0) {
        placeholder.textContent = 'No models found';
        DOMElements.modelSelect.disabled = true;
        setModelMeta(null);
        return;
    }

    DOMElements.modelSelect.disabled = false;

    for (const model of models) {
        const option = document.createElement('option');
        option.value = model.name;

        const isInstalledLocally = model.sources.includes('local');
        const explicitEndpoint = String(model.endpoint || '').trim();
        const requestBaseUrl = explicitEndpoint || window.OllamaConfig.apiEndpoint;
        const isSameAsLocalApi = normalizeBaseUrl(requestBaseUrl) === normalizeBaseUrl(window.OllamaConfig.apiEndpoint);
        const isPullRequired = !isInstalledLocally && isSameAsLocalApi;

        const provenanceLabel = isPullRequired
            ? 'Not installed'
            : model.sources.includes('local') && model.sources.includes('cloud')
                ? 'Local + Cloud'
                : model.sources.includes('local')
                    ? 'Local'
                    : 'Cloud';

        option.textContent = `${model.name} (${provenanceLabel})`;
        option.disabled = isPullRequired;

        option.dataset.sources = model.sources.join(',');
        option.dataset.description = model.description || '';
        option.dataset.endpoint = model.endpoint || '';

        DOMElements.modelSelect.appendChild(option);
    }

    if (preserveSelection && previousSelection && getModelByName(previousSelection)) {
        DOMElements.modelSelect.value = previousSelection;
        handleModelChange(previousSelection);
        return;
    }

    AppState.currentModel = null;
    setModelMeta(null);
}

async function refreshModels({ preserveSelection = true } = {}) {
    if (AppState.isRefreshingModels) return;

    AppState.isRefreshingModels = true;
    setErrorBanner(null);
    setModelSelectLoading(true);
    setRefreshModelsButtonLoading(true);
    updateStatus('Loading models...', 'loading');
    setLibraryTableMessage('Loading library...');
    setLibraryCountText('');

    if (DOMElements.installedModelsList) {
        DOMElements.installedModelsList.innerHTML = '<li class="list-group-item text-muted small">Loading installed models...</li>';
    }
    if (DOMElements.installedModelsCountText) {
        DOMElements.installedModelsCountText.textContent = '';
    }

    try {
        const cloudPromise = fetchCloudModelsFromManifest().catch((err) => {
            console.warn('Failed to load cloud models manifest:', err);
            return [];
        });

        const localPromise = fetchLocalModels().catch((err) => {
            const apiBase = normalizeBaseUrl(window.OllamaConfig.apiEndpoint);
            setErrorBanner(
                `Unable to reach Ollama at ${apiBase}. Ensure Ollama is running and allows browser requests (CORS).`,
                'warning'
            );
            console.warn('Failed to load local models from Ollama:', err);
            return [];
        });

        const libraryPromise = fetchLibraryModelsFromEndpoint();

        const [cloudModels, localModels, libraryModels] = await Promise.all([cloudPromise, localPromise, libraryPromise]);

        AppState.availableModels = mergeModels(localModels, cloudModels);
        AppState.libraryCatalogModels = mergeLibraryCatalogModels(cloudModels, libraryModels);

        setModelSelectLoading(false);
        renderModelSelect(AppState.availableModels, { preserveSelection });
        renderLibraryTable();
        renderInstalledModels();

        if (AppState.availableModels.length === 0) {
            updateStatus('No models available', 'warning');
        } else {
            updateStatus('Ready', 'success');
        }
    } catch (err) {
        console.error('Failed to refresh models:', err);
        setErrorBanner('Failed to load models. Please try again.', 'danger');
        AppState.availableModels = [];
        AppState.libraryCatalogModels = [];
        setModelSelectLoading(false);
        renderModelSelect(AppState.availableModels, { preserveSelection: false });
        renderLibraryTable();
        renderInstalledModels();
        updateStatus('Failed to load models', 'error');
    } finally {
        setRefreshModelsButtonLoading(false);
        AppState.isRefreshingModels = false;
    }
}

function formatBytes(bytes) {
    const value = typeof bytes === 'number' ? bytes : Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const scaled = value / Math.pow(1024, index);

    return `${scaled.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function buildPullProgressMessage(update) {
    if (!update || typeof update !== 'object') return '';

    const status = update.status || '';
    const completed = typeof update.completed === 'number' ? update.completed : Number(update.completed);
    const total = typeof update.total === 'number' ? update.total : Number(update.total);

    if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
        const percent = Math.max(0, Math.min(100, Math.floor((completed / total) * 100)));
        const detail = `${formatBytes(completed)} / ${formatBytes(total)} (${percent}%)`;
        return status ? `${status} • ${detail}` : detail;
    }

    if (status) return status;
    return '';
}

async function pullModel(modelName) {
    const trimmedName = String(modelName || '').trim();
    if (!trimmedName) return;

    const key = getLibraryPullKey(trimmedName);
    const existing = AppState.activeModelPulls[key];

    if (existing?.phase === 'pulling') {
        updateStatus(`Pull already in progress: ${trimmedName}`, 'warning');
        return;
    }

    setErrorBanner(null);

    const controller = new AbortController();
    const pullTimeoutMs =
        typeof window.OllamaConfig.pullTimeoutMs === 'number' ? window.OllamaConfig.pullTimeoutMs : 30 * 60 * 1000;

    const timeoutId = setTimeout(() => controller.abort(), pullTimeoutMs);

    setLibraryPullState(trimmedName, {
        phase: 'pulling',
        message: 'Starting...',
        controller,
    });
    updateLibraryRowFromPullState(trimmedName);
    updateStatus(`Pulling ${trimmedName}...`, 'loading');

    try {
        const url = buildOllamaUrl('/api/pull');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: trimmedName, stream: true }),
            signal: controller.signal,
        });

        if (!response.ok) {
            let detail = '';
            try {
                detail = await response.text();
            } catch {
                detail = '';
            }

            const suffix = detail ? ` - ${detail}` : '';
            throw new Error(`Pull failed: ${response.status} ${response.statusText}${suffix}`);
        }

        if (!response.body) {
            throw new Error('No response body available');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let lastUiUpdate = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    let data;
                    try {
                        data = JSON.parse(trimmed);
                    } catch (err) {
                        console.warn('Failed to parse pull stream line:', trimmed, err);
                        continue;
                    }

                    if (data?.error) {
                        throw new Error(String(data.error));
                    }

                    const message = buildPullProgressMessage(data);
                    if (!message) continue;

                    setLibraryPullState(trimmedName, { phase: 'pulling', message });

                    const now = Date.now();
                    if (now - lastUiUpdate > 150) {
                        updateLibraryRowFromPullState(trimmedName);
                        updateStatus(`Pulling ${trimmedName}: ${message}`, 'loading');
                        lastUiUpdate = now;
                    }
                }
            }

            const remainder = buffer.trim();
            if (remainder) {
                try {
                    const data = JSON.parse(remainder);
                    if (data?.error) {
                        throw new Error(String(data.error));
                    }
                } catch {
                    // ignore
                }
            }
        } finally {
            reader.releaseLock();
        }

        setLibraryPullState(trimmedName, { phase: 'done', message: 'Complete', controller: null });
        updateLibraryRowFromPullState(trimmedName);
        updateStatus(`Pulled ${trimmedName}`, 'success');

        await refreshModels({ preserveSelection: true });
        clearLibraryPullState(trimmedName);
    } catch (err) {
        const message = err?.name === 'AbortError'
            ? `Pull timed out after ${Math.round(pullTimeoutMs / 1000)}s`
            : err?.message || 'Failed to pull model.';

        setLibraryPullState(trimmedName, { phase: 'error', message, controller: null });
        updateLibraryRowFromPullState(trimmedName);

        if (
            message.toLowerCase().includes('unable to connect') ||
            message.toLowerCase().includes('failed to fetch') ||
            message.toLowerCase().includes('econnrefused') ||
            message.toLowerCase().includes('enotfound')
        ) {
            setErrorBanner('Unable to connect to Ollama. Please make sure Ollama is running and accessible.', 'danger');
        } else {
            setErrorBanner(message, 'danger');
        }

        updateStatus(`Pull failed: ${trimmedName}`, 'error');
    } finally {
        clearTimeout(timeoutId);
    }
}

async function readOllamaResponseDetail(response) {
    if (!response) return '';

    try {
        const text = await response.text();
        if (!text) return '';

        try {
            const data = JSON.parse(text);
            if (data?.error) return String(data.error);
            if (data?.message) return String(data.message);
            if (data?.status) return String(data.status);
        } catch {
            // ignore json parse errors
        }

        return text;
    } catch {
        return '';
    }
}

async function requestOllamaDeleteModel(modelName, method) {
    const url = buildOllamaUrl('/api/delete');
    const payload = JSON.stringify({ name: modelName });

    return fetchWithTimeout(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: payload,
        timeoutMs: 60_000,
    });
}

async function deleteModel(modelName) {
    const trimmedName = String(modelName || '').trim();
    if (!trimmedName) return;

    if (AppState.isStreaming || AppState.abortController) {
        setErrorBanner('Stop generation before deleting models.', 'warning');
        updateStatus('Stop generation before deleting models', 'warning');
        return;
    }

    const isActiveModel = normalizeModelName(AppState.currentModel) === normalizeModelName(trimmedName);

    const confirmationText = isActiveModel
        ? `Delete the currently selected model "${trimmedName}"? This will remove it from Ollama and clear your selection.`
        : `Delete model "${trimmedName}" from your Ollama installation?`;

    const confirmed = window.confirm(`${confirmationText}\n\nThis cannot be undone (you can re-pull later).`);
    if (!confirmed) {
        updateStatus('Delete cancelled', 'warning');
        return;
    }

    setErrorBanner(null);
    setInstalledModelDeleteState(trimmedName, { phase: 'deleting', message: 'Deleting...' });
    updateInstalledModelRowFromDeleteState(trimmedName);
    updateStatus(`Deleting ${trimmedName}...`, 'loading');

    try {
        let response;
        let deleteError = null;

        try {
            response = await requestOllamaDeleteModel(trimmedName, 'DELETE');
        } catch (err) {
            deleteError = err;
        }

        if (!response || !response.ok) {
            const statusCode = response?.status;
            const shouldFallback = !response || statusCode === 404 || statusCode === 405 || statusCode === 501;

            if (!shouldFallback) {
                const detail = await readOllamaResponseDetail(response);
                const suffix = detail ? ` - ${detail}` : '';
                throw new Error(`Delete failed: ${statusCode || 'request error'}${suffix}`);
            }

            const postResponse = await requestOllamaDeleteModel(trimmedName, 'POST');
            if (!postResponse.ok) {
                const detail = await readOllamaResponseDetail(postResponse);
                const suffix = detail ? ` - ${detail}` : '';
                throw new Error(`Delete failed: ${postResponse.status} ${postResponse.statusText}${suffix}`);
            }

            response = postResponse;

            if (deleteError) {
                console.warn('DELETE /api/delete failed, succeeded with POST:', deleteError);
            }
        }

        setInstalledModelDeleteState(trimmedName, { phase: 'done', message: 'Deleted' });
        updateInstalledModelRowFromDeleteState(trimmedName);

        if (isActiveModel) {
            AppState.currentModel = null;
            if (DOMElements.modelSelect) {
                DOMElements.modelSelect.value = '';
            }
            setModelMeta(null);
            updateTranscriptPlaceholder();
        }

        await refreshModels({ preserveSelection: true });
        clearInstalledModelDeleteState(trimmedName);
        renderInstalledModels();

        updateStatus(`Deleted ${trimmedName}`, 'success');
    } catch (err) {
        const message = err?.message || 'Failed to delete model.';
        setInstalledModelDeleteState(trimmedName, { phase: 'error', message });
        updateInstalledModelRowFromDeleteState(trimmedName);
        setErrorBanner(message, 'danger');
        updateStatus(`Delete failed: ${trimmedName}`, 'error');
    }
}

/**
 * Initialize DOM elements references
 */
function initializeDOMElements() {
    DOMElements.app = document.getElementById('app');
    DOMElements.modelSelect = document.getElementById('modelSelect');
    DOMElements.refreshModelsButton = document.getElementById('refreshModelsButton');
    DOMElements.modelProvenance = document.getElementById('modelProvenance');
    DOMElements.modelDescription = document.getElementById('modelDescription');
    DOMElements.errorBanner = document.getElementById('errorBanner');

    DOMElements.installedModelsList = document.getElementById('installedModelsList');
    DOMElements.installedModelsWarning = document.getElementById('installedModelsWarning');
    DOMElements.installedModelsCountText = document.getElementById('installedModelsCountText');

    DOMElements.temperatureSlider = document.getElementById('temperatureSlider');
    DOMElements.temperatureValue = document.getElementById('temperatureValue');
    DOMElements.maxTokensInput = document.getElementById('maxTokensInput');
    DOMElements.chatTranscript = document.getElementById('chatTranscript');
    DOMElements.messageForm = document.getElementById('messageForm');
    DOMElements.messageInput = document.getElementById('messageInput');
    DOMElements.sendButton = document.getElementById('sendButton');
    DOMElements.stopButton = document.getElementById('stopButton');
    DOMElements.clearChatButton = document.getElementById('clearChatButton');
    DOMElements.statusText = document.getElementById('statusText');
    DOMElements.tokenCount = document.getElementById('tokenCount');
    DOMElements.attachImageButton = document.getElementById('attachImageButton');
    DOMElements.imageInput = document.getElementById('imageInput');
    DOMElements.thumbnailStrip = document.getElementById('thumbnailStrip');

    DOMElements.librarySearchInput = document.getElementById('librarySearchInput');
    DOMElements.libraryTableBody = document.getElementById('libraryTableBody');
    DOMElements.libraryCountText = document.getElementById('libraryCountText');
}

/**
 * Validate all required DOM elements exist
 */
function validateDOMElements() {
    const missingElements = Object.entries(DOMElements)
        .filter(([, element]) => !element)
        .map(([key]) => key);

    if (missingElements.length > 0) {
        console.error('Missing DOM elements:', missingElements);
        return false;
    }
    return true;
}

/**
 * Image attachment utilities
 */
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_MB = 20;
const MAX_IMAGES_COUNT = 10;

function getImageTypeDisplayName(mimeType) {
    const typeMap = {
        'image/jpeg': 'JPEG',
        'image/png': 'PNG',
        'image/gif': 'GIF',
        'image/webp': 'WebP',
    };
    return typeMap[mimeType] || 'Unknown';
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function validateImageFile(file) {
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Unsupported image type: ${getImageTypeDisplayName(file.type)}. Supported types: JPEG, PNG, GIF, WebP.`,
        };
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
        return {
            valid: false,
            error: `File "${file.name}" is too large (${fileSizeMB.toFixed(1)}MB). Max size is ${MAX_IMAGE_SIZE_MB}MB.`,
        };
    }

    return { valid: true };
}

async function handleImageInput(files) {
    const errors = [];
    const newImages = [];

    for (const file of files) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
            errors.push(validation.error);
            continue;
        }

        if (AppState.pendingImages.length + newImages.length >= MAX_IMAGES_COUNT) {
            errors.push(`Maximum ${MAX_IMAGES_COUNT} images per message.`);
            break;
        }

        try {
            const base64Data = await readFileAsBase64(file);
            newImages.push({
                filename: file.name,
                mimeType: file.type,
                data: base64Data,
            });
        } catch (err) {
            errors.push(`Failed to read "${file.name}": ${err.message}`);
        }
    }

    if (errors.length > 0) {
        setErrorBanner(errors.join(' '), 'danger');
    }

    if (newImages.length > 0) {
        AppState.pendingImages.push(...newImages);
        updateThumbnailStrip();
    }
}

function updateThumbnailStrip() {
    if (!DOMElements.thumbnailStrip) return;

    if (AppState.pendingImages.length === 0) {
        DOMElements.thumbnailStrip.style.display = 'none';
        DOMElements.thumbnailStrip.innerHTML = '';
        return;
    }

    DOMElements.thumbnailStrip.style.display = 'flex';
    DOMElements.thumbnailStrip.innerHTML = '';

    for (let i = 0; i < AppState.pendingImages.length; i++) {
        const image = AppState.pendingImages[i];
        const thumbnail = document.createElement('div');
        thumbnail.className = 'attachment-thumbnail';

        const img = document.createElement('img');
        img.src = image.data;
        img.alt = image.filename;
        img.onclick = () => window.open(image.data, '_blank');

        const removeBtn = document.createElement('button');
        removeBtn.className = 'attachment-thumbnail-remove';
        removeBtn.textContent = '×';
        removeBtn.type = 'button';
        removeBtn.onclick = (e) => {
            e.preventDefault();
            AppState.pendingImages.splice(i, 1);
            updateThumbnailStrip();
        };

        thumbnail.appendChild(img);
        thumbnail.appendChild(removeBtn);
        DOMElements.thumbnailStrip.appendChild(thumbnail);
    }
}

function clearPendingImages() {
    AppState.pendingImages = [];
    updateThumbnailStrip();
    if (DOMElements.imageInput) {
        DOMElements.imageInput.value = '';
    }
}

function isModelMultimodal(modelName) {
    if (!modelName) return false;
    const knownMultimodalModels = [
        'llava',
        'vision',
        'qwen',
        'minicpm',
        'cogvlm',
        'llama2-vision',
        'mistral-large',
        'mistral',
        'gemini',
        'claude',
        'gpt',
    ];
    const normalized = modelName.toLowerCase();
    return knownMultimodalModels.some((model) => normalized.includes(model));
}

function warnIfModelNotMultimodal() {
    if (AppState.pendingImages.length === 0) return;

    if (!isModelMultimodal(AppState.currentModel)) {
        setErrorBanner(
            `Warning: The selected model "${AppState.currentModel}" may not support vision capabilities. Consider switching to a multimodal model (e.g., llava, qwen, mistral-large).`,
            'warning'
        );
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Model Selection
    if (DOMElements.modelSelect) {
        DOMElements.modelSelect.addEventListener('change', (e) => {
            handleModelChange(e.target.value);
        });
    }

    if (DOMElements.refreshModelsButton) {
        DOMElements.refreshModelsButton.addEventListener('click', () => {
            refreshModels({ preserveSelection: true });
        });
    }

    if (DOMElements.librarySearchInput) {
        DOMElements.librarySearchInput.addEventListener('input', (e) => {
            AppState.librarySearchQuery = String(e.target.value || '');
            renderLibraryTable();
        });
    }

    if (DOMElements.libraryTableBody) {
        DOMElements.libraryTableBody.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action="pull-model"]');
            if (!button) return;

            const modelName = button.dataset.modelName;
            if (!modelName) return;

            pullModel(modelName);
        });
    }

    if (DOMElements.installedModelsList) {
        DOMElements.installedModelsList.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action="delete-model"]');
            if (!button) return;

            const modelName = button.dataset.modelName;
            if (!modelName) return;

            deleteModel(modelName);
        });
    }

    // Temperature Slider
    if (DOMElements.temperatureSlider) {
        DOMElements.temperatureSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value).toFixed(1);
            AppState.temperature = parseFloat(value);
            if (DOMElements.temperatureValue) {
                DOMElements.temperatureValue.textContent = value;
            }
        });
    }

    // Max Tokens Input
    if (DOMElements.maxTokensInput) {
        DOMElements.maxTokensInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value > 0) {
                AppState.maxTokens = value;
            }
        });
    }

    // Message Form Submission
    if (DOMElements.messageForm) {
        DOMElements.messageForm.addEventListener('submit', handleMessageSubmit);
    }

    // Stop Button
    if (DOMElements.stopButton) {
        DOMElements.stopButton.addEventListener('click', handleStopStreaming);
    }

    // Clear Chat Button
    if (DOMElements.clearChatButton) {
        DOMElements.clearChatButton.addEventListener('click', handleClearChat);
    }

    // Message Input - Auto-expand textarea
    if (DOMElements.messageInput) {
        DOMElements.messageInput.addEventListener('input', autoExpandTextarea);
        DOMElements.messageInput.addEventListener('keydown', handleMessageInputKeydown);
    }

    // Image Attachment
    if (DOMElements.attachImageButton) {
        DOMElements.attachImageButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (DOMElements.imageInput) {
                DOMElements.imageInput.click();
            }
        });
    }

    if (DOMElements.imageInput) {
        DOMElements.imageInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
                await handleImageInput(files);
            }
        });
    }
}

/**
 * Handle model selection change
 */
function handleModelChange(modelName) {
    const previousModel = AppState.currentModel;

    if (!modelName) {
        AppState.currentModel = null;
        setModelMeta(null);
        updateStatus('No model selected', 'warning');
        updateTranscriptPlaceholder();
        renderInstalledModels();
        return;
    }

    const model = getModelByName(modelName);

    AppState.currentModel = modelName;
    setModelMeta(model);

    const metaBits = [];
    if (model && model.sources?.includes('local')) metaBits.push('local');
    if (model && model.sources?.includes('cloud')) metaBits.push('cloud');

    updateStatus(`Using model: ${modelName}${metaBits.length ? ` (${metaBits.join(' + ')})` : ''}`, 'success');

    if (previousModel && previousModel !== modelName && AppState.messages.length > 0) {
        appendMessage('system', `Switched to model: ${modelName}`, modelName);
    }

    updateTranscriptPlaceholder();
    renderInstalledModels();

    console.log('Model selected:', modelName);
    console.log('Current configuration:', window.OllamaConfig.getConfig());
}

/**
 * Handle message form submission
 */
async function handleMessageSubmit(e) {
    e.preventDefault();

    if (AppState.isLoading || AppState.isStreaming) return;

    if (!AppState.currentModel) {
        updateStatus('Please select a model first', 'warning');
        return;
    }

    const message = DOMElements.messageInput.value.trim();

    if (!message && AppState.pendingImages.length === 0) {
        updateStatus('Message cannot be empty', 'warning');
        return;
    }

    const modelAtSend = AppState.currentModel;
    const temperatureAtSend = AppState.temperature;
    const maxTokensAtSend = AppState.maxTokens;
    const imagesToSend = AppState.pendingImages.length > 0 ? [...AppState.pendingImages] : null;

    if (imagesToSend) {
        warnIfModelNotMultimodal();
    }

    appendMessage('user', message, modelAtSend, imagesToSend);
    clearPendingImages();

    DOMElements.messageInput.value = '';
    DOMElements.messageInput.style.height = 'auto';

    setErrorBanner(null);
    setLoadingState(true);
    setStreamingState(true);
    updateStatus(`Generating response with ${modelAtSend}...`, 'loading');

    const assistantMessageIndex = AppState.messages.length;
    const assistantMessage = appendMessage('assistant', '', modelAtSend);

    AppState.abortController = new AbortController();

    try {
        const result = await requestOllamaChat({
            modelName: modelAtSend,
            temperature: temperatureAtSend,
            maxTokens: maxTokensAtSend,
            onStreamToken: (token) => {
                if (AppState.messages[assistantMessageIndex]) {
                    AppState.messages[assistantMessageIndex].content += token;
                    updateStreamingMessageInUI(assistantMessageIndex, AppState.messages[assistantMessageIndex].content);
                }
            },
        });

        AppState.messages[assistantMessageIndex].content = result.content;
        updateStreamingMessageInUI(assistantMessageIndex, result.content);
        historyStorage.save(AppState.messages);

        if (typeof result.tokenCount === 'number') {
            updateTokenCount(result.tokenCount);
        } else {
            updateTokenCount(result.content.split(/\s+/).filter(Boolean).length);
        }

        updateStatus('Ready', 'success');
    } catch (err) {
        console.error('Failed to generate response:', err);
        const errorMessage = err?.message || 'Failed to generate response. Please try again.';
        
        if (errorMessage.toLowerCase().includes('cancelled') || err.name === 'AbortError') {
            updateStatus('Response stopped', 'warning');
            AppState.messages[assistantMessageIndex].content += '\n\n[Response stopped by user]';
            updateStreamingMessageInUI(assistantMessageIndex, AppState.messages[assistantMessageIndex].content);
            historyStorage.save(AppState.messages);
            clearPendingImages();
        } else if (
            (errorMessage.includes('Failed') && errorMessage.includes('0')) ||
            errorMessage.toLowerCase().includes('unable to connect') ||
            errorMessage.toLowerCase().includes('econnrefused') ||
            errorMessage.toLowerCase().includes('enotfound') ||
            errorMessage.toLowerCase().includes('no response body') ||
            errorMessage.toLowerCase().includes('request failed') ||
            errorMessage.toLowerCase().includes('failed to fetch')
        ) {
            const displayMessage = 'Unable to connect to Ollama. Please make sure Ollama is running and accessible.';
            setErrorBanner(displayMessage, 'danger');
            AppState.messages[assistantMessageIndex].content = `[Error: ${displayMessage}]`;
            updateStreamingMessageInUI(assistantMessageIndex, AppState.messages[assistantMessageIndex].content);
            historyStorage.save(AppState.messages);
            updateStatus('Failed to connect', 'error');
            clearPendingImages();
        } else {
            setErrorBanner(errorMessage, 'danger');
            AppState.messages[assistantMessageIndex].content = `[Error: ${errorMessage}]`;
            updateStreamingMessageInUI(assistantMessageIndex, AppState.messages[assistantMessageIndex].content);
            historyStorage.save(AppState.messages);
            updateStatus('Failed to generate response', 'error');
            clearPendingImages();
        }
    } finally {
        setLoadingState(false);
        setStreamingState(false);
        AppState.abortController = null;
    }
}

/**
 * Handle message input keydown (Shift+Enter for new line, Enter for submit)
 */
function handleMessageInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        if (typeof DOMElements.messageForm?.requestSubmit === 'function') {
            DOMElements.messageForm.requestSubmit();
        } else {
            DOMElements.messageForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    }
}

/**
 * Auto-expand textarea based on content
 */
function autoExpandTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

/**
 * Chat transcript + in-memory conversation handling
 */
function formatTimestamp(isoString) {
    try {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

function updateTranscriptPlaceholder() {
    if (!DOMElements.chatTranscript) return;
    if (AppState.messages.length > 0) return;

    DOMElements.chatTranscript.innerHTML = '';

    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder-content text-center text-muted';

    const p = document.createElement('p');
    p.textContent = AppState.currentModel
        ? `Chatting with ${AppState.currentModel}. Send a message to begin.`
        : 'Select a model to start chatting';

    placeholder.appendChild(p);
    DOMElements.chatTranscript.appendChild(placeholder);
}

function renderMessageToTranscript(message) {
    if (!DOMElements.chatTranscript) return;

    const placeholder = DOMElements.chatTranscript.querySelector('.placeholder-content');
    if (placeholder) placeholder.remove();

    const roleClass = message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : 'system';

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${roleClass}`;

    if (roleClass === 'system') {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message.content;
        messageDiv.appendChild(contentDiv);
        DOMElements.chatTranscript.appendChild(messageDiv);
        scrollChatToBottom();
        return;
    }

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.textContent = message.role === 'user' ? 'U' : 'A';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'message-label';
    labelSpan.textContent = message.role === 'user' ? 'You' : 'Assistant';
    metaDiv.appendChild(labelSpan);

    if (message.role === 'assistant' && message.model) {
        const modelSpan = document.createElement('span');
        modelSpan.className = 'message-model';
        modelSpan.textContent = message.model;
        metaDiv.appendChild(modelSpan);
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-timestamp';
    timeSpan.textContent = formatTimestamp(message.timestamp);
    metaDiv.appendChild(timeSpan);

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message.content;

    contentDiv.appendChild(metaDiv);
    contentDiv.appendChild(textDiv);

    if (message.images && message.images.length > 0) {
        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'message-images';

        for (const image of message.images) {
            const imgElement = document.createElement('img');
            imgElement.className = 'message-image';
            imgElement.src = image.data;
            imgElement.alt = image.filename;
            imgElement.onclick = () => window.open(image.data, '_blank');
            imagesDiv.appendChild(imgElement);
        }

        contentDiv.appendChild(imagesDiv);
    }

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);

    DOMElements.chatTranscript.appendChild(messageDiv);
    scrollChatToBottom();
}

function appendMessage(role, content, model = null, images = null) {
    const message = {
        role,
        content,
        timestamp: new Date().toISOString(),
        model: model || null,
    };

    if (images && images.length > 0) {
        message.images = images;
    }

    AppState.messages.push(message);
    renderMessageToTranscript(message);
    historyStorage.save(AppState.messages);

    return message;
}

function clearChatTranscript() {
    if (!DOMElements.chatTranscript) return;

    AppState.messages = [];
    historyStorage.clear();
    updateTranscriptPlaceholder();
}

function handleClearChat() {
    if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
        clearChatTranscript();
        updateStatus('Chat history cleared', 'success');
    }
}

function getConversationContextForRequest() {
    return AppState.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
            const messageObj = { role: m.role, content: m.content };
            if (m.images && m.images.length > 0) {
                messageObj.images = m.images;
            }
            return messageObj;
        });
}

function getRequestBaseUrlForModel(modelName) {
    const model = getModelByName(modelName);
    const explicitEndpoint = String(model?.endpoint || '').trim();
    return explicitEndpoint || window.OllamaConfig.apiEndpoint;
}

async function requestOllamaChat({ modelName, temperature, maxTokens, onStreamToken, onStreamingStatusChange }) {
    const baseUrl = getRequestBaseUrlForModel(modelName);
    const url = buildOllamaUrlForBase(baseUrl, '/api/chat');

    const payload = {
        model: modelName,
        messages: getConversationContextForRequest(),
        stream: true,
        options: {
            temperature,
            num_predict: maxTokens,
        },
    };

    const chatTimeoutMs = typeof window.OllamaConfig.chatTimeoutMs === 'number' ? window.OllamaConfig.chatTimeoutMs : 120_000;
    const controller = AppState.abortController || new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), chatTimeoutMs);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error('No response body available');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let totalTokens = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter((line) => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        const token = data?.message?.content || '';

                        if (token) {
                            accumulatedContent += token;
                            if (typeof onStreamToken === 'function') {
                                onStreamToken(token);
                            }
                        }

                        if (data?.eval_count) {
                            totalTokens = data.eval_count;
                        }
                        if (data?.prompt_eval_count) {
                            totalTokens += data.prompt_eval_count;
                        }
                    } catch (err) {
                        console.warn('Failed to parse stream line:', line, err);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        if (!accumulatedContent) {
            throw new Error('No response content received from Ollama.');
        }

        return { content: accumulatedContent, tokenCount: totalTokens || undefined };
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Request cancelled');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Scroll chat transcript to bottom
 */
function scrollChatToBottom() {
    if (!DOMElements.chatTranscript) return;

    setTimeout(() => {
        DOMElements.chatTranscript.scrollTop = DOMElements.chatTranscript.scrollHeight;
    }, 0);
}

/**
 * Handle stop/cancel streaming
 */
function handleStopStreaming() {
    if (AppState.abortController) {
        AppState.abortController.abort();
        AppState.isStreaming = false;
    }
}

/**
 * Set streaming state
 */
function setStreamingState(isStreaming) {
    AppState.isStreaming = isStreaming;
    if (DOMElements.sendButton) {
        DOMElements.sendButton.style.display = isStreaming ? 'none' : 'block';
    }
    if (DOMElements.stopButton) {
        DOMElements.stopButton.style.display = isStreaming ? 'block' : 'none';
    }
    renderInstalledModels();
}

/**
 * Update streaming message content in the UI
 */
function updateStreamingMessageInUI(messageIndex, content) {
    if (!DOMElements.chatTranscript || messageIndex >= AppState.messages.length) return;

    const messages = DOMElements.chatTranscript.querySelectorAll('.message');
    if (messageIndex < messages.length) {
        const messageElement = messages[messageIndex];
        const textElement = messageElement.querySelector('.message-text');
        if (textElement) {
            textElement.textContent = content;
            scrollChatToBottom();
        }
    }
}

/**
 * Set loading state
 */
function setLoadingState(isLoading) {
    AppState.isLoading = isLoading;
    if (DOMElements.sendButton) {
        DOMElements.sendButton.disabled = isLoading;
        if (!AppState.isStreaming) {
            DOMElements.sendButton.textContent = isLoading ? 'Sending...' : 'Send';
        }
    }
    if (DOMElements.messageInput) {
        DOMElements.messageInput.disabled = isLoading;
    }
}

/**
 * Update status bar
 */
function updateStatus(message, status = 'ready') {
    if (!DOMElements.statusText) return;

    DOMElements.statusText.textContent = message;
    DOMElements.statusText.className = `status-${status}`;

    // Log status changes
    console.log(`[${status.toUpperCase()}] ${message}`);
}

/**
 * Update token count display
 */
function updateTokenCount(count) {
    if (!DOMElements.tokenCount) return;
    DOMElements.tokenCount.textContent = `${count} tokens`;
}

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('Initializing Ollama Wrapper SPA...');

    // Initialize theme
    themeManager.initialize();

    // Initialize DOM elements
    initializeDOMElements();

    // Validate DOM elements
    if (!validateDOMElements()) {
        console.error('Failed to initialize application: missing DOM elements');
        updateStatus('Application initialization failed', 'error');
        return;
    }

    // Setup event listeners
    setupEventListeners();

    // Load chat history before rendering placeholder
    const savedMessages = historyStorage.load();
    if (Array.isArray(savedMessages) && savedMessages.length > 0) {
        AppState.messages = savedMessages;
        // Replay messages to the transcript
        for (const message of savedMessages) {
            renderMessageToTranscript(message);
        }
        console.log(`Loaded ${savedMessages.length} messages from chat history`);
    }

    // Set initial status
    updateStatus('Ready', 'success');

    // Load available model sources
    refreshModels({ preserveSelection: false });

    // Log configuration
    console.log('Configuration loaded:', window.OllamaConfig.getConfig());
    console.log('Application initialized successfully');
}

/**
 * Wait for DOM to be ready and initialize application
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already ready
    initializeApp();
}

// Export for testing or external use
window.AppState = AppState;
window.ThemeManager = themeManager;
window.HistoryStorage = HistoryStorage;
window.OllamaApp = {
    addMessage: appendMessage,
    clearChat: clearChatTranscript,
    setStatus: updateStatus,
    setModel: handleModelChange,
    refreshModels,
    pullModel,
    deleteModel,
    setTheme: (theme) => {
        if (theme === 'light' || theme === 'dark') {
            themeManager.applyTheme(theme);
            localStorage.setItem('ollama-theme', theme);
        }
    },
    getTheme: () => themeManager.currentTheme,
};
