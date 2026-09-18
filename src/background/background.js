/**
 * Background Service Worker / Script for QR Radar.
 * Highly Optimized Global Real-Time Scanner:
 * - Dynamic power management: pauses captures during scroll or window blur (0% CPU).
 * - Adaptive FPS throttling: switches to low-power maintenance mode (4 FPS) when QR is anchored.
 * - Off-thread decoding: jsQR runs in a dedicated Web Worker (0 ms main-thread blocking).
 * - Zero-copy frame transfer: Uint8ClampedArray transferred to Worker without memory copy.
 */

import { readBarcodes } from 'zxing-wasm/reader';
import { getSettings, saveSettings, addScanHistory, isDomainBlacklisted } from '../utils/storage.js';
import { classifyContent } from '../utils/parser.js';

let isGlobalActive = false;
let isLoopRunning = false;
let isTabScrolling = false;
let isWindowFocused = true;
let hasActiveQR = false;
let loopTimer = null;
let cachedSettings = null;
let currentActiveTab = null;
let lastFrameHash = 0;
let unchangedEmptyFrames = 0;

// Track QR data already saved to history to avoid repeated writes on every frame
const reportedQrDataThisSession = new Set();
let lastQrDataSnapshot = ''; // stringified set of active QR data for change detection

async function getCachedSettings() {
  if (!cachedSettings) {
    cachedSettings = await getSettings();
  }
  return cachedSettings;
}

async function getActiveTab() {
  if (!currentActiveTab || !currentActiveTab.id) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    currentActiveTab = tab || null;
  }
  return currentActiveTab;
}

// Reusable canvas buffers — createImageBitmap handles image decode off-thread
let canvas = null;
let ctx = null;
let cropCanvas = null;
let cropCtx = null;

function getCanvas() {
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
  return { canvas, ctx };
}

function getCropCanvas() {
  if (!cropCanvas && typeof document !== 'undefined') {
    cropCanvas = document.createElement('canvas');
    cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
  }
  return { cropCanvas, cropCtx };
}

// ─── Decoder Web Worker ───────────────────────────────────────────────────────
// WebAssembly decoder runs entirely in a Worker: 0 ms main-thread blocking per frame.

let decoderWorker = null;
let workerMsgId = 0;
const workerPending = new Map();

/**
 * Lazily initialises the decoder Worker (once per background page lifetime).
 * Safe to call in Node test environment — returns null when browser API is absent.
 * @returns {Worker | null}
 */
function getDecoderWorker() {
  if (decoderWorker) return decoderWorker;
  if (typeof browser === 'undefined' || !browser.runtime) return null;
  try {
    decoderWorker = new Worker(browser.runtime.getURL('dist/decoder.worker.bundle.js'));
    const wasmUrl = browser.runtime.getURL('dist/zxing_reader.wasm');
    decoderWorker.postMessage({ type: 'INIT', wasmUrl });

    decoderWorker.onmessage = ({ data }) => {
      if (!data || data.type === 'INIT') return;
      const resolve = workerPending.get(data.id);
      if (resolve) {
        workerPending.delete(data.id);
        resolve(data.qrs);
      }
    };
    decoderWorker.onerror = (err) => {
      console.error('[QR Radar] Decoder Worker error:', err);
    };
  } catch {
    decoderWorker = null;
  }
  return decoderWorker;
}

/**
 * Sends a pixel buffer to the decoder Worker and returns detected QRs.
 * The ArrayBuffer is transferred (zero-copy) to the Worker.
 * Falls back to running zxing-wasm in background page if Worker is unavailable.
 * @param {ArrayBuffer} buffer - RGBA pixel data
 * @param {number} width
 * @param {number} height
 * @param {number} [maxQRs=4]
 * @returns {Promise<Array<{ data: string, location: any }>>}
 */
