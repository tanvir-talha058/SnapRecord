# Installation and Testing Guide

## How to Install SnapRecord

### Step 1: Open Extension Management Page

In your Chromium-based browser, navigate to:
- **Chrome**: `chrome://extensions/`
- **Edge**: `edge://extensions/`
- **Brave**: `brave://extensions/`
- **Opera**: `opera://extensions/`

### Step 2: Enable Developer Mode

1. Look for a toggle switch in the top-right corner labeled "Developer mode"
2. Click it to enable Developer mode
3. You should see additional options appear

### Step 3: Load the Extension

1. Click the "Load unpacked" button
2. Navigate to the SnapRecord folder (the folder containing `manifest.json`)
3. Select the folder and click "Select Folder" or "Open"

### Step 4: Verify Installation

1. The extension should now appear in your extensions list
2. You should see the SnapRecord icon in your browser toolbar
3. If you don't see it, click the puzzle piece icon and pin SnapRecord

## How to Test SnapRecord

### Test 1: Tab Recording

1. Open a YouTube video or any web page with content
2. Click the SnapRecord icon in your toolbar
3. Select "Current Tab" as the capture type
4. Check "Include Audio" if the page has audio
5. Click "Start Recording"
6. Let it record for a few seconds
7. Click "Stop" to end the recording
8. The video should automatically download

### Test 2: Screen Recording

1. Click the SnapRecord icon
2. Select "Entire Screen" or "Current Window"
3. Click "Start Recording"
4. Browser will prompt you to select what to share
5. Select your screen or window
6. Click "Share" to start recording
7. Use the controls to pause/resume/stop

### Test 3: Pause and Resume

1. Start a recording (tab, window, or screen)
2. Click "Pause" after a few seconds
3. Do something different
4. Click "Resume" to continue recording
5. Click "Stop" when done
6. Verify the downloaded video contains all segments

### Test 4: Settings

1. Click the "⚙ Settings" link in the popup
2. Or right-click the extension icon and select "Options"
3. Change default settings (quality, audio options, etc.)
4. Click "Save Settings"
5. Close and reopen the popup to verify settings persist

## Troubleshooting

### Extension Won't Load
- Make sure you selected the correct folder (containing `manifest.json`)
- Check browser console for errors
- Try disabling and re-enabling the extension

### Recording Doesn't Start
- Check that you granted necessary permissions
- For tab recording, make sure the tab has audio/video content if audio is enabled
- For screen recording, make sure you clicked "Share" in the browser prompt

### No Audio in Recording
- Make sure "Include Audio" is checked before starting
- Some sites block audio capture (like Netflix due to DRM)
- System audio capture may not work on all sites

### Video Quality Issues
- Try different quality settings (720p, 1080p, 1440p)
- Higher quality uses more memory and creates larger files
- Lower quality if experiencing performance issues

### Can't Download Recording
- Check browser's download settings
- Make sure you have permission to save files
- Try clicking "Stop" again if download doesn't start

## Browser Compatibility

✅ **Tested and Working:**
- Google Chrome (version 88+)
- Microsoft Edge (version 88+)
- Brave Browser
- Opera

⚠️ **Note:** Some features may vary by browser version and operating system.

## Privacy Notice

SnapRecord:
- Does NOT upload any recordings to servers
- Does NOT collect any user data
- Does NOT track your activity
- Recordings stay on your local machine
- All processing happens locally in your browser

## Performance Tips

1. **Use Tab Recording** when possible - it's more efficient than screen recording
2. **Close unused tabs** before recording to free up memory
3. **Lower the quality** if you experience lag or stuttering
4. **Keep recordings short** - very long recordings may consume significant memory
5. **Save frequently** - stop and restart recording if doing a long session

## Next Steps

- Try recording different types of content
- Experiment with quality settings
- Test pause/resume functionality
- Configure your preferred defaults in Settings
- Set up keyboard shortcuts (optional)

## Getting Help

If you encounter issues:
1. Check this guide first
2. Look at the browser console for error messages
3. Open an issue on GitHub with details about:
   - Your browser and version
   - What you were trying to do
   - Any error messages you saw

## Keyboard Shortcuts (Optional)

To set up keyboard shortcuts:
1. Go to `chrome://extensions/shortcuts` (or equivalent for your browser)
2. Find SnapRecord
3. Click in the shortcut field
4. Press your desired key combination
5. Save

Suggested shortcuts:
- Start Recording: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Stop Recording: `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac)

---

**Enjoy using SnapRecord! 🎥**
