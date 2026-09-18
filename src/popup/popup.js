/**
 * QR Radar Popup Controller - Rich Customization Edition.
 * Manages tabs, settings controls, themes, domain exclusions, and scan history.
 */

import {
  getSettings,
  saveSettings,
  getScanHistory,
  clearScanHistory,
  isDomainBlacklisted,
  toggleDomainBlacklist
} from '../utils/storage.js';
import { classifyContent } from '../utils/parser.js';

let activeTabId = null;
let currentDomain = '';
let isScannerActive = false;

// DOM Elements: Tabs
const navScanner = document.getElementById('nav-scanner');
const navSettings = document.getElementById('nav-settings');
const panelScanner = document.getElementById('panel-scanner');
const panelSettings = document.getElementById('panel-settings');

// DOM Elements: Scanner Panel
const statusBadge = document.getElementById('status-badge');
const statusLabel = statusBadge.querySelector('.status-label');
const toggleBtn = document.getElementById('toggle-scan-btn');
const toggleLabel = document.getElementById('toggle-scan-label');
const historyList = document.getElementById('history-list');
const historyCount = document.getElementById('history-count');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// DOM Elements: Settings Panel
const themeSwatches = document.getElementById('theme-swatches');
const cardModeSelector = document.getElementById('card-mode-selector');
const settingGlow = document.getElementById('setting-glow');
const settingBrackets = document.getElementById('setting-brackets');
const settingSound = document.getElementById('setting-sound');
const settingAutoCopy = document.getElementById('setting-autocopy');
const settingPauseScroll = document.getElementById('setting-pause-scroll');
const fpsSelector = document.getElementById('fps-selector');
const resolutionSelector = document.getElementById('resolution-selector');
const settingDomImages = document.getElementById('setting-dom-images');

// DOM Elements: Site Exclusions
const currentDomainText = document.getElementById('current-domain-text');
const toggleBlacklistBtn = document.getElementById('toggle-blacklist-btn');
const blacklistChips = document.getElementById('blacklist-chips');

/**
 * Initializes the popup on DOM load.
 */
async function init() {
  setupTabs();
  await refreshActiveTab();
  await loadPreferences();
  await refreshHistory();
  setupEventListeners();
}

/**
 * Tab switcher between Scanner & Settings.
 */
function setupTabs() {
  navScanner.addEventListener('click', () => switchTab('scanner'));
  navSettings.addEventListener('click', () => switchTab('settings'));
}

function switchTab(tabName) {
  if (tabName === 'scanner') {
    navScanner.classList.add('active');
    navSettings.classList.remove('active');
    panelScanner.classList.add('active');
    panelSettings.classList.remove('active');
  } else {
    navSettings.classList.add('active');
    navScanner.classList.remove('active');
    panelSettings.classList.add('active');
    panelScanner.classList.remove('active');
  }
}

/**
 * Detects current active tab and checks global scanner state.
 */
async function refreshActiveTab() {
  try {
    if (typeof browser !== 'undefined' && browser.tabs) {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        activeTabId = tab.id;
        if (tab.url) {
          try {
            currentDomain = new URL(tab.url).hostname;
            currentDomainText.textContent = currentDomain;
          } catch {
            currentDomain = '';
            currentDomainText.textContent = 'Non-web page';
          }
        }
      }
    }

    const response = await browser.runtime.sendMessage({ type: 'GET_GLOBAL_STATUS' });
    if (response && response.active !== undefined) {
      updateUIState(response.active);
    }
  } catch (err) {
    console.warn('[QR-Radar Popup] Error refreshing tab state:', err);
    updateUIState(false);
  }
}

/**
 * Updates UI based on scanner active status.
 */
function updateUIState(active) {
  isScannerActive = active;

  if (active) {
    statusBadge.className = 'status-badge status-active';
    statusLabel.textContent = 'Active (All Tabs)';
    toggleBtn.classList.add('scanning');
    toggleLabel.textContent = 'Turn OFF Scanner';
  } else {
    statusBadge.className = 'status-badge status-idle';
    statusLabel.textContent = 'Off';
    toggleBtn.classList.remove('scanning');
    toggleLabel.textContent = 'Turn ON Scanner (Everywhere)';
  }
}

/**
 * Loads saved preferences into UI controls.
 */
