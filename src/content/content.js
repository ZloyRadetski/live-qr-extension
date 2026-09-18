/**
 * QR Radar Content Script.
 * Manages the on-screen HUD overlay and receives detection updates from background service.
 */

import { QROverlayManager } from './overlay.js';
import { getSettings } from '../utils/storage.js';
import { scanVisibleDomImages, getVisibleVideoRects } from '../utils/dom-scanner.js';

let overlay = null;
let isMounted = false;
let domScanInterval = null;
let domObserver = null;
let domMutationDebounce = null;

let lastReportedVideoKey = '';

// Settings cache: avoids hitting browser.storage on every scan tick
let cachedContentSettings = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5000; // 5 seconds

async function getCachedContentSettings() {
  const now = Date.now();
  if (!cachedContentSettings || now - settingsCacheTime > SETTINGS_CACHE_TTL) {
    cachedContentSettings = await getSettings();
    settingsCacheTime = now;
  }
  return cachedContentSettings;
}

let lastVideoRectsReportTime = 0;

/**
 * Reports visible <video> element bounding rects to background worker for high-res crop scanning.
 * Time-throttled (500ms) + deduplicates: avoids spamming querySelectorAll and IPC.
 */
function reportVisibleVideoRects() {
  const now = Date.now();
  if (now - lastVideoRectsReportTime < 500) return;
  lastVideoRectsReportTime = now;

  const rects = getVisibleVideoRects();
  const key = rects.map((r) => `${r.left},${r.top},${r.width},${r.height}`).join(';');
  if (key === lastReportedVideoKey) {
    return;
  }
  lastReportedVideoKey = key;

  try {
    browser.runtime.sendMessage({
      type: 'VIDEO_RECTS_UPDATE',
      rects,
      dpr: window.devicePixelRatio || 1,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    }).catch(() => {});
  } catch {}
}

/**
 * Computes interval for in-page DOM scanner from scanRate FPS setting.
 * @param {number} scanRate 
 * @returns {number} Interval in milliseconds
 */
function getDomScanIntervalMs(scanRate) {
  // DOM scan targets static images/canvases — they don't change 12x/sec.
  // Cap at 3 FPS to save CPU for video capture and page rendering.
  const fps = Math.max(1, Math.min(3, scanRate || 3));
  return Math.round(1000 / fps);
}

/**
 * Resets the in-page DOM scanning interval based on the current FPS setting.
 * @param {number} scanRate 
 */
function updateDomScanRate(scanRate) {
  if (domScanInterval) {
    clearInterval(domScanInterval);
    domScanInterval = null;
  }
  if (isMounted) {
    const intervalMs = getDomScanIntervalMs(scanRate);
    domScanInterval = setInterval(triggerDomScan, intervalMs);
  }
}

/**
 * Scans visible DOM images (<img>, <canvas>) and updates overlay if QR detected.
 */
async function triggerDomScan() {
  if (!isMounted) return;
  const settings = await getCachedContentSettings();
  if (settings.scanDomImages === false) return;

  // Report any visible video player viewports to background service
  reportVisibleVideoRects();

  const results = scanVisibleDomImages();
  if (Array.isArray(results)) {
    if (results.length > 0) {
      if (!overlay) {
        await initOverlay();
      }
      if (overlay) {
        overlay.updateFromDom(results);
      }
      // Notify background service of ALL detected QRs in a single batched message
      try {
        browser.runtime.sendMessage({
          type: 'DOM_QR_DETECTED',
          qrData: results[0].data
        }).catch(() => {});
      } catch {}
    } else if (overlay) {
      // Notify overlay of empty results so missing trackers are cleaned up immediately
      overlay.updateFromDom([]);
    }
  }
}

/**
 * Sets up MutationObserver to detect dynamically added images and video players.
 * Highly filtered to ignore player style/class churn during video playback.
 */
function setupDomObserver() {
  if (domObserver || typeof MutationObserver === 'undefined') return;

  domObserver = new MutationObserver((mutations) => {
    let hasRelevantMutation = false;
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && (node.tagName === 'IMG' || node.tagName === 'VIDEO' || node.tagName === 'CANVAS' || node.querySelector?.('img, video, canvas'))) {
            hasRelevantMutation = true;
            break;
          }
        }
      } else if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'srcset')) {
        hasRelevantMutation = true;
        break;
      }
      if (hasRelevantMutation) break;
    }

    if (!hasRelevantMutation) return;

    clearTimeout(domMutationDebounce);
    domMutationDebounce = setTimeout(() => {
      reportVisibleVideoRects();
      triggerDomScan();
    }, 200);
  });

  if (document.body) {
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset']
    });
  }
}

/**
 * Initializes or mounts overlay HUD and starts DOM media scanning.
 */
