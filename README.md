# SnapRecord - Screen Recorder Extension

A lightweight, feature-rich screen recording extension for Chromium-based browsers (Chrome, Edge, Brave, Opera, etc.). SnapRecord fills the gaps in existing screen recording extensions by providing a complete set of features while maintaining a minimal footprint with zero external dependencies.

## ✨ Features

- 🛟 **Crash-Proof Recordings**
  - Chunks persist locally as you record
  - Recover footage after a tab crash, navigation, or browser restart
  - Never lose a recording again

- 🔒 **100% Private**
  - No account, no uploads, no telemetry
  - Recordings never leave your device

- ⏩ **Seekable Videos**
  - WebM duration is fixed automatically
  - Files scrub correctly in every player

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
  - 480p (SD)
  - 720p (HD)
  - 1080p (Full HD)
  - 1440p (2K)
  - 2160p (4K)

- 📹 **Camera Overlay**
  - Picture-in-picture webcam
  - Customizable position, size, and shape

- ✏️ **Annotation Tools**
  - Pen, highlighter, arrow, rectangle
  - Color picker
  - Draw on screen while recording

- ⌨️ **Keyboard Shortcuts**
  - Alt+Shift+R: Start/Stop recording
  - Alt+Shift+P: Pause/Resume recording

- ⏱️ **Countdown Timer**
  - 3, 5, or 10 second countdown before recording

- 📊 **Recording History**
  - View past recordings with stats
  - Track total recording time and storage

- 💾 **Easy Saving**
  - Auto-download in WebM format
  - Timestamped filenames
  - Configurable save preferences

- ⚡ **Lightweight & Fast**
  - No external dependencies
  - Minimal resource usage
  - Native browser APIs only

## 🔒 Privacy

**Your recordings never leave this device.**

- No account or sign-in — ever
- No uploads: videos download straight to your computer
- No analytics, tracking, or telemetry of any kind
- Minimal permissions: only what recording strictly requires
- Crash-recovery data is stored locally in your browser and auto-deleted

## 🚀 Installation

Not yet on the Chrome Web Store, but installing takes under a minute:

1. Download the latest `snaprecord-vX.Y.Z.zip` from the
   [Releases page](https://github.com/tanvir-talha058/SnapRecord/releases)
   and unzip it.
2. Open `chrome://extensions/` (or `edge://extensions/`, `brave://extensions/`),
   turn on **Developer mode**, and click **Load unpacked** on the unzipped
   folder.

Full walkthrough, troubleshooting, and how to install from source instead:
see **[INSTALL.md](INSTALL.md)**.

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
- **background.js**: Service worker handling recording state
- **content.js**: Content script for screen capture and recording
- **options.html/css/js**: Settings/configuration page
- **history.html/css/js**: Recording history page
- **icons/**: Extension icons in multiple sizes

## 🔒 Permissions

SnapRecord requires only three permissions — far fewer than comparable recorders:

- **activeTab**: Access the current tab when you start a recording
- **storage**: Save your preferences and recording history
- **scripting**: Inject the recording script into the page

No host permissions, no downloads permission, no tab-capture permission. All permissions are used exclusively for screen recording functionality and no data is collected or transmitted.

## 🛠️ Technical Details

### Supported Formats

- **Video**: WebM (VP9, VP8, H.264), MP4, GIF
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
- [ ] Kill the tab mid-recording and verify "Recover" in the popup works
- [ ] Verify the downloaded video is seekable with a correct duration

## 📝 License

MIT License - feel free to use this project for any purpose.

## 🐛 Known Issues & Limitations

- Screen/window capture requires user permission each time (browser security requirement)
- Some websites may block tab capture due to DRM protection
- Maximum recording length depends on available system memory
- On pages with very strict security policies the crash-recovery mirror may be unavailable; recording still works normally there

## 🔮 Roadmap

- [x] Drawing/annotation tools during recording
- [x] Webcam overlay support  
- [x] Keyboard shortcuts
- [x] Recording history
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