async function decodeWithWorker(buffer, width, height, maxQRs = 4) {
  const worker = getDecoderWorker();
  if (worker) {
    return new Promise((resolve) => {
      const id = ++workerMsgId;
      workerPending.set(id, resolve);
      // Transfer buffer ownership to Worker — no memory copy
      worker.postMessage({ id, buffer, width, height, maxQRs }, [buffer]);
    });
  }

  // Fallback: run zxing-wasm synchronously in background page.
  try {
    const results = await readBarcodes(
      { data: new Uint8ClampedArray(buffer), width, height },
      { formats: ['QRCode'], maxNumberOfSymbols: maxQRs, tryHarder: false }
    );
    if (Array.isArray(results) && results.length > 0) {
      return results.map((r) => ({
        data: r.text,
        location: {
          topLeftCorner: { x: r.position.topLeft.x, y: r.position.topLeft.y },
          topRightCorner: { x: r.position.topRight.x, y: r.position.topRight.y },
          bottomRightCorner: { x: r.position.bottomRight.x, y: r.position.bottomRight.y },
          bottomLeftCorner: { x: r.position.bottomLeft.x, y: r.position.bottomLeft.y }
        }
      }));
    }
  } catch {}
  return [];
}

/**
 * Converts a data URL to a Blob without going through the network stack.
 * ~3–5× faster than fetch(dataUrl) because it avoids HTTP/XHR machinery.
 * @param {string} dataUrl
 * @returns {Blob}
 */
function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const mimeMatch = dataUrl.slice(0, comma).match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const base64 = dataUrl.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// Active video player rects reported by content scripts (tabId -> { rects, dpr, viewportWidth, viewportHeight })
export const tabVideoRects = new Map();

/**
 * Fast non-cryptographic hash of a frame data URL.
 * Samples ~256 characters spread across the string for a lightweight fingerprint.
 * Cost: < 0.1 ms. Used to skip jsQR decode when the frame hasn't changed.
 * @param {string} dataUrl
 * @returns {number}
 */
