# Self-Contained HTML Bundle

This document provides detailed instructions for building, distributing, and using the self-contained HTML bundle of Ollama Local Wrapper.

## Overview

The self-contained bundle (`dist/ollama-wrapper.html`) is a single HTML file that includes all application code, styles, and dependencies inlined. It can be opened directly from the filesystem via the `file://` protocol without requiring a web server.

**Key Benefits:**

- No web server needed
- Easy to distribute (single ~400 KB file)
- Works offline once downloaded
- All features preserved (streaming, chat history, image support)

## Building the Bundle

### Prerequisites

- Python 3.6 or higher
- Source files in the project directory:
  - `index.html`
  - `app.js`
  - `style.css`
  - `manifest.json`
  - `vendor/bootstrap.min.css`
  - `vendor/bootstrap.bundle.min.js`

### Build Steps

1. Navigate to the project root directory:

   ```bash
   cd /path/to/ollama-local-wrapper
   ```

2. Run the bundler script:

   ```bash
   python3 scripts/bundle_single_file.py
   ```

3. The bundled file will be generated at:

   ```
   dist/ollama-wrapper.html
   ```

4. Verify the output:

   ```bash
   ls -lh dist/ollama-wrapper.html
   ```

   Expected file size: ~400 KB

### Custom Output Path

To specify a custom output location:

```bash
python3 scripts/bundle_single_file.py path/to/custom-output.html
```

### What Gets Bundled

The bundler:

- Inlines all CSS (Bootstrap + custom styles, minified)
- Inlines all JavaScript (Bootstrap + app logic)
- Converts Bootstrap icon classes to inline SVG elements
- Embeds manifest data as JSON (`<script type="application/json">`)
- Removes external CDN dependencies
- Outputs a single, portable HTML file

## Using the Bundle

### Opening the File

**Method 1: File Browser**

1. Navigate to `dist/` directory
2. Double-click `ollama-wrapper.html`
3. Opens in your default browser

**Method 2: Command Line**

macOS:

```bash
open dist/ollama-wrapper.html
```

Linux:

```bash
xdg-open dist/ollama-wrapper.html
# or
firefox dist/ollama-wrapper.html
```

Windows:

```cmd
start dist\ollama-wrapper.html
```

**Method 3: Drag and Drop**

- Drag `ollama-wrapper.html` into an open browser window

### Configuring the API Endpoint

The bundle defaults to `http://127.0.0.1:11434` (standard Ollama API endpoint). To change this:

**Option 1: UI Settings (Recommended)**

1. Open the bundle in your browser
2. Look for the **Settings** panel in the left sidebar
3. Scroll to **API Endpoint**
4. Enter your custom endpoint (e.g., `http://192.168.1.100:11434`)
5. Click **Update** or press Enter
6. Setting is saved to browser's localStorage

**Option 2: Browser Console (Advanced)**

Before the app initializes, set the configuration:

```javascript
window.OllamaConfig = {
  apiEndpoint: 'http://your-server:11434',
  defaultTemperature: 0.7,
  defaultMaxTokens: 512,
  chatTimeoutMs: 120000,
  pullTimeoutMs: 1800000
};
```

Refresh the page after setting this configuration.

**Option 3: Edit the HTML File**

Add a `<script>` tag before the main application JavaScript:

```html
<script>
  window.OllamaConfig = {
    apiEndpoint: 'http://your-server:11434'
  };
</script>
```

**Resetting to Default:**

- In UI: Click the **Reset** button next to the API Endpoint field
- Via console: `localStorage.removeItem('ollamaApiEndpoint')`

## Browser Considerations

### CORS (Cross-Origin Resource Sharing)

When using `file://` protocol to access `http://127.0.0.1:11434`, browsers enforce CORS policies that may block requests.

**Solution: Configure Ollama to Allow CORS**

**Linux/macOS:**

```bash
OLLAMA_ORIGINS="*" ollama serve
```

**Windows PowerShell:**

