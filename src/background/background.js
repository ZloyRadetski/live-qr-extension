/**
 * Background Service Worker / Script for QR Radar.
 * Handles commands, action clicks, and badge indicators.
 */

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCANNER_STATE_CHANGED' && sender.tab) {
    updateBadge(sender.tab.id, message.active);
  }
});

// Update badge text and color based on active scanner status
function updateBadge(tabId, isActive) {
  if (isActive) {
    browser.action.setBadgeText({ tabId, text: 'ON' });
    browser.action.setBadgeBackgroundColor({ tabId, color: '#00f0ff' });
    browser.action.setBadgeTextColor({ tabId, color: '#000000' }).catch(() => {});
  } else {
    browser.action.setBadgeText({ tabId, text: '' });
  }
}

// Global keyboard shortcut handler (configured in manifest commands)
if (browser.commands && browser.commands.onCommand) {
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-scanner') {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        try {
          await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_SCAN' });
        } catch {
          // If content script is not injected yet, inject it
          try {
            await browser.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['dist/overlay.css']
            });
            await browser.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['dist/content.bundle.js']
            });
            await browser.tabs.sendMessage(tab.id, { type: 'START_SCAN' });
          } catch (err) {
            console.warn('[QR-Radar] Could not inject content script:', err);
          }
        }
      }
    }
  });
}
