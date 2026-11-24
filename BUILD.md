# Build Instructions for Mozilla AMO Reviewers

This archive contains the complete source code of **QR Radar** (Firefox, Manifest V3).
Running the steps below produces a byte-identical copy of the `dist/` directory that ships in the add-on package.

## Build environment

| Item | Required | Used for the submitted build |
|------|----------|------------------------------|
| Operating system | Any: Windows 10/11, macOS, or Linux (64-bit) | Windows 11 Pro |
| Node.js | **22.2.0 or newer** (22 LTS or 24 LTS recommended) | v24.15.0 |
| npm | 10 or newer (ships with Node.js) | 11.16.0 |
| Network | Needed once, for `npm ci` to download dependencies from registry.npmjs.org | |

No other tools are required. The bundles are **not minified**: they are plain `esbuild` bundles, so the output is human-readable.

### Installing Node.js and npm
1. Download the installer for your OS from https://nodejs.org/en/download (choose the LTS release, version 22 or newer). npm is installed together with Node.js.
   - Alternatively with a version manager: `nvm install 22 && nvm use 22` (https://github.com/nvm-sh/nvm), or `nvm-windows` on Windows.
2. Verify in a new terminal:
   ```
   node --version    # v22.2.0 or newer
   npm --version     # 10 or newer
   ```

## Steps to reproduce the build

1. Extract this source archive into an empty directory and open a terminal in it.
2. Install the exact dependency versions pinned in `package-lock.json`:
   ```
   npm ci
   ```
   (`npm install` also works, but `npm ci` guarantees the locked versions.)
3. Build all bundles:
   ```
   npm run build
   ```
   This runs `node build.js`, which performs every build action:
   - bundles `src/content/content.js`    → `dist/content.bundle.js`
   - bundles `src/popup/popup.js`        → `dist/popup.bundle.js`
   - bundles `src/background/background.js` → `dist/background.bundle.js`
   - bundles `src/background/decoder.worker.js` → `dist/decoder.worker.bundle.js`
   - copies `src/content/overlay.css`    → `dist/overlay.css`
   - copies `node_modules/zxing-wasm/dist/reader/zxing_reader.wasm` → `dist/zxing_reader.wasm`
4. (Optional) Build the final add-on ZIP exactly as submitted:
   ```
   npm run package
   ```
   The add-on package is written to `release/qr-radar-v<version>.zip`.

## Third-party code

- `zxing-wasm` 3.1.4 (https://github.com/Sec-ant/zxing-wasm): WebAssembly build of ZXing-C++ used to decode QR codes.
  `dist/zxing_reader.wasm` is copied **unmodified** from the npm package `zxing-wasm`; its JavaScript glue is bundled into the `*.bundle.js` files by `esbuild`.
- `esbuild` 0.28.2 is the only build tool. `qrcode` is used by the unit tests only and is not part of the shipped add-on.

## Source layout

- `manifest.json`: extension manifest
- `src/background/`: background script and decoder Web Worker
- `src/content/`: content script and on-screen overlay
- `src/popup/`: toolbar popup (HTML, CSS, JS)
- `src/utils/`: shared helpers
- `build.js`: build script, `package.js`: release packaging script
- `test/`: unit tests (`npm test`)