```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

**Linux systemd service (persistent):**

```bash
sudo systemctl edit ollama.service
```

Add:

```ini
[Service]
Environment="OLLAMA_ORIGINS=*"
```

Then:

```bash
sudo systemctl restart ollama
```

**Note:** Setting `OLLAMA_ORIGINS="*"` allows all origins. For production, specify the exact origin:

```bash
OLLAMA_ORIGINS="file://" ollama serve
```

### localStorage Persistence

The bundle uses browser's localStorage for:

- Chat history (last 1000 messages)
- API endpoint configuration
- UI preferences (theme, settings)
- Model selection

**Important:** Each `file://` path is treated as a separate origin:

- `file:///path/to/ollama-wrapper.html` → separate storage
- `file:///different/path/ollama-wrapper.html` → separate storage

**To share history across locations:**

- Keep the file in the same location
- Or use a local web server instead of `file://`

**Storage limits:**

- Most browsers: 5-10 MB for localStorage
- Chat history is automatically limited to 1000 messages
- Clearing browser data will remove all saved history

### Browser-Specific Notes

**Chrome/Edge:**

- Works reliably with `file://` protocol
- localStorage works as expected
- May show CORS warnings in console (expected)

**Firefox:**

- Works well with `file://` protocol
- May prompt for permission to access localStorage
- CORS handling is strict; ensure Ollama is configured correctly

**Safari:**

- Works with `file://` protocol
- localStorage is supported
- May have stricter CORS enforcement

**Common Issues:**

- **"Failed to fetch"**: Ensure Ollama is running and CORS is configured
- **"Network error"**: Check firewall/antivirus isn't blocking connections
- **History not saving**: Check browser localStorage isn't disabled
- **Models not loading**: Verify API endpoint is correct and accessible

## Manual Verification Checklist

Use this checklist to verify the bundle works correctly before distribution.

### Pre-Verification Setup

1. ✅ Build the bundle: `python3 scripts/bundle_single_file.py`
2. ✅ Ensure Ollama is running: `ollama serve` (with CORS enabled)
3. ✅ Verify at least one model is available: `ollama list`

### Core Functionality Tests

**1. Application Launch**

- [ ] Open `dist/ollama-wrapper.html` in browser
- [ ] UI loads without errors (check browser console)
- [ ] Sidebar displays model selector, library, and settings
- [ ] Chat area shows placeholder message
- [ ] Theme toggle button works (light/dark mode)

**2. Model Selection**

- [ ] Model dropdown populates with available models
- [ ] Can select a model from dropdown
- [ ] Selected model persists after page refresh

**3. API Connection**

- [ ] Status bar shows "Connected" or similar ready state
- [ ] No CORS errors in browser console
- [ ] Model library loads cloud models from embedded manifest

**4. Chat Functionality**

- [ ] Type message in text area and press Enter
- [ ] Message appears in transcript with "user" avatar
- [ ] Assistant response streams in real-time (tokens appear progressively)
- [ ] Stop button is visible during streaming
- [ ] Can click Stop button to cancel response
- [ ] Token count updates during streaming
- [ ] Timestamp shows on messages

**5. Streaming Responses**

- [ ] Response text appears token-by-token (not all at once)
- [ ] Transcript auto-scrolls as tokens arrive
- [ ] Stop button works (cancels mid-stream)
- [ ] Status bar shows "Generating..." during streaming
- [ ] No JavaScript errors during streaming

**6. Chat History Persistence**

- [ ] Send 2-3 messages in conversation
- [ ] Refresh the page (`Ctrl+R` / `Cmd+R`)
- [ ] All messages reappear in transcript
- [ ] Timestamps and model names are preserved
- [ ] Click "Clear chat" button
- [ ] Confirm dialog appears
- [ ] Accept → transcript clears and localStorage is empty
- [ ] Refresh page → transcript remains empty (history cleared)

**7. Settings Persistence**

- [ ] Change temperature slider
- [ ] Change max tokens slider
- [ ] Update API endpoint
- [ ] Refresh page
- [ ] All settings restore to saved values

