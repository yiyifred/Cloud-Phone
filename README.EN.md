<div align="center">

# Cloud Phone

**Manage real Android devices in the browser: cast, control, files, apps, and shell — plus an Android companion app for the gallery and fullscreen cast on your phone.**

Current version: **v1.22.3** · Node backend + Vue 3 web + Android app · Android scrcpy 4.0 WebSocket + HarmonyOS HDC JPEG + iOS WDA MJPEG cast

[中文](README.md) · **English**

</div>

---

## Links

| Platform | URL |
|----------|-----|
| **GitHub** | [github.com/yiyifred/Cloud-Phone](https://github.com/yiyifred/Cloud-Phone) |
| **Gitee** | [gitee.com/yiyifred/Cloud-Phone](https://gitee.com/yiyifred/Cloud-Phone) |
| **LINUX DO** | [linux.do](https://linux.do/) |
| **Afdian** | [ifdian.net/a/yiyifred](https://ifdian.net/a/yiyifred) |

---

## Table of contents

- [Links](#links)
- [What it is](#what-it-is)
- [Highlights](#highlights)
- [Screenshots](#screenshots)
- [Features](#features)
- [Android app](#android-app)
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

**Good fit:** developers with USB/Wi‑Fi ADB, who want mirror options, files, apps, and shell in a single web UI — or a phone-side gallery + fullscreen cast against the same backend.  
**Not a fit:** “cloud phones” without ADB, or pure SaaS expectations.

---

## Highlights

- Browser cast with low-latency H.264 + touch/mouse injection (scrcpy 4.0)
- Official scrcpy **4.0** server fork with WebSocket on port **8886**
- Mirror + **camera** cast modes (OTG/UHID removed in v0.9.1)
- Files, app manager, and terminal **without** an active cast session
- **Multi-device concurrency**: per-device ADB locks so many phones can be controlled in parallel; same device allows concurrent WebSocket clients with serialized ADB ops
- Toolbar: navigation keys (press/hold), clipboard, record (MP4/MP3), screenshot flash
- Unified iconography via Lucide for key actions, with clearer focus-visible and hover feedback
- **Naive UI shell**: shared components across login, settings, logs, and modals; mobile web uses bottom tab navigation with logout/theme in Settings
- `npm run dev` waits for backend health before Vite; light/dark theme
- **i18n**: switch UI language in Settings (zh-CN, en-US, zh-TW, ja-JP, ko-KR); core shell strings localized
- **Activity log**: sidebar **Logs** tab with Debug / Info / Warn / Error levels and auth / navigation / device / cast / stream / settings / UI categories; search, filters, expandable JSON details, and proper scrolling for long log lists
- **API security**: HttpOnly session cookie (~**150 days**) persisted in SQLite (survives restart); password change revokes all sessions; on 401 soft-recover cookie → remembered password before login UI; JSON AES-GCM; WebSocket requires a valid session
- **Device entry**: top-right Add Device modal; Android USB / pair code / QR / **direct connect** (IP + ADB port for ReDroid, emulators, etc.); **HarmonyOS USB/HDC**; **Apple WDA** — Windows USB wizard (sign/install/connect), or Mac `tools/ios-wda-bridge.mjs` for LAN discovery
- **Termux host**: run the backend on Android via Termux as Linux (`scripts/install-termux.sh`); repo includes `backend/bin/scrcpy/linux/scrcpy-server` (no local Gradle build)
- **Docker/CI**: `docker-cloud-phone/` — Linux defaults to **host network** (shared host NICs, ADB/mDNS); Mac/Windows use `docker-compose.bridge.yml` overlay; multi-arch images + Actions; commits tagged `#android` skip Docker packaging
- **HarmonyOS cast**: HDC + uitest agent + JPEG stream; `cast/start` pushes agent and fport, `/cast/ws` starts the JPEG pipe and delivers frames; **scale/quality**; **real-time touch** (ECHO/hdckit `Gestures`); touch coords track display scale, landscape, and preview rotation; agents in `backend/assets/harmony/`
- **Multi-app cast**: Windows-style desktop; **one scrcpy-server per device**, per-window WebSocket / virtual display + `start_app` (aligned with official `--new-display`); **top window 60fps, others 30fps** (8Mbps); server CSD + client SPS/PPS inlining for reliable WebCodecs paint; live watch: relaunch onto the virtual display if the app leaves it, and close the window if the app exits; closing a window hides UI immediately, then soft-stops and `force-stop`s the package in the background so it does not migrate to the device home screen; resize/maximize syncs virtual-display size via `RESIZE_DISPLAY`; Start menu footer **Fullscreen / Exit fullscreen** (native Fullscreen API, same as mirror cast); on device online, prefetch package/icons into browser cache; Start menu and App Manager are cache-first; show package/icon loading progress only when icons are missing, then sync silently in the background; Icon Helper caches icons per device with hash-based incremental updates; Quick Settings / notification center
- **Auth session**: HttpOnly cookie ~**150 days**; sessions persisted in SQLite (survive backend restart); password change revokes all sessions; silent recover via cookie → remembered password before showing the login UI
- **Local persistence**: theme, locale, settings, activity log, and Icon Helper consent sync via backend SQLite (`/api/local-persistence`)
- **iOS cast**: WebDriverAgent MJPEG (port 9100) + HTTP touch; place `wda.ipa` in `backend/bin/wda/` for the Windows sign/install wizard, or use Mac `iproxy` + `ios-wda-bridge.mjs` for LAN bridge; browser cast with nav keys
- **Android companion app**: same backend — device gallery, full Settings page, cast workspace, **multi-app Win11 desktop** (embedded canvas + fullscreen Activity), landscape fullscreen H.264 cast; stream params aligned with web; workspace stacks vertically in portrait and splits horizontally in landscape
- **Mobile cast UX**: mirror nav keys / camera torch & zoom; Material motion; auto-hiding chrome; touch mapping with letterboxing

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

- Tabs: **Devices**, **Group control**, **Logs**, **Settings**
- Uses bundled `platform-tools` ADB and **HDC** (`backend/bin/hdc`; Windows includes `libusb_shared.dll`) to discover devices
- Shows model, manufacturer, IP, Android/HarmonyOS version, serial, product name
- Screenshot refresh ~5s by default (configurable), list refresh ~1s
- Keeps the previous frame while updating to avoid full-page loading flicker
- Online/offline counts, last refresh time, manual refresh; scrollable gallery for many devices with lazy screenshot loading
- Backend caps screenshot concurrency (max 4) and returns retryable status when a device is offline or ADB drops, avoiding `unhandledRejection` noise
- **Right-click a device card**: view device details or disconnect wireless devices (USB connections cannot be disconnected)
- Click a card to open the **device workspace**

### Activity log (web)

- Sidebar **Logs** tab records key console actions and streaming events
- Four severity levels (Debug / Info / Warn / Error) and seven categories (auth, navigation, device, cast, stream, settings, UI)
- Keyword search, level/category filters, clear log; each entry expands to JSON details (cast options, stream timeline, page-exit reason, etc.)
- Cast startup logs (scrcpy / HarmonyOS / iOS) are bridged into the global log automatically

### Group control (web)

- **+** opens a device picker: choose online devices to add (select-all, names, screenshot previews)
- Added devices cast inline in a grid (1080p / 30 fps / 4 Mbps) without opening the device workspace; touch inside the cast to control
- Click outside the cast area to toggle control selection; toolbar select-all / deselect-all; all added devices selected by default; new online devices auto-join
- With at least one device selected, batch actions: **power** (screen on/off), **volume** (mute/up/down), **apps** (batch APK install / uninstall by package), **batch control** (master yellow, followers green, mirrored input)
- Device list and control selection persist separately in browser `localStorage`
- Backend probes the local forward port before the cast pipe is ready; stopping a cast or server exit aborts the WebSocket proxy immediately (no `ECONNREFUSED` retry storm)

### Settings & auth (web)

- Horizontal settings page with secondary nav: **Account**, **Appearance**, **Refresh**
- **Account**: password status (default / updated), session expiry, change password
- **Appearance**: UI language (zh-CN, en-US, zh-TW, ja-JP, ko-KR), light/dark theme; synced via backend local persistence (SQLite)
- **Refresh**: device list and screenshot poll intervals (1–120 s, defaults 1 s / 5 s); takes effect immediately after save
- Session login (default password `admin`, please change it); AES-GCM on JSON APIs after login
- **Backend local data**: `backend/node/data/` holds `auth.key` and `cloud-phone.db` on disk only—never commit this directory

> **Note:** File explorer, app manager, and ADB terminal are available in both the **web and Android device workspaces**. The Android app also adds Group control and Activity log tabs — see [Android app](#android-app).

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

- `POST .../cast/start` to start; browser connects to `WebSocket .../cast/ws`; `cast/start` and `cast/status` return `startupLogs` (adb push, forward, shell, etc.)
- The right canvas shows startup logs while connecting (including frontend scrcpy ready); logs **hide after the first rendered frame**; fullscreen uses the same canvas overlay
- Non-fullscreen toolbar is docked below the device name; fullscreen keeps the floating toolbar
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

- App label via scrcpy-server `PackageManager` (`list_all_apps`), plus package name and system/frozen badges; **opens from IndexedDB cache first** (warmed on device online) with quiet background refresh; optional Icon Helper (consent) for icons; package-name-only mode shows a loading bar; once icons exist, updates continue silently in the background
- Detail modal: version, SDK, data directory, etc.
- Uninstall (with confirmation), user-level freeze/unfreeze, export APK, open `dataDir` in the file explorer
- Install from a local APK: `PUT .../apps/install`

### Terminal

![ADB terminal](images/readme/terminal.png)

- xterm.js terminal; supports Tab, arrows, and ANSI colors
- `WebSocket .../terminal/ws` bridges to `adb shell -tt`

### Backend & misc

- `GET /health`, `GET /api/devices`, `GET .../screenshot`
- ADB tasks use per-device serial locks: parallel across devices, serialized per device; multiple users on one phone share concurrent WebSockets
- scrcpy session API: `/api/scrcpy/*` for capabilities and programmatic sessions
- Tools: `tools/build-scrcpy-server.mjs`, `compare-scrcpy-upstream.mjs`, `sync-scrcpy-from-upstream.mjs`, `build-scrcpy.mjs`, `download-scrcpy.mjs`, `sync-scrcpy-source.mjs`
- OTG / UHID cast modes have been removed; only **mirror** and **camera** remain

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

---

## Android app

Source: `frontend/android/`. Uses the same Node backend and session model as the web UI — handy on the LAN for watching device screens and driving them fullscreen from a phone.

### Connect & sign in

- First launch: server **host** defaults to the LAN gateway (`.1` on the current subnet, e.g. `192.168.31.1`), **port** `3000`
- Same flow as web: ping → forced password change while still `admin` → login; password stored encrypted for auto sign-in next time
- Settings: **Log out** or **Change server** (clears session and saved password, returns to the connection screen)

### Device gallery (bottom tab · Devices)

- Horizontal cards with model, online state, and live screenshots (default ~5 s refresh, configurable in Settings)
- Device list polls about every **1 s**; pull-to-refresh; keeps the previous screenshot frame to reduce flicker
- **Long-press a device card**: view device details or disconnect wireless devices (USB connections cannot be disconnected)
- **+** add device: USB guide, wireless **pairing code**, **QR** pairing; also **HarmonyOS USB** and **Apple WDA** connection flows
- **Community Material** icons (Android-Iconics), consistent with web MDI
- Uses a **Material 3** theme with a fixed bottom navigation bar and gesture-safe insets

### Group control (bottom tab · Group)

- Pick online devices into a control grid; **casting starts immediately on add** (web parity), with startup logs overlaid on each slot
- **Responsive grid:** 1 column when narrow, ~2 on phones, more on tablet widths; tap the slot header to toggle cast
- **Preview touch:** touch the device preview to control the remote device; touch empty areas to scroll the list; in batch mode the master’s touches relay to followers
- **Aspect ratio:** letterbox (no stretch) for mismatched device ratios; adding devices does not reconnect already-streaming sessions
- Bottom nav and action bar icons match the web (power, volume, apps, batch mode, add device); smaller nav labels to avoid clipping
- Batch actions: power (screen on/off), volume (mute/up/down), uninstall by package name
- **Batch control mode:** designate a master device; followers mirror touch input

### Activity log (bottom tab · Logs)

- In-app event log (auth, device, cast, files, apps, terminal, group, settings, etc.)
- Filter by level/category, search, and clear

### Settings (bottom tab · Settings)

Mirrors the web `SettingsPanel` sections:

| Section | Features |
|---|---|
| **Account** | Password status, session expiry, change password (bottom sheet), log out |
| **Appearance** | UI locale preference (5 codes), light/dark theme (Material3 DayNight) |
| **Refresh** | Device list / screenshot intervals (1–120 s); Devices tab polling picks up new values immediately |
| **Server** | Current `host:port`, switch server and sign in again |

Settings use a hero header and section icon cards; web and Android share a green theme (`#16a34a`).

### Device workspace

- Tap a card: back, device name, **Files / Apps / Terminal**, **Start**, and a **cast-mode** dropdown; a second bar below holds **Video / Audio / Device / Screen** (or camera settings tabs)
- **Cast mode:** mirror (default), **multi-app**, or camera (Android 12+); HarmonyOS/iOS devices use JPEG/MJPEG cast
- **Responsive layout:** portrait stacks settings above the canvas; landscape splits settings left / canvas right; rotation adapts without dropping the cast session
- **Tabbed parameters** (same shape as the web left panel, persisted per device serial):
  - Mirror: video, audio, device, screen (virtual display presets, `__main__`/`__custom__`, suggested DPI, `start_app` package)
  - Camera: camera, video, audio (`audioCode`, buffer fields, stream extras aligned with web)
- Changes auto-save when you leave the page
- **Cast canvas:** **Start** casts inline in the workspace; connection logs during startup (adb push / forward / shell / WebSocket), auto-hidden after the first frame
- **Multi-app mode:** embedded Win11-style desktop (centered taskbar, Start menu, draggable/resizable windows, per-window virtual display) with stable move and edge-resize gestures; overflow apps collapse to icon-only chips; Start menu opens a dedicated fullscreen desktop Activity and **Exit fullscreen** returns; Start menu / App Manager support Icon Helper consent and loading progress (silent background sync once icons exist); Quick Settings / clock-notifications pop up above the taskbar with Web-matched date/time and calendar, sized to fit the screen
- **Cast toolbar:** docked below the settings tab bar when not fullscreen; floating bar at the bottom in fullscreen
- **Fullscreen** can reuse the active session without calling `cast/start` again

### Fullscreen cast

- **Start** opens landscape fullscreen: `POST .../cast/start` + `WebSocket .../cast/ws`, **MediaCodec** H.264, letterboxed canvas with preview rotation
- Startup logs on the canvas until the first frame is rendered
- **Mirror:** recents / home / back / power / volume / rotate / stop; touch injection (scrcpy wire format)
- **Camera:** torch, zoom out, zoom in, stop; no canvas touch injection
- Chrome **auto-hides** (~3.5 s); tap video to toggle; enter/exit fades and live-status dot animation
- Stream extras (`codecOptions`, virtual display, `audioDup` min SDK 33+, etc.) follow the **same rules** as web/desktop

### File explorer / App manager / ADB terminal

- **Files:** browse device directories, download to local Downloads, upload to the current path
- **Apps:** search installed apps, install APK, detail actions (uninstall/freeze/extract APK/force stop/open data dir)
- **Terminal:** WebSocket `adb shell -tt` with ANSI colors and reconnect; extra-keys bar (ESC/Ctrl/arrows) and soft keyboard input

### Build & install

**Requirements:** Android Studio or JDK 11+ and the Android SDK (`minSdk 28`).

```powershell
cd frontend/android
.\gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

The phone must reach the backend on your LAN. Cleartext HTTP is allowed for local dev via `network_security_config`.

### Web vs Android feature matrix

| Capability | Web | Android app |
|---|---|---|
| Device gallery / screenshot polling | Yes | Yes |
| Settings (account / appearance / refresh) | Yes | Yes |
| Add device (USB / pair / QR) | Yes | Yes |
| Group control / activity log | Yes | Yes |
| Cast settings workspace | Yes | Yes |
| Multi-app Win11 desktop | Yes | Yes |
| Fullscreen cast + touch / toolbar | Yes | Yes |
| File explorer | Yes | Yes |
| App manager | Yes | Yes |
| ADB terminal | Yes | Yes |
| Clipboard / record / browser screenshot download | Yes | — |

---

## Quick start

**Requirements (web):** Node.js 18+, authorized ADB device, Chromium-based browser with WebCodecs.

**Requirements (Android app):** same LAN as the backend; install the debug/release APK from `frontend/android` (see [Build & install](#build--install) under Android app).

**Interactive installer (terminal UI):**

| OS | Command |
|----|---------|
| Linux (Debian, Alpine, Fedora, Arch, …) | `bash scripts/install-linux.sh` |
| **Android (Termux)** | `bash scripts/install-termux.sh` (or `bash scripts/install.sh` auto-routes) |
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
backend/source/scrcpy/         scrcpy 4.0 + WebSocket fork
backend/source/WebDriverAgent/ iOS WebDriver server (Appium WDA, integration pending)
frontend/web/          Vue 3 + Vite (web console)
frontend/android/      Android companion app
tools/                 build & dev scripts (incl. ios-wda-bridge.mjs)
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
| GET | `/api/devices/:serial/apps/:pkg/orientation` | Infer portrait/landscape |
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
node tools/compare-scrcpy-upstream.mjs
node tools/sync-scrcpy-from-upstream.mjs   # or sync-scrcpy-source.mjs (compat)
```

More details: [backend/source/scrcpy/CLOUD_PHONE.md](backend/source/scrcpy/CLOUD_PHONE.md).

---

## Docker

Configure root `.env` (`BACKEND_PORT`, `FRONTEND_PORT`, `DOCKERHUB_NAMESPACE`).

```bash
cd docker-cloud-phone

# Recommended: use ../.env automatically
chmod +x compose.sh
./compose.sh up -d

# Or pass env file explicitly
docker compose --env-file ../.env up -d

# Or symlink then plain docker compose up -d works
ln -sf ../.env .env && docker compose up -d

# Local single-arch build (host architecture)
./compose.sh -f docker-compose.build.yml up -d --build

# Multi-arch build and push to Docker Hub (requires docker login + buildx)
chmod +x build-multiarch.sh
./build-multiarch.sh
```

Open `https://localhost:${FRONTEND_PORT}` (default 5173; trust the self-signed cert in the browser). On LAN use `https://<host-ip>:5173`; set `FRONTEND_TLS_SAN=<host-ip>` in `.env` to reduce warnings.

**Data persistence**: compose mounts `docker-cloud-phone/data/` to `/data` in the backend container (`auth.key`, `cloud-phone.db` for passwords and sessions). Data survives image rebuilds; the host directory is created on first start.

**iOS / Python**: the backend image includes Python 3, `pymobiledevice3`, and OpenSSL for the Apple WDA USB pipeline (install, port forward, launch); IPA re-signing uses Node `zsign-wasm`. Place `wda.ipa` at `backend/bin/wda/wda.ipa` and mount it into the container. On Linux, pass the iPhone USB device into the container (e.g. `--device /dev/bus/usb` or `privileged`) and ensure the host recognizes the device.

**Network mode (Linux host by default)**: frontend and backend share the host network stack so the API can list all host interfaces (`GET /api/host/networks`) and ADB/mDNS use real LAN addresses. On Mac/Windows Docker Desktop:

```bash
./compose.sh -f docker-compose.yml -f docker-compose.bridge.yml up -d
```

---

## Environment

Root `.env` (see `.env.example`):

| Variable | Meaning | Default |
|---|---|---|
| `HOST` | Bind address | `0.0.0.0` |
| `BACKEND_PORT` | Backend API port | `3000` |
| `FRONTEND_PORT` | Vite dev server port | `5173` |
| `CLOUD_PHONE_ADB_PATH` | Custom adb binary path (Termux, etc.) | auto-detect |
| `CLOUD_PHONE_ROOT` | Repo root when path resolution fails (Termux) | auto-detect |
| `CLOUD_PHONE_SCRCPY_SERVER_JAR` | Modded scrcpy-server jar path | `backend/bin/scrcpy/<platform>/scrcpy-server` |
| `CLOUD_PHONE_USE_HOST_NETWORK` | Docker host network (Linux compose default `1`) | `1` |
| `CLOUD_PHONE_DATA_DIR` | Backend data directory (Docker compose default `/data`, host path `docker-cloud-phone/data`) | `backend/node/data` (non-Docker) |
| `CLOUD_PHONE_PREFER_SYSTEM_ADB` | Prefer apt-installed adb on Docker/Linux | `1` (Docker default) |
| `CLOUD_PHONE_LAN_IP` | Primary LAN IPv4 for mDNS/display (optional) | auto |
| `BACKEND_ORIGIN` | Frontend `/api` proxy target (host network uses `127.0.0.1`) | `http://127.0.0.1:3000` |
| `FRONTEND_HTTPS` | Enable HTTPS for production frontend (`server.mjs`; on by default in Docker) | `1` (set `0` to disable) |
| `FRONTEND_TLS_SAN` | Self-signed cert SAN entries (comma-separated IPs/hostnames) | empty |
| `DOCKERHUB_NAMESPACE` | Docker Hub image namespace | `yiyifred` |
| `IMAGE_TAG` | Docker Hub image tag (project semver, e.g. `0.13.0`) | `package.json` `version` |
| `DOCKER_PLATFORMS` | Multi-arch build platforms (`build-multiarch.sh` / CI) | `linux/amd64,linux/arm64` |

---

## Community guidelines

Behavior here follows the spirit of the [LINUX DO guidelines](https://linux.do/guidelines): be sincere and kind, not arrogant or destructive; no harassment, illegal content, or spam.  
When posting on LINUX DO itself, follow their rule about AI content (use screenshots instead of raw AI-polished text).  
For this repo, please file clear, reproducible issues and focused pull requests.

---

## Acknowledgements

Thanks to these projects (in no particular order):

- [scrcpy](https://github.com/Genymobile/scrcpy) – the core for display/control; this repo extends scrcpy 4.0 server with WebSocket
- [WebDriverAgent](https://github.com/appium/WebDriverAgent) – iOS automation and touch/screenshot HTTP API; vendored in `backend/source/WebDriverAgent` for future Apple device control
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

If Cloud Phone saved you some time, feel free to support via **Afdian** – totally optional:

**[https://ifdian.net/a/yiyifred](https://ifdian.net/a/yiyifred)**

The project remains free and open source either way.

