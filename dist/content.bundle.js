(() => {
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

  // src/utils/coordinates.js
  function computeBounds(location) {
    const points = [
      location.topLeftCorner,
      location.topRightCorner,
      location.bottomRightCorner,
      location.bottomLeftCorner
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width,
      height,
      centerX: minX + width / 2,
      centerY: minY + height / 2
    };
  }
  function lerp(start, end, factor = 0.35) {
    return start + (end - start) * factor;
  }
  function lerpPoint(current, target, factor = 0.35) {
    if (!current) return { ...target };
    return {
      x: lerp(current.x, target.x, factor),
      y: lerp(current.y, target.y, factor)
    };
  }
  function lerpLocation(current, target, factor = 0.35) {
    if (!current) {
      return {
        topLeftCorner: { ...target.topLeftCorner },
        topRightCorner: { ...target.topRightCorner },
        bottomRightCorner: { ...target.bottomRightCorner },
        bottomLeftCorner: { ...target.bottomLeftCorner }
      };
    }
    return {
      topLeftCorner: lerpPoint(current.topLeftCorner, target.topLeftCorner, factor),
      topRightCorner: lerpPoint(current.topRightCorner, target.topRightCorner, factor),
      bottomRightCorner: lerpPoint(current.bottomRightCorner, target.bottomRightCorner, factor),
      bottomLeftCorner: lerpPoint(current.bottomLeftCorner, target.bottomLeftCorner, factor)
    };
  }

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
    downsampleScale: 0.5,
    // Frame downsampling for performance (0.5 = half resolution)
    globalActive: false
    // Whether scanner runs globally across all tabs
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
  async function addScanHistory(item) {
    const history = await getScanHistory();
    const now = Date.now();
    if (history.length > 0 && history[0].text === item.text && now - history[0].timestamp < 5e3) {
      return history;
    }
    const newEntry = {
      id: `scan_${now}_${Math.random().toString(36).slice(2, 7)}`,
      text: item.text,
      type: item.type || "text",
      title: item.title || item.text,
      timestamp: now
    };
    const updated = [newEntry, ...history.filter((h) => h.text !== item.text)].slice(0, 50);
    if (hasExtensionStorage()) {
      await browser.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
    }
    return updated;
  }

  // src/utils/dom-anchor.js
  function findAnchorElement(centerX, centerY, ignoreRootId = "qr-radar-root") {
    if (typeof document === "undefined" || !document.elementsFromPoint) {
      return null;
    }
    const elements = document.elementsFromPoint(centerX, centerY) || [];
    const candidates = elements.filter((el) => {
      return el && el.id !== ignoreRootId && !el.closest(`#${ignoreRootId}`);
    });
    if (candidates.length === 0) return null;
    const mediaTags = ["IMG", "VIDEO", "CANVAS", "SVG", "PICTURE"];
    for (const el of candidates) {
      if (mediaTags.includes(el.tagName)) {
        return el;
      }
    }
    for (const el of candidates) {
      try {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== "none" && !bg.includes("initial")) {
          return el;
        }
      } catch {
      }
    }
    const nonBody = candidates.filter((el) => el.tagName !== "BODY" && el.tagName !== "HTML");
    if (nonBody.length > 0) {
      nonBody.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return ra.width * ra.height - rb.width * rb.height;
      });
      return nonBody[0];
    }
    return candidates[0] || null;
  }
  function computeAnchorOffset(anchorEl, bounds) {
    if (!anchorEl || !bounds) {
      return { offsetX: 0, offsetY: 0, width: bounds?.width || 0, height: bounds?.height || 0 };
    }
    const rect = anchorEl.getBoundingClientRect();
    return {
      offsetX: bounds.minX - rect.left,
      offsetY: bounds.minY - rect.top,
      width: bounds.width,
      height: bounds.height
    };
  }
  function resolveAnchorPosition(anchorEl, offset, viewport) {
    if (!anchorEl || typeof anchorEl.isConnected === "boolean" && !anchorEl.isConnected) {
      return null;
    }
    const vw = viewport?.innerWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1920);
    const vh = viewport?.innerHeight ?? (typeof window !== "undefined" ? window.innerHeight : 1080);
    const rect = anchorEl.getBoundingClientRect();
    const x = rect.left + offset.offsetX;
    const y = rect.top + offset.offsetY;
    const isVisible = y + offset.height >= -10 && y <= vh + 10 && x + offset.width >= -10 && x <= vw + 10;
    return {
      x,
      y,
      width: offset.width,
      height: offset.height,
      isVisible
    };
  }

  // src/content/overlay.js
  var QROverlayManager = class {
    constructor(options = {}) {
      this.options = {
        soundEnabled: true,
        autoCopy: false,
        onStopRequested: () => {
        },
        ...options
      };
      this.root = null;
      this.boxElement = null;
      this.hudCard = null;
      this.miniBadge = null;
      this.currentLocation = null;
      this.lastDetectedText = null;
      this.docBounds = null;
      this.anchorElement = null;
      this.anchorOffset = null;
      this.isScrolling = false;
      this.scrollTimer = null;
      this.missingFrames = 0;
      this.maxMissingFrames = 8;
      this.audioCtx = null;
    }
    /**
     * Initializes overlay DOM structure.
     */
    mount() {
      if (this.root) return;
      this.root = document.createElement("div");
      this.root.id = "qr-radar-root";
      this.boxElement = document.createElement("div");
      this.boxElement.className = "qr-radar-box qr-hidden";
      this.boxElement.innerHTML = `
      <div class="qr-radar-box-frame">
        <div class="qr-radar-corner qr-radar-corner-tl"></div>
        <div class="qr-radar-corner qr-radar-corner-tr"></div>
        <div class="qr-radar-corner qr-radar-corner-bl"></div>
        <div class="qr-radar-corner qr-radar-corner-br"></div>
        <div class="qr-radar-mini-badge" title="Hover for details">
          <span class="qr-mini-dot"></span>
          <span class="qr-mini-type">QR</span>
        </div>
      </div>
    `;
      this.miniBadge = this.boxElement.querySelector(".qr-radar-mini-badge");
      this.hudCard = document.createElement("div");
      this.hudCard.className = "qr-radar-hud-card";
      this.boxElement.appendChild(this.hudCard);
      this.root.appendChild(this.boxElement);
      document.body.appendChild(this.root);
    }
    /**
     * Updates HUD with newly detected QR code.
     * @param {{ location: any, data: string }} qrResult
     * @param {number} scaleX
     * @param {number} scaleY
     */
    update(qrResult, scaleX, scaleY) {
      if (!this.root) this.mount();
      if (!qrResult) {
        this.missingFrames++;
        if (this.missingFrames > this.maxMissingFrames) {
          this.boxElement.classList.add("qr-hidden");
          this.currentLocation = null;
          this.anchorElement = null;
          this.anchorOffset = null;
          this.docBounds = null;
        }
        return;
      }
      this.missingFrames = 0;
      this.boxElement.classList.remove("qr-hidden");
      if (this.isScrolling) {
        const text2 = qrResult.data;
        if (text2 !== this.lastDetectedText) {
          this.lastDetectedText = text2;
          this.renderCardContent(text2);
          this.onNewQRAcquired(text2);
        }
        return;
      }
      const rawLoc = qrResult.location;
      const targetLoc = {
        topLeftCorner: { x: rawLoc.topLeftCorner.x * scaleX, y: rawLoc.topLeftCorner.y * scaleY },
        topRightCorner: { x: rawLoc.topRightCorner.x * scaleX, y: rawLoc.topRightCorner.y * scaleY },
        bottomRightCorner: { x: rawLoc.bottomRightCorner.x * scaleX, y: rawLoc.bottomRightCorner.y * scaleY },
        bottomLeftCorner: { x: rawLoc.bottomLeftCorner.x * scaleX, y: rawLoc.bottomLeftCorner.y * scaleY }
      };
      this.currentLocation = lerpLocation(this.currentLocation, targetLoc, 0.45);
      const bounds = computeBounds(this.currentLocation);
      if (!this.anchorElement || !this.anchorElement.isConnected) {
        this.anchorElement = findAnchorElement(bounds.centerX, bounds.centerY);
      }
      this.anchorOffset = computeAnchorOffset(this.anchorElement, bounds);
      this.docBounds = {
        docX: bounds.minX + window.scrollX,
        docY: bounds.minY + window.scrollY,
        width: bounds.width,
        height: bounds.height
      };
      this.applyPosition(bounds.minX, bounds.minY, bounds.width, bounds.height, true);
      const text = qrResult.data;
      if (text !== this.lastDetectedText) {
        this.lastDetectedText = text;
        this.renderCardContent(text);
        this.onNewQRAcquired(text);
      }
    }
    /**
     * Applies position and card orientation.
     */
    applyPosition(x, y, width, height, isVisible) {
      if (!this.boxElement) return;
      if (!isVisible) {
        this.boxElement.style.visibility = "hidden";
        return;
      }
      this.boxElement.style.visibility = "visible";
      this.boxElement.style.left = `${Math.round(x)}px`;
      this.boxElement.style.top = `${Math.round(y)}px`;
      if (width > 0) this.boxElement.style.width = `${Math.round(width)}px`;
      if (height > 0) this.boxElement.style.height = `${Math.round(height)}px`;
      const spaceBelow = window.innerHeight - (y + height);
      if (spaceBelow < 180) {
        this.hudCard.classList.add("qr-flipped");
      } else {
        this.hudCard.classList.remove("qr-flipped");
      }
    }
    /**
     * Instantly compensates bounding box position on page scroll (60/120 FPS)
     * using real-time DOM element bounding rect.
     */
    onScroll() {
      if (!this.boxElement || this.boxElement.classList.contains("qr-hidden")) {
        return;
      }
      this.isScrolling = true;
      if (this.scrollTimer) clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        this.isScrolling = false;
      }, 130);
      if (this.anchorElement && this.anchorElement.isConnected && this.anchorOffset) {
        const pos = resolveAnchorPosition(this.anchorElement, this.anchorOffset);
        if (pos) {
          this.applyPosition(pos.x, pos.y, pos.width, pos.height, pos.isVisible);
          return;
        }
      }
      if (this.docBounds) {
        const currentViewportX = this.docBounds.docX - window.scrollX;
        const currentViewportY = this.docBounds.docY - window.scrollY;
        const isOut = currentViewportY + this.docBounds.height < -10 || currentViewportY > window.innerHeight + 10 || currentViewportX + this.docBounds.width < -10 || currentViewportX > window.innerWidth + 10;
        this.applyPosition(currentViewportX, currentViewportY, this.docBounds.width, this.docBounds.height, !isOut);
      }
    }
    /**
     * Renders the interactive contents of the HUD card.
     * @param {string} text
     */
    renderCardContent(text) {
      const parsed = classifyContent(text);
      let actionBtnHtml = "";
      if (parsed.type === "url" && parsed.actionUrl) {
        actionBtnHtml = `
        <a href="${escapeHtml(parsed.actionUrl)}" target="_blank" rel="noopener noreferrer" class="qr-btn qr-btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Open Link
        </a>
      `;
      }
      this.hudCard.innerHTML = `
      <div class="qr-radar-hud-header">
        <span class="qr-radar-type-badge qr-badge-${parsed.type}">${parsed.type}</span>
        <span style="font-size: 11px; color: #8b949e;">${escapeHtml(parsed.title)}</span>
      </div>
      <div class="qr-radar-hud-body">
        ${escapeHtml(parsed.summary)}
      </div>
      <div class="qr-radar-hud-actions">
        <button class="qr-btn qr-btn-secondary qr-copy-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="qr-copy-label">Copy</span>
        </button>
        ${actionBtnHtml}
      </div>
    `;
      const copyBtn = this.hudCard.querySelector(".qr-copy-btn");
      if (copyBtn) {
        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.copyToClipboard(text, copyBtn);
        });
      }
      if (this.miniBadge) {
        const typeLabels = {
          url: "\u{1F517} LINK",
          wifi: "\u{1F4F6} WIFI",
          email: "\u{1F4E7} EMAIL",
          phone: "\u{1F4DE} CALL",
          sms: "\u{1F4AC} SMS",
          geo: "\u{1F4CD} GEO",
          text: "\u{1F4DD} TEXT"
        };
        const typeText = typeLabels[parsed.type] || "QR";
        const typeSpan = this.miniBadge.querySelector(".qr-mini-type");
        if (typeSpan) typeSpan.textContent = typeText;
        this.miniBadge.className = `qr-radar-mini-badge qr-mini-${parsed.type}`;
      }
    }
    /**
     * Triggered when a new QR code is detected.
     * @param {string} text
     */
    onNewQRAcquired(text) {
      const parsed = classifyContent(text);
      addScanHistory({
        text,
        type: parsed.type,
        title: parsed.title
      }).catch(() => {
      });
      if (this.options.soundEnabled) {
        this.playChime();
      }
      if (this.options.autoCopy) {
        navigator.clipboard.writeText(text).catch(() => {
        });
      }
    }
    /**
     * Copies text to clipboard and updates button state.
     */
    async copyToClipboard(text, btn) {
      try {
        await navigator.clipboard.writeText(text);
        const label = btn.querySelector(".qr-copy-label");
        btn.classList.add("qr-btn-copied");
        if (label) label.textContent = "Copied! \u2713";
        setTimeout(() => {
          btn.classList.remove("qr-btn-copied");
          if (label) label.textContent = "Copy";
        }, 2e3);
      } catch (err) {
        console.warn("[QR-Radar] Clipboard write failed:", err);
      }
    }
    /**
     * Plays a subtle high-tech synth beep using Web Audio API.
     */
    playChime() {
      try {
        if (!this.audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.audioCtx = new AudioCtx();
        }
        if (!this.audioCtx) return;
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume();
        }
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-3, this.audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
      } catch {
      }
    }
    /**
     * Unmounts overlay and cleans up DOM.
     */
    unmount() {
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer);
        this.scrollTimer = null;
      }
      if (this.root && this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
      this.root = null;
      this.boxElement = null;
      this.hudCard = null;
      this.miniBadge = null;
      this.currentLocation = null;
      this.lastDetectedText = null;
      this.anchorElement = null;
      this.anchorOffset = null;
      this.docBounds = null;
      this.isScrolling = false;
    }
  };
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // src/content/content.js
  var overlay = null;
  var isMounted = false;
  async function initOverlay() {
    if (overlay && isMounted) return overlay;
    const settings = await getSettings();
    overlay = new QROverlayManager({
      soundEnabled: settings.soundEnabled,
      autoCopy: settings.autoCopy,
      onStopRequested: () => {
        try {
          browser.runtime.sendMessage({ type: "STOP_SCAN" }).catch(() => {
          });
        } catch {
        }
        teardownOverlay();
      }
    });
    overlay.mount();
    isMounted = true;
    return overlay;
  }
  function teardownOverlay() {
    if (overlay) {
      overlay.unmount();
      overlay = null;
    }
    isMounted = false;
  }
  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) return;
      switch (message.type) {
        case "PING": {
          sendResponse({ pong: true });
          return false;
        }
        case "SCANNER_STARTED": {
          initOverlay().then(() => sendResponse({ success: true }));
          return true;
        }
        case "SCANNER_STOPPED": {
          teardownOverlay();
          sendResponse({ success: true });
          return false;
        }
        case "QR_DETECTED": {
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
        case "QR_NOT_FOUND": {
          if (overlay) {
            overlay.update(null);
          }
          sendResponse({ received: true });
          return false;
        }
        case "SETTINGS_UPDATED": {
          if (overlay && message.settings) {
            if (message.settings.soundEnabled !== void 0) {
              overlay.options.soundEnabled = message.settings.soundEnabled;
            }
            if (message.settings.autoCopy !== void 0) {
              overlay.options.autoCopy = message.settings.autoCopy;
            }
          }
          sendResponse({ success: true });
          return false;
        }
      }
    });
  }
  window.addEventListener("scroll", () => {
    if (overlay) {
      overlay.onScroll();
    }
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (overlay) {
      overlay.onScroll();
    }
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "q" || e.key === "\u0439" || e.key === "Q" || e.key === "\u0419")) {
      e.preventDefault();
      try {
        browser.runtime.sendMessage({ type: "TOGGLE_SCAN" }).catch(() => {
        });
      } catch {
      }
    }
  });
})();
