/**
 * QR Radar Content Script.
 * Manages the on-screen HUD overlay and receives detection updates from background service.
 */

import { QROverlayManager } from './overlay.js';
import { getSettings } from '../utils/storage.js';
import { scanVisibleDomImages, getVisibleVideoRects, invalidateShadowRoots } from '../utils/dom-scanner.js';

// The script runs in every frame (manifest all_frames). Screen-capture results are expressed in the
// top-level viewport, so only the top frame draws them; child frames scan their own <img>/<canvas>.
const isTopFrame = (() => {
  try { return window === window.top; } catch { return false; }
})();

/** Ad pixels, tracking frames and hidden iframes cannot show a QR code: do not pay for them. */
function isFrameTooSmall() {
  return !isTopFrame && (window.innerWidth < 48 || window.innerHeight < 48);
}

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
let videoResizeObserver = null;

function observeVideoElement(v) {
  if (typeof ResizeObserver === 'undefined' || !v) return;
  if (!videoResizeObserver) {
    videoResizeObserver = new ResizeObserver(() => {
      reportVisibleVideoRects(true);
    });
  }
  try {
    videoResizeObserver.observe(v);
  } catch {}
}

/**
 * Reports visible <video> element bounding rects to background worker for high-res crop scanning.
 * Time-throttled (500ms) + deduplicates: avoids spamming querySelectorAll and IPC.
 * @param {boolean} [force=false] Bypasses throttle to report immediately (e.g. on fullscreen or resize).
 */
function reportVisibleVideoRects(force = false) {
  // Rects of videos inside iframes are relative to that iframe, not to the captured viewport.
  if (!isTopFrame) return;
  const now = Date.now();
  if (!force && now - lastVideoRectsReportTime < 500) return;
  lastVideoRectsReportTime = now;

  const rects = getVisibleVideoRects();
  const key = rects.map((r) => `${r.left},${r.top},${r.width},${r.height}`).join(';');
  if (!force && key === lastReportedVideoKey) {
    return;
  }
  lastReportedVideoKey = key;

  // Track any videos with ResizeObserver so mode switches (Theater mode, expand) notify background immediately
  if (typeof document !== 'undefined') {
    const vids = document.querySelectorAll('video');
    for (const v of vids) {
      observeVideoElement(v);
    }
  }

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
  // In-page <img>/<canvas> scanning is cached per element and re-triggered by DOM mutations,
  // scroll end and navigation, so polling faster than 4 Hz only burns the page's main thread.
  const fps = Math.max(1, Math.min(4, Math.round((Number(scanRate) || 2) / 3)));
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
let isDomScanRunning = false;

async function triggerDomScan() {
  // Background tabs are invisible: never decode images there. A previous tick may still be busy.
  if (!isMounted || document.hidden || isDomScanRunning) return;
  isDomScanRunning = true;
  try {
    await runDomScan();
  } finally {
    isDomScanRunning = false;
  }
}

async function runDomScan() {
  const settings = await getCachedContentSettings();
  if (settings.scanDomImages === false) return;

  // Report any visible video player viewports to background service
  reportVisibleVideoRects();

  const results = await scanVisibleDomImages();
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
          if (node.nodeType !== 1) continue;
          // Custom elements (tag name contains "-") usually host a shadow root with their own media
          if (node.tagName.includes('-')) {
            invalidateShadowRoots();
            hasRelevantMutation = true;
            break;
          }
          if (node.tagName === 'IMG' || node.tagName === 'VIDEO' || node.tagName === 'CANVAS' || node.querySelector?.('img, video, canvas')) {
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
let initInFlight = null;

function initOverlay() {
  if (overlay && isMounted) return Promise.resolve(overlay);
  if (isFrameTooSmall()) return Promise.resolve(null);
  // Concurrent triggers (message + auto-init + SPA navigation) must not create two overlays
  if (!initInFlight) {
    initInFlight = doInitOverlay().finally(() => { initInFlight = null; });
  }
  return initInFlight;
}

async function doInitOverlay() {

  const settings = await getSettings();

  overlay = new QROverlayManager({
    soundEnabled: settings.soundEnabled,
    autoCopy: settings.autoCopy,
    themeColor: settings.themeColor,
    cardDisplayMode: settings.cardDisplayMode,
    glowAnimation: settings.glowAnimation,
    cornerBrackets: settings.cornerBrackets,
    scanRate: settings.scanRate || 2,
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
    updateDomScanRate(settings.scanRate || 2);
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

/**
 * Registers all page/runtime listeners. Runs once per frame: the content script can be injected
 * both by the manifest and again by the background (tabs opened before install), so it guards itself.
 */
function bootstrap() {
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
          if (!isTopFrame) {
            sendResponse({ received: false });
            return false;
          }
          const qrs = message.qrResults || (message.qrResult ? [message.qrResult] : []);
          if (!overlay) {
            initOverlay().then((ov) => {
              if (ov) ov.updateFromScreen(qrs, message.scanWidth, message.scanHeight);
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

  // Resize and fullscreen listeners: instantly update video rects
  window.addEventListener('resize', () => {
    reportVisibleVideoRects(true);
    if (overlay) {
      overlay.onScroll();
    }
  }, { passive: true });

  const onFullscreenChange = () => {
    reportVisibleVideoRects(true);
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

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

  // Hidden tabs/frames must not scan; re-arm everything as soon as the tab becomes visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (domScanInterval) {
        clearInterval(domScanInterval);
        domScanInterval = null;
      }
      return;
    }
    getCachedContentSettings().then((settings) => {
      if (!settings || !settings.globalActive) return;
      if (!overlay) {
        initOverlay();
      } else if (settings.scanDomImages !== false) {
        updateDomScanRate(settings.scanRate);
        reportVisibleVideoRects(true);
        triggerDomScan();
      }
    }).catch(() => {});
  });

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
  // (hidden tabs wait for their visibilitychange instead of all initialising at browser start)
  getSettings().then((settings) => {
    if (settings && settings.globalActive && !document.hidden) {
      initOverlay();
    }
  }).catch(() => {});
}

if (!globalThis.__qrRadarContentLoaded) {
  globalThis.__qrRadarContentLoaded = true;
  bootstrap();
}