export function computeFrameHash(dataUrl) {
  const len = dataUrl.length;
  if (len === 0) return 0;
  // Sample at most 256 evenly-spaced positions
  const step = Math.max(1, Math.floor(len / 256));
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < len; i += step) {
    hash ^= dataUrl.charCodeAt(i);
    // FNV-1a prime multiply — keep within 32-bit int range
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * High-speed targeted decode of visible video player crops directly from the full-resolution screenshot.
 * Bypasses full screen downsampling and JPEG degradation.
 * Single getImageData readback per crop; jsQR loop runs in the decoder Worker.
 * @param {ImageBitmap | HTMLImageElement} img
 * @param {{ rects: Array<{ left: number, top: number, width: number, height: number }>, dpr: number, viewportWidth?: number, viewportHeight?: number }} videoInfo
 * @returns {Promise<{ qrs: any[], qr: any, scanWidth: number, scanHeight: number, isDirectCrop: boolean } | null>}
 */
export async function decodeVideoCrops(img, videoInfo) {
  if (!videoInfo || !videoInfo.rects || videoInfo.rects.length === 0) return null;
  const { cropCanvas: cCanvas, cropCtx: cCtx } = getCropCanvas();
  if (!cCanvas || !cCtx) return null;

  const dpr = videoInfo.dpr || 1;
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const qrs = [];

  for (const rect of videoInfo.rects) {
    // Source crop at full DPR resolution
    let srcX = Math.round(rect.left * dpr);
    let srcY = Math.round(rect.top * dpr);
    let srcW = Math.round(rect.width * dpr);
    let srcH = Math.round(rect.height * dpr);

    // Bounds check
    if (srcX < 0) { srcW += srcX; srcX = 0; }
    if (srcY < 0) { srcH += srcY; srcY = 0; }
    if (srcX + srcW > imgW) srcW = imgW - srcX;
    if (srcY + srcH > imgH) srcH = imgH - srcY;

    if (srcW < 24 || srcH < 24) continue;

    // Downsample to max 720px for fast decode while preserving detection accuracy
    const maxCropDim = 720;
    let drawW = srcW, drawH = srcH;
    if (drawW > maxCropDim || drawH > maxCropDim) {
      const ratio = Math.min(maxCropDim / drawW, maxCropDim / drawH);
      drawW = Math.round(drawW * ratio);
      drawH = Math.round(drawH * ratio);
    }

    if (cCanvas.width !== drawW || cCanvas.height !== drawH) {
      cCanvas.width = drawW;
      cCanvas.height = drawH;
    }

    cCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, drawW, drawH);

    // Single GPU→CPU readback; Worker handles the full jsQR loop with CPU masking
    const imgData = cCtx.getImageData(0, 0, drawW, drawH);
    const scaleBackX = srcW / drawW;
    const scaleBackY = srcH / drawH;

    // Transfer buffer ownership to Worker — no memory copy
    const cropQrs = await decodeWithWorker(imgData.data.buffer, drawW, drawH, 3);

    for (const qr of cropQrs) {
      const loc = qr.location;
      // Project downsampled crop coordinates back to viewport CSS coordinates
      qrs.push({
        data: qr.data,
        location: {
          topLeftCorner:     { x: (srcX + loc.topLeftCorner.x     * scaleBackX) / dpr, y: (srcY + loc.topLeftCorner.y     * scaleBackY) / dpr },
          topRightCorner:    { x: (srcX + loc.topRightCorner.x    * scaleBackX) / dpr, y: (srcY + loc.topRightCorner.y    * scaleBackY) / dpr },
          bottomRightCorner: { x: (srcX + loc.bottomRightCorner.x * scaleBackX) / dpr, y: (srcY + loc.bottomRightCorner.y * scaleBackY) / dpr },
          bottomLeftCorner:  { x: (srcX + loc.bottomLeftCorner.x  * scaleBackX) / dpr, y: (srcY + loc.bottomLeftCorner.y  * scaleBackY) / dpr }
        }
      });
    }
  }

  if (qrs.length > 0) {
    const vw = videoInfo.viewportWidth || Math.round(imgW / dpr);
    const vh = videoInfo.viewportHeight || Math.round(imgH / dpr);
    return { qrs, qr: qrs[0], scanWidth: vw, scanHeight: vh, isDirectCrop: true };
  }

  return null;
}

/**
 * Decodes a screen capture data URL with jsQR.
 * Converts data URL to Blob without fetch (no network stack overhead),
 * uses createImageBitmap for off-thread JPEG decode,
 * then transfers pixels to the decoder Worker for jsQR (0 ms main-thread blocking).
 * Checks visible video player crops first at full resolution, then falls back to full-screen.
 * @param {string} dataUrl
 * @param {number} [maxW=720]
 * @param {any} [videoInfo=null]
 * @returns {Promise<{ qrs: any[], qr: any, scanWidth: number, scanHeight: number } | null>}
 */
