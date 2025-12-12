/**
 * Ollama Local Wrapper - SPA Application
 * Main application script for the browser-based Ollama wrapper
 */

// Global Configuration Object
const DefaultOllamaConfig = {
    apiEndpoint: 'http://localhost:11434',
    modelManifestUrl: 'manifest.json',
    fetchRetries: 2,
    fetchRetryDelayMs: 450,
    fetchTimeoutMs: 4000,

    defaultModel: 'llama2',
    defaultTemperature: 0.7,
    defaultMaxTokens: 512,
    conversationHistory: [],

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
    conversationHistory: [],

    availableModels: [],
};

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
                `Unable to reach Ollama at ${apiBase}. Start Ollama and click “Refresh”. (The app will still show any cloud models.)`,
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
    if (!modelName) {
        AppState.currentModel = null;
        setModelMeta(null);
        updateStatus('No model selected', 'warning');
        return;
    }

    const model = getModelByName(modelName);

    AppState.currentModel = modelName;
    AppState.conversationHistory = [];
    clearChatTranscript();

    setModelMeta(model);

    const metaBits = [];
    if (model && model.sources?.includes('local')) metaBits.push('local');
    if (model && model.sources?.includes('cloud')) metaBits.push('cloud');

    updateStatus(`Model changed to: ${modelName}${metaBits.length ? ` (${metaBits.join(' + ')})` : ''}`, 'success');

    console.log('Model selected:', modelName);
    console.log('Current configuration:', window.OllamaConfig.getConfig());
}

/**
 * Handle message form submission
 */
function handleMessageSubmit(e) {
    e.preventDefault();

    if (!AppState.currentModel) {
        updateStatus('Please select a model first', 'warning');
        return;
    }

    const message = DOMElements.messageInput.value.trim();

    if (!message) {
        updateStatus('Message cannot be empty', 'warning');
        return;
    }

    // Add user message to transcript
    addMessageToTranscript(message, 'user');

    // Clear input
    DOMElements.messageInput.value = '';
    if (DOMElements.messageInput) {
        DOMElements.messageInput.style.height = 'auto';
    }

    // Simulate API call and response (placeholder)
    setLoadingState(true);
    updateStatus('Generating response...', 'loading');

    // Simulate async operation
    setTimeout(() => {
        const response = `This is a placeholder response from ${AppState.currentModel}. ` +
            `Temperature: ${AppState.temperature}, Max Tokens: ${AppState.maxTokens}`;
        addMessageToTranscript(response, 'assistant');
        setLoadingState(false);
        updateStatus('Ready', 'success');
        updateTokenCount(response.split(' ').length);
    }, 1000);
}

/**
 * Handle message input keydown (Shift+Enter for new line, Enter for submit)
 */
function handleMessageInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        DOMElements.messageForm.dispatchEvent(new Event('submit'));
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
 * Add message to chat transcript
 */
function addMessageToTranscript(text, sender) {
    if (!DOMElements.chatTranscript) return;

    // Clear placeholder if it exists
    const placeholder = DOMElements.chatTranscript.querySelector('.placeholder-content');
    if (placeholder) {
        placeholder.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);
    DOMElements.chatTranscript.appendChild(messageDiv);

    // Scroll to bottom
    scrollChatToBottom();

    // Store in history
    AppState.conversationHistory.push({
        sender,
        text,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Clear chat transcript
 */
function clearChatTranscript() {
    if (!DOMElements.chatTranscript) return;

    DOMElements.chatTranscript.innerHTML = `
        <div class="placeholder-content text-center text-muted">
            <p>Conversation started. Send a message to begin.</p>
        </div>
    `;
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
 * Set loading state
 */
function setLoadingState(isLoading) {
    AppState.isLoading = isLoading;
    if (DOMElements.sendButton) {
        DOMElements.sendButton.disabled = isLoading;
        DOMElements.sendButton.textContent = isLoading ? 'Sending...' : 'Send';
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
window.OllamaApp = {
    addMessage: addMessageToTranscript,
    clearChat: clearChatTranscript,
    setStatus: updateStatus,
    setModel: handleModelChange,
    refreshModels,
};
