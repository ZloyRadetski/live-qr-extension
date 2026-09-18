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
let remoteCanvas = null;
let remoteCtx = null;
let isCapturing = false;

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

function getRemoteCanvas() {
  if (!remoteCanvas && typeof document !== 'undefined') {
    remoteCanvas = document.createElement('canvas');
    remoteCtx = remoteCanvas.getContext('2d', { willReadFrequently: true });
  }
  return { remoteCanvas, remoteCtx };
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
      { formats: ['QRCode'], maxNumberOfSymbols: maxQRs, tryHarder: true }
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

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

/**
 * High-speed Base64 string to Uint8Array decoder using lookup table.
 * Supports an optional startIndex to decode directly from a data URL
 * without allocating intermediate substrings (e.g. dataUrl.slice()).
 * @param {string} b64 
 * @param {number} [startIndex=0]
 * @returns {Uint8Array}
 */
export function fastBase64ToBytes(b64, startIndex = 0) {
  const len = b64.length - startIndex;
  if (len <= 0) return new Uint8Array(0);
  let validLen = len;
  if (len > 0 && b64.charCodeAt(startIndex + len - 1) === 61) validLen--;
  if (len > 1 && b64.charCodeAt(startIndex + len - 2) === 61) validLen--;
  const byteLen = (validLen * 3) >> 2;
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < validLen; i += 4) {
    const enc1 = B64_LOOKUP[b64.charCodeAt(startIndex + i)];
    const enc2 = B64_LOOKUP[b64.charCodeAt(startIndex + i + 1)];
    const enc3 = B64_LOOKUP[b64.charCodeAt(startIndex + i + 2)];
    const enc4 = B64_LOOKUP[b64.charCodeAt(startIndex + i + 3)];
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (p < byteLen) bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (p < byteLen) bytes[p++] = ((enc3 & 3) << 6) | enc4;
  }
  return bytes;
}

/**
 * Converts a data URL to a Blob with zero intermediate string allocations.
 * Directly decodes from dataUrl into Uint8Array via startIndex offset.
 * @param {string} dataUrl
 * @returns {Blob | null}
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;
  let mime = 'image/jpeg';
  if (comma > 5) {
    const semi = dataUrl.indexOf(';', 5);
    if (semi !== -1 && semi < comma) {
      mime = dataUrl.slice(5, semi);
    }
  }
  const bytes = fastBase64ToBytes(dataUrl, comma + 1);
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
export async function decodeVideoCrops(img, videoInfo, maxDim = 1920) {
  if (!videoInfo || !videoInfo.rects || videoInfo.rects.length === 0) return null;
  const { cropCanvas: cCanvas, cropCtx: cCtx } = getCropCanvas();
  if (!cCanvas || !cCtx) return null;

  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  // True scale ratio between physical screenshot bitmap pixels and CSS viewport pixels.
  // In LibreWolf / privacy.resistFingerprinting, window.devicePixelRatio is spoofed (e.g. 1.0),
  // but captureVisibleTab returns physical screen resolution (e.g. 1.25x or 1.5x on Windows).
  // Comparing img dimensions to viewport dimensions yields the exact physical-to-CSS ratio.
  const scaleX = videoInfo.viewportWidth ? (imgW / videoInfo.viewportWidth) : (videoInfo.dpr || 1);
  const scaleY = videoInfo.viewportHeight ? (imgH / videoInfo.viewportHeight) : (videoInfo.dpr || 1);
  const qrs = [];

  for (const rect of videoInfo.rects) {
    // Unclipped target crop coordinates in physical screenshot pixels
    const rawSrcX = Math.round(rect.left * scaleX);
    const rawSrcY = Math.round(rect.top * scaleY);
    const rawSrcW = Math.round(rect.width * scaleX);
    const rawSrcH = Math.round(rect.height * scaleY);

    // Visible crop coordinates clamped to screenshot boundaries
    let srcX = rawSrcX;
    let srcY = rawSrcY;
    let srcW = rawSrcW;
    let srcH = rawSrcH;

    // Track how many physical pixels were clipped off the left and top edges
    let clipLeft = 0;
    let clipTop = 0;

    if (srcX < 0) {
      clipLeft = -srcX;
      srcW += srcX;
      srcX = 0;
    }
    if (srcY < 0) {
      clipTop = -srcY;
      srcH += srcY;
      srcY = 0;
    }
    if (srcX + srcW > imgW) {
      srcW = imgW - srcX;
    }
    if (srcY + srcH > imgH) {
      srcH = imgH - srcY;
    }

    if (srcW < 24 || srcH < 24) continue;

    // Preserve resolution up to maxDim (default 1080p+) so small QR codes in videos survive
    const maxCropDim = Math.max(maxDim, 1080);
    let drawW = srcW;
    let drawH = srcH;
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

    // Projects a point inside the crop canvas back to viewport CSS coordinates:
    // (clipLeft + p.x * scaleBackX) gives the offset within the unclipped video in physical pixels;
    // dividing by scaleX converts to CSS pixels, and adding rect.left anchors it in the viewport.
    const mapPoint = (p) => ({
      x: rect.left + ((clipLeft + p.x * scaleBackX) / scaleX),
      y: rect.top  + ((clipTop  + p.y * scaleBackY) / scaleY)
    });

    for (const qr of cropQrs) {
      const loc = qr.location;
      qrs.push({
        data: qr.data,
        location: {
          topLeftCorner:     mapPoint(loc.topLeftCorner),
          topRightCorner:    mapPoint(loc.topRightCorner),
          bottomRightCorner: mapPoint(loc.bottomRightCorner),
          bottomLeftCorner:  mapPoint(loc.bottomLeftCorner)
        }
      });
    }
  }

  if (qrs.length > 0) {
    const vw = videoInfo.viewportWidth || Math.round(imgW / scaleX);
    const vh = videoInfo.viewportHeight || Math.round(imgH / scaleY);
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
 * @param {number} [maxW=1920]
 * @param {any} [videoInfo=null]
 * @returns {Promise<{ qrs: any[], qr: any, scanWidth: number, scanHeight: number } | null>}
 */
