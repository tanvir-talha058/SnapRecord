# Installing SnapRecord

SnapRecord isn't on the Chrome Web Store yet, so it installs the same way any
developer-mode extension does: download it, then load it into your browser
in a few clicks. This works in Chrome, Edge, Brave, Opera, and any other
Chromium-based browser.

## Option A — Download the latest release (recommended)

1. Go to the [Releases page](https://github.com/tanvir-talha058/SnapRecord/releases)
   and download `snaprecord-vX.Y.Z.zip` from the latest release's Assets.
2. Unzip it. You'll get a folder (e.g. `snaprecord-v1.2.0`) — remember where
   it is, you can't delete or move it after installing without breaking the
   extension.
3. Open your browser's extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
   - Opera: `opera://extensions/`
4. Turn on **Developer mode** (top-right corner on Chrome/Edge/Brave).
5. Click **Load unpacked** and select the unzipped folder.
6. The SnapRecord icon appears in your toolbar. Pin it (puzzle-piece icon →
   pin) for one-click access.

## Option B — Install from source

For the latest changes between releases, or if you want to build it
yourself:

```bash
git clone https://github.com/tanvir-talha058/SnapRecord.git
cd SnapRecord
```

Then follow steps 3–6 above, selecting the cloned `SnapRecord` folder in
**Load unpacked**.

## First launch

1. Click the SnapRecord icon, pick what to capture (tab, window, or your
   whole screen), and click **Start Recording**.
2. Your browser will ask you to choose a screen/window/tab to share — that's
   the browser's own permission prompt, not SnapRecord's; it appears every
   time by design (a browser security requirement, not something the
   extension can skip).
3. Click **Stop** when you're done. The recording downloads automatically as
   a `.webm` file.
4. Optional: bind keyboard shortcuts at `chrome://extensions/shortcuts`
   (defaults are `Alt+Shift+R` to start/stop, `Alt+Shift+P` to pause/resume).

## Updating

Developer-mode extensions don't auto-update. To update:

1. Download the new release zip and unzip it (Option A), or `git pull`
   (Option B).
2. Go back to `chrome://extensions/`, find SnapRecord, and click the reload
   icon (⟳) on its card — or remove it and **Load unpacked** again if you
   moved the folder.

Your settings and recording history are stored in the browser profile, not
in the extension folder, so updating this way won't lose them.

## Troubleshooting

- **"Manifest file is missing or unreadable"** — you selected the zip file
  itself, or a folder above/inside the actual extension folder. Select the
  folder that directly contains `manifest.json`.
- **Nothing happens when you click Start Recording** — make sure you're on
  a normal web page (`http://` or `https://`). SnapRecord can't record
  browser-internal pages like `chrome://extensions` or a blank new tab.
- **The recording never starts after granting screen-share permission** —
  refresh the page you're recording and try again; this is usually a stale
  content-script injection, fixed by a reload.
- Still stuck? [Open an issue](https://github.com/tanvir-talha058/SnapRecord/issues).

## Uninstalling

`chrome://extensions/` → find SnapRecord → **Remove**. This deletes all
locally stored settings, history, and any unsaved crash-recovery data —
nothing is stored anywhere else, since SnapRecord never uploads anything.
