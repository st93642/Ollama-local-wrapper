# Copilot Instructions for Ollama Local Wrapper

## Project Overview

Browser-based SPA that communicates directly with [Ollama](https://ollama.com) HTTP API—**no backend server**. The app talks to `http://localhost:11434` by default for local models and supports optional cloud model endpoints via `manifest.json`.

## Architecture

```
index.html  → Bootstrap 5 UI shell (model selector, chat transcript, settings)
app.js      → Single-file SPA logic (~1000 LOC): state management, API calls, DOM rendering
style.css   → Custom styling on top of Bootstrap
manifest.json → Optional cloud model definitions
```

### Key Patterns

- **Global Config**: `window.OllamaConfig` merges defaults from `DefaultOllamaConfig` with user overrides. Access via `window.OllamaConfig.getConfig()`.
- **State Object**: `AppState` holds all runtime state (current model, messages, loading flags, abort controller).
- **DOM Cache**: `DOMElements` caches all element references; populated by `initializeDOMElements()`.
- **Model Sources**: Models can be `local` (from Ollama `/api/tags`), `cloud` (from manifest), or both. Merged by `mergeModels()`.

## Ollama API Integration

```javascript
// Local models fetched from:
buildOllamaUrl('/api/tags')  // → http://localhost:11434/api/tags

// Chat requests to:
buildOllamaUrlForBase(baseUrl, '/api/chat')  // Supports custom endpoints per model

// Streaming: Uses fetch + ReadableStream, not EventSource
// Abort: AppState.abortController for cancellation
```

## Development Workflow

```bash
# No build step—open index.html directly or serve statically:
python3 -m http.server 8000
# Then visit http://localhost:8000

# Ensure Ollama is running:
curl http://localhost:11434/api/tags
```

## Code Conventions

- **Normalize helpers**: Use `normalizeModelName()` for case-insensitive model lookups, `normalizeBaseUrl()` for trailing-slash handling
- **Fetch with retry**: `fetchJsonWithRetry()` for non-streaming; direct `fetch()` with `AbortController` for streaming
- **Error display**: `setErrorBanner(message, variant)` for user-visible errors; variants: `danger`, `warning`
- **Status updates**: `updateStatus(text, type)` where type is `loading`, `success`, `warning`, `error`
- **UI state toggles**: `setLoadingState()`, `setStreamingState()` manage button visibility and form disabling

## Adding Cloud Models

Edit `manifest.json`:
```json
{
  "cloudModels": [
    { "name": "model-name", "description": "...", "endpoint": "https://..." }
  ]
}
```

Models appear with "Cloud" badge; local+cloud overlap shows "Local + Cloud".

## Testing Considerations

- Test with Ollama offline to verify graceful degradation (cloud-only mode)
- Test abort mid-stream to verify cleanup
- Verify model switching mid-conversation appends system message
