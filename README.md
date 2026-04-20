# Reverse Prompt Generator - Browser Extension

A Chrome/Edge extension that analyzes images and generates reverse prompts using AI.

## Features

- 🌐 **Image Analysis**: Click any web image to analyze it
- 🤖 **AI-Powered**: Uses Doubao Vision API to generate detailed prompts
- 📋 **Dual Output**: Provides both JSON structured prompts and natural language prompts
- 💾 **History**: Keeps track of your analysis history
- 🎨 **Sidebar UI**: Clean, modern sidebar interface

## Installation

### 1. Get the Extension Files

Download or clone this repository.

### 2. Add Icons (Required)

Create three icon files in the `icons/` directory:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

You can use any image editor or online tool to create these. For testing, you can use simple placeholder images.

### 3. Load in Chrome/Edge

1. Open Chrome/Edge and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `rev_prompt` folder

### 4. Configure API Key

1. Click the extension icon to open the sidebar
2. Click the ⚙️ (Settings) button
3. Enter your Doubao API Key
4. Click "Save API Key"

## Usage

1. **Hover over an image** on any webpage
2. Click the **"Analyze Image"** button that appears
3. View the generated prompts in the sidebar
4. Toggle between JSON and Natural Language views
5. Click **"📋 Copy"** to copy the prompt

## Project Structure

```
rev_prompt/
├── manifest.json          # Extension configuration
├── icons/                 # Extension icons (add your own)
├── src/
│   ├── content-script.js  # Injected into web pages
│   ├── content-style.css  # Styles for page overlays
│   ├── background.js      # Service worker
│   ├── sidebar/
│   │   ├── sidebar.html   # Sidebar UI
│   │   ├── sidebar.js     # Sidebar logic
│   │   └── sidebar.css    # Sidebar styles
│   └── lib/
│       ├── doubao-api.js  # Doubao API wrapper
│       └── utils.js       # Utility functions
└── refer/                 # Reference prompt datasets
```

## API Configuration

**Important**: You need to update the Doubao API endpoint and model name in `src/lib/doubao-api.js`:

```javascript
const API_ENDPOINT = 'YOUR_DOUBAO_API_ENDPOINT';
model: 'YOUR_DOUBAO_MODEL_NAME',
```

## Troubleshooting

- **Icons not showing**: Make sure you've added the icon files in `icons/`
- **API errors**: Check your API key is correct and has vision model access
- **CORS issues**: Some images may not be analyzable due to CORS restrictions

## License

MIT
