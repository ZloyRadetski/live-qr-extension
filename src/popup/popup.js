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

function createSvg(viewBox, width, height, children) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  for (const [tag, attrs] of children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    svg.appendChild(el);
  }
  return svg;
}

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
const fpsSlider = document.getElementById('fps-slider');
const fpsValueBadge = document.getElementById('fps-value-badge');
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
    statusLabel.textContent = 'Active';
    toggleBtn.classList.add('scanning');
    toggleLabel.textContent = 'Stop Scanner';
  } else {
    statusBadge.className = 'status-badge status-idle';
    statusLabel.textContent = 'Off';
    toggleBtn.classList.remove('scanning');
    toggleLabel.textContent = 'Start Scanner';
  }
}

/**
 * Updates the FPS slider value, fill progress bar, and badge text.
 * @param {number} fps 
 */
function updateFpsUI(fps) {
  if (fpsSlider) {
    fpsSlider.value = fps;
    const pct = ((fps - 1) / (30 - 1)) * 100;
    fpsSlider.style.background = `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${pct}%, var(--bg-tertiary) ${pct}%, var(--bg-tertiary) 100%)`;
  }
  if (fpsValueBadge) {
    let modeHint = '';
    if (fps <= 3) modeHint = ' (Eco)';
    else if (fps <= 10) modeHint = ' (Std)';
    else if (fps <= 20) modeHint = ' (Smooth)';
    else if (fps >= 30) modeHint = ' (Max)';
    fpsValueBadge.textContent = `${fps} FPS${modeHint}`;
  }
}

/**
 * Loads saved preferences into UI controls.
 */
async function loadPreferences() {
  const settings = await getSettings();

  // 1. Theme Swatches
  const currentTheme = settings.themeColor || 'gold';
  themeSwatches.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.theme === currentTheme);
  });

  // 2. Card Mode
  const currentMode = settings.cardDisplayMode || 'hover';
  cardModeSelector.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });

  // 3. Toggles
  settingGlow.checked = settings.glowAnimation ?? false;
  settingBrackets.checked = settings.cornerBrackets ?? true;
  settingSound.checked = settings.soundEnabled ?? false;
  settingAutoCopy.checked = settings.autoCopy ?? false;
  settingPauseScroll.checked = settings.pauseOnScroll ?? true;

  // 4. Scan Rate Slider (1 to 30 FPS)
  const currentFps = Math.max(1, Math.min(30, settings.scanRate ?? 2));
  updateFpsUI(currentFps);

  // 5. Scan Resolution Profile
  const currentRes = settings.scanResolution || '720';
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
    const emptySpan = document.createElement('span');
    emptySpan.style.fontSize = '11px';
    emptySpan.style.color = 'var(--text-muted)';
    emptySpan.textContent = 'No sites excluded';
    blacklistChips.replaceChildren(emptySpan);
    return;
  }

  const chips = blacklist.map((domain) => {
    const chip = document.createElement('span');
    chip.className = 'blacklist-chip';
    chip.textContent = domain + ' ';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'chip-remove';
    removeBtn.dataset.domain = domain;
    removeBtn.title = 'Remove exclusion';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const updated = await toggleDomainBlacklist(domain);
      renderBlacklist(updated);
    });

    chip.appendChild(removeBtn);
    return chip;
  });

  blacklistChips.replaceChildren(...chips);
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

  // Also notify background capture loop to adjust rate or wake up
  try {
    await browser.runtime.sendMessage({
      type: 'SETTINGS_UPDATED',
      settings: newSettings
    });
  } catch {}
}

/**
 * Loads and renders recent scan history.
 */
async function refreshHistory() {
  const history = await getScanHistory();
  historyCount.textContent = history.length;

  if (history.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';

    const svg = createSvg('0 0 24 24', 28, 28, [
      ['circle', { cx: '12', cy: '12', r: '9' }],
      ['path', { d: 'M12 3a9 9 0 0 1 9 9' }],
      ['circle', { cx: '12', cy: '12', r: '2' }]
    ]);

    const msg = document.createElement('p');
    msg.textContent = 'No QR codes scanned yet';

    emptyDiv.append(svg, msg);
    historyList.replaceChildren(emptyDiv);
    return;
  }

  const itemElements = history.map((item) => {
    const parsed = classifyContent(item.text);
    const timeAgo = formatTimeAgo(item.timestamp);

    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';
    itemDiv.dataset.id = item.id;

    const topDiv = document.createElement('div');
    topDiv.className = 'history-item-top';

    const badge = document.createElement('span');
    badge.className = `item-badge badge-${parsed.type}`;
    badge.textContent = parsed.type;

    const time = document.createElement('span');
    time.className = 'item-time';
    time.textContent = timeAgo;

    topDiv.append(badge, time);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'item-content';
    contentDiv.title = item.text;
    contentDiv.textContent = item.text;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'item-btn copy-item-btn';
    copyBtn.title = 'Copy';
    copyBtn.dataset.text = item.text;

    const copySvg = createSvg('0 0 24 24', 11, 11, [
      ['rect', { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' }],
      ['path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }]
    ]);
    const copyText = document.createElement('span');
    copyText.textContent = 'Copy';

    copyBtn.append(copySvg, copyText);
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(item.text);
      copyBtn.classList.add('copied');
      copyText.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyText.textContent = 'Copy';
      }, 1800);
    });

    actionsDiv.appendChild(copyBtn);

    if (parsed.type === 'url' && parsed.actionUrl) {
      const openA = document.createElement('a');
      openA.href = parsed.actionUrl;
      openA.target = '_blank';
      openA.rel = 'noopener noreferrer';
      openA.className = 'item-btn';
      openA.title = 'Open Link';

      const openSvg = createSvg('0 0 24 24', 11, 11, [
        ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
        ['polyline', { points: '15 3 21 3 21 9' }],
        ['line', { x1: '10', y1: '14', x2: '21', y2: '3' }]
      ]);
      openA.append(openSvg, document.createTextNode(' Open'));
      actionsDiv.appendChild(openA);
    }

    itemDiv.append(topDiv, contentDiv, actionsDiv);
    return itemDiv;
  });

  historyList.replaceChildren(...itemElements);
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

  // Speed FPS slider (1 to 30 FPS)
  let fpsDebounceTimer = null;
  if (fpsSlider) {
    fpsSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      updateFpsUI(val);
      clearTimeout(fpsDebounceTimer);
      fpsDebounceTimer = setTimeout(() => {
        applySettingChange({ scanRate: val });
      }, 50);
    });

    fpsSlider.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      clearTimeout(fpsDebounceTimer);
      applySettingChange({ scanRate: val });
    });
  }

  // Preset scale marks click handlers
  document.querySelectorAll('.scale-mark').forEach((mark) => {
    mark.addEventListener('click', () => {
      const val = parseInt(mark.dataset.val, 10);
      if (!isNaN(val)) {
        updateFpsUI(val);
        applySettingChange({ scanRate: val });
      }
    });
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
