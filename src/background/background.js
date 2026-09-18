/**
 * Background Service Worker / Script for QR Radar.
 * Performs native tab capture via browser.tabs.captureVisibleTab (zero website prompts),
 * decodes frames with jsQR, and transmits coordinates to content scripts.
 */

import jsQR from 'jsqr';
import { getSettings, addScanHistory } from '../utils/storage.js';
import { classifyContent } from '../utils/parser.js';

// Set of currently scanning tab IDs
const activeTabs = new Set();

// In-memory offscreen canvas and image for decoding
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
 * Decodes a base64/JPEG data URL with jsQR.
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

      // Downsample for high-speed detection (capped at 960px width)
      const maxW = 960;
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
 * Continuous capture and detection loop for a specific tab.
 * @param {number} tabId
 */
async function captureLoop(tabId) {
  if (!activeTabs.has(tabId)) return;

  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab || !tab.active) {
      // If tab is in background, pause and re-check shortly
      if (activeTabs.has(tabId)) {
        setTimeout(() => captureLoop(tabId), 400);
      }
      return;
    }

    // Capture tab silently via native extension API (no site prompt!)
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 70
    });

    if (dataUrl && activeTabs.has(tabId)) {
      const decoded = await decodeDataUrl(dataUrl);

      if (decoded && decoded.qr) {
        // Classify and save to history
        const parsed = classifyContent(decoded.qr.data);
        addScanHistory({
          text: decoded.qr.data,
          type: parsed.type,
          title: parsed.title
        }).catch(() => {});

        // Send detection to content script
        browser.tabs.sendMessage(tabId, {
          type: 'QR_DETECTED',
          qrResult: decoded.qr,
          scanWidth: decoded.scanWidth,
          scanHeight: decoded.scanHeight
        }).catch(() => {});
      } else {
        // Notify no QR code on this frame
        browser.tabs.sendMessage(tabId, {
          type: 'QR_NOT_FOUND'
        }).catch(() => {});
      }
    }
  } catch (err) {
    // Tab might be navigating or closed
    console.debug('[QR Radar] Capture tick skipped:', err?.message || err);
  }

  // Schedule next frame according to settings
  if (activeTabs.has(tabId)) {
    const settings = await getSettings();
    const fps = settings.scanRate || 15;
    const interval = Math.round(1000 / fps);
    setTimeout(() => captureLoop(tabId), interval);
  }
}

/**
 * Injects content script and CSS into a tab if not yet present.
 */
async function ensureInjected(tabId) {
  try {
    const test = await browser.tabs.sendMessage(tabId, { type: 'PING' });
    if (test && test.pong) return true;
  } catch {
    // Not injected yet, inject programmatically
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
    console.warn('[QR Radar] Script injection failed:', err);
    return false;
  }
}

/**
 * Starts scanning for a tab.
 */
async function startScanningTab(tabId) {
  await ensureInjected(tabId);
  activeTabs.add(tabId);
  updateBadge(tabId, true);

  browser.tabs.sendMessage(tabId, { type: 'SCANNER_STARTED' }).catch(() => {});
  captureLoop(tabId);
  return { success: true, active: true };
}

/**
 * Stops scanning for a tab.
 */
function stopScanningTab(tabId) {
  activeTabs.delete(tabId);
  updateBadge(tabId, false);

  browser.tabs.sendMessage(tabId, { type: 'SCANNER_STOPPED' }).catch(() => {});
  return { success: true, active: false };
}

/**
 * Updates extension badge.
 */
function updateBadge(tabId, isActive) {
  if (isActive) {
    browser.action.setBadgeText({ tabId, text: 'ON' });
    browser.action.setBadgeBackgroundColor({ tabId, color: '#00f0ff' });
    browser.action.setBadgeTextColor({ tabId, color: '#000000' }).catch(() => {});
  } else {
    browser.action.setBadgeText({ tabId, text: '' });
  }
}

// Clean up when tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

// Update badge when user switches tabs
browser.tabs.onActivated.addListener(({ tabId }) => {
  updateBadge(tabId, activeTabs.has(tabId));
});

// Message hub
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  const targetTabId = message.tabId || sender.tab?.id;

  switch (message.type) {
    case 'START_SCAN': {
      if (!targetTabId) {
        sendResponse({ success: false, error: 'No active tab' });
        return false;
      }
      startScanningTab(targetTabId).then(sendResponse);
      return true;
    }

    case 'STOP_SCAN': {
      if (!targetTabId) {
        sendResponse({ success: false });
        return false;
      }
      sendResponse(stopScanningTab(targetTabId));
      return false;
    }

    case 'TOGGLE_SCAN': {
      if (!targetTabId) {
        sendResponse({ success: false });
        return false;
      }
      if (activeTabs.has(targetTabId)) {
        sendResponse(stopScanningTab(targetTabId));
      } else {
        startScanningTab(targetTabId).then(sendResponse);
      }
      return true;
    }

    case 'GET_STATUS': {
      const active = targetTabId ? activeTabs.has(targetTabId) : false;
      sendResponse({ active });
      return false;
    }
  }
});

// Keyboard shortcut (Alt+Q)
if (browser.commands && browser.commands.onCommand) {
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-scanner') {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        if (activeTabs.has(tab.id)) {
          stopScanningTab(tab.id);
        } else {
          await startScanningTab(tab.id);
        }
      }
    }
  });
}