async function loadPreferences() {
  const settings = await getSettings();

  // 1. Theme Swatches
  const currentTheme = settings.themeColor || 'cyan';
  themeSwatches.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.theme === currentTheme);
  });

  // 2. Card Mode
  const currentMode = settings.cardDisplayMode || 'hover';
  cardModeSelector.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });

  // 3. Toggles
  settingGlow.checked = settings.glowAnimation ?? true;
  settingBrackets.checked = settings.cornerBrackets ?? true;
  settingSound.checked = settings.soundEnabled ?? true;
  settingAutoCopy.checked = settings.autoCopy ?? false;
  settingPauseScroll.checked = settings.pauseOnScroll ?? true;

  // 4. Speed Profile
  const currentFps = String(settings.scanRate || 12);
  fpsSelector.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.fps === currentFps);
  });

  // 5. Scan Resolution Profile
  const currentRes = settings.scanResolution || '1080';
  resolutionSelector.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.res === currentRes);
  });

  // 6. DOM Images Toggle
  settingDomImages.checked = settings.scanDomImages ?? true;

  // 7. Blacklist Chips & Current Domain Button
  renderBlacklist(settings.blacklist || []);
}

/**
 * Renders domain exclusion chips and updates button state.
 */
function renderBlacklist(blacklist = []) {
  if (!currentDomain || currentDomain === 'Non-web page') {
    toggleBlacklistBtn.style.display = 'none';
  } else {
    toggleBlacklistBtn.style.display = 'block';
    const isExcluded = isDomainBlacklisted(`https://${currentDomain}`, blacklist);
    if (isExcluded) {
      toggleBlacklistBtn.textContent = 'Include this site';
      toggleBlacklistBtn.classList.add('blacklisted');
    } else {
      toggleBlacklistBtn.textContent = 'Exclude this site';
      toggleBlacklistBtn.classList.remove('blacklisted');
    }
  }

  if (blacklist.length === 0) {
    blacklistChips.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">No sites excluded</span>';
    return;
  }

  blacklistChips.innerHTML = blacklist.map((domain) => `
    <span class="blacklist-chip">
      ${escapeHtml(domain)}
      <button class="chip-remove" data-domain="${escapeHtml(domain)}" title="Remove exclusion">✕</button>
    </span>
  `).join('');

  blacklistChips.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const domain = btn.dataset.domain;
      const updated = await toggleDomainBlacklist(domain);
      renderBlacklist(updated);
    });
  });
}

/**
 * Toggles global scanner on/off.
 */
async function handleToggleClick() {
  const targetType = isScannerActive ? 'STOP_GLOBAL_SCAN' : 'START_GLOBAL_SCAN';

  try {
    const response = await browser.runtime.sendMessage({ type: targetType });
    if (response && response.active !== undefined) {
      updateUIState(response.active);
      if (response.active) {
        window.close();
      }
    }
  } catch (err) {
    console.error('[QR-Radar Popup] Failed to toggle global scanner:', err);
  }
}

/**
 * Updates settings and broadcasts to active tab and background.
 */
async function applySettingChange(updates) {
  const newSettings = await saveSettings(updates);

  if (activeTabId) {
    try {
      await browser.tabs.sendMessage(activeTabId, {
        type: 'SETTINGS_UPDATED',
        settings: newSettings
      });
    } catch {}
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
 * Attaches all event listeners for controls.
 */
function setupEventListeners() {
  toggleBtn.addEventListener('click', handleToggleClick);

  // Theme color selector
  themeSwatches.addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    themeSwatches.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    applySettingChange({ themeColor: swatch.dataset.theme });
  });

  // Card mode selector
  cardModeSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.segment-btn');
    if (!btn) return;
    cardModeSelector.querySelectorAll('.segment-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    applySettingChange({ cardDisplayMode: btn.dataset.mode });
  });

  // Speed FPS profile selector
  fpsSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.segment-btn');
    if (!btn) return;
    fpsSelector.querySelectorAll('.segment-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    applySettingChange({ scanRate: parseInt(btn.dataset.fps, 10) });
  });

  // Toggles
  settingGlow.addEventListener('change', () => applySettingChange({ glowAnimation: settingGlow.checked }));
  settingBrackets.addEventListener('change', () => applySettingChange({ cornerBrackets: settingBrackets.checked }));
  settingSound.addEventListener('change', () => applySettingChange({ soundEnabled: settingSound.checked }));
  settingAutoCopy.addEventListener('change', () => applySettingChange({ autoCopy: settingAutoCopy.checked }));
  settingPauseScroll.addEventListener('change', () => applySettingChange({ pauseOnScroll: settingPauseScroll.checked }));
  settingDomImages.addEventListener('change', () => applySettingChange({ scanDomImages: settingDomImages.checked }));

  // Resolution selector
  resolutionSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.segment-btn');
    if (!btn) return;
    resolutionSelector.querySelectorAll('.segment-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    applySettingChange({ scanResolution: btn.dataset.res });
  });

  // Exclude current site button
  toggleBlacklistBtn.addEventListener('click', async () => {
    if (!currentDomain) return;
    const updated = await toggleDomainBlacklist(currentDomain);
    renderBlacklist(updated);
  });

  // Clear history
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
