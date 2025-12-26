# SnapRecord - Screen Recording Extension

<div align="center">

![SnapRecord Logo](icons/icon128.png)

**A lightweight, feature-rich screen recording extension for Chromium-based browsers**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)

</div>

## 🎯 Overview

SnapRecord is a powerful yet lightweight browser extension that enables high-quality screen recording directly from your Chromium-based browser. It fills the gaps left by existing extensions by offering:

- 🎥 Multiple recording modes (Screen, Tab, Window)
- 🎤 Microphone audio capture
- 🔊 System audio recording
- ⏸️ Pause/Resume functionality
- 💾 Automatic download with timestamps
- 🎨 Modern, intuitive UI
- ⚡ Lightweight and efficient

## ✨ Features

### Recording Modes
- **Screen Recording**: Capture your entire screen
- **Tab Recording**: Record a specific browser tab
- **Window Recording**: Capture a specific application window

### Audio Options
- **Microphone Support**: Include your voice in recordings
- **System Audio**: Capture system/tab audio
- **Dual Audio**: Combine microphone and system audio

### Controls
- **Start/Stop**: Easy recording control
- **Pause/Resume**: Temporarily pause without stopping
- **Timer**: Real-time recording duration display
- **Visual Indicators**: Clear recording status

### Quality Settings
- Multiple video quality presets (Low to Ultra)
- Adjustable frame rates (15-60 FPS)
- Optimized bitrates for file size vs quality

## 📦 Installation

### From Source (Developer Mode)

1. **Clone the repository**
   ```bash
   git clone https://github.com/tanvir-talha058/SnapRecord.git
   cd SnapRecord
   ```

2. **Load the extension in Chrome/Edge/Brave**
   - Open your browser and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `SnapRecord` folder

3. **Start Recording!**
   - Click the SnapRecord icon in your browser toolbar
   - Choose your recording mode
   - Configure audio settings
   - Click "Start Recording"

### From Chrome Web Store (Coming Soon)
The extension will be available on the Chrome Web Store soon!

## 🚀 Usage

### Quick Start

1. **Click the extension icon** in your browser toolbar
2. **Select recording mode**: Screen, Tab, or Window
3. **Configure audio**: Enable microphone and/or system audio if needed
4. **Start recording**: Click the "Start Recording" button
5. **Stop when done**: Click "Stop Recording" to save your video

### Advanced Features

#### Settings Page
Access advanced settings by clicking "Settings" in the popup:
- Set default recording mode
- Configure default audio preferences
- Adjust video quality
- Set maximum frame rate
- Enable/disable auto-download

#### Pause/Resume
During recording, you can:
- Click "Pause" to temporarily stop recording
- Click "Resume" to continue from where you paused
- The timer pauses during paused state

#### File Management
- Recordings are automatically saved with timestamps
- Default format: `SnapRecord_YYYY-MM-DD-HHMMSS.webm`
- Browser's download manager handles file location

## 🛠️ Technical Details

### Technology Stack
- **Manifest Version**: 3 (latest Chrome extension standard)
- **APIs Used**:
  - `chrome.desktopCapture` - Screen/window capture
  - `chrome.tabCapture` - Tab capture
  - `MediaRecorder API` - Video encoding
  - `chrome.storage` - Settings persistence
  - `chrome.downloads` - File saving

### Video Specifications
- **Codec**: VP9 (fallback to VP8 if unavailable)
- **Audio Codec**: Opus
- **Container**: WebM
- **Default Bitrate**: 2.5 Mbps
- **Max Resolution**: 1920x1080 @ 30fps (configurable)

### Browser Compatibility
- ✅ Google Chrome (v88+)
- ✅ Microsoft Edge (v88+)
- ✅ Brave Browser
- ✅ Opera
- ✅ Any Chromium-based browser

## 📁 Project Structure

```
SnapRecord/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (recording logic)
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup functionality
├── options.html          # Settings page
├── options.js            # Settings logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## 🎨 Screenshots

### Popup Interface
The main interface provides easy access to all recording options with a clean, modern design.

### Settings Page
Customize your recording experience with comprehensive settings.

## 🔒 Permissions

SnapRecord requires the following permissions:

- **`desktopCapture`**: To capture screen and window content
- **`tabCapture`**: To capture browser tab content
- **`storage`**: To save user preferences
- **`activeTab`**: To identify the current tab for tab recording
- **`scripting`**: For potential future features

We take your privacy seriously and only use these permissions for their intended purpose.

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Bug Reports & Feature Requests

Found a bug or have a feature request? Please open an issue on our [GitHub Issues](https://github.com/tanvir-talha058/SnapRecord/issues) page.

## 💡 Roadmap

Future features we're considering:

- [ ] Custom keyboard shortcuts
- [ ] Webcam overlay during recording
- [ ] Annotation tools (drawing, text)
- [ ] GIF export option
- [ ] Cloud storage integration
- [ ] Video editing capabilities
- [ ] Multiple format export (MP4, AVI)
- [ ] Scheduled recordings

## 👨‍💻 Author

**Tanvir Talha**
- GitHub: [@tanvir-talha058](https://github.com/tanvir-talha058)

## 🙏 Acknowledgments

- Icons created with SVG and optimized for clarity
- UI design inspired by modern web design principles
- Built with vanilla JavaScript for maximum performance

---

<div align="center">

**Made with ❤️ for the open-source community**

Star ⭐ this repository if you find it useful!

</div>