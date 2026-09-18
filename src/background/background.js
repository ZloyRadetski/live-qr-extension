/**
 * Background Service Worker / Script for QR Radar.
 * Global Real-Time Scanner:
 * - Scans seamlessly across ALL tabs without needing per-page activation.
 * - Silent native tab capture with 60FPS scroll compensation in content script.
 * - Optimized 720p frame decoding with jsQR for low CPU usage and true high FPS.
 */

import jsQR from 'jsqr';
import { getSettings, saveSettings, addScanHistory } from '../utils/storage.js';
import { classifyContent } from '../utils/parser.js';

let isGlobalActive = false;
let isLoopRunning = false;

// In-memory canvas and context for decoding
let canvas = null;
let ctx = null;

function getCanvas() {
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
  return { canvas, ctx };
}

/**
 * Decodes a JPEG data URL with jsQR using high-speed 720p scaling.
 * @param {string} dataUrl
 * @returns {Promise<{ qr: any, scanWidth: number, scanHeight: number } | null>}
 */
async function decodeDataUrl(dataUrl) {
  const { canvas, ctx } = getCanvas();
  if (!canvas || !ctx) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      // Downsample to max 720px for lightning-fast decoding
      const maxW = 720;
      if (w > maxW) {
        const ratio = maxW / w;
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const qr = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });

      resolve({ qr, scanWidth: w, scanHeight: h });
    };

    img.onerror = () => resolve(null);
    img.src = dataUrl;
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
  } catch (err) {
    // System pages or restricted domains cannot be scripted
    return false;
  }
}

/**
 * Continuous capture loop targeting the currently active tab.
 */
async function globalCaptureLoop() {
  if (!isGlobalActive) {
    isLoopRunning = false;
    return;
  }

  isLoopRunning = true;
  const loopStartTime = performance.now();

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.id && tab.windowId && !tab.url?.startsWith('about:')) {
      // Capture the visible area of current active tab
      const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 65
      });

      if (dataUrl && isGlobalActive) {
        const decoded = await decodeDataUrl(dataUrl);

        if (decoded && decoded.qr) {
          const parsed = classifyContent(decoded.qr.data);
          addScanHistory({
            text: decoded.qr.data,
            type: parsed.type,
            title: parsed.title
          }).catch(() => {});

          // Transmit coordinates to active tab
          browser.tabs.sendMessage(tab.id, {
            type: 'QR_DETECTED',
            qrResult: decoded.qr,
            scanWidth: decoded.scanWidth,
            scanHeight: decoded.scanHeight
          }).catch(() => {});
        } else {
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
    const fps = settings.scanRate || 15;
    const targetInterval = Math.round(1000 / fps);
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

  // Notify current active tab immediately
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
  await saveSettings({ globalActive: false });
  updateGlobalBadge(false);

  // Notify current active tab
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

// When user switches tabs, ensure content script on the new tab
browser.tabs.onActivated.addListener(async ({ tabId }) => {
  if (isGlobalActive) {
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
