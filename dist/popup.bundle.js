(() => {
  // src/utils/storage.js
  var STORAGE_KEYS = {
    SETTINGS: "qr_radar_settings",
    HISTORY: "qr_radar_history"
  };
  var DEFAULT_SETTINGS = {
    scanRate: 15,
    // FPS: 8 (Eco), 15 (Balanced), 30 (High)
    autoCopy: false,
    // Auto copy content on detection
    soundEnabled: true,
    // Subtle audio cue on detection
    downsampleScale: 0.5
    // Frame downsampling for performance (0.5 = half resolution)
  };
  function hasExtensionStorage() {
    return typeof browser !== "undefined" && browser.storage && browser.storage.local;
  }
  async function getSettings() {
    try {
      if (hasExtensionStorage()) {
        const res = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
        return { ...DEFAULT_SETTINGS, ...res[STORAGE_KEYS.SETTINGS] || {} };
      } else if (typeof localStorage !== "undefined") {
        const item = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return { ...DEFAULT_SETTINGS, ...item ? JSON.parse(item) : {} };
      }
    } catch (err) {
      console.warn("[QR-Radar] Failed to load settings, using defaults:", err);
    }
    return { ...DEFAULT_SETTINGS };
  }
  async function saveSettings(updates) {
    const current = await getSettings();
    const merged = { ...current, ...updates };
    if (hasExtensionStorage()) {
      await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: merged });
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    }
    return merged;
  }
  async function getScanHistory() {
    try {
      if (hasExtensionStorage()) {
        const res = await browser.storage.local.get(STORAGE_KEYS.HISTORY);
        return res[STORAGE_KEYS.HISTORY] || [];
      } else if (typeof localStorage !== "undefined") {
        const item = localStorage.getItem(STORAGE_KEYS.HISTORY);
        return item ? JSON.parse(item) : [];
      }
    } catch (err) {
      console.warn("[QR-Radar] Failed to load history:", err);
    }
    return [];
  }
  async function clearScanHistory() {
    if (hasExtensionStorage()) {
      await browser.storage.local.remove(STORAGE_KEYS.HISTORY);
    } else if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    }
    return [];
  }

  // src/utils/parser.js
  function classifyContent(raw) {
    if (typeof raw !== "string") {
      return {
        type: "text",
        raw: "",
        title: "Empty",
        summary: ""
      };
    }
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        return {
          type: "url",
          raw: trimmed,
          title: url.hostname,
          summary: trimmed,
          actionUrl: trimmed
        };
      } catch {
      }
    }
    if (/^WIFI:/i.test(trimmed)) {
      const wifiData = parseWifiString(trimmed);
      return {
        type: "wifi",
        raw: trimmed,
        title: wifiData.ssid ? `WiFi: ${wifiData.ssid}` : "WiFi Network",
        summary: wifiData.ssid ? `SSID: ${wifiData.ssid} (${wifiData.type || "Open"})` : trimmed,
        metadata: wifiData
      };
    }
    if (/^mailto:/i.test(trimmed) || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
      const email = trimmed.replace(/^mailto:/i, "").split("?")[0];
      return {
        type: "email",
        raw: trimmed,
        title: `Email: ${email}`,
        summary: email,
        actionUrl: trimmed.startsWith("mailto:") ? trimmed : `mailto:${email}`
      };
    }
    if (/^tel:/i.test(trimmed) || /^\+?[0-9\s\-()]{7,20}$/.test(trimmed)) {
      const phone = trimmed.replace(/^tel:/i, "").trim();
      return {
        type: "phone",
        raw: trimmed,
        title: `Call: ${phone}`,
        summary: phone,
        actionUrl: `tel:${phone.replace(/\s+/g, "")}`
      };
    }
    if (/^(smsto|sms):/i.test(trimmed)) {
      const parts = trimmed.replace(/^(smsto|sms):/i, "").split(":");
      const number = parts[0] || "";
      const body = parts.slice(1).join(":") || "";
      return {
        type: "sms",
        raw: trimmed,
        title: `SMS: ${number}`,
        summary: body ? `${number} \u2014 "${body}"` : number,
        metadata: { number, body },
        actionUrl: trimmed
      };
    }
    if (/^geo:/i.test(trimmed)) {
      const coords = trimmed.replace(/^geo:/i, "").split("?")[0].split(",");
      const lat = parseFloat(coords[0]);
      const lng = parseFloat(coords[1]);
      const isValid = !isNaN(lat) && !isNaN(lng);
      return {
        type: "geo",
        raw: trimmed,
        title: isValid ? `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Location",
        summary: trimmed,
        metadata: isValid ? { lat, lng } : {},
        actionUrl: isValid ? `https://www.google.com/maps?q=${lat},${lng}` : void 0
      };
    }
    return {
      type: "text",
      raw: trimmed,
      title: "Text Snippet",
      summary: truncateString(trimmed, 90)
    };
  }
  function parseWifiString(str) {
    const clean = str.replace(/^WIFI:/i, "");
    const result = {
      ssid: "",
      type: "WPA",
      password: "",
      hidden: false
    };
    const regex = /([STPH]):((?:\\;|[^;])*);/gi;
    let match;
    while ((match = regex.exec(clean)) !== null) {
      const key = match[1].toUpperCase();
      const value = match[2].replace(/\\;/g, ";").replace(/\\\\/g, "\\");
      if (key === "S") result.ssid = value;
      else if (key === "T") result.type = value;
      else if (key === "P") result.password = value;
      else if (key === "H") result.hidden = value.toLowerCase() === "true";
    }
    return result;
  }
  function truncateString(str, max = 80) {
    if (!str) return "";
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + "\u2026";
  }

  // src/popup/popup.js
  var activeTabId = null;
  var isScannerActive = false;
  var statusBadge = document.getElementById("status-badge");
  var statusLabel = statusBadge.querySelector(".status-label");
  var toggleBtn = document.getElementById("toggle-scan-btn");
  var toggleLabel = document.getElementById("toggle-scan-label");
  var fpsSelector = document.getElementById("fps-selector");
  var settingSound = document.getElementById("setting-sound");
  var settingAutoCopy = document.getElementById("setting-autocopy");
  var historyList = document.getElementById("history-list");
  var historyCount = document.getElementById("history-count");
  var clearHistoryBtn = document.getElementById("clear-history-btn");
  async function init() {
    await loadPreferences();
    await refreshActiveTab();
    await refreshHistory();
    setupEventListeners();
  }
  async function loadPreferences() {
    const settings = await getSettings();
    const currentFps = String(settings.scanRate || 15);
    fpsSelector.querySelectorAll(".segment-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.fps === currentFps);
    });
    settingSound.checked = settings.soundEnabled ?? true;
    settingAutoCopy.checked = settings.autoCopy ?? false;
  }
  async function refreshActiveTab() {
    try {
      if (typeof browser !== "undefined" && browser.tabs) {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          activeTabId = tab.id;
          const response = await browser.runtime.sendMessage({
            type: "GET_STATUS",
            tabId: activeTabId
          });
          if (response && response.active !== void 0) {
            updateUIState(response.active);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("[QR-Radar Popup] Error querying background service:", err);
    }
    updateUIState(false);
  }
  function updateUIState(active) {
    isScannerActive = active;
    if (active) {
      statusBadge.className = "status-badge status-active";
      statusLabel.textContent = "Scanning";
      toggleBtn.classList.add("scanning");
      toggleLabel.textContent = "Stop Scanner";
    } else {
      statusBadge.className = "status-badge status-idle";
      statusLabel.textContent = "Idle";
      toggleBtn.classList.remove("scanning");
      toggleLabel.textContent = "Start Real-Time Scanner";
    }
  }
  async function handleToggleClick() {
    if (!activeTabId) return;
    const targetType = isScannerActive ? "STOP_SCAN" : "START_SCAN";
    try {
      const response = await browser.runtime.sendMessage({
        type: targetType,
        tabId: activeTabId
      });
      if (response && response.active !== void 0) {
        updateUIState(response.active);
        if (response.active) {
          window.close();
        }
      }
    } catch (err) {
      console.error("[QR-Radar Popup] Failed to toggle scanner:", err);
    }
  }
  async function updateSettings(updates) {
    const newSettings = await saveSettings(updates);
    if (activeTabId) {
      try {
        await browser.tabs.sendMessage(activeTabId, {
          type: "SETTINGS_UPDATED",
          settings: newSettings
        });
      } catch {
      }
    }
  }
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
      let openBtn = "";
      if (parsed.type === "url" && parsed.actionUrl) {
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
    }).join("");
    historyList.querySelectorAll(".copy-item-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const text = btn.dataset.text;
        await navigator.clipboard.writeText(text);
        const span = btn.querySelector("span");
        btn.classList.add("copied");
        if (span) span.textContent = "Copied!";
        setTimeout(() => {
          btn.classList.remove("copied");
          if (span) span.textContent = "Copy";
        }, 1800);
      });
    });
  }
  function setupEventListeners() {
    toggleBtn.addEventListener("click", handleToggleClick);
    fpsSelector.addEventListener("click", (e) => {
      const btn = e.target.closest(".segment-btn");
      if (!btn) return;
      fpsSelector.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const fps = parseInt(btn.dataset.fps, 10);
      updateSettings({ scanRate: fps });
    });
    settingSound.addEventListener("change", () => {
      updateSettings({ soundEnabled: settingSound.checked });
    });
    settingAutoCopy.addEventListener("change", () => {
      updateSettings({ autoCopy: settingAutoCopy.checked });
    });
    clearHistoryBtn.addEventListener("click", async () => {
      if (confirm("Clear all scan history?")) {
        await clearScanHistory();
        await refreshHistory();
      }
    });
  }
  function formatTimeAgo(timestamp) {
    if (!timestamp) return "";
    const diffSec = Math.floor((Date.now() - timestamp) / 1e3);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  document.addEventListener("DOMContentLoaded", init);
})();
