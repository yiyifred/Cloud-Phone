<div align="center">

# Cloud Phone

**Manage real Android devices in the browser: cast, control, files, apps, and shell.**

Current version: **v0.11.4** · Node backend + Vue 3 frontend · scrcpy 4.0 WebSocket build

[中文](README.md) · **English**

</div>

---

## Links

| Platform | URL |
|----------|-----|
| **GitHub** | [github.com/yiyifred/Cloud-Phone](https://github.com/yiyifred/Cloud-Phone) |
| **Gitee** | [gitee.com/yiyifred/Cloud-Phone](https://gitee.com/yiyifred/Cloud-Phone) |
| **LINUX DO** | [linux.do](https://linux.do/) |

---

## Table of contents

- [Links](#links)
- [What it is](#what-it-is)
- [Highlights](#highlights)
- [Screenshots](#screenshots)
- [Features](#features)
- [Quick start](#quick-start)
- [Project layout](#project-layout)
- [API overview](#api-overview)
- [Building scrcpy](#building-scrcpy)
- [Environment](#environment)
- [Community guidelines](#community-guidelines)
- [Acknowledgements](#acknowledgements)
- [Sponsorship](#sponsorship)

---

## What it is

Cloud Phone is a **local** web console for Android devices already connected via ADB.  
A Node backend pushes a customized **scrcpy 4.0** server with WebSocket streaming;  
the Vue frontend decodes H.264 with **WebCodecs** and speaks the **ws-scrcpy** wire protocol.

Mirror settings panels follow grouping ideas from **escrcpy**, but this repo is standalone – it does not depend on escrcpy at runtime.

**Good fit:** developers with USB/Wi‑Fi ADB, who want mirror options, files, apps, and shell in a single UI.  
**Not a fit:** “cloud phones” without ADB, or pure SaaS expectations.

---

## Highlights

- Browser cast with low-latency H.264 + touch/mouse injection (scrcpy 4.0)
- Official scrcpy **4.0** server fork with WebSocket on port **8886**
- Mirror + **camera** cast modes (OTG/UHID removed in v0.9.1)
- Files, app manager, and terminal **without** an active cast session
- Toolbar: navigation keys (press/hold), clipboard, record (MP4/MP3), screenshot flash
- Unified iconography via Lucide for key actions, with clearer focus-visible and hover feedback
- `npm run dev` waits for backend health before Vite; light/dark theme
- **i18n**: switch UI language in Settings (zh-CN, en-US, zh-TW, ja-JP, ko-KR); core shell strings localized
- **API security**: session cookie required; JSON payloads use AES-GCM after login; WebSocket upgrade requires session
- **Device entry**: top-right Add Device modal; Android now supports USB guide + pairing-code flow (IP/port/code with auto connect-port scan), Huawei/Apple remain placeholders

---

## Screenshots

Images live in `images/readme/`:

| File | Content |
|---|---|
| `gallery.png` | Device gallery |
| `mirror-cast.png` | Mirror cast + settings |
| `camera-cast.png` | Camera cast |
| `files.png` | File explorer |
| `apps.png` | App manager |
| `terminal.png` | ADB terminal |

```text
images/readme/
├── gallery.png
├── mirror-cast.png
├── camera-cast.png
├── files.png
├── apps.png
└── terminal.png
```

Images are embedded in the corresponding feature sections below.

---

## Features

### Device gallery

![Device gallery](images/readme/gallery.png)

- Tabs: **Devices**, **Settings**
- Uses bundled `platform-tools` ADB to discover devices
- Shows model, manufacturer, IP, Android/SDK, serial, product name
- Screenshot refresh ~5s by default (configurable), list refresh ~1s
- Keeps the previous frame while updating to avoid full-page loading flicker
- Online/offline counts, last refresh time, manual refresh
- Click a card to open the **device workspace**

### Settings & auth

- Horizontal settings page with secondary nav: **Account** (session/password), **Appearance** (language/theme), **Refresh** (intervals)
- **UI language**: Simplified Chinese, English, Traditional Chinese, Japanese, Korean (under Appearance, persisted locally)
- Session login (default password `admin`, please change it); change password and session expiry under Account
- Light/dark theme under Appearance with persisted preference
- **Android app**: on first server setup, defaults to the LAN gateway (`.1` on the current subnet, e.g. `192.168.31.1`) on port `3000`; after connect, routes to first-time password setup or login like the web UI; saves the password encrypted on device for auto sign-in next launch; console UI uses bottom tabs for Devices and Settings; Devices tab mirrors the web mobile gallery (horizontal cards, auto refresh)
- **Backend local data**: `backend/node/data/` holds `auth.key` and `cloud-phone.db` on disk only—never commit this directory

### Device workspace · Mirror cast (default)

![Mirror cast](images/readme/mirror-cast.png)

**Left panel** (Naive UI collapses; all selects use the searchable `MirrorSearchableSelect`):

| Group | Capabilities |
|---|---|
| **Video** | Long-edge resolution, bitrate, FPS, encoder (device `list_encoders` with timeout + fallback), capture orientation, preview-only rotation |
| **Audio** | Enable/disable, audio source, `audio-code`, bitrate, `audio-dup` (Android 13+); can **disable video** and keep audio-only (waveform + PCM, Android 11+) |
| **Device** | Display id, screen-off casting, keep-awake, show touches, screen-off timeout, etc. |
| **Screen** | Virtual display presets, `--new-display` custom resolution/DPI, `--flex-display`, IME policy, system decorations; `--start-app` launches on the virtual display |

**Cast pipeline**

- `POST .../cast/start` to start; browser connects to `WebSocket .../cast/ws`
- Device runs a locally built **scrcpy-server 4.0** (backend auto-builds via Gradle when missing)
- Startup kills leftover `com.genymobile.scrcpy.Server` processes to avoid port **8886** conflicts
- Stream extras go over WebSocket type **101** (`codecOptions` / stream extras); left panel locks while casting to avoid accidental edits
- Touch coordinates use the **decoded video size**, aligned with server `PositionMapper`; mouse hover/press/drag/release follow scrcpy SDK semantics

**Toolbar** (Lucide-style icon + label)

- Recents, home, back, screen off, power, rotate (syncs preview rotation, +90° clockwise)
- Volume: expands into “up / down” sub-buttons
- Clipboard: paste host clipboard into device / copy device clipboard to host; also supports sending typed text
- Screenshot: downloads PNG even without an active cast; when casting, the viewport flashes white around the edges
- Record: MP4 when video is on, MP3 when audio-only; saved automatically when the cast ends
- **Files**, **Apps**, **Terminal** buttons open the tools below (no cast required)

### Device workspace · Camera cast (Android 12+)

![Camera cast](images/readme/camera-cast.png)

- Left “Camera” panel: facing, camera id, capture size, aspect ratio, FPS, high-speed mode, torch, zoom, encoder, audio
- `GET /api/devices/:serial/cameras` lists available cameras
- In-cast torch and zoom controls
- Canvas touch injection is disabled in camera mode to avoid accidental taps

### Files

![File explorer](images/readme/files.png)

- Filesystem root is `/`, default folder is `/storage/emulated/0`
- Real absolute path in the address bar
- Back / forward / up / refresh
- “Permission denied” errors are surfaced clearly
- **Upload** local files to the current directory (`PUT .../files/upload?path=`)
- **Download** device files to the host (`GET .../files/download?path=`)
- `GET /api/devices/:serial/files?path=...` lists a directory

### Apps

![App manager](images/readme/apps.png)

- App label via scrcpy-server `PackageManager` (`list_all_apps`), plus package name and system/frozen badges
- Detail modal: version, SDK, data directory, etc.
- Uninstall (with confirmation), user-level freeze/unfreeze, export APK, open `dataDir` in the file explorer
- Install from a local APK: `PUT .../apps/install`

### Terminal

![ADB terminal](images/readme/terminal.png)

- xterm.js terminal; supports Tab, arrows, and ANSI colors
- `WebSocket .../terminal/ws` bridges to `adb shell -tt`

### Backend & misc

- `GET /health`, `GET /api/devices`, `GET .../screenshot`
- scrcpy session API: `/api/scrcpy/*` for capabilities and programmatic sessions
- Tools: `tools/build-scrcpy-server.mjs`, `build-scrcpy.mjs`, `download-scrcpy.mjs`, `sync-scrcpy-source.mjs`, `test-scrcpy-cast.mjs`
- OTG / UHID cast modes have been removed; only **mirror** and **camera** remain

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

---

## Quick start

**Requirements:** Node.js 18+, authorized ADB device, Chromium-based browser with WebCodecs.

**Interactive installer (terminal UI):**

| OS | Command |
|----|---------|
| Linux (Debian, Alpine, Fedora, Arch, …) | `bash scripts/install-linux.sh` |
| macOS | `bash scripts/install-macos.sh` |
| Windows | `powershell -ExecutionPolicy Bypass -File scripts/install-windows.ps1` |
| Auto (Linux/macOS) | `bash scripts/install.sh` |

```powershell
cd Cloud-Phone
copy .env.example .env

# Recommended: start both backend and frontend from repo root
npm run dev

# Then open http://localhost:5173 (or FRONTEND_PORT in .env)
```

Separate terminals:

```powershell
npm run dev:backend   # API, default 3000
npm run dev:frontend  # Vite UI, default 5173
```

Production preview:

```powershell
cd frontend/web
npm run start   # build then serve dist/
```

If you see an error about the scrcpy server JAR not being built, install JDK 17+ and Android SDK, then run:

```powershell
node tools/build-scrcpy-server.mjs
```

---

## Project layout

```text
scripts/               cross-platform install wizards (terminal UI)
backend/node/          API + WebSocket
backend/source/scrcpy/ scrcpy 4.0 + WebSocket fork
frontend/web/          Vue 3 + Vite
tools/                 build & dev scripts
images/qr/             sponsorship QR codes
```

---

## API overview

Protected routes require a valid session cookie (sign in first). JSON bodies and responses use AES-256-GCM envelopes after login; login returns an encrypted payload derived from your password. WebSocket paths require the session cookie; large file/APK uploads use raw `PUT` streams (auth only).

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/devices` | List devices |
| GET | `/api/devices/:serial/screenshot` | Screenshot |
| GET | `/api/devices/:serial/mirror-options` | Mirror options |
| GET | `/api/devices/:serial/video-encoders` | Encoders |
| GET | `/api/devices/:serial/cameras` | Cameras |
| GET | `/api/devices/:serial/files?path=` | List files |
| GET | `/api/devices/:serial/files/download?path=` | Download file |
| PUT | `/api/devices/:serial/files/upload?path=` | Upload to device |
| GET/DELETE | `/api/devices/:serial/apps` | Apps / uninstall |
| GET | `/api/devices/:serial/apps/:pkg` | App detail |
| POST | `/api/devices/:serial/apps/:pkg/state` | Freeze/unfreeze |
| GET | `/api/devices/:serial/apps/:pkg/apk` | Export APK |
| PUT | `/api/devices/:serial/apps/install` | Install APK |
| POST/DELETE | `/api/devices/:serial/cast/start\|stop` | Cast session |
| WS | `/api/devices/:serial/cast/ws` | Cast stream + control |
| WS | `/api/devices/:serial/terminal/ws` | ADB shell |
| * | `/api/scrcpy/*` | scrcpy sessions & capabilities |

---

## Building scrcpy

**Web cast** needs the modded `scrcpy-server` (same Android APK for every host OS; build once with Gradle):

```powershell
node tools/build-scrcpy-server.mjs
node tools/build-scrcpy-server.mjs --all-platforms   # install jar under windows/linux/macos
```

On **Linux / macOS**, if you only run the Node backend in a browser, `--all-platforms` is enough; a desktop `scrcpy` binary is optional.

Optional client build (Meson + Ninja; embeds the modded server, no `install_release.sh`):

```powershell
node tools/build-scrcpy.mjs
node tools/build-scrcpy.mjs --server-only

# Official prebuilt — server is NOT modded; do not use for web cast
# node tools/build-scrcpy.mjs --download
```

```powershell
node tools/sync-scrcpy-source.mjs
```

More details: [backend/source/scrcpy/CLOUD_PHONE.md](backend/source/scrcpy/CLOUD_PHONE.md).

---

## Environment

Root `.env` (see `.env.example`):

| Variable | Meaning | Default |
|---|---|---|
| `HOST` | Bind address | `0.0.0.0` |
| `BACKEND_PORT` | Backend API port | `3000` |
| `FRONTEND_PORT` | Vite dev server port | `5173` |

---

## Community guidelines

Behavior here follows the spirit of the [LINUX DO guidelines](https://linux.do/guidelines): be sincere and kind, not arrogant or destructive; no harassment, illegal content, or spam.  
When posting on LINUX DO itself, follow their rule about AI content (use screenshots instead of raw AI-polished text).  
For this repo, please file clear, reproducible issues and focused pull requests.

---

## Acknowledgements

Thanks to these projects (in no particular order):

- [scrcpy](https://github.com/Genymobile/scrcpy) – the core for display/control; this repo extends scrcpy 4.0 server with WebSocket
- [ws-scrcpy](https://github.com/NetrisTV/ws-scrcpy) – WebSocket wire protocol reference
- [escrcpy](https://github.com/viarotel-org/escrcpy) – inspiration for mirror settings grouping and naming
- [Vue](https://github.com/vuejs/core)
- [Vite](https://github.com/vitejs/vite)
- [Naive UI](https://github.com/tusen-ai/naive-ui)
- [xterm.js](https://github.com/xtermjs/xterm.js)
- [@breezystack/lamejs](https://github.com/breezystack/lamejs)
- [ws](https://github.com/websockets/ws)
- [Java-WebSocket](https://github.com/TooTallNate/Java-WebSocket)
- Android [platform-tools](https://developer.android.com/tools/releases/platform-tools)

The vendored scrcpy source is licensed under **Apache License 2.0** (see `backend/source/scrcpy/LICENSE`).

---

## Sponsorship

If Cloud Phone saved you some time, feel free to buy me a coffee – totally optional.

<table align="center">
<tr>
<td align="center"><b>WeChat</b><br/><img src="images/qr/wx.jpg" width="220" alt="WeChat QR"/></td>
<td align="center"><b>Alipay</b><br/><img src="images/qr/zfb.png" width="220" alt="Alipay QR"/></td>
</tr>
</table>

The project remains free and open source either way.

