# RAL Browser Extension

**Reality Anchoring Layer** - Make AI assistants aware of your real-world context.

## What It Does

RAL automatically injects your local context (timezone, date, time of day) into every prompt you send to:

- ✅ **ChatGPT** (chat.openai.com, chatgpt.com)
- ✅ **Claude** (claude.ai)
- ✅ **Gemini** (gemini.google.com)

## Why?

LLMs don't know:
- What time it is for you
- Your timezone
- Whether it's morning or night

This causes problems like:
- "Schedule a meeting tomorrow" → AI doesn't know what day tomorrow is
- "What should I eat?" → AI doesn't know if it's breakfast or dinner time
- "Is the store open?" → AI doesn't know your timezone

RAL fixes this automatically.

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "RAL Reality Anchoring"
3. Click "Add to Chrome"

### Manual Installation (Developer Mode)

1. **Download** this extension folder

2. **Generate PNG icons** (required):
   ```bash
   cd extension
   python3 generate_icons.py
   ```
   Or manually create 16x16, 48x48, and 128x128 PNG icons

3. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extension` folder

4. **Verify**: Look for the RAL icon in your browser toolbar

## Usage

1. **Click the RAL icon** to see current settings
2. **Toggle ON/OFF** context injection
3. **Choose what to include**:
   - Timezone (e.g., America/New_York)
   - Date (e.g., Monday, January 15, 2025)
   - Time of day (morning/afternoon/evening/night)

4. **Start chatting** - RAL works automatically!

## How It Works

When you send a message, RAL:

1. Intercepts the message before it's sent
2. Prepends your context:
   ```
   [Context: Timezone: America/New_York | Date: Monday, January 15, 2025 | Time: afternoon]

   Your original message here...
   ```
3. Sends the enhanced message to the AI

The AI now knows your real-world context and can give better answers!

## Privacy

- **100% local** - No data sent to any server
- **No tracking** - We don't collect any information
- **Open source** - Audit the code yourself

Your timezone and date are derived locally from your browser. Nothing leaves your machine.

## Files Structure

```
extension/
├── manifest.json          # Extension configuration
├── background/
│   └── service-worker.js  # Background context generator
├── content-scripts/
│   ├── chatgpt.js         # ChatGPT integration
│   ├── claude.js          # Claude integration
│   ├── gemini.js          # Gemini integration
│   └── styles.css         # RAL indicator styles
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
└── icons/
    ├── icon16.svg/png     # Toolbar icon
    ├── icon48.svg/png     # Extension list icon
    └── icon128.svg/png    # Store icon
```

## Development

### Testing locally

1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the RAL extension
4. Test on ChatGPT/Claude/Gemini

### Adding new platforms

1. Create `content-scripts/newplatform.js`
2. Add to `manifest.json` content_scripts
3. Follow the pattern in existing scripts

## Roadmap

- [ ] Firefox support
- [ ] Safari support  
- [ ] Weather context
- [ ] Location context (with permission)
- [ ] Custom context fields
- [ ] Connect to RAL server for advanced features

## License

MIT License - Use freely!

---

**RAL** - Because AI should know what time it is.