**8. Model Library**

- [ ] Click "Pull" button on a cloud model
- [ ] Progress bar shows download progress
- [ ] Model appears in dropdown when complete
- [ ] Can select and chat with newly pulled model

**9. Image Support (if vision model available)**

- [ ] Click attach button (📎)
- [ ] Select an image file
- [ ] Thumbnail appears below text area
- [ ] Send message with image
- [ ] Image displays inline in transcript
- [ ] Assistant responds (with vision-capable model)

**10. Error Handling**

- [ ] Stop Ollama service
- [ ] Try to send a message
- [ ] Error message displays in UI
- [ ] Start Ollama service
- [ ] Click "Refresh" → models load again

### Browser Compatibility

Test on multiple browsers:

- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (macOS)
- [ ] Edge (Windows)

For each browser:

- [ ] Bundle loads without errors
- [ ] Chat functionality works
- [ ] localStorage persists

### Network Scenarios

**Local Network Access:**

- [ ] Change API endpoint to remote server (e.g., `http://192.168.1.100:11434`)
- [ ] Verify connection works
- [ ] Chat functions normally

**Offline Mode:**

- [ ] Open bundle while offline (no internet)
- [ ] UI loads (no external resources)
- [ ] LocalStorage works
- [ ] Can connect to local Ollama instance

### File Size Verification

```bash
ls -lh dist/ollama-wrapper.html
```

- [ ] File size is ~400 KB (acceptable range: 350-450 KB)
- [ ] If >500 KB, investigate unnecessary inclusions

### Performance Tests

- [ ] Send 10 consecutive messages
- [ ] No memory leaks (check browser DevTools memory)
- [ ] UI remains responsive
- [ ] Streaming performance is smooth

### Regression Tests

After any code changes, verify:

- [ ] Bundle rebuilds successfully
- [ ] All core tests pass (items 1-10 above)
- [ ] No new console errors
- [ ] File size hasn't increased significantly

## Distribution

### Packaging

**Single File:**

- Distribute `dist/ollama-wrapper.html` directly
- Rename if desired (e.g., `ollama-chat.html`)

**With Instructions:**
Create a zip archive:

```bash
zip -r ollama-wrapper-bundle.zip dist/ollama-wrapper.html README.md
```

Or create a release package:

```
ollama-wrapper-v1.0/
├── ollama-wrapper.html
├── README.txt (basic usage instructions)
└── SETUP.txt (Ollama installation + CORS setup)
```

### User Instructions (Minimal)

Include these basic steps for end users:

1. **Install Ollama** (if not already installed):
   - Download from <https://ollama.com/download>
   - Follow platform-specific instructions

2. **Enable CORS** (required for `file://` access):
   - Run: `OLLAMA_ORIGINS="*" ollama serve` (Linux/Mac)
   - Or: `$env:OLLAMA_ORIGINS="*"; ollama serve` (Windows)

3. **Pull a Model**:

   ```bash
   ollama pull llama3.2
   ```

4. **Open the Bundle**:
   - Double-click `ollama-wrapper.html`
   - Or drag into browser window

5. **Start Chatting**:
   - Select model from dropdown
   - Type message and press Enter

### Hosting on Web Server (Optional)

For wider distribution, host on a web server:

**Static Hosting:**

```bash
# Upload to server
scp dist/ollama-wrapper.html user@server:/var/www/html/

# Or use Python's simple server for local testing
cd dist
python3 -m http.server 8000
# Open http://localhost:8000/ollama-wrapper.html
```

**Advantages over `file://`:**

- No CORS configuration needed (if Ollama on same domain)
- Consistent localStorage behavior
- Better for multiple users

**Note:** If hosting on web server, you may need to configure CORS differently:

```bash
OLLAMA_ORIGINS="http://your-domain.com" ollama serve
```

## Troubleshooting

### Bundle Doesn't Load

**Symptoms:** Blank page, console errors
**Solutions:**

- Check browser console for errors
- Verify file isn't corrupted (re-download/rebuild)
- Try a different browser
- Disable browser extensions temporarily

