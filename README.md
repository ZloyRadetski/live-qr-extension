<div align="center">
  <img src="icons/icon.svg" alt="QR Radar Icon" width="192" height="192">

  # QR Radar

  **Real-Time Screen QR Scanner for Firefox**

  A Firefox extension that detects and reads QR codes on your screen in real time. Works across web pages, video streams, images, and canvas elements.
</div>

---

## Features

* **Real-Time Screen Recognition**: Scans the screen directly via tab capture, bypassing CORS blocks on cross-origin images and video players like YouTube or Vimeo.
* **GPU & CPU Optimized**: High-speed targeted decoding using `jsQR` with configurable rate limits (1 to 120 FPS) and low-power idle mode.
* **HUD Bounding Box**: Highlights detected codes with clean, modern targeting brackets.
* **Instant Actions**: Displays a floating panel that categorizes data into URLs, Wi-Fi credentials, emails, phone numbers, SMS, or plain text.
* **One-Click Actions**: Easily copy payload or open links in a new tab with one click.
* **Configurable Settings**: 5 color themes (Amber, Cyan, Emerald, Violet, Rose), resolution profiles (720p/1080p/1440p), auto-copy, and pause on scroll.
* **Site Exclusions**: Exclude specific domains from active scanning with one click.
* **Global Shortcut**: Toggle scanning on or off using <kbd>Alt</kbd> + <kbd>Q</kbd>.

---

## Installation & Running in Firefox

1. Open **Firefox** and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. Click **"Load Temporary Add-on..."**.
3. Select `manifest.json` from this project folder.
4. The **QR Radar** icon will appear in your Firefox toolbar.

---

## Development & Building

```bash
# Install dependencies
npm install

# Run automated unit tests
npm test

# Build production bundles
npm run build

# Create Mozilla Add-ons (AMO) release packages
npm run package
```