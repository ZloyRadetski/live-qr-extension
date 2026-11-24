<div align="center">
  <img src="icons/icon.svg" alt="QR Radar Icon" width="192" height="192">

  # QR Radar

  **Real-Time Screen QR Scanner for Firefox**

  A Firefox extension that detects and reads QR codes on your screen in real time. Works across web pages, video streams, images, and canvas elements.
</div>

---

## Features

- **Real-Time Stream Processing**: Uses hardware-accelerated tab/screen capture to inspect visual output directly, bypassing CORS issues with cross-origin images or video players (YouTube, Vimeo, WebGL games).
- **Fast Off-Thread Decoding**: ZXing-C++ compiled to WebAssembly runs in a pool of Web Workers (0 ms main-thread blocking) with configurable FPS throttling (1–30 FPS).
- **Tiny QR Codes**: a fast full-frame pass is followed, once the picture settles, by a deep pass over native-resolution and 2x-upscaled tiles. This finds codes only ~1.5 px per module wide, even on 4K / HiDPI screens that the fast pass has to downscale. Toggle: *Deep Scan Tiny QR*.
- **Whole-Browser Coverage**: content script runs in every frame (iframes, `about:blank`), looks into shadow DOM, and the toolbar badge shows the number of codes on screen even where no overlay can be drawn (PDF viewer, restricted pages).
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

<div align="center">
  <img src="icons/example.gif" alt="QR Radar Icon" width="50%" height="50%">
</div>