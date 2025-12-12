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

// Application State
const AppState = {
    currentModel: null,
    temperature: window.OllamaConfig.defaultTemperature,
    maxTokens: window.OllamaConfig.defaultMaxTokens,
    isLoading: false,
    isRefreshingModels: false,
    isStreaming: false,

    messages: [],

    availableModels: [],
    
    // For cancelling streaming requests
    abortController: null,
};

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

    temperatureSlider: null,
    temperatureValue: null,
    maxTokensInput: null,
    chatTranscript: null,
    messageForm: null,
    messageInput: null,
    sendButton: null,
    stopButton: null,
    statusText: null,
    tokenCount: null,
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

        const provenanceLabel = model.sources.includes('local') && model.sources.includes('cloud')
            ? 'Local + Cloud'
            : model.sources.includes('local')
                ? 'Local'
                : 'Cloud';

        option.textContent = `${model.name} (${provenanceLabel})`;

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

        const [cloudModels, localModels] = await Promise.all([cloudPromise, localPromise]);

        AppState.availableModels = mergeModels(localModels, cloudModels);

        setModelSelectLoading(false);
        renderModelSelect(AppState.availableModels, { preserveSelection });

        if (AppState.availableModels.length === 0) {
            updateStatus('No models available', 'warning');
        } else {
            updateStatus('Ready', 'success');
        }
    } catch (err) {
        console.error('Failed to refresh models:', err);
        setErrorBanner('Failed to load models. Please try again.', 'danger');
        AppState.availableModels = [];
        setModelSelectLoading(false);
        renderModelSelect(AppState.availableModels, { preserveSelection: false });
        updateStatus('Failed to load models', 'error');
    } finally {
        setRefreshModelsButtonLoading(false);
        AppState.isRefreshingModels = false;
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

    DOMElements.temperatureSlider = document.getElementById('temperatureSlider');
    DOMElements.temperatureValue = document.getElementById('temperatureValue');
    DOMElements.maxTokensInput = document.getElementById('maxTokensInput');
    DOMElements.chatTranscript = document.getElementById('chatTranscript');
    DOMElements.messageForm = document.getElementById('messageForm');
    DOMElements.messageInput = document.getElementById('messageInput');
    DOMElements.sendButton = document.getElementById('sendButton');
    DOMElements.stopButton = document.getElementById('stopButton');
    DOMElements.statusText = document.getElementById('statusText');
    DOMElements.tokenCount = document.getElementById('tokenCount');
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

    // Message Input - Auto-expand textarea
    if (DOMElements.messageInput) {
        DOMElements.messageInput.addEventListener('input', autoExpandTextarea);
        DOMElements.messageInput.addEventListener('keydown', handleMessageInputKeydown);
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

    if (!message) {
        updateStatus('Message cannot be empty', 'warning');
        return;
    }

    const modelAtSend = AppState.currentModel;
    const temperatureAtSend = AppState.temperature;
    const maxTokensAtSend = AppState.maxTokens;

    appendMessage('user', message, modelAtSend);

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
            updateStatus('Failed to connect', 'error');
        } else {
            setErrorBanner(errorMessage, 'danger');
            AppState.messages[assistantMessageIndex].content = `[Error: ${errorMessage}]`;
            updateStreamingMessageInUI(assistantMessageIndex, AppState.messages[assistantMessageIndex].content);
            updateStatus('Failed to generate response', 'error');
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

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);

    DOMElements.chatTranscript.appendChild(messageDiv);
    scrollChatToBottom();
}

function appendMessage(role, content, model = null) {
    const message = {
        role,
        content,
        timestamp: new Date().toISOString(),
        model: model || null,
    };

    AppState.messages.push(message);
    renderMessageToTranscript(message);

    return message;
}

function clearChatTranscript() {
    if (!DOMElements.chatTranscript) return;

    AppState.messages = [];
    updateTranscriptPlaceholder();
}

function getConversationContextForRequest() {
    return AppState.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));
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
window.OllamaApp = {
    addMessage: appendMessage,
    clearChat: clearChatTranscript,
    setStatus: updateStatus,
    setModel: handleModelChange,
    refreshModels,
    setTheme: (theme) => {
        if (theme === 'light' || theme === 'dark') {
            themeManager.applyTheme(theme);
            localStorage.setItem('ollama-theme', theme);
        }
    },
    getTheme: () => themeManager.currentTheme,
};
