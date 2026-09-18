/**
 * QR Radar Popup Controller.
 * Manages UI state, communicates with the active tab, and handles settings/history.
 */

import { getSettings, saveSettings, getScanHistory, clearScanHistory } from '../utils/storage.js';
import { classifyContent } from '../utils/parser.js';

let activeTabId = null;
let isScannerActive = false;

// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusLabel = statusBadge.querySelector('.status-label');
const toggleBtn = document.getElementById('toggle-scan-btn');
const toggleLabel = document.getElementById('toggle-scan-label');
const fpsSelector = document.getElementById('fps-selector');
const settingSound = document.getElementById('setting-sound');
const settingAutoCopy = document.getElementById('setting-autocopy');
const historyList = document.getElementById('history-list');
const historyCount = document.getElementById('history-count');
const clearHistoryBtn = document.getElementById('clear-history-btn');

/**
 * Initializes the popup on DOM load.
 */
async function init() {
  await loadPreferences();
  await refreshActiveTab();
  await refreshHistory();
  setupEventListeners();
}

/**
 * Loads preferences into UI controls.
 */
async function loadPreferences() {
  const settings = await getSettings();

  // Set FPS active button
  const currentFps = String(settings.scanRate || 15);
  fpsSelector.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.fps === currentFps);
  });

  settingSound.checked = settings.soundEnabled ?? true;
  settingAutoCopy.checked = settings.autoCopy ?? false;
}

/**
 * Detects current active tab and checks its scanner state.
 */
async function refreshActiveTab() {
  try {
    if (typeof browser !== 'undefined' && browser.tabs) {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        activeTabId = tab.id;

        // Query content script status
        try {
          const response = await browser.tabs.sendMessage(activeTabId, { type: 'GET_STATUS' });
          if (response && response.active !== undefined) {
            updateUIState(response.active);
            return;
          }
        } catch {
          // Content script may not be loaded yet
        }
      }
    }
  } catch (err) {
    console.warn('[QR-Radar Popup] Error querying active tab:', err);
  }

  updateUIState(false);
}

/**
 * Updates UI based on scanner active status.
 */
function updateUIState(active) {
  isScannerActive = active;

  if (active) {
    statusBadge.className = 'status-badge status-active';
    statusLabel.textContent = 'Scanning';
    toggleBtn.classList.add('scanning');
    toggleLabel.textContent = 'Stop Scanner';
  } else {
    statusBadge.className = 'status-badge status-idle';
    statusLabel.textContent = 'Idle';
    toggleBtn.classList.remove('scanning');
    toggleLabel.textContent = 'Start Real-Time Scanner';
  }
}

/**
 * Toggles scanner on the active tab.
 */
async function handleToggleClick() {
  if (!activeTabId) return;

  const targetState = !isScannerActive;

  try {
    // Attempt sending message directly
    const msgType = targetState ? 'START_SCAN' : 'STOP_SCAN';
    const response = await browser.tabs.sendMessage(activeTabId, { type: msgType });

    if (response && response.active !== undefined) {
      updateUIState(response.active);
      window.close(); // Close popup so user sees full tab HUD and stream dialog
    }
  } catch {
    // Inject scripts if content script wasn't active on this page
    try {
      await browser.scripting.insertCSS({
        target: { tabId: activeTabId },
        files: ['dist/overlay.css']
      });
      await browser.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ['dist/content.bundle.js']
      });
      const res = await browser.tabs.sendMessage(activeTabId, { type: 'START_SCAN' });
      if (res && res.active !== undefined) {
        updateUIState(res.active);
        window.close();
      }
    } catch (injErr) {
      console.error('[QR-Radar Popup] Failed to inject or start scanner:', injErr);
      alert('Could not start scanner on this page. Note: system pages (about:*) cannot be scripted.');
    }
  }
}

/**
 * Updates settings across storage and notifies active tab.
 */
async function updateSettings(updates) {
  const newSettings = await saveSettings(updates);

  if (activeTabId) {
    try {
      await browser.tabs.sendMessage(activeTabId, {
        type: 'SETTINGS_UPDATED',
        settings: newSettings
      });
    } catch {
      // Tab not ready
    }
  }
}

/**
 * Loads and renders recent scan history.
 */
async function refreshHistory() {
  const history = await getScanHistory();
  historyCount.textContent = history.length;

  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 3a9 9 0 0 1 9 9"></path>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
        <p>No QR codes scanned yet</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = history.map((item) => {
    const parsed = classifyContent(item.text);
    const timeAgo = formatTimeAgo(item.timestamp);

    let openBtn = '';
    if (parsed.type === 'url' && parsed.actionUrl) {
      openBtn = `
        <a href="${escapeHtml(parsed.actionUrl)}" target="_blank" rel="noopener noreferrer" class="item-btn" title="Open Link">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
          </svg>
          Open
        </a>
      `;
    }

    return `
      <div class="history-item" data-id="${escapeHtml(item.id)}">
        <div class="history-item-top">
          <span class="item-badge badge-${parsed.type}">${parsed.type}</span>
          <span class="item-time">${timeAgo}</span>
        </div>
        <div class="item-content" title="${escapeHtml(item.text)}">
          ${escapeHtml(item.text)}
        </div>
        <div class="item-actions">
          <button class="item-btn copy-item-btn" data-text="${escapeHtml(item.text)}" title="Copy">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
          ${openBtn}
        </div>
      </div>
    `;
  }).join('');

  // Attach copy listeners
  historyList.querySelectorAll('.copy-item-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = btn.dataset.text;
      await navigator.clipboard.writeText(text);
      const span = btn.querySelector('span');
      btn.classList.add('copied');
      if (span) span.textContent = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        if (span) span.textContent = 'Copy';
      }, 1800);
    });
  });
}

/**
 * Sets up all UI event listeners.
 */
function setupEventListeners() {
  toggleBtn.addEventListener('click', handleToggleClick);

  // FPS Selector
  fpsSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.segment-btn');
    if (!btn) return;
    fpsSelector.querySelectorAll('.segment-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const fps = parseInt(btn.dataset.fps, 10);
    updateSettings({ scanRate: fps });
  });

  // Toggles
  settingSound.addEventListener('change', () => {
    updateSettings({ soundEnabled: settingSound.checked });
  });

  settingAutoCopy.addEventListener('change', () => {
    updateSettings({ autoCopy: settingAutoCopy.checked });
  });

  // Clear History
  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Clear all scan history?')) {
      await clearScanHistory();
      await refreshHistory();
    }
  });
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', init);
