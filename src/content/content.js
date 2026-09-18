/**
 * QR Radar Content Script.
 * Coordinates the stream scanner, HUD overlay, and communication with background/popup.
 */

import { StreamScanner } from './stream-scanner.js';
import { QROverlayManager } from './overlay.js';
import { getSettings } from '../utils/storage.js';

let scanner = null;
let overlay = null;
let isScanning = false;

/**
 * Initializes and starts the QR code radar scanner.
 */
async function startScanning() {
  if (isScanning) return { success: true, active: true };

  const settings = await getSettings();

  overlay = new QROverlayManager({
    soundEnabled: settings.soundEnabled,
    autoCopy: settings.autoCopy,
    onStopRequested: () => {
      stopScanning();
    }
  });

  scanner = new StreamScanner({
    fps: settings.scanRate || 15,
    onFrame: (qrResult, scaleX, scaleY) => {
      if (overlay) {
        overlay.update(qrResult, scaleX, scaleY);
      }
    },
    onStopped: () => {
      cleanup();
      notifyState(false);
    },
    onError: (err) => {
      console.warn('[QR-Radar] Stream error or cancelled:', err);
      cleanup();
      notifyState(false);
    }
  });

  try {
    await scanner.start();
    isScanning = true;
    overlay.mount();
    notifyState(true);
    return { success: true, active: true };
  } catch (err) {
    cleanup();
    notifyState(false);
    return { success: false, error: err.message || 'Permission denied' };
  }
}

/**
 * Stops scanner and cleans up HUD.
 */
function stopScanning() {
  if (!isScanning && !scanner) return { success: true, active: false };
  cleanup();
  notifyState(false);
  return { success: true, active: false };
}

/**
 * Cleanup helper.
 */
function cleanup() {
  isScanning = false;
  if (scanner) {
    scanner.stop();
    scanner = null;
  }
  if (overlay) {
    overlay.unmount();
    overlay = null;
  }
}

/**
 * Notifies background script of active status so toolbar badge updates.
 */
function notifyState(active) {
  try {
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({
        type: 'SCANNER_STATE_CHANGED',
        active
      }).catch(() => {});
    }
  } catch {
    // Ignore runtime disconnected errors
  }
}

/**
 * Toggles scanner on/off.
 */
async function toggleScanning() {
  if (isScanning) {
    return stopScanning();
  } else {
    return await startScanning();
  }
}

// Runtime message listener (from popup or background)
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'START_SCAN':
        startScanning().then(sendResponse);
        return true; // Keep channel open for async response

      case 'STOP_SCAN':
        sendResponse(stopScanning());
        return false;

      case 'TOGGLE_SCAN':
        toggleScanning().then(sendResponse);
        return true;

      case 'GET_STATUS':
        sendResponse({ active: isScanning });
        return false;

      case 'SETTINGS_UPDATED':
        if (message.settings) {
          if (scanner && message.settings.scanRate) {
            scanner.setFps(message.settings.scanRate);
          }
          if (overlay) {
            if (message.settings.soundEnabled !== undefined) {
              overlay.options.soundEnabled = message.settings.soundEnabled;
            }
            if (message.settings.autoCopy !== undefined) {
              overlay.options.autoCopy = message.settings.autoCopy;
            }
          }
        }
        sendResponse({ success: true });
        return false;
    }
  });
}

// Keyboard shortcut fallback inside page (Alt+Shift+Q or Alt+Q)
window.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'q' || e.key === 'й' || e.key === 'Q' || e.key === 'Й')) {
    e.preventDefault();
    toggleScanning();
  }
});
