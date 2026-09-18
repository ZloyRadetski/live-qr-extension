# QR Radar — Firefox Real-Time Screen QR Scanner

A high-performance Firefox WebExtension that recognizes QR codes anywhere on your screen in real time (within videos, photos, canvas graphics, and web pages), tracks them with dynamic glowing target brackets, and displays their content in a floating HUD with one-click actions.

![QR Radar Icon](icons/icon.svg)

---

## Features

- **Real-Time Stream Processing**: Uses hardware-accelerated tab/screen capture to inspect visual output directly, bypassing CORS issues with cross-origin images or video players (YouTube, Vimeo, WebGL games).
- **Zero-Latency Decoding**: Powered by `jsQR` with configurable FPS throttling (8 / 15 / 30 FPS) and smart frame downscaling.
- **Dynamic HUD & Bounding Box**:
  - Glowing neon cyan & emerald corner reticles tracking the QR polygon.
  - Floating HUD card with automatic classification (URLs, WiFi credentials, Email, Phone numbers, SMS, Plain text).
  - One-click "Copy to Clipboard" with feedback animation.
  - "Open in New Tab" button for URLs.
- **Auditory Cue**: Subtle synth chime on new QR code detection via Web Audio API.
- **Popup Control Center**:
  - Start / Stop toggle button with live status pulse.
  - Scan rate presets (Eco 8 FPS, Balanced 15 FPS, High 30 FPS).
  - Scan history with timestamps and one-click copy.
  - Auto-copy to clipboard toggle.
- **Hotkeys**: Press <kbd>Alt</kbd> + <kbd>Q</kbd> anywhere to instantly toggle the scanner.

---

## How to Install and Run in Firefox

1. Open **Firefox** and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. Click **"Load Temporary Add-on..."**.
3. Select the file:
   ```
   c:\Dev\qr_ext\manifest.json
   ```
4. The extension icon will appear in your Firefox toolbar.

---

## Testing & Verification

1. Open `test/index.html` in Firefox:
   ```
   file:///c:/Dev/qr_ext/test/index.html
   ```
2. Click the **QR Radar** extension icon in the toolbar (or press `Alt + Q`).
3. Click **"Start Real-Time Scanner"** and grant permission for the current tab.
4. The scanner will highlight:
   - Static Web URLs, WiFi configurations, and phone numbers.
   - Any custom text you type in the interactive generator.
   - Smoothly track the moving and rotating QR code on the dynamic canvas.

### Automated Unit Tests

Run the comprehensive test suite with Node.js:
```bash
npm test
```
Tests cover:
- Coordinate projection, scaling, and EMA (lerp) smoothing.
- QR payload classification (URLs, WiFi, Email, Phone, SMS, Geo, Text).
- End-to-end QR image generation and pixel decoding.

---

## Building

To re-bundle after making changes:
```bash
npm run build
```
Builds bundle artifacts to `dist/` using `esbuild`.
