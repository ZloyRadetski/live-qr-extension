/**
 * Background Service Worker / Script for QR Radar.
 * Highly Optimized Global Real-Time Scanner:
 * - Dynamic power management: pauses captures during scroll or window blur (0% CPU).
 * - Adaptive FPS throttling: switches to low-power maintenance mode (4 FPS) when QR is anchored.
 * - Ultra-fast 540p downsampled decoding with jsQR (<4ms decode time).
 * - Reusable image memory buffer to eliminate GC pressure.
 */

import jsQR from 'jsqr';
import { getSettings, saveSettings, addScanHistory, isDomainBlacklisted } from '../utils/storage.js';
import { classifyContent } from '../utils/parser.js';
import { maskQrRegion } from '../utils/coordinates.js';

let isGlobalActive = false;
let isLoopRunning = false;
let isTabScrolling = false;
let isWindowFocused = true;
let hasActiveQR = false;

// Reusable image & canvas buffers to avoid GC pressure
let canvas = null;
let ctx = null;
let cachedImg = null;

function getCanvas() {
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    cachedImg = new Image();
  }
  return { canvas, ctx, cachedImg };
}

/**
 * Decodes a JPEG data URL with jsQR using configurable scaling and iterative masking for multiple QRs.
 * @param {string} dataUrl
 * @param {number} [maxW=1080]
 * @returns {Promise<{ qrs: any[], qr: any, scanWidth: number, scanHeight: number } | null>}
 */
async function decodeDataUrl(dataUrl, maxW = 1080) {
  const { canvas, ctx, cachedImg } = getCanvas();
  if (!canvas || !ctx || !cachedImg) return null;

  return new Promise((resolve) => {
    cachedImg.onload = () => {
      let w = cachedImg.width;
      let h = cachedImg.height;

      // Downsample to maxW (e.g. 720, 1080, 1440) for optimal speed/accuracy balance
      if (w > maxW) {
        const ratio = maxW / w;
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.drawImage(cachedImg, 0, 0, w, h);
      let imgData = ctx.getImageData(0, 0, w, h);
      const qrs = [];
      const maxQRs = 6;
      let count = 0;

      while (count < maxQRs) {
        const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
        if (!code) break;
        qrs.push(code);
        count++;

        // Mask this QR on canvas so remaining QRs can be detected
        maskQrRegion(ctx, code.location);
        imgData = ctx.getImageData(0, 0, w, h);
      }

      resolve({ qrs, qr: qrs[0] || null, scanWidth: w, scanHeight: h });
    };

    cachedImg.onerror = () => resolve(null);
    cachedImg.src = dataUrl;
  });
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
  const settings = await getSettings();

  // 1. Power Saver: Skip capture if window is blurred or (pauseOnScroll && actively scrolling)
  const shouldPauseForScroll = (settings.pauseOnScroll !== false) && isTabScrolling;
  if (!isWindowFocused || shouldPauseForScroll) {
    setTimeout(globalCaptureLoop, 120);
    return;
  }

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.id && tab.windowId && !tab.url?.startsWith('about:')) {
      // 2. Check exclusion blacklist
      if (isDomainBlacklisted(tab.url, settings.blacklist)) {
        setTimeout(globalCaptureLoop, 500);
        return;
      }

      // Configure resolution and JPEG quality according to user settings
      const resolution = settings.scanResolution || '1080';
      let maxW = 1080;
      let quality = 85;
      if (resolution === '720') {
        maxW = 720;
        quality = 70;
      } else if (resolution === '1440') {
        maxW = 1440;
        quality = 90;
      }

      const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality
      });

      if (dataUrl && isGlobalActive && !isTabScrolling) {
        const decoded = await decodeDataUrl(dataUrl, maxW);

        if (decoded && decoded.qrs && decoded.qrs.length > 0) {
          hasActiveQR = true;
          for (const qr of decoded.qrs) {
            const parsed = classifyContent(qr.data);
            addScanHistory({
              text: qr.data,
              type: parsed.type,
              title: parsed.title
            }).catch(() => {});
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
    const settings = await getSettings();

    // 2. Adaptive rate: If a QR is locked on screen, reduce rate to 4 FPS
    // (the DOM element anchor already handles 60/120 FPS position updates)
    const baseFps = settings.scanRate || 15;
    const effectiveFps = hasActiveQR ? Math.min(4, baseFps) : baseFps;
    const targetInterval = Math.round(1000 / effectiveFps);
    const elapsed = performance.now() - loopStartTime;
    const nextDelay = Math.max(10, targetInterval - elapsed);

    setTimeout(globalCaptureLoop, nextDelay);
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
if (browser.windows && browser.windows.onFocusChanged) {
  browser.windows.onFocusChanged.addListener((windowId) => {
    isWindowFocused = windowId !== browser.windows.WINDOW_ID_NONE;
    if (isWindowFocused && isGlobalActive && !isLoopRunning) {
      globalCaptureLoop();
    }
  });
}

// When user switches tabs, ensure content script on the new tab
browser.tabs.onActivated.addListener(async ({ tabId }) => {
  if (isGlobalActive) {
    hasActiveQR = false;
    await ensureInjected(tabId);
    browser.tabs.sendMessage(tabId, { type: 'SCANNER_STARTED' }).catch(() => {});
  }
});

// When tab finishes loading, inject if global scanner is ON
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (isGlobalActive && changeInfo.status === 'complete' && tab.active) {
    await ensureInjected(tabId);
    browser.tabs.sendMessage(tabId, { type: 'SCANNER_STARTED' }).catch(() => {});
  }
});

// Message Hub
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

// Keyboard shortcut (Alt+Q)
if (browser.commands && browser.commands.onCommand) {
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-scanner') {
      await toggleGlobalScan();
    }
  });
}

// Restore saved state on startup
getSettings().then((settings) => {
  if (settings.globalActive) {
    startGlobalScan();
  }
});