### CORS Errors

**Symptoms:** "Access blocked by CORS policy" in console
**Solutions:**

- Ensure Ollama is started with `OLLAMA_ORIGINS="*"`
- Restart Ollama after changing environment variable
- Check firewall isn't blocking port 11434
- Try hosting on a web server instead of `file://`

### Models Don't Load

**Symptoms:** Empty model dropdown
**Solutions:**

- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check API endpoint in Settings (should be `http://127.0.0.1:11434`)
- Click "Refresh" button
- Check browser console for specific error

### Chat History Not Saving

**Symptoms:** History clears on page refresh
**Solutions:**

- Check localStorage is enabled in browser settings
- Verify not in private/incognito mode
- Check browser storage quota isn't exceeded
- Try clearing and resetting: `localStorage.clear()`

### Streaming Doesn't Work

**Symptoms:** Full response appears at once
**Solutions:**

- Check network tab in DevTools for streaming response
- Verify Ollama version supports streaming (v0.1.0+)
- Try a different model
- Check console for JavaScript errors

### Build Fails

**Symptoms:** Bundler script errors
**Solutions:**

- Verify Python 3.6+ is installed: `python3 --version`
- Check all source files exist in project directory
- Ensure `vendor/` directory contains Bootstrap files
- Check file permissions (readable)

## Advanced Topics

### Customizing the Bundle

**Modify Default Configuration:**

Edit `scripts/bundle_single_file.py` to change defaults:

```python
# Before bundling, inject custom config
config_injection = '''
<script>
  window.OllamaConfig = {
    apiEndpoint: 'http://custom-server:11434',
    defaultTemperature: 0.8
  };
</script>
'''
html = html.replace('</head>', f'{config_injection}\n</head>')
```

**Remove Unnecessary Features:**

To reduce file size, comment out features in `app.js` before bundling:

- Model library (if not needed)
- Image support (if not needed)
- Specific cloud models from manifest

**Branding:**

Edit `index.html` before bundling:

- Change `<title>` tag
- Update navbar brand name
- Add custom logo/favicon

### Security Considerations

**When Using `file://` Protocol:**

- ✅ No external resources loaded
- ✅ All code is local
- ⚠️ API endpoint must be trusted (usually localhost)

**When Hosting on Web Server:**

- 🔒 Use HTTPS if possible
- 🔒 Configure CORS to specific origins (not `*`)
- 🔒 Consider authentication if public-facing

**Data Privacy:**

- Chat history stored in browser localStorage (local only)
- No data sent to external servers
- API calls go directly to Ollama instance

### Performance Optimization

**For Large Chat Histories:**

- Reduce `maxHistoryMessages` in config
- Use "Clear chat" periodically
- Export important conversations

**For Slow Streaming:**

- Increase `chatTimeoutMs` config
- Check Ollama server performance
- Consider using smaller models

**For Large File Size:**

- Remove unused cloud models from manifest
- Minify more aggressively (edit bundler)
- Use gzip compression on web server

## Version Control

When updating the bundle:

1. **Update version number** (if versioning):
   - In `manifest.json`: update `version` field
   - In README: note version changes

2. **Rebuild bundle**:

   ```bash
   python3 scripts/bundle_single_file.py
   ```

3. **Test with verification checklist** (see above)

4. **Tag release**:

   ```bash
   git add dist/ollama-wrapper.html
   git commit -m "Update bundle: <changelog>"
   git tag -a v1.0.1 -m "Release 1.0.1"
   ```

5. **Distribute new version** with changelog

## Support

For issues or questions:

- Check this documentation thoroughly
- Review browser console for errors
- Verify Ollama setup and CORS configuration
- Test with manual verification checklist
- Check GitHub issues (if applicable)

---

**Last Updated:** 2024-12
**Bundle Version:** Compatible with Ollama v0.1.0+
**Tested Browsers:** Chrome 120+, Firefox 121+, Safari 17+, Edge 120+
