/**
 * Ollama Local Wrapper - SPA Application
 * Main application script for the browser-based Ollama wrapper
 */

// Global Configuration Object
window.OllamaConfig = {
    apiEndpoint: 'http://localhost:11434',
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
            defaultModel: this.defaultModel,
            defaultTemperature: this.defaultTemperature,
            defaultMaxTokens: this.defaultMaxTokens,
        };
    }
};

// Application State
const AppState = {
    currentModel: null,
    temperature: window.OllamaConfig.defaultTemperature,
    maxTokens: window.OllamaConfig.defaultMaxTokens,
    isLoading: false,
    conversationHistory: [],
};

// DOM Elements Cache
const DOMElements = {
    app: null,
    modelSelect: null,
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

/**
 * Initialize DOM elements references
 */
function initializeDOMElements() {
    DOMElements.app = document.getElementById('app');
    DOMElements.modelSelect = document.getElementById('modelSelect');
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
        .filter(([key, element]) => !element)
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
function handleModelChange(model) {
    if (!model) {
        updateStatus('No model selected', 'warning');
        return;
    }

    AppState.currentModel = model;
    AppState.conversationHistory = [];
    clearChatTranscript();
    updateStatus(`Model changed to: ${model}`, 'success');
    
    console.log('Model selected:', model);
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
};
