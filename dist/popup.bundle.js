(() => {
  // src/utils/storage.js
  var STORAGE_KEYS = {
    SETTINGS: "qr_radar_settings",
    HISTORY: "qr_radar_history"
  };
  var DEFAULT_SETTINGS = {
    globalActive: false,
    // Whether scanner runs globally across all tabs
    scanRate: 2,
    // FPS: 1 to 120 (Slider, default 2 FPS Eco)
    themeColor: "gold",
    // 'cyan' | 'emerald' | 'violet' | 'gold' | 'pink'
    cardDisplayMode: "hover",
    // 'hover' (expand on hover) | 'always' (always open) | 'compact' (mini pill only)
    glowAnimation: false,
    // Inner QR background tint pulse
    cornerBrackets: true,
    // Corner targeting brackets
    soundEnabled: false,
    // Audio chime on detection
    autoCopy: false,
    // Auto copy content on detection
    pauseOnScroll: true,
    // Pause capture during scroll to save CPU
    scanResolution: "720",
    // '720' | '1080' | '1440' capture detail
    scanDomImages: true,
    // Directly scan visible in-page <img> and <canvas>
    blacklist: []
    // List of excluded domains (e.g. ["bank.com"])
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
  function isDomainBlacklisted(url, blacklist = []) {
    if (!url || !Array.isArray(blacklist) || blacklist.length === 0) return false;
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return blacklist.some((item) => {
        const b = item.toLowerCase().trim();
        return hostname === b || hostname.endsWith(`.${b}`);
      });
    } catch {
      return false;
    }
  }
  async function toggleDomainBlacklist(domain) {
    if (!domain) return [];
    const cleanDomain = domain.toLowerCase().trim();
    const settings = await getSettings();
    const currentList = Array.isArray(settings.blacklist) ? settings.blacklist : [];
    let updated;
    if (currentList.includes(cleanDomain)) {
      updated = currentList.filter((d) => d !== cleanDomain);
    } else {
      updated = [...currentList, cleanDomain];
    }
    await saveSettings({ blacklist: updated });
    return updated;
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
  var currentDomain = "";
  var isScannerActive = false;
  var navScanner = document.getElementById("nav-scanner");
  var navSettings = document.getElementById("nav-settings");
  var panelScanner = document.getElementById("panel-scanner");
  var panelSettings = document.getElementById("panel-settings");
  var statusBadge = document.getElementById("status-badge");
  var statusLabel = statusBadge.querySelector(".status-label");
  var toggleBtn = document.getElementById("toggle-scan-btn");
  var toggleLabel = document.getElementById("toggle-scan-label");
  var historyList = document.getElementById("history-list");
  var historyCount = document.getElementById("history-count");
  var clearHistoryBtn = document.getElementById("clear-history-btn");
  var themeSwatches = document.getElementById("theme-swatches");
  var cardModeSelector = document.getElementById("card-mode-selector");
  var settingGlow = document.getElementById("setting-glow");
  var settingBrackets = document.getElementById("setting-brackets");
  var settingSound = document.getElementById("setting-sound");
  var settingAutoCopy = document.getElementById("setting-autocopy");
  var settingPauseScroll = document.getElementById("setting-pause-scroll");
  var fpsSlider = document.getElementById("fps-slider");
  var fpsValueBadge = document.getElementById("fps-value-badge");
  var resolutionSelector = document.getElementById("resolution-selector");
  var settingDomImages = document.getElementById("setting-dom-images");
  var currentDomainText = document.getElementById("current-domain-text");
  var toggleBlacklistBtn = document.getElementById("toggle-blacklist-btn");
  var blacklistChips = document.getElementById("blacklist-chips");
  async function init() {
    setupTabs();
    await refreshActiveTab();
    await loadPreferences();
    await refreshHistory();
    setupEventListeners();
  }
  function setupTabs() {
    navScanner.addEventListener("click", () => switchTab("scanner"));
    navSettings.addEventListener("click", () => switchTab("settings"));
  }
  function switchTab(tabName) {
    if (tabName === "scanner") {
      navScanner.classList.add("active");
      navSettings.classList.remove("active");
      panelScanner.classList.add("active");
      panelSettings.classList.remove("active");
    } else {
      navSettings.classList.add("active");
      navScanner.classList.remove("active");
      panelSettings.classList.add("active");
      panelScanner.classList.remove("active");
    }
  }
  async function refreshActiveTab() {
    try {
      if (typeof browser !== "undefined" && browser.tabs) {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          activeTabId = tab.id;
          if (tab.url) {
            try {
              currentDomain = new URL(tab.url).hostname;
              currentDomainText.textContent = currentDomain;
            } catch {
              currentDomain = "";
              currentDomainText.textContent = "Non-web page";
            }
          }
        }
      }
      const response = await browser.runtime.sendMessage({ type: "GET_GLOBAL_STATUS" });
      if (response && response.active !== void 0) {
        updateUIState(response.active);
      }
    } catch (err) {
      console.warn("[QR-Radar Popup] Error refreshing tab state:", err);
      updateUIState(false);
    }
  }
  function updateUIState(active) {
    isScannerActive = active;
    if (active) {
      statusBadge.className = "status-badge status-active";
      statusLabel.textContent = "Active";
      toggleBtn.classList.add("scanning");
      toggleLabel.textContent = "Stop Scanner";
    } else {
      statusBadge.className = "status-badge status-idle";
      statusLabel.textContent = "Off";
      toggleBtn.classList.remove("scanning");
      toggleLabel.textContent = "Start Scanner";
    }
  }
  function updateFpsUI(fps) {
    if (fpsSlider) {
      fpsSlider.value = fps;
      const pct = (fps - 1) / (120 - 1) * 100;
      fpsSlider.style.background = `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${pct}%, var(--bg-tertiary) ${pct}%, var(--bg-tertiary) 100%)`;
    }
    if (fpsValueBadge) {
      let modeHint = "";
      if (fps <= 5) modeHint = " (Eco)";
      else if (fps === 12) modeHint = " (Balanced)";
      else if (fps === 30) modeHint = " (Std)";
      else if (fps === 60) modeHint = " (Smooth)";
      else if (fps >= 120) modeHint = " (Max)";
      fpsValueBadge.textContent = `${fps} FPS${modeHint}`;
    }
  }
  async function loadPreferences() {
    const settings = await getSettings();
    const currentTheme = settings.themeColor || "gold";
    themeSwatches.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.classList.toggle("active", swatch.dataset.theme === currentTheme);
    });
    const currentMode = settings.cardDisplayMode || "hover";
    cardModeSelector.querySelectorAll(".segment-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === currentMode);
    });
    settingGlow.checked = settings.glowAnimation ?? false;
    settingBrackets.checked = settings.cornerBrackets ?? true;
    settingSound.checked = settings.soundEnabled ?? false;
    settingAutoCopy.checked = settings.autoCopy ?? false;
    settingPauseScroll.checked = settings.pauseOnScroll ?? true;
    const currentFps = Math.max(1, Math.min(120, settings.scanRate ?? 2));
    updateFpsUI(currentFps);
    const currentRes = settings.scanResolution || "720";
    resolutionSelector.querySelectorAll(".segment-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.res === currentRes);
    });
    settingDomImages.checked = settings.scanDomImages ?? true;
    renderBlacklist(settings.blacklist || []);
  }
  function renderBlacklist(blacklist = []) {
    if (!currentDomain || currentDomain === "Non-web page") {
      toggleBlacklistBtn.style.display = "none";
    } else {
      toggleBlacklistBtn.style.display = "block";
      const isExcluded = isDomainBlacklisted(`https://${currentDomain}`, blacklist);
      if (isExcluded) {
        toggleBlacklistBtn.textContent = "Include this site";
        toggleBlacklistBtn.classList.add("blacklisted");
      } else {
        toggleBlacklistBtn.textContent = "Exclude this site";
        toggleBlacklistBtn.classList.remove("blacklisted");
      }
    }
    if (blacklist.length === 0) {
      blacklistChips.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">No sites excluded</span>';
      return;
    }
    blacklistChips.innerHTML = blacklist.map((domain) => `
    <span class="blacklist-chip">
      ${escapeHtml(domain)}
      <button class="chip-remove" data-domain="${escapeHtml(domain)}" title="Remove exclusion">\u2715</button>
    </span>
  `).join("");
    blacklistChips.querySelectorAll(".chip-remove").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const domain = btn.dataset.domain;
        const updated = await toggleDomainBlacklist(domain);
        renderBlacklist(updated);
      });
    });
  }
  async function handleToggleClick() {
    const targetType = isScannerActive ? "STOP_GLOBAL_SCAN" : "START_GLOBAL_SCAN";
    try {
      const response = await browser.runtime.sendMessage({ type: targetType });
      if (response && response.active !== void 0) {
        updateUIState(response.active);
        if (response.active) {
          window.close();
        }
      }
    } catch (err) {
      console.error("[QR-Radar Popup] Failed to toggle global scanner:", err);
    }
  }
  async function applySettingChange(updates) {
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
    try {
      await browser.runtime.sendMessage({
        type: "SETTINGS_UPDATED",
        settings: newSettings
      });
    } catch {
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
    themeSwatches.addEventListener("click", (e) => {
      const swatch = e.target.closest(".color-swatch");
      if (!swatch) return;
      themeSwatches.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
      swatch.classList.add("active");
      applySettingChange({ themeColor: swatch.dataset.theme });
    });
    cardModeSelector.addEventListener("click", (e) => {
      const btn = e.target.closest(".segment-btn");
      if (!btn) return;
      cardModeSelector.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applySettingChange({ cardDisplayMode: btn.dataset.mode });
    });
    let fpsDebounceTimer = null;
    if (fpsSlider) {
      fpsSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        updateFpsUI(val);
        clearTimeout(fpsDebounceTimer);
        fpsDebounceTimer = setTimeout(() => {
          applySettingChange({ scanRate: val });
        }, 50);
      });
      fpsSlider.addEventListener("change", (e) => {
        const val = parseInt(e.target.value, 10);
        clearTimeout(fpsDebounceTimer);
        applySettingChange({ scanRate: val });
      });
    }
    document.querySelectorAll(".scale-mark").forEach((mark) => {
      mark.addEventListener("click", () => {
        const val = parseInt(mark.dataset.val, 10);
        if (!isNaN(val)) {
          updateFpsUI(val);
          applySettingChange({ scanRate: val });
        }
      });
    });
    settingGlow.addEventListener("change", () => applySettingChange({ glowAnimation: settingGlow.checked }));
    settingBrackets.addEventListener("change", () => applySettingChange({ cornerBrackets: settingBrackets.checked }));
    settingSound.addEventListener("change", () => applySettingChange({ soundEnabled: settingSound.checked }));
    settingAutoCopy.addEventListener("change", () => applySettingChange({ autoCopy: settingAutoCopy.checked }));
    settingPauseScroll.addEventListener("change", () => applySettingChange({ pauseOnScroll: settingPauseScroll.checked }));
    settingDomImages.addEventListener("change", () => applySettingChange({ scanDomImages: settingDomImages.checked }));
    resolutionSelector.addEventListener("click", (e) => {
      const btn = e.target.closest(".segment-btn");
      if (!btn) return;
      resolutionSelector.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applySettingChange({ scanResolution: btn.dataset.res });
    });
    toggleBlacklistBtn.addEventListener("click", async () => {
      if (!currentDomain) return;
      const updated = await toggleDomainBlacklist(currentDomain);
      renderBlacklist(updated);
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
