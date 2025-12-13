# Copilot Instructions for Ollama Local Wrapper

## Project Overview

Browser-based SPA that communicates directly with [Ollama](https://ollama.com) HTTP API—**no backend server**. The app talks to `http://127.0.0.1:11434` by default for local models and supports optional cloud model endpoints via `manifest.json`.

## Architecture

```
index.html    → Bootstrap 5 UI shell (model selector, chat transcript, settings, library)
app.js        → Single-file SPA logic (~2200 LOC): state management, API calls, DOM rendering
style.css     → Custom styling on top of Bootstrap with CSS variables for theming
manifest.json → Optional cloud model definitions
```

### Key Components

- **Global Config**: `window.OllamaConfig` merges defaults from `DefaultOllamaConfig` with user overrides. Access via `window.OllamaConfig.getConfig()`. Includes embedded fallback models when `manifest.json` unavailable.
- **State Object**: `AppState` holds runtime state (current model, messages, loading flags, abort controller, active pulls/deletes, library catalog).
- **DOM Cache**: `DOMElements` caches all element references; populated by `initializeDOMElements()`.
- **Model Sources**: Models can be `local` (from Ollama `/api/tags`), `cloud` (from manifest/embedded), or both. Merged by `mergeModels()`. Library models fetched from `libraryUrl` or embedded fallback.
- **Storage**: `HistoryStorage` class manages localStorage persistence (max 1000 messages). `ThemeManager` class handles dark/light theme toggling and persistence.

## Ollama API Integration

```javascript
// Local models fetched from:
buildOllamaUrl('/api/tags')  // → http://127.0.0.1:11434/api/tags

// Chat requests to (per-model endpoint support):
buildOllamaUrlForBase(baseUrl, '/api/chat')

// Model pull (streaming):
buildOllamaUrl('/api/pull')  // POST with { name, stream: true }

// Model delete:
buildOllamaUrl('/api/delete')  // DELETE with { name }

// Streaming: Uses fetch + ReadableStream, not EventSource
// Abort: AppState.abortController for cancellation
```

### Streaming Pattern

All streaming endpoints (chat, pull) follow the same pattern:
1. Create `AbortController` and set timeout
2. Use `fetch()` with `signal`
3. Read via `response.body.getReader()` with `TextDecoder`
4. Parse newline-delimited JSON chunks
5. Handle errors from JSON `data.error` field
6. Always call `reader.releaseLock()` in `finally`

Example from app.js:
```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(line => line.trim());
    for (const line of lines) {
        const data = JSON.parse(line);
        if (data?.error) throw new Error(data.error);
        // Process data...
    }
}
```

## Development Workflow

```bash
# No build step—open index.html directly or serve statically:
python3 -m http.server 8000
# Then visit http://localhost:8000

# Ensure Ollama is running with CORS enabled:
OLLAMA_ORIGINS="*" ollama serve

# Linux systemd users (persistent):
systemctl edit ollama.service
# Add: [Service] Environment="OLLAMA_ORIGINS=*"
systemctl restart ollama
```

## Code Conventions

### Normalization & URL Building
- `normalizeModelName(name)`: Case-insensitive, trimmed model lookups
- `normalizeBaseUrl(baseUrl)`: Ensures trailing slash for consistent URL construction
- `buildOllamaUrl(pathname)`: Builds URL from default `apiEndpoint`
- `buildOllamaUrlForBase(baseUrl, pathname)`: Builds URL from per-model endpoint

### Error Handling & Retry Logic
- `fetchWithTimeout(url, options)`: Wraps fetch with configurable timeout (default 4000ms)
- `fetchJsonWithRetry(url, options)`: Auto-retries failed requests (2 retries, 450ms delay)
- Use direct `fetch()` with `AbortController` for streaming (no retry)
- Error messages: Always check for `data?.error` in JSON responses before handling HTTP status

### UI State Management
- `setErrorBanner(message, variant)`: User-visible errors; variants: `danger`, `warning`
- `updateStatus(text, type)`: Status bar updates; types: `loading`, `success`, `warning`, `error`
- `setLoadingState()`, `setStreamingState()`: Manage button visibility, form disabling
- `setRefreshModelsButtonLoading(isLoading)`, `setModelSelectLoading(isLoading, label)`: Specific UI states

### Message Handling
- Messages stored in `AppState.messages` with structure: `{ role, content, timestamp, model?, images? }`
- Roles: `user`, `assistant`, `system`
- System messages auto-inserted on model switch
- Conversation context built by `getConversationContextForRequest()` filtering only user/assistant messages
- Images attached as base64 strings in `message.images` array for multimodal models

### Model Pull/Delete Tracking
- `activeModelPulls` and `activeModelDeletes` in `AppState` track operations by model name
- Pull states: `{ phase: 'pulling'|'done'|'error', message, controller }`
- Update library UI via `updateLibraryRowFromPullState(modelName)`
- Pull progress parsed from streaming JSON: `{ status, completed, total }`

## Adding Cloud Models

Edit `manifest.json`:
```json
{
  "cloudModels": [
    { "name": "model-name:tag-cloud", "description": "...", "endpoint": "http://127.0.0.1:11434" }
  ]
}
```

Models appear with "Cloud" badge; local+cloud overlap shows "Local + Cloud". Cloud models fallback to embedded list in `DefaultOllamaConfig.embeddedCloudModels` if manifest unavailable.

## Library Feature

- Library models fetched from `window.OllamaConfig.libraryUrl` (if set) or embedded `embeddedLibraryModels`
- Filtered by search query stored in `AppState.librarySearchQuery`
- UI shows model family, tags, Pull/Delete buttons with live progress
- Pull button hidden for locally available models
- Progress updates throttled to every 150ms during pull operations

## Theming

CSS variables define all colors in `:root` (light theme defaults) and `[data-theme="dark"]`. Toggle via `themeManager.toggleTheme()`, persisted in localStorage. Icons swap between sun/moon using Bootstrap Icons.

## Testing Considerations

- Test with Ollama offline to verify graceful degradation (cloud-only mode, embedded model fallback)
- Test abort mid-stream (chat/pull) to verify cleanup and controller release
- Verify model switching mid-conversation appends system message
- Test image attachment for multimodal models (base64 encoding)
- Verify pull timeout handling (default 30min configurable via `pullTimeoutMs`)
- Test library search filtering and UI updates during pull operations
