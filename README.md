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
- A **Model library** sidebar section that lists models known from the manifest / optional library feed but not yet installed, with a **Pull** button and streaming progress

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
- `libraryUrl`: (optional) URL to fetch additional model catalog entries for the **Model library** panel
- `pullTimeoutMs`: (optional) timeout for a model pull request (defaults to 30 minutes)
- `chatTimeoutMs`: (optional) defaults to 120s
- `defaultTheme`: `'dark'` (optional; can also be `'light'`)

Example override (set before `app.js` is loaded, or from the browser console):

```js
window.OllamaConfig = {
  apiEndpoint: 'http://127.0.0.1:11434',
  modelManifestUrl: 'manifest.json',

  // Optional: add an extra "model catalog" feed for the Model library panel
  libraryUrl: null,

  // Optional: allow long pulls (large models can take a while)
  pullTimeoutMs: 30 * 60 * 1000,

  defaultModel: 'llama3.2',
  defaultTemperature: 0.7,
  defaultMaxTokens: 512,
  chatTimeoutMs: 120_000,
  defaultTheme: 'dark', // or 'light'
};
```

## Theming

The app includes a built-in light/dark theme toggle in the header (top-right corner).

### Theme Behavior

- **Default**: Dark theme on first visit (when no preference is saved)
- **Persistence**: Your theme choice is saved to browser `localStorage` and restored on next visit
- **Fallback**: If no stored preference, the app respects your system's `prefers-color-scheme` setting
- **Override**: You can set a default theme via `window.OllamaConfig.defaultTheme = 'light'` or `'dark'` before the app loads

### Switching Themes

Click the theme toggle button (☀️ icon for light mode, 🌙 icon for dark mode) in the header to switch instantly. All UI elements—including messages, sidebar, chat area, and controls—update their colors in real-time to maintain readability and contrast in both themes.

Both themes use semantic CSS custom properties to ensure consistent, accessible colors across all UI components.

### Cloud models (`manifest.json`)

`manifest.json` can define additional models and an alternate base URL to send requests to (useful for hosted Ollama-compatible endpoints).

The app will:

- always try to load local models from `apiEndpoint` (`/api/tags`)
- also try to load optional cloud models from `modelManifestUrl`

If the manifest can’t be loaded, the app will still work with local models.

## Model library + pulling models

The sidebar includes a **Model library** section that helps you install missing models.

- The list is built from:
  - `manifest.json` (`cloudModels`) / the embedded fallback list, and
  - an optional `window.OllamaConfig.libraryUrl` feed (if configured).
- The list is **filtered against your installed models** from `/api/tags`, so it only shows models that are known in the catalog but **not installed locally**.
- Clicking **Pull** issues a streaming `POST /api/pull` to `apiEndpoint` and shows progress updates inline.
- When the pull finishes, the app automatically refreshes `/api/tags` so the model becomes selectable.
- Starting a second pull for the same model while one is already running is blocked.

### `libraryUrl` response format

The app is lenient about the feed shape. It accepts either:

- an array of entries, or
- an object containing an array under `models`, `items`, `results`, or `data`.

Each entry should have at least a `name` field, and can optionally include `description`, `tags`, `family`, and `parameter_size`.

## Installed models + deleting models

The sidebar includes an **Installed models** panel that lists your local models as reported by Ollama (`GET /api/tags`).

- The currently selected model is labeled **Active**.
- Each installed model has a 🗑 delete action.

### Safe removal workflow

1. **Stop generation first**
   - If a response is currently streaming, click **Stop**.
   - Model deletion is blocked while streaming to avoid breaking an active chat.
2. In **Installed models**, click 🗑 next to the model and confirm the prompt.

Under the hood, the app calls `DELETE /api/delete` (falling back to `POST /api/delete` on older Ollama builds), then refreshes the model list automatically.

If you delete the currently selected model, the app will clear the active model selection and you’ll need to choose another model before sending the next message.

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

## Image Attachments

The app supports attaching images to your messages for multimodal models.

### How to attach images

1. Click the **📎** (attachment) button in the message composer
2. Select one or more image files from your computer
3. Thumbnail previews appear below the message input
4. Click on a thumbnail to open the full-size image
5. Click the **×** button on a thumbnail to remove it before sending
6. Send your message with the attached images

### Supported formats and limits

- **Supported formats**: JPEG, PNG, GIF, WebP
- **Maximum file size**: 20 MB per image
- **Maximum images per message**: 10

### Multimodal model requirement

Image attachments only work with models that support vision/multimodal capabilities. The app will warn you if the selected model may not support images. Recommended models include:

- `llava` and variants (e.g., `llava:13b`)
- `qwen` models with vision support
- `minicpm` and `minicpm-v`
- `mistral-large` (multimodal)
- Other models with built-in vision support

If you attach images with a non-multimodal model, the images will still be sent with your message, but the model may ignore them.

### How images appear in conversation

- **In the composer**: Thumbnail previews show before you send
- **In the transcript**: Full images appear inline with both user and assistant messages
- **Clickable images**: Click any message image to view it in full size in a new window

### Chat history with images

Images are automatically saved with your chat history, so they'll appear in your transcript when you reload the app.

## Chat History

The app automatically persists your conversation history across browser sessions.

### Where is it stored?

By default, chat history is stored in your browser's **localStorage** under the key `ollama-chat-history`. This means:

- **Persistence**: Your chat history is saved locally on your machine and restored when you reopen the app
- **Privacy**: History is stored in your browser only and is never sent to any server
- **Browser-specific**: Each browser profile maintains its own separate chat history

### How to clear history

There are two ways to clear your chat history:

1. **In the UI**: Click the **"Clear chat"** button in the left sidebar. You'll be asked to confirm before the history is deleted.
2. **Manually**: Open your browser's Developer Tools → Storage/Application tab → LocalStorage → Find `ollama-chat-history` and delete it.

### History retention limit

By default, the app keeps the last 1000 messages to prevent localStorage from becoming too large. You can customize this limit via configuration:

```js
window.OllamaConfig = {
    maxHistoryMessages: 500, // Keep only the last 500 messages
};
```

### Desktop wrapper configuration

For desktop applications wrapping this UI (like Tauri or Electron apps), you can optionally store history in a custom directory instead of browser localStorage:

```js
window.OllamaConfig = {
    historyPath: '~/.ollama/chat-history.json', // Desktop app storage path
};
```

When `historyPath` is configured, the app will attempt to store history at that filesystem location instead of using localStorage. This allows for better integration with native desktop wrappers.

## License

See [LICENSE](LICENSE).