export async function decodeDataUrl(dataUrl, maxW = 720, videoInfo = null) {
  const { canvas, ctx } = getCanvas();
  if (!canvas || !ctx) return null;

  let bitmap;
  try {
    // Convert data URL → Blob without going through the network stack (~3–5× faster than fetch)
    const blob = dataUrlToBlob(dataUrl);
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  try {
    // 1. High-speed targeted scan of visible video players
    const hasVideos = videoInfo && videoInfo.rects && videoInfo.rects.length > 0;
    if (hasVideos) {
      const videoResult = await decodeVideoCrops(bitmap, videoInfo);
      if (videoResult && videoResult.qrs && videoResult.qrs.length > 0) {
        return videoResult;
      }
    }

    // 2. Full-screen scan fallback
    // When video rects are active, skip full-screen fallback entirely:
    // - Videos are handled by crop scanning above
    // - Static page elements are handled by the content DOM scanner
    // This eliminates an entire jsQR pass (~4-8ms) per frame during video playback.
    if (hasVideos) {
      return null;
    }

    let w = bitmap.width;
    let h = bitmap.height;

    // Downsample to maxW (e.g. 540, 720, 1080) for optimal speed/accuracy balance
    if (w > maxW) {
      const ratio = maxW / w;
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.drawImage(bitmap, 0, 0, w, h);

    // Single GPU→CPU readback; Worker handles full jsQR loop with CPU masking
    const imgData = ctx.getImageData(0, 0, w, h);
    const qrs = await decodeWithWorker(imgData.data.buffer, w, h);

    return { qrs, qr: qrs[0] || null, scanWidth: w, scanHeight: h };
  } finally {
    // Free GPU memory immediately — ImageBitmap is not GC'd automatically
    bitmap.close();
  }
}

/**
 * Ensures content script and overlay styles are injected into tab.
 * @param {number} tabId
 */
async function ensureInjected(tabId) {
  try {
    const test = await browser.tabs.sendMessage(tabId, { type: 'PING' });
    if (test && test.pong) return true;
  } catch {
    // Content script not ready, inject
  }

  try {
    await browser.scripting.insertCSS({
      target: { tabId },
      files: ['dist/overlay.css']
    });
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['dist/content.bundle.js']
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Adaptive continuous capture loop with dynamic sleep, blacklist, and scroll pause.
 */
async function globalCaptureLoop() {
  if (!isGlobalActive) {
    isLoopRunning = false;
    return;
  }

  isLoopRunning = true;
  const loopStartTime = performance.now();
  const settings = await getCachedSettings();

  // 1. Power Saver: Skip capture if window is blurred or (pauseOnScroll && actively scrolling)
  const shouldPauseForScroll = (settings.pauseOnScroll !== false) && isTabScrolling;
  if (!isWindowFocused || shouldPauseForScroll) {
    setTimeout(globalCaptureLoop, 120);
    return;
  }

  try {
    const tab = await getActiveTab();

    if (tab && tab.id && tab.windowId && !tab.url?.startsWith('about:')) {
      // 2. Check exclusion blacklist
      if (isDomainBlacklisted(tab.url, settings.blacklist)) {
        setTimeout(globalCaptureLoop, 500);
        return;
      }

      // Configure resolution and JPEG quality according to user settings.
      // maxW values are generous because jsQR now runs in a Worker (0 ms main-thread cost),
      // and high-density QR codes (version 35+, 157+ modules) need ~2px/module minimum.
      const resolution = settings.scanResolution || '720';
      let maxW = 960;
      let quality = 75;
      if (resolution === '720') {
        maxW = 720;  // was 540 — increased to handle dense QR codes at typical screen sizes
        quality = 72;
      } else if (resolution === '1440') {
        maxW = 1280;
        quality = 82;
      }

      const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality
      });

      if (dataUrl && isGlobalActive && !isTabScrolling) {
        const frameHash = computeFrameHash(dataUrl);

        if (frameHash === lastFrameHash) {
          if (hasActiveQR) {
            // QR is locked, frame is identical — safe to reuse previous result without re-decoding
            unchangedEmptyFrames = 0;
            const userFps = Math.max(1, Math.min(120, Number(settings.scanRate) || 2));
            loopTimer = setTimeout(globalCaptureLoop, Math.round(1000 / userFps));
            return;
          } else {
            unchangedEmptyFrames++;
            if (unchangedEmptyFrames >= 2) {
              // Frame was verified twice with no QR detected and is static.
              // Eco-mode (2 FPS) until screen updates or user scrolls.
              loopTimer = setTimeout(globalCaptureLoop, 500);
              return;
            }
          }
        } else {
          unchangedEmptyFrames = 0;
          lastFrameHash = frameHash;
        }

        const videoInfo = tabVideoRects.get(tab.id) || null;
        const decoded = await decodeDataUrl(dataUrl, maxW, videoInfo);

        if (decoded && decoded.qrs && decoded.qrs.length > 0) {
          const wasActive = hasActiveQR;
          hasActiveQR = true;

          // Only write history when QR data is newly seen (not on every frame)
          const newDataKeys = decoded.qrs.map((q) => q.data).join('|');
          if (!wasActive || newDataKeys !== lastQrDataSnapshot) {
            lastQrDataSnapshot = newDataKeys;
            for (const qr of decoded.qrs) {
              if (!reportedQrDataThisSession.has(qr.data)) {
                reportedQrDataThisSession.add(qr.data);
                const parsed = classifyContent(qr.data);
                addScanHistory({
                  text: qr.data,
                  type: parsed.type,
                  title: parsed.title
                }).catch(() => {});
              }
            }
          }

          browser.tabs.sendMessage(tab.id, {
            type: 'QR_DETECTED',
            qrResults: decoded.qrs,
            qrResult: decoded.qr,
            scanWidth: decoded.scanWidth,
            scanHeight: decoded.scanHeight
          }).catch(() => {});
        } else {
          hasActiveQR = false;
          browser.tabs.sendMessage(tab.id, {
            type: 'QR_NOT_FOUND'
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    // Tab switching or window hidden
  }

  if (isGlobalActive) {
    // User-configured FPS from 1 to 120 (Slider setting):
    const userFps = Math.max(1, Math.min(120, Number(settings.scanRate) || 2));

    // When a QR code is on screen, run at full userFps for maximum tracking smoothness (up to 120 FPS).
    // When idle (no QR code on screen), cap idle scan loop at 10 FPS to avoid burning CPU on empty screens.
    const effectiveFps = hasActiveQR
      ? userFps
      : Math.max(1, Math.min(10, userFps));

    const targetInterval = Math.round(1000 / effectiveFps);
    const elapsed = performance.now() - loopStartTime;
    const nextDelay = Math.max(4, targetInterval - elapsed);

    loopTimer = setTimeout(globalCaptureLoop, nextDelay);
  } else {
    isLoopRunning = false;
  }
}

/**
 * Starts the scanner globally across all tabs.
 */
async function startGlobalScan() {
  isGlobalActive = true;
  await saveSettings({ globalActive: true });
  updateGlobalBadge(true);

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    await ensureInjected(tab.id);
    browser.tabs.sendMessage(tab.id, { type: 'SCANNER_STARTED' }).catch(() => {});
  }

  if (!isLoopRunning) {
    globalCaptureLoop();
  }
  return { success: true, active: true };
}

/**
 * Stops the scanner globally.
 */
async function stopGlobalScan() {
  isGlobalActive = false;
  hasActiveQR = false;
  unchangedEmptyFrames = 0;
  lastFrameHash = 0;
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
  await saveSettings({ globalActive: false });
  updateGlobalBadge(false);

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    browser.tabs.sendMessage(tab.id, { type: 'SCANNER_STOPPED' }).catch(() => {});
  }
  return { success: true, active: false };
}

/**
 * Toggles global scanner state.
 */
async function toggleGlobalScan() {
  if (isGlobalActive) {
    return await stopGlobalScan();
  } else {
    return await startGlobalScan();
  }
}

/**
 * Updates extension toolbar badge globally.
 */
function updateGlobalBadge(isActive) {
  if (isActive) {
    browser.action.setBadgeText({ text: 'ON' });
    browser.action.setBadgeBackgroundColor({ color: '#00f0ff' });
    browser.action.setBadgeTextColor({ color: '#000000' }).catch(() => {});
  } else {
    browser.action.setBadgeText({ text: '' });
  }
}

// Window focus listener: Pause when Firefox is minimized or loses focus
if (typeof browser !== 'undefined' && browser.windows && browser.windows.onFocusChanged) {
  browser.windows.onFocusChanged.addListener((windowId) => {
    isWindowFocused = windowId !== browser.windows.WINDOW_ID_NONE;
    currentActiveTab = null;
    if (isWindowFocused && isGlobalActive && !isLoopRunning) {
      globalCaptureLoop();
    }
  });
}

// When user switches tabs, ensure content script on the new tab
if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.onActivated) {
  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    currentActiveTab = null;
    if (isGlobalActive) {
      hasActiveQR = false;
      await ensureInjected(tabId);
      browser.tabs.sendMessage(tabId, { type: 'SCANNER_STARTED' }).catch(() => {});
    }
  });
}

// When tab finishes loading, inject if global scanner is ON
if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.onUpdated) {
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      currentActiveTab = null;
    }
    if (isGlobalActive && changeInfo.status === 'complete' && tab.active) {
      await ensureInjected(tabId);
      browser.tabs.sendMessage(tabId, { type: 'SCANNER_STARTED' }).catch(() => {});
    }
  });
}

