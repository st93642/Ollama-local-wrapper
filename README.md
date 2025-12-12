# Ollama Local Wrapper

A lightweight, browser-based single-page app (SPA) for chatting with [Ollama](https://ollama.com) models running on your machine.

There’s no separate backend server for this project—the app talks directly to the Ollama HTTP API (default: `http://127.0.0.1:11434`).

## Overview

The wrapper provides a user-friendly web interface for:

- **Local model discovery** via Ollama (`/api/tags`) with a **Refresh** button
- **Streaming chat responses** (tokens appear as the model generates)
- **Stop generation** button to cancel an in-progress response
- **Conversation transcript** with message history
- **Settings**: temperature + max tokens
- Optional **“cloud” model entries** loaded from `manifest.json` (useful when pointing some models at a different Ollama-compatible base URL)

## Project Structure

```text
.
├── index.html      # Main HTML
├── style.css       # Styling
├── app.js          # SPA logic (calls Ollama /api/* endpoints)
├── manifest.json   # Optional cloud-model list
└── README.md       # This file
```

## Getting Started

### 1) Install Ollama locally

Follow the official instructions at <https://ollama.com/download>.

Common options:

- **macOS**
  - Download the macOS app from the link above, or
  - Install via Homebrew (if you prefer):

    ```bash
    brew install ollama
    ```

- **Linux**

  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```

- **Windows**
  - Download and run the Windows installer from the link above.

After installing, ensure the Ollama server is running and reachable at `http://localhost:11434`.

Quick check:

```bash
curl http://localhost:11434/api/tags
```

### 2) Pull (download) at least one model

In a terminal:

```bash
ollama pull llama3.2
# or run directly (pulls if needed)
ollama run llama3.2
```

Confirm you have models available:

```bash
ollama list
```

### 3) Open the wrapper

Just open `index.html` in your browser.

- If your browser blocks local-file fetches (some configurations do), serve this folder as static files using any simple file server.
- No backend/API server is needed for this project—only the Ollama server.

### 4) Configure CORS (Important!)

Since this app runs in the browser, Ollama must allow requests from your browser's origin.

**Linux / macOS:**
```bash
OLLAMA_ORIGINS="*" ollama serve
```

**Windows (PowerShell):**
```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

If running as a system service (Linux systemd), add `Environment="OLLAMA_ORIGINS=*"` to your service override:
```bash
systemctl edit ollama.service
# Add:
# [Service]
# Environment="OLLAMA_ORIGINS=*"
systemctl restart ollama
```

## Configuration

The app reads configuration from a global `window.OllamaConfig` object.

Defaults (see `app.js`):

- `apiEndpoint`: `http://127.0.0.1:11434`
- `modelManifestUrl`: `manifest.json`
- `chatTimeoutMs`: (optional) defaults to 120s

Example override (set before `app.js` is loaded, or from the browser console):

```js
window.OllamaConfig = {
  apiEndpoint: 'http://127.0.0.1:11434',
  modelManifestUrl: 'manifest.json',
  defaultModel: 'llama3.2',
  defaultTemperature: 0.7,
  defaultMaxTokens: 512,
  chatTimeoutMs: 120_000,
};
```

### Cloud models (`manifest.json`)

`manifest.json` can define additional models and an alternate base URL to send requests to (useful for hosted Ollama-compatible endpoints).

The app will:

- always try to load local models from `apiEndpoint` (`/api/tags`)
- also try to load optional cloud models from `modelManifestUrl`

If the manifest can’t be loaded, the app will still work with local models.

## Troubleshooting

### “No models found”

1. Make sure Ollama is running.
2. Make sure you’ve pulled at least one model:

   ```bash
   ollama pull llama3.2
   ```

3. Click **Refresh** in the UI.

### “Unable to reach Ollama …”

- Verify the Ollama server is reachable:

  ```bash
  curl http://localhost:11434/api/tags
  ```

- If Ollama is on a different machine or port, set `window.OllamaConfig.apiEndpoint` accordingly.

### Streaming stops immediately / request cancelled

- Long generations are aborted after `chatTimeoutMs` (default 120s). Increase it via `window.OllamaConfig.chatTimeoutMs`.

## License

See [LICENSE](LICENSE).
