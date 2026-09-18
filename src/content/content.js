/**
 * QR Radar Content Script.
 * Manages the on-screen HUD overlay and receives detection updates from background service.
 */

import { QROverlayManager } from './overlay.js';
import { getSettings } from '../utils/storage.js';

let overlay = null;
let isMounted = false;

/**
 * Initializes or mounts overlay HUD.
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
  return overlay;
}

/**
 * Unmounts overlay and clears state.
 */
function teardownOverlay() {
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