// Clean up video rects when tab is closed
if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.onRemoved) {
  browser.tabs.onRemoved.addListener((tabId) => {
    tabVideoRects.delete(tabId);
    if (currentActiveTab && currentActiveTab.id === tabId) {
      currentActiveTab = null;
    }
  });
}

// Message Hub
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  switch (message.type) {
    case 'SCROLL_START': {
      isTabScrolling = true;
      sendResponse({ ok: true });
      return false;
    }

    case 'SCROLL_END': {
      isTabScrolling = false;
      sendResponse({ ok: true });
      return false;
    }

    case 'DOM_QR_DETECTED': {
      hasActiveQR = true;
      if (message.qrData) {
        const parsed = classifyContent(message.qrData);
        addScanHistory({
          text: message.qrData,
          type: parsed.type,
          title: parsed.title
        }).catch(() => {});
      }
      sendResponse({ ok: true });
      return false;
    }

    case 'VIDEO_RECTS_UPDATE': {
      const tabId = sender?.tab?.id || currentActiveTab?.id;
      if (tabId) {
        tabVideoRects.set(tabId, {
          rects: message.rects || [],
          dpr: message.dpr || 1,
          viewportWidth: message.viewportWidth,
          viewportHeight: message.viewportHeight,
          lastUpdate: Date.now()
        });
      }
      sendResponse({ ok: true });
      return false;
    }

    case 'SETTINGS_UPDATED': {
      if (message.settings) {
        cachedSettings = message.settings;
      }
      if (isGlobalActive) {
        if (loopTimer) {
          clearTimeout(loopTimer);
          loopTimer = null;
        }
        globalCaptureLoop();
      }
      sendResponse({ ok: true });
      return false;
    }

    case 'GET_STATUS':
    case 'GET_GLOBAL_STATUS': {
      sendResponse({ active: isGlobalActive });
      return false;
    }

    case 'START_SCAN':
    case 'START_GLOBAL_SCAN': {
      startGlobalScan().then(sendResponse);
      return true;
    }

    case 'STOP_SCAN':
    case 'STOP_GLOBAL_SCAN': {
      stopGlobalScan().then(sendResponse);
      return true;
    }

    case 'TOGGLE_SCAN':
    case 'TOGGLE_GLOBAL_SCAN': {
      toggleGlobalScan().then(sendResponse);
      return true;
    }
  }
  });
}

// Keyboard shortcut (Alt+Q)
if (typeof browser !== 'undefined' && browser.commands && browser.commands.onCommand) {
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-scanner') {
      await toggleGlobalScan();
    }
  });
}

// Listen for storage changes to immediately update settings (e.g. scanRate slider changes)
if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.qr_radar_settings && changes.qr_radar_settings.newValue) {
      cachedSettings = changes.qr_radar_settings.newValue;
      if (isGlobalActive) {
        if (loopTimer) {
          clearTimeout(loopTimer);
          loopTimer = null;
        }
        globalCaptureLoop();
      }
    }
  });
}

// Restore saved state on startup
if (typeof browser !== 'undefined') {
  getSettings().then((settings) => {
    if (settings && settings.globalActive) {
      startGlobalScan();
    }
  }).catch(() => {});
}
