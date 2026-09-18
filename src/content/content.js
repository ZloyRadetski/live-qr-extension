/**
 * QR Radar Content Script.
 * Manages the on-screen HUD overlay and receives detection updates from background service.
 */

import { QROverlayManager } from './overlay.js';
import { getSettings } from '../utils/storage.js';
import { scanVisibleDomImages } from '../utils/dom-scanner.js';

let overlay = null;
let isMounted = false;
let domScanInterval = null;
let domObserver = null;
let domMutationDebounce = null;

/**
 * Scans visible DOM images (<img>, <canvas>) and updates overlay if QR detected.
 */
async function triggerDomScan() {
  if (!isMounted) return;
  const settings = await getSettings();
  if (settings.scanDomImages === false) return;

  const result = scanVisibleDomImages();
  if (result && result.code) {
    if (!overlay) {
      await initOverlay();
    }
    if (overlay) {
      overlay.update(result.code, 1, 1, result.element);
    }
    // Notify background service
    try {
      browser.runtime.sendMessage({
        type: 'DOM_QR_DETECTED',
        qrData: result.data
      }).catch(() => {});
    } catch {}
  }
}

/**
 * Sets up MutationObserver to detect dynamically added images.
 */
function setupDomObserver() {
  if (domObserver || typeof MutationObserver === 'undefined') return;

  domObserver = new MutationObserver(() => {
    clearTimeout(domMutationDebounce);
    domMutationDebounce = setTimeout(() => {
      triggerDomScan();
    }, 350);
  });

  if (document.body) {
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'class', 'style']
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

  // Start DOM scanning features if enabled
  if (settings.scanDomImages !== false) {
    setupDomObserver();
    triggerDomScan();
    if (!domScanInterval) {
      domScanInterval = setInterval(triggerDomScan, 1400);
    }
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
        if (!overlay) {
          initOverlay().then((ov) => {
            const scaleX = window.innerWidth / message.scanWidth;
            const scaleY = window.innerHeight / message.scanHeight;
            ov.update(message.qrResult, scaleX, scaleY);
          });
        } else {
          const scaleX = window.innerWidth / message.scanWidth;
          const scaleY = window.innerHeight / message.scanHeight;
          overlay.update(message.qrResult, scaleX, scaleY);
        }
        sendResponse({ received: true });
        return false;
      }

      case 'QR_NOT_FOUND': {
        if (overlay) {
          overlay.update(null);
        }
        sendResponse({ received: true });
        return false;
      }

      case 'SETTINGS_UPDATED': {
        if (overlay && message.settings) {
          overlay.updateSettings(message.settings);
        }
        if (message.settings && message.settings.scanDomImages !== undefined) {
          if (message.settings.scanDomImages && isMounted) {
            setupDomObserver();
            triggerDomScan();
            if (!domScanInterval) {
              domScanInterval = setInterval(triggerDomScan, 1400);
            }
          } else {
            if (domScanInterval) {
              clearInterval(domScanInterval);
              domScanInterval = null;
            }
            if (domObserver) {
              domObserver.disconnect();
              domObserver = null;
            }
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
    triggerDomScan();
  }, 140);
}, { passive: true });

// Resize listener
window.addEventListener('resize', () => {
  if (overlay) {
    overlay.onScroll();
  }
}, { passive: true });

// Fallback in-page shortcut (Alt+Q)
window.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'q' || e.key === 'й' || e.key === 'Q' || e.key === 'Й')) {
    e.preventDefault();
    try {
      browser.runtime.sendMessage({ type: 'TOGGLE_SCAN' }).catch(() => {});
    } catch {}
  }
});
