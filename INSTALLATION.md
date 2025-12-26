# Installation Guide for SnapRecord

## Prerequisites

- A Chromium-based browser (Chrome, Edge, Brave, Opera, etc.)
- Version 88 or higher

## Installation Steps

### Method 1: Load from Source (Recommended for Development)

1. **Download the Extension**
   
   Clone or download this repository:
   ```bash
   git clone https://github.com/tanvir-talha058/SnapRecord.git
   ```
   
   Or download as ZIP and extract it to a folder.

2. **Open Extensions Page**
   
   In your Chromium-based browser:
   - **Chrome/Brave**: Navigate to `chrome://extensions/`
   - **Edge**: Navigate to `edge://extensions/`
   - **Opera**: Navigate to `opera://extensions/`

3. **Enable Developer Mode**
   
   Toggle the "Developer mode" switch in the top-right corner of the extensions page.

4. **Load the Extension**
   
   Click the "Load unpacked" button and select the `SnapRecord` folder (the one containing `manifest.json`).

5. **Verify Installation**
   
   You should see the SnapRecord extension appear in your extensions list with the camera icon.

6. **Pin the Extension (Optional)**
   
   Click the extensions icon (puzzle piece) in your browser toolbar and pin SnapRecord for easy access.

### Method 2: From Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store in the future for one-click installation.

## First-Time Setup

1. **Click the Extension Icon**
   
   After installation, click the SnapRecord icon in your browser toolbar.

2. **Grant Permissions**
   
   On first use, the browser will prompt you to grant permissions for:
   - Screen/window capture
   - Audio recording (if enabled)
   - Downloads (for saving recordings)

3. **Configure Settings (Optional)**
   
   Click "Settings" in the popup to customize:
   - Default recording mode
   - Audio preferences
   - Video quality
   - Frame rate

## Usage

### Quick Start

1. Click the SnapRecord icon
2. Select your recording mode (Screen, Tab, or Window)
3. Enable audio options if needed
4. Click "Start Recording"
5. When done, click "Stop Recording"
6. The video will automatically download

### Recording Modes

- **Screen**: Captures your entire screen
- **Tab**: Records only the current browser tab
- **Window**: Captures a specific application window

### Audio Options

- **Include Microphone**: Records your voice
- **Include System Audio**: Captures audio from the tab/system

### Controls

- **Start**: Begin recording
- **Pause**: Temporarily pause without stopping
- **Resume**: Continue from where you paused
- **Stop**: End recording and download the file

## File Output

- **Format**: WebM (VP9 or VP8 codec)
- **Audio**: Opus codec
- **Naming**: `SnapRecord_YYYY-MM-DD-HHMMSS.webm`
- **Location**: Your browser's default download folder

## Troubleshooting

### Extension Not Loading

- Ensure you selected the correct folder containing `manifest.json`
- Check that Developer mode is enabled
- Try refreshing the extensions page

### Recording Not Starting

- Make sure you granted the necessary permissions
- Check that another application isn't using your screen capture
- Verify your browser supports the required APIs

### No Audio in Recording

- Enable "Include System Audio" or "Include Microphone" before recording
- Check your system audio settings
- Grant microphone permissions when prompted

### Download Not Starting

- Check your browser's download permissions
- Ensure pop-ups aren't blocked
- Verify you have write permissions to the download folder

### Video Quality Issues

- Adjust video quality in Settings
- Increase the frame rate for smoother playback
- Check your system resources during recording

## Updating the Extension

When updates are available:

1. Pull the latest changes from the repository
2. Go to `chrome://extensions/`
3. Click the refresh icon on the SnapRecord extension card
4. Restart your browser if needed

## Uninstalling

1. Go to `chrome://extensions/`
2. Find SnapRecord in the list
3. Click "Remove"
4. Confirm the uninstallation

## Privacy & Security

- SnapRecord runs entirely locally on your machine
- No data is sent to external servers
- Recordings are stored only on your computer
- You have full control over what is recorded

## Support

For issues, questions, or feature requests:
- Open an issue on [GitHub](https://github.com/tanvir-talha058/SnapRecord/issues)
- Check the [README](README.md) for additional documentation

## System Requirements

- **Operating System**: Windows, macOS, or Linux
- **Browser**: Chrome 88+, Edge 88+, Brave, Opera, or any Chromium-based browser
- **RAM**: At least 4GB recommended
- **Disk Space**: Sufficient space for recordings (varies by duration and quality)

## Tips for Best Results

1. **Close unnecessary tabs** to reduce system load
2. **Use Tab recording** for better performance when recording specific content
3. **Adjust quality settings** based on your needs (lower for longer recordings)
4. **Test before important recordings** to ensure everything works
5. **Check available disk space** before long recordings

---

**Enjoy recording with SnapRecord!** 🎥
