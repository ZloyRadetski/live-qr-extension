/**
 * Storage adapter for preferences and scan history.
 * Supports Firefox browser.storage.local with localStorage fallback.
 */

const STORAGE_KEYS = {
  SETTINGS: 'qr_radar_settings',
  HISTORY: 'qr_radar_history'
};

const DEFAULT_SETTINGS = {
  scanRate: 15,         // FPS: 8 (Eco), 15 (Balanced), 30 (High)
  autoCopy: false,      // Auto copy content on detection
  soundEnabled: true,   // Subtle audio cue on detection
  downsampleScale: 0.5, // Frame downsampling for performance (0.5 = half resolution)
  globalActive: false   // Whether scanner runs globally across all tabs
};

/**
 * Checks if browser extension storage is available.
 */
function hasExtensionStorage() {
  return typeof browser !== 'undefined' && browser.storage && browser.storage.local;
}

/**
 * Retrieves saved settings merged with defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings() {
  try {
    if (hasExtensionStorage()) {
      const res = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
      return { ...DEFAULT_SETTINGS, ...(res[STORAGE_KEYS.SETTINGS] || {}) };
    } else if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return { ...DEFAULT_SETTINGS, ...(item ? JSON.parse(item) : {}) };
    }
  } catch (err) {
    console.warn('[QR-Radar] Failed to load settings, using defaults:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Saves updated settings.
 * @param {Partial<typeof DEFAULT_SETTINGS>} updates
 */
export async function saveSettings(updates) {
  const current = await getSettings();
  const merged = { ...current, ...updates };

  if (hasExtensionStorage()) {
    await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: merged });
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
  }
  return merged;
}

/**
 * Retrieves scan history list (max 50 recent items).
 * @returns {Promise<Array<{ id: string, text: string, type: string, title: string, timestamp: number }>>}
 */
export async function getScanHistory() {
  try {
    if (hasExtensionStorage()) {
      const res = await browser.storage.local.get(STORAGE_KEYS.HISTORY);
      return res[STORAGE_KEYS.HISTORY] || [];
    } else if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return item ? JSON.parse(item) : [];
    }
  } catch (err) {
    console.warn('[QR-Radar] Failed to load history:', err);
  }
  return [];
}

/**
 * Adds a new scan item to history (deduplicates recent same item within 5 seconds).
 * @param {{ text: string, type: string, title: string }} item
 */
export async function addScanHistory(item) {
  const history = await getScanHistory();
  const now = Date.now();

  // Deduplicate if identical to the latest scan within 5 seconds
  if (history.length > 0 && history[0].text === item.text && (now - history[0].timestamp) < 5000) {
    return history;
  }

  const newEntry = {
    id: `scan_${now}_${Math.random().toString(36).slice(2, 7)}`,
    text: item.text,
    type: item.type || 'text',
    title: item.title || item.text,
    timestamp: now
  };

  const updated = [newEntry, ...history.filter(h => h.text !== item.text)].slice(0, 50);

  if (hasExtensionStorage()) {
    await browser.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  }

  return updated;
}

/**
 * Clears all scan history.
 */
export async function clearScanHistory() {
  if (hasExtensionStorage()) {
    await browser.storage.local.remove(STORAGE_KEYS.HISTORY);
  } else if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  }
  return [];
}
