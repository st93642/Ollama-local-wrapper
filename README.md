# Ollama Local Wrapper

A browser-based single-page application (SPA) wrapper for interacting with Ollama models locally.

## Overview

This project provides a user-friendly web interface for chatting with Ollama models running on your local machine. The application features:

- **Model Selector**: Choose from available Ollama models
- **Chat Interface**: Full conversation transcript with message history
- **Message Composer**: Rich message input with auto-expanding textarea
- **Settings Panel**: Adjust temperature and max tokens for model responses
- **Status Bar**: Real-time status and token count information
- **Responsive Design**: Adapts from two-column (desktop) to single-column (mobile) layout

## Project Structure

```
.
├── index.html      # Main HTML structure with semantic markup
├── style.css       # Responsive styling with CSS variables and flexbox
├── app.js          # SPA application logic and global config hook
└── README.md       # This file
```

## Getting Started

### Prerequisites

- A local Ollama installation with one or more models
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A simple HTTP server (see serving options below)

### Serving the Application

Choose one of the following methods to serve the static files:

#### Option 1: Python Built-in Server (Recommended for Quick Testing)

**Python 3.x:**
```bash
cd /path/to/ollama-local-wrapper
python3 -m http.server 8000
```

Then open your browser to: `http://localhost:8000`

**Python 2.x:**
```bash
cd /path/to/ollama-local-wrapper
python -m SimpleHTTPServer 8000
```

#### Option 2: Node.js with http-server

Install globally:
```bash
npm install -g http-server
```

Serve the directory:
```bash
cd /path/to/ollama-local-wrapper
http-server -p 8000
```

#### Option 3: Node.js with Express

Create a simple `server.js`:
```javascript
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, '.')));

app.listen(8000, () => {
    console.log('Server running at http://localhost:8000');
});
```

Install Express:
```bash
npm install express
```

Run the server:
```bash
node server.js
```

#### Option 4: PHP Built-in Server

```bash
cd /path/to/ollama-local-wrapper
php -S localhost:8000
```

#### Option 5: Ruby Built-in Server

```bash
cd /path/to/ollama-local-wrapper
ruby -run -ehttpd . -p8000
```

#### Option 6: Using Docker

Create a `Dockerfile`:
```dockerfile
FROM nginx:latest
COPY . /usr/share/nginx/html
EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t ollama-wrapper .
docker run -p 8000:8000 ollama-wrapper
```

### Configuration

The application uses a global `OllamaConfig` object that can be customized:

```javascript
// In your browser console or before page load
window.OllamaConfig.apiEndpoint = 'http://your-ollama-server:11434';
window.OllamaConfig.defaultModel = 'mistral';
window.OllamaConfig.defaultTemperature = 0.8;
window.OllamaConfig.defaultMaxTokens = 2048;

// Load from an external manifest
window.OllamaConfig.loadFromManifest({
    apiEndpoint: 'http://localhost:11434',
    defaultModel: 'llama2'
});
```

## Features

### Model Selection

The model selector panel on the left sidebar allows you to choose from available Ollama models. The selection is required before sending messages.

### Chat Interface

- **Transcript Area**: Displays all messages from both user and model
- **Message History**: Automatically maintained in the application state
- **Auto-scrolling**: Chat automatically scrolls to the latest message

### Message Composer

- **Multi-line Input**: Textarea expands automatically as you type
- **Keyboard Shortcuts**:
  - `Enter`: Send message
  - `Shift + Enter`: New line
- **Send Button**: Click to submit messages

### Settings Panel

- **Temperature**: Controls response creativity (0.0 = deterministic, 1.0 = creative)
- **Max Tokens**: Maximum length of generated responses

### Status Bar

- **Status Indicator**: Shows current application state
- **Token Counter**: Displays token usage information

## Browser Support

- Chrome/Chromium: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Edge: ✅ Fully supported
- IE11: ❌ Not supported

## Development

### Architecture

The application follows a modular SPA architecture with:

1. **Global Configuration** (`window.OllamaConfig`): Centralized settings
2. **Application State** (`AppState`): Tracks current UI and model state
3. **DOM Elements Cache** (`DOMElements`): Efficient element access
4. **Event Handlers**: Responsive to user interactions
5. **Message Management**: History tracking and display

### Extending the Application

To add new features or connect to the actual Ollama API:

1. Modify the `handleMessageSubmit` function to make real API calls
2. Update `window.OllamaConfig` with your API endpoint
3. Add new UI components to `index.html`
4. Style them in `style.css` using existing CSS variables

### Testing

Open `index.html` in your browser to test:
- ✅ Layout renders correctly
- ✅ All UI elements are visible
- ✅ No console errors on page load
- ✅ Model selection works
- ✅ Message input accepts text
- ✅ Settings sliders respond to input
- ✅ Responsive design adapts to window resize
- ✅ Status bar updates appropriately

## Dependencies

- **Bootstrap 5.3.0**: For responsive grid and utility classes
- **Semantic HTML5**: For accessible markup
- **Vanilla JavaScript**: No framework dependencies (ES6+)

## CSS Features

- **CSS Variables**: Easily customizable colors and sizes
- **Flexbox Layout**: Modern, responsive layout
- **Mobile-first Design**: Works great on all screen sizes
- **Dark/Light Support**: Prepared for theme switching
- **Smooth Animations**: Subtle transitions and effects

## License

See LICENSE file for details.

## Troubleshooting

### Page shows blank/doesn't load

1. Check browser console for JavaScript errors (F12)
2. Verify all files (`index.html`, `style.css`, `app.js`) are in the same directory
3. Clear browser cache and do a hard refresh (Ctrl+F5 or Cmd+Shift+R)

### Model selector shows no models

The placeholder options are static. Connect to actual Ollama API to fetch real models.

### Messages not sending

1. Select a model first
2. Check that Ollama is running locally (`http://localhost:11434`)
3. Open browser console to check for errors

### Responsive layout not working

1. Verify viewport meta tag is present in `<head>`
2. Check browser zoom level (should be 100%)
3. Try resizing the window to test responsiveness

## Future Enhancements

- [ ] Real Ollama API integration
- [ ] Message export/save functionality
- [ ] Dark mode theme
- [ ] Model management (pull, delete)
- [ ] Persistent conversation storage
- [ ] Markdown rendering for responses
- [ ] Code syntax highlighting
- [ ] Multi-conversation tabs
