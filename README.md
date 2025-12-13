# Ollama Local Wrapper

A lightweight, browser-based chat interface for [Ollama](https://ollama.com) models. Open `index.html` directly in your browser—no backend server needed.

## Features

- 💬 **Chat with local models** - Streaming responses with live token generation
- ☁️ **Cloud model support** - Pull and use Ollama cloud models (e.g., DeepSeek-V3.1, Cogito, GPT-OSS)
- 📚 **Model library** - Discover and pull models directly from the UI
- 🎨 **Dark/Light themes** - Toggle with persistent preference
- 🖼️ **Image support** - Attach images for multimodal models
- 💾 **Auto-save history** - Conversations persist in browser storage
- ⚙️ **Configurable** - Adjust temperature, max tokens, and API endpoint

## Quick Start

### 1. Install Ollama

Download from [ollama.com/download](https://ollama.com/download) or:

**Linux:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS:**

```bash
brew install ollama
```

**Windows:** Download installer from the official site

### 2. Enable CORS

**Linux/macOS:**

```bash
OLLAMA_ORIGINS="*" ollama serve
```

**Windows (PowerShell):**

```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

**Linux systemd service:**

```bash
systemctl edit ollama.service
# Add:
# [Service]
# Environment="OLLAMA_ORIGINS=*"
systemctl restart ollama
```

### 3. Pull Models

**Local models:**

```bash
ollama pull llama3.2
ollama pull mistral
```

**Cloud models** (pull from the UI):

- Open `index.html` in your browser
- Go to **Model library** section
- Click **Pull** next to any cloud model (e.g., `cogito-2.1:671b-cloud`, `deepseek-v3.1:671b-cloud`)
- Wait for download to complete
- Model appears in dropdown and is ready to use

### 4. Start Chatting

1. Open `index.html` in your browser
2. Select a model from the dropdown
3. Type your message and press Enter
4. Use Stop button (red) to cancel responses

## Cloud Models

The app includes an embedded library of Ollama cloud models. These models automatically offload to Ollama's cloud service, allowing you to run powerful models without requiring a high-end GPU. Cloud models work seamlessly with your local Ollama installation while inference runs remotely.

> **Note:** Ollama Cloud is currently in preview. An account on [ollama.com](https://ollama.com/) is required.

### Setup for Cloud Models

**Sign in to Ollama (one-time setup):**

```bash
ollama signin
```

This authenticates your local Ollama instance with ollama.com, enabling cloud model access.

### Available Cloud Models

Browse all cloud models at [ollama.com/search?c=cloud](https://ollama.com/search?c=cloud)

### Using Cloud Models

**From the UI:**

1. Run `ollama signin` in terminal (first time only)
2. Open `index.html` in your browser
3. In the **Model library** section, click **Pull** next to a cloud model
4. Wait for manifest download (instant, no large file)
5. Select the model from dropdown and start chatting

**From terminal:**

```bash
ollama run gpt-oss:120b-cloud
```

### Cloud Model Limits

- Some cloud models are **premium** and have usage limits
- If you see "Premium model request limit reached", try a different model or wait before retrying
- Standard cloud models are available to all signed-in users

## Themes

Click the **☀️/🌙** icon (top-right) to toggle between light and dark themes. Your preference is saved automatically.

## Image Support

Attach images for vision-capable models (e.g., `llava`, `qwen3-vl:235b-cloud`):

1. Click **📎** button in message composer
2. Select image(s) (JPEG, PNG, GIF, WebP; max 20MB each, 10 per message)
3. Previews appear below input—click to view full size, **×** to remove
4. Send message with images

Images are saved with chat history and display inline in the transcript.

## Chat History

Conversations are automatically saved in browser localStorage (last 1000 messages). Click **Clear chat** in the sidebar to delete history.

## Configuration (Optional)

Configure the app by setting `window.OllamaConfig` before loading (add to `index.html` or browser console):

```js
window.OllamaConfig = {
  apiEndpoint: 'http://127.0.0.1:11434',      // Ollama API endpoint
  defaultTemperature: 0.7,                     // Default creativity (0-1)
  defaultMaxTokens: 512,                       // Default max response length
  chatTimeoutMs: 120000,                       // Chat timeout (2 minutes)
  pullTimeoutMs: 1800000,                      // Pull timeout (30 minutes)
};
```

## Troubleshooting

"No models found"

1. Ensure Ollama is running: `ollama serve`
2. Pull a model: `ollama pull llama3.2`
3. Check CORS is enabled: `OLLAMA_ORIGINS="*" ollama serve`
4. Click **Refresh** in the UI

"Unable to connect to Ollama"

- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check CORS settings (see step 2 above)
- If using a remote Ollama instance, update `window.OllamaConfig.apiEndpoint`

"Premium model request limit reached"

- Some cloud models (e.g., `gemini-3-pro-preview`) have usage limits
- Try a different cloud model or wait before retrying

Chat hangs or times out

- Increase timeout: `window.OllamaConfig.chatTimeoutMs = 300000` (5 minutes)
- Check Ollama logs for errors: `journalctl -u ollama -f` (Linux)

## License

See [LICENSE](LICENSE).