export async function decodeDataUrl(dataUrl, maxW = 1920, videoInfo = null) {
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
      const videoResult = await decodeVideoCrops(bitmap, videoInfo, maxW);
      if (videoResult && videoResult.qrs && videoResult.qrs.length > 0) {
        return videoResult;
      }
    }

    // 2. Full-screen scan fallback (also catches QR codes outside video players)

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
  if (!isGlobalActive || isCapturing) {
    if (!isGlobalActive) isLoopRunning = false;
    return;
  }

  isCapturing = true;
  isLoopRunning = true;
  const loopStartTime = performance.now();
  const settings = await getCachedSettings();

  try {
    // 1. Power Saver: Skip capture if window is blurred or (pauseOnScroll && actively scrolling)
    const shouldPauseForScroll = (settings.pauseOnScroll !== false) && isTabScrolling;
    if (!isWindowFocused || shouldPauseForScroll) {
      loopTimer = setTimeout(globalCaptureLoop, 120);
      return;
    }

    try {
      const tab = await getActiveTab();

      if (tab && tab.id && tab.windowId && !tab.url?.startsWith('about:')) {
        // 2. Check exclusion blacklist
        if (isDomainBlacklisted(tab.url, settings.blacklist)) {
          loopTimer = setTimeout(globalCaptureLoop, 500);
          return;
        }

        // Configure resolution and JPEG quality according to user settings.
        // With Wasm running in Worker (~10 ms), full 1080p native resolution ensures
        // small QR codes (e.g. 40x40px on high-DPI or large screens) are not destroyed by downsampling.
        const resolution = settings.scanResolution || '1080';
        let maxW = 1920;
        let quality = 78;
        if (resolution === '720') {
          maxW = 1280;  // provides at least 1280px width so small QR codes survive downsampling
          quality = 75;
        } else if (resolution === '1440') {
          maxW = 2560;
          quality = 85;
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
              const userFps = Math.max(1, Math.min(30, Number(settings.scanRate) || 2));
              loopTimer = setTimeout(globalCaptureLoop, Math.round(1000 / userFps));
              return;
            } else {
              // Frame is identical and has no QR — skip decode immediately
              unchangedEmptyFrames++;
              const idleDelay = unchangedEmptyFrames >= 3 ? 1200 : 500;
              loopTimer = setTimeout(globalCaptureLoop, idleDelay);
              return;
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
      // User-configured FPS from 1 to 30 (Slider setting):
      const userFps = Math.max(1, Math.min(30, Number(settings.scanRate) || 2));

      // When a QR code is on screen, run at full userFps for fast tracking (up to 30 FPS).
      // When idle (no QR code on screen), cap idle scan loop at 6 FPS to avoid burning CPU on empty screens.
      const effectiveFps = hasActiveQR
        ? userFps
        : Math.max(1, Math.min(6, userFps));

      const targetInterval = Math.round(1000 / effectiveFps);
      const elapsed = performance.now() - loopStartTime;
      const nextDelay = Math.max(4, targetInterval - elapsed);

      loopTimer = setTimeout(globalCaptureLoop, nextDelay);
    } else {
      isLoopRunning = false;
    }
  } finally {
    isCapturing = false;
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

// Remote image decode cache to avoid re-fetching the same image URLs
const remoteImageCache = new Map();

/**
 * Fetches an external image without CORS restrictions and scans it at native resolution with zxing-wasm.
 * @param {string} url
 * @returns {Promise<Array<{ data: string, relLoc: { topLeftCorner: {x:number, y:number}, ... } }>>}
 */
export async function fetchRemoteImageAndDecode(url) {
  if (!url || typeof fetch === 'undefined') return [];
  if (remoteImageCache.has(url)) {
    return remoteImageCache.get(url);
  }

  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) {
      remoteImageCache.set(url, []);
      return [];
    }
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    try {
      let w = bitmap.width;
      let h = bitmap.height;
      if (w < 20 || h < 20) {
        remoteImageCache.set(url, []);
        return [];
      }

      // Cap at 2048px to prevent gigantic textures
      if (w > 2048 || h > 2048) {
        const ratio = Math.min(2048 / w, 2048 / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const { remoteCanvas: rCanvas, remoteCtx: rCtx } = getRemoteCanvas();
      if (!rCanvas || !rCtx) return [];
      if (rCanvas.width !== w || rCanvas.height !== h) {
        rCanvas.width = w;
        rCanvas.height = h;
      }
      rCtx.drawImage(bitmap, 0, 0, w, h);
      const imgData = rCtx.getImageData(0, 0, w, h);
      const qrs = await decodeWithWorker(imgData.data.buffer, w, h, 4);

      const normalized = (qrs || []).map((q) => ({
        data: q.data,
        relLoc: {
          topLeftCorner:     { x: q.location.topLeftCorner.x / w,     y: q.location.topLeftCorner.y / h },
          topRightCorner:    { x: q.location.topRightCorner.x / w,    y: q.location.topRightCorner.y / h },
          bottomRightCorner: { x: q.location.bottomRightCorner.x / w, y: q.location.bottomRightCorner.y / h },
          bottomLeftCorner:  { x: q.location.bottomLeftCorner.x / w,  y: q.location.bottomLeftCorner.y / h }
        }
      }));

      // Cache up to 200 remote image results
      if (remoteImageCache.size > 200) {
        const firstKey = remoteImageCache.keys().next().value;
        remoteImageCache.delete(firstKey);
      }
      remoteImageCache.set(url, normalized);
      return normalized;
    } finally {
      bitmap.close();
    }
  } catch (err) {
    remoteImageCache.set(url, []);
    return [];
  }
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
      unchangedEmptyFrames = 0;
      if (isGlobalActive) {
        if (loopTimer) clearTimeout(loopTimer);
        // Instant Snapshot-on-Rest: take sharp capture right after scroll stops
        loopTimer = setTimeout(globalCaptureLoop, 25);
      }
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

    case 'SCAN_REMOTE_IMAGE': {
      fetchRemoteImageAndDecode(message.url)
        .then((qrs) => sendResponse({ qrs: qrs || [] }))
        .catch(() => sendResponse({ qrs: [] }));
      return true;
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
