# SnapRecord - Screen Recorder Extension

A lightweight, feature-rich screen recording extension for Chromium-based browsers (Chrome, Edge, Brave, Opera, etc.). SnapRecord fills the gaps in existing screen recording extensions by providing a complete set of features while maintaining a minimal footprint with zero external dependencies.

## ✨ Features

- 🎥 **Multiple Capture Modes**
  - Record current browser tab
  - Record current window
  - Record entire screen

- 🎬 **Advanced Recording Controls**
  - Start, pause, resume, and stop recording
  - Real-time recording timer
  - Visual status indicators

- 🎵 **Flexible Audio Options**
  - System audio capture
  - Microphone input
  - Mix both audio sources

- 📺 **Quality Settings**
  - 720p (HD)
  - 1080p (Full HD)
  - 1440p (2K)

- 💾 **Easy Saving**
  - Auto-download in WebM format
  - Timestamped filenames
  - Configurable save preferences

- ⚡ **Lightweight & Fast**
  - No external dependencies
  - Minimal resource usage
  - Native browser APIs only

## 🚀 Installation

### From Source (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/tanvir-talha058/SnapRecord.git
   ```

2. Open your Chromium-based browser and navigate to:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`

3. Enable "Developer mode" using the toggle in the top-right corner

4. Click "Load unpacked" and select the SnapRecord directory

5. The extension icon should appear in your browser toolbar

### From Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store soon.

## 📖 Usage

### Quick Start

1. Click the SnapRecord icon in your browser toolbar
2. Select your preferred capture type (tab, window, or screen)
3. Choose audio options (system audio and/or microphone)
4. Select video quality
5. Click "Start Recording"
6. When finished, click "Stop" to save the recording

### Testing the Extension

Open the included `test-page.html` in your browser to test all features:
- Animated content capture
- Interactive canvas recording
- Video and audio capture
- Counter for timing

See [INSTALLATION.md](INSTALLATION.md) for detailed installation and testing instructions.

### Pause & Resume

- While recording, click "Pause" to temporarily stop capturing
- Click "Resume" to continue recording
- All segments will be combined into a single video file

### Keyboard Shortcuts (Optional)

Configure custom keyboard shortcuts via:
- Chrome: `chrome://extensions/shortcuts`
- Settings → Extensions → Keyboard shortcuts

## ⚙️ Settings

Access the settings page by clicking the "⚙ Settings" link in the popup or right-clicking the extension icon and selecting "Options".

### Available Settings

- **Default Capture Type**: Set your preferred default capture mode
- **Default Quality**: Choose default video quality
- **Audio Options**: Configure default audio settings
- **File Settings**: Customize output format and save behavior

## 🏗️ Architecture

SnapRecord is built using Chrome Extension Manifest V3 with the following components:

- **manifest.json**: Extension configuration and permissions
- **popup.html/css/js**: Main user interface
- **background.js**: Service worker handling recording logic
- **offscreen.html/js**: Offscreen document for display media capture
- **options.html/css/js**: Settings/configuration page
- **icons/**: Extension icons in multiple sizes

## 🔒 Permissions

SnapRecord requires the following permissions:

- **activeTab**: Access the current tab for tab recording
- **tabCapture**: Capture tab audio and video
- **storage**: Save user preferences
- **offscreen**: Create offscreen documents for screen/window capture
- **host_permissions**: Required for complete tab capture functionality

All permissions are used exclusively for screen recording functionality and no data is collected or transmitted.

## 🛠️ Technical Details

### Supported Formats

- **Video**: WebM with VP9 codec
- **Audio**: Opus codec

### Browser Compatibility

- ✅ Google Chrome (v88+)
- ✅ Microsoft Edge (v88+)
- ✅ Brave Browser
- ✅ Opera
- ✅ Any Chromium-based browser supporting Manifest V3

### File Sizes (Approximate)

Recording 1 minute of video:
- 720p: ~5-10 MB
- 1080p: ~10-20 MB
- 1440p: ~20-30 MB

Actual file sizes vary based on content complexity and motion.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Make your changes
3. Test thoroughly in developer mode
4. Submit a pull request

### Testing Checklist

- [ ] Test all capture modes (tab, window, screen)
- [ ] Test audio options (system, microphone, both, none)
- [ ] Test pause/resume functionality
- [ ] Test all quality settings
- [ ] Verify downloads work correctly
- [ ] Test settings persistence

## 📝 License

MIT License - feel free to use this project for any purpose.

## 🐛 Known Issues & Limitations

- Screen/window capture requires user permission each time (browser security requirement)
- Some websites may block tab capture due to DRM protection
- Maximum recording length depends on available system memory
- WebM format may require conversion for some video editors (VLC plays it natively)

## 🔮 Roadmap

- [ ] MP4 export option
- [ ] Drawing/annotation tools during recording
- [ ] Webcam overlay support
- [ ] Cloud upload integration
- [ ] Video trimming/editing
- [ ] Custom watermarks
- [ ] Scheduled recordings

## 💬 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions

## 🙏 Acknowledgments

Built with modern web technologies and Chrome Extension APIs. No external libraries or dependencies used to ensure maximum performance and minimal size.

---

**SnapRecord** - Making screen recording simple, powerful, and lightweight.