async function initOverlay() {
  if (overlay && isMounted) return overlay;

  const settings = await getSettings();

  overlay = new QROverlayManager({
    soundEnabled: settings.soundEnabled,
    autoCopy: settings.autoCopy,
    themeColor: settings.themeColor,
    cardDisplayMode: settings.cardDisplayMode,
    glowAnimation: settings.glowAnimation,
    cornerBrackets: settings.cornerBrackets,
    scanRate: settings.scanRate || 12,
    onStopRequested: () => {
      // Notify background to stop capture loop
      try {
        browser.runtime.sendMessage({ type: 'STOP_SCAN' }).catch(() => {});
      } catch {}
      teardownOverlay();
    }
  });

  overlay.mount();
  isMounted = true;

  // Immediately report video rects to background scanner
  reportVisibleVideoRects();

  // Start DOM scanning features if enabled
  if (settings.scanDomImages !== false) {
    setupDomObserver();
    triggerDomScan();
    updateDomScanRate(settings.scanRate || 12);
  }

  return overlay;
}

/**
 * Unmounts overlay and clears state.
 */
function teardownOverlay() {
  if (domScanInterval) {
    clearInterval(domScanInterval);
    domScanInterval = null;
  }
  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
  clearTimeout(domMutationDebounce);

  if (overlay) {
    overlay.unmount();
    overlay = null;
  }
  isMounted = false;
}

// Runtime message listener from background
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'PING': {
        sendResponse({ pong: true });
        return false;
      }

      case 'SCANNER_STARTED': {
        initOverlay().then(() => sendResponse({ success: true }));
        return true;
      }

      case 'SCANNER_STOPPED': {
        teardownOverlay();
        sendResponse({ success: true });
        return false;
      }

      case 'QR_DETECTED': {
        const qrs = message.qrResults || (message.qrResult ? [message.qrResult] : []);
        if (!overlay) {
          initOverlay().then((ov) => {
            ov.updateFromScreen(qrs, message.scanWidth, message.scanHeight);
          });
        } else {
          overlay.updateFromScreen(qrs, message.scanWidth, message.scanHeight);
        }
        sendResponse({ received: true });
        return false;
      }

      case 'QR_NOT_FOUND': {
        if (overlay) {
          overlay.onScreenQrNotFound();
        }
        sendResponse({ received: true });
        return false;
      }

      case 'SETTINGS_UPDATED': {
        // Invalidate local settings cache immediately
        cachedContentSettings = message.settings || null;
        settingsCacheTime = message.settings ? Date.now() : 0;

        if (overlay && message.settings) {
          overlay.updateSettings(message.settings);
        }
        if (message.settings) {
          if (message.settings.scanDomImages === false) {
            if (domScanInterval) {
              clearInterval(domScanInterval);
              domScanInterval = null;
            }
            if (domObserver) {
              domObserver.disconnect();
              domObserver = null;
            }
          } else if (message.settings.scanDomImages === true || isMounted) {
            setupDomObserver();
            triggerDomScan();
            updateDomScanRate(message.settings.scanRate);
          }
        }
        sendResponse({ success: true });
        return false;
      }
    }
  });
}

// 60/120 FPS Real-time scroll compensation with background pause
let scrollNotifyTimer = null;
let isScrollingActive = false;

window.addEventListener('scroll', () => {
  if (overlay) {
    overlay.onScroll();
  }

  // Notify background service to pause heavy captures during scroll
  if (!isScrollingActive) {
    isScrollingActive = true;
    try {
      browser.runtime.sendMessage({ type: 'SCROLL_START' }).catch(() => {});
    } catch {}
  }

  clearTimeout(scrollNotifyTimer);
  scrollNotifyTimer = setTimeout(() => {
    isScrollingActive = false;
    try {
      browser.runtime.sendMessage({ type: 'SCROLL_END' }).catch(() => {});
    } catch {}
    reportVisibleVideoRects();
    triggerDomScan();
  }, 140);
}, { passive: true });

// Resize listener
window.addEventListener('resize', () => {
  reportVisibleVideoRects();
  if (overlay) {
    overlay.onScroll();
  }
}, { passive: true });

// SPA Navigation support (YouTube yt-navigate-finish, popstate, hashchange)
function onSpaNavigation() {
  getCachedContentSettings().then((settings) => {
    if (settings && settings.globalActive) {
      if (!overlay) {
        initOverlay();
      } else {
        reportVisibleVideoRects();
        triggerDomScan();
      }
    }
  }).catch(() => {});
}

window.addEventListener('yt-navigate-finish', onSpaNavigation);
window.addEventListener('popstate', onSpaNavigation);
window.addEventListener('hashchange', onSpaNavigation);

// Fallback in-page shortcut (Alt+Q)
window.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'q' || e.key === 'й' || e.key === 'Q' || e.key === 'Й')) {
    e.preventDefault();
    try {
      browser.runtime.sendMessage({ type: 'TOGGLE_SCAN' }).catch(() => {});
    } catch {}
  }
});

// Auto-initialize on page load if scanner is already globally active
getSettings().then((settings) => {
  if (settings && settings.globalActive) {
    initOverlay();
  }
}).catch(() => {});
