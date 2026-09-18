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
    for (const p2 of points) {
      if (p2.x < minX) minX = p2.x;
      if (p2.y < minY) minY = p2.y;
      if (p2.x > maxX) maxX = p2.x;
      if (p2.y > maxY) maxY = p2.y;
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
  function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function areBoundsNear(b1, b2, maxDistance = 60) {
    if (!b1 || !b2) return false;
    const dx = b1.centerX - b2.centerX;
    const dy = b1.centerY - b2.centerY;
    return dx * dx + dy * dy <= maxDistance * maxDistance;
  }

  // src/utils/storage.js
  var STORAGE_KEYS = {
    SETTINGS: "qr_radar_settings",
    HISTORY: "qr_radar_history"
  };
  var DEFAULT_SETTINGS = {
    globalActive: false,
    // Whether scanner runs globally across all tabs
    scanRate: 2,
    // FPS: 1 to 30 (Slider, default 2 FPS Eco)
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
    scanResolution: "1080",
    // '720' | '1080' | '1440' capture detail (default 1080p for crisp small QR detection)
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
    const updated = [newEntry, ...history.filter((h2) => h2.text !== item.text)].slice(0, 50);
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
    for (const el of candidates) {
      if (el.tagName !== "BODY" && el.tagName !== "HTML") {
        return el;
      }
    }
    return candidates[0] || null;
  }
  function computeAnchorOffset(anchorEl, bounds) {
    if (!anchorEl || !bounds) {
      return { offsetX: 0, offsetY: 0, width: bounds?.width || 0, height: bounds?.height || 0 };
    }
    const rect = anchorEl.getBoundingClientRect();
    const initialWidth = rect.width || 1;
    const initialHeight = rect.height || 1;
    return {
      offsetX: bounds.minX - rect.left,
      offsetY: bounds.minY - rect.top,
      width: bounds.width,
      height: bounds.height,
      relX: (bounds.minX - rect.left) / initialWidth,
      relY: (bounds.minY - rect.top) / initialHeight,
      relW: bounds.width / initialWidth,
      relH: bounds.height / initialHeight,
      initialWidth,
      initialHeight
    };
  }
  function isElementFixed(el) {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      return true;
    }
    if (!el || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
      return false;
    }
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      try {
        const pos = window.getComputedStyle(curr).position;
        if (pos === "fixed") return true;
      } catch {
        break;
      }
      curr = curr.parentElement;
    }
    return false;
  }
  function resolveAnchorPosition(anchorEl, offset, viewport) {
    if (!anchorEl || typeof anchorEl.isConnected === "boolean" && !anchorEl.isConnected) {
      return null;
    }
    const isFullscreen = typeof document !== "undefined" && !!document.fullscreenElement;
    const vw = viewport?.innerWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1920);
    const vh = viewport?.innerHeight ?? (typeof window !== "undefined" ? window.innerHeight : 1080);
    const scrollX = !isFullscreen && typeof window !== "undefined" ? window.pageXOffset || window.scrollX || 0 : 0;
    const scrollY = !isFullscreen && typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
    const rect = anchorEl.getBoundingClientRect();
    let x2, y2, width, height;
    if (offset.relX !== void 0 && offset.initialWidth > 0 && Math.abs(rect.width - offset.initialWidth) > 1.5) {
      width = rect.width * offset.relW;
      height = rect.height * offset.relH;
      x2 = rect.left + rect.width * offset.relX;
      y2 = rect.top + rect.height * offset.relY;
    } else {
      x2 = rect.left + offset.offsetX;
      y2 = rect.top + offset.offsetY;
      width = offset.width;
      height = offset.height;
    }
    const isVisible = y2 + height >= -10 && y2 <= vh + 10 && x2 + width >= -10 && x2 <= vw + 10;
    return {
      x: x2,
      y: y2,
      docX: x2 + scrollX,
      docY: y2 + scrollY,
      width,
      height,
      isVisible
    };
  }

  // node_modules/zxing-wasm/dist/es/share.js
  var e = [
    [
      "All",
      "*",
      "*",
      "     ",
      0,
      "All"
    ],
    [
      "AllReadable",
      "*",
      "r",
      "     ",
      0,
      "All Readable"
    ],
    [
      "AllCreatable",
      "*",
      "w",
      "     ",
      0,
      "All Creatable"
    ],
    [
      "AllLinear",
      "*",
      "l",
      "     ",
      0,
      "All Linear"
    ],
    [
      "AllMatrix",
      "*",
      "m",
      "     ",
      0,
      "All Matrix"
    ],
    [
      "AllGS1",
      "*",
      "G",
      "     ",
      0,
      "All GS1"
    ],
    [
      "AllRetail",
      "*",
      "R",
      "     ",
      0,
      "All Retail"
    ],
    [
      "AllIndustrial",
      "*",
      "I",
      "     ",
      0,
      "All Industrial"
    ],
    [
      "Codabar",
      "F",
      " ",
      "lrw  ",
      18,
      "Codabar"
    ],
    [
      "Code39",
      "A",
      " ",
      "lrw I",
      8,
      "Code 39"
    ],
    [
      "Code39Std",
      "A",
      "s",
      "lrw I",
      8,
      "Code 39 Standard"
    ],
    [
      "Code39Ext",
      "A",
      "e",
      "lr  I",
      9,
      "Code 39 Extended"
    ],
    [
      "Code32",
      "A",
      "2",
      "lr  I",
      129,
      "Code 32"
    ],
    [
      "PZN",
      "A",
      "p",
      "lr  I",
      52,
      "Pharmazentralnummer"
    ],
    [
      "Code93",
      "G",
      " ",
      "lrw I",
      25,
      "Code 93"
    ],
    [
      "Code128",
      "C",
      " ",
      "lrwGI",
      20,
      "Code 128"
    ],
    [
      "ITF",
      "I",
      " ",
      "lrw I",
      3,
      "ITF"
    ],
    [
      "ITF14",
      "I",
      "4",
      "lr  I",
      89,
      "ITF-14"
    ],
    [
      "DataBar",
      "e",
      " ",
      "lr GR",
      29,
      "DataBar"
    ],
    [
      "DataBarOmni",
      "e",
      "o",
      "lr GR",
      29,
      "DataBar Omni"
    ],
    [
      "DataBarStk",
      "e",
      "s",
      "lr GR",
      79,
      "DataBar Stacked"
    ],
    [
      "DataBarStkOmni",
      "e",
      "O",
      "lr GR",
      80,
      "DataBar Stacked Omni"
    ],
    [
      "DataBarLtd",
      "e",
      "l",
      "lr GR",
      30,
      "DataBar Limited"
    ],
    [
      "DataBarExp",
      "e",
      "e",
      "lr GR",
      31,
      "DataBar Expanded"
    ],
    [
      "DataBarExpStk",
      "e",
      "E",
      "lr GR",
      81,
      "DataBar Expanded Stacked"
    ],
    [
      "EANUPC",
      "E",
      " ",
      "lr  R",
      15,
      "EAN/UPC"
    ],
    [
      "EAN13",
      "E",
      "1",
      "lrw R",
      15,
      "EAN-13"
    ],
    [
      "EAN8",
      "E",
      "8",
      "lrw R",
      10,
      "EAN-8"
    ],
    [
      "EAN5",
      "E",
      "5",
      "l   R",
      12,
      "EAN-5"
    ],
    [
      "EAN2",
      "E",
      "2",
      "l   R",
      11,
      "EAN-2"
    ],
    [
      "ISBN",
      "E",
      "i",
      "lr  R",
      69,
      "ISBN"
    ],
    [
      "UPCA",
      "E",
      "a",
      "lrw R",
      34,
      "UPC-A"
    ],
    [
      "UPCE",
      "E",
      "e",
      "lrw R",
      37,
      "UPC-E"
    ],
    [
      "Telepen",
      "B",
      " ",
      "lr  I",
      32,
      "Telepen"
    ],
    [
      "TelepenAlpha",
      "B",
      "0",
      "lr  I",
      32,
      "Telepen Alpha"
    ],
    [
      "TelepenNumeric",
      "B",
      "1",
      "lr  I",
      87,
      "Telepen Numeric"
    ],
    [
      "OtherBarcode",
      "X",
      " ",
      " r   ",
      0,
      "Other barcode"
    ],
    [
      "DXFilmEdge",
      "X",
      "x",
      "lr   ",
      147,
      "DX Film Edge"
    ],
    [
      "PDF417",
      "L",
      " ",
      "mrw  ",
      55,
      "PDF417"
    ],
    [
      "CompactPDF417",
      "L",
      "c",
      "mr   ",
      56,
      "Compact PDF417"
    ],
    [
      "MicroPDF417",
      "L",
      "m",
      "mr   ",
      84,
      "MicroPDF417"
    ],
    [
      "Aztec",
      "z",
      " ",
      "mr G ",
      92,
      "Aztec"
    ],
    [
      "AztecCode",
      "z",
      "c",
      "mrwG ",
      92,
      "Aztec Code"
    ],
    [
      "AztecRune",
      "z",
      "r",
      "mr   ",
      128,
      "Aztec Rune"
    ],
    [
      "QRCode",
      "Q",
      " ",
      "mrwG ",
      58,
      "QR Code"
    ],
    [
      "QRCodeModel1",
      "Q",
      "1",
      "mr   ",
      0,
      "QR Code Model 1"
    ],
    [
      "QRCodeModel2",
      "Q",
      "2",
      "mr   ",
      58,
      "QR Code Model 2"
    ],
    [
      "MicroQRCode",
      "Q",
      "m",
      "mr   ",
      97,
      "Micro QR Code"
    ],
    [
      "RMQRCode",
      "Q",
      "r",
      "mr G ",
      145,
      "rMQR Code"
    ],
    [
      "DataMatrix",
      "d",
      " ",
      "mrwG ",
      71,
      "Data Matrix"
    ],
    [
      "MaxiCode",
      "U",
      " ",
      "mr   ",
      57,
      "MaxiCode"
    ]
  ];
  var t = {
    DataBarExpanded: "DataBarExp",
    DataBarLimited: "DataBarLtd",
    "Linear-Codes": "AllLinear",
    "Matrix-Codes": "AllMatrix",
    Any: "All",
    rMQRCode: "RMQRCode"
  };
  var n = e.map((e2) => e2[5]);
  var r = e.filter((e2) => e2[1] === "*").map((e2) => e2[0]);
  var i = e.filter((e2) => e2[1] !== "*").map((e2) => e2[0]);
  var o = e.filter((e2) => e2[2] === " ").map((e2) => e2[0]);
  var s = e.filter((e2) => e2[3][0] === "l").map((e2) => e2[0]);
  var l = e.filter((e2) => e2[3][0] === "m").map((e2) => e2[0]);
  var d = e.filter((e2) => e2[3][1] === "r").map((e2) => e2[0]);
  var f = e.filter((e2) => e2[3][2] === "w" || e2[4] !== 0).map((e2) => e2[0]);
  var p = e.filter((e2) => e2[3][3] === "G").map((e2) => e2[0]);
  var m = e.filter((e2) => e2[3][4] === "R").map((e2) => e2[0]);
  var h = e.filter((e2) => e2[3][4] === "I").map((e2) => e2[0]);
  function y(e2) {
    var n2;
    return (n2 = t[e2]) == null ? e2 : n2;
  }
  function b(e2) {
    return e2.map(y).join(",");
  }
  var x = [
    "LocalAverage",
    "GlobalHistogram",
    "FixedThreshold",
    "BoolCast"
  ];
  function C(e2) {
    return x.indexOf(e2);
  }
  var w = /* @__PURE__ */ "Unknown.ASCII.ISO8859_1.ISO8859_2.ISO8859_3.ISO8859_4.ISO8859_5.ISO8859_6.ISO8859_7.ISO8859_8.ISO8859_9.ISO8859_10.ISO8859_11.ISO8859_13.ISO8859_14.ISO8859_15.ISO8859_16.Cp437.Cp1250.Cp1251.Cp1252.Cp1256.Shift_JIS.Big5.GB2312.GB18030.EUC_JP.EUC_KR.UTF16BE.UTF8.UTF16LE.UTF32BE.UTF32LE.BINARY".split(".");
  function E(e2) {
    return e2 === "UnicodeBig" ? w.indexOf("UTF16BE") : w.indexOf(e2);
  }
  var D = [
    "Text",
    "Binary",
    "Mixed",
    "GS1",
    "ISO15434",
    "UnknownECI"
  ];
  function k(e2) {
    return D[e2];
  }
  var A = [
    "Ignore",
    "Read",
    "Require"
  ];
  function M(e2) {
    return A.indexOf(e2);
  }
  var N = [
    "Plain",
    "ECI",
    "HRI",
    "Escaped",
    "Hex",
    "HexECI"
  ];
  function F(e2) {
    return N.indexOf(e2);
  }
  var I = {
    formats: [],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    tryDenoise: false,
    binarizer: "LocalAverage",
    isPure: false,
    downscaleFactor: 3,
    downscaleThreshold: 500,
    minLineCount: 2,
    maxNumberOfSymbols: 255,
    validateOptionalChecksum: false,
    returnErrors: false,
    eanAddOnSymbol: "Ignore",
    textMode: "HRI",
    characterSet: "Unknown",
    tryCode39ExtendedMode: true
  };
  function L(e2) {
    var t2;
    return {
      ...e2,
      formats: b(e2.formats),
      binarizer: C(e2.binarizer),
      eanAddOnSymbol: M(e2.eanAddOnSymbol),
      textMode: F(e2.textMode),
      characterSet: E(e2.characterSet),
      tryCode39ExtendedMode: (t2 = e2.tryCode39ExtendedMode) == null || t2
    };
  }
  function R(e2) {
    return {
      ...e2,
      orientation: e2.rotation,
      format: e2.format,
      symbology: e2.symbology,
      contentType: k(e2.contentType)
    };
  }
  var B = {
    format: "QRCode",
    readerInit: false,
    forceSquareDataMatrix: false,
    ecLevel: "",
    scale: 1,
    sizeHint: 0,
    rotate: 0,
    invert: false,
    withHRT: false,
    withQuietZones: true,
    addHRT: false,
    addQuietZones: true,
    options: ""
  };
  var W = { locateFile: (e2, t2) => {
    let n2 = e2.match(/_(.+?)\.wasm$/);
    return n2 ? `https://fastly.jsdelivr.net/npm/zxing-wasm@3.1.4/dist/${n2[1]}/${e2}` : t2 + e2;
  } };
  var G = /* @__PURE__ */ new WeakMap();
  function K(e2, t2) {
    return Object.is(e2, t2) || Object.keys(e2).length === Object.keys(t2).length && Object.keys(e2).every((n2) => Object.hasOwn(t2, n2) && e2[n2] === t2[n2]);
  }
  function q(e2, { overrides: t2, equalityFn: n2 = K, fireImmediately: r2 = false } = {}) {
    var i2, a2;
    let [o2, s2] = (i2 = G.get(e2)) == null ? [W] : i2, c2 = t2 == null ? o2 : t2, l2;
    if (r2) {
      if (s2 && (l2 = n2(o2, c2))) return s2;
      let t3 = e2({ ...c2 });
      return G.set(e2, [c2, t3]), t3;
    }
    ((a2 = l2) == null ? n2(o2, c2) : a2) || G.set(e2, [c2]);
  }
  function Y(e2) {
    let t2 = e2.byteLength >> 2, n2 = new Uint8Array(t2);
    for (let r2 = 0; r2 < t2; r2++) {
      let t3 = r2 << 2;
      n2[r2] = 306 * e2[t3] + 601 * e2[t3 + 1] + 117 * e2[t3 + 2] + 512 >> 10;
    }
    return n2;
  }
  async function X(e2, t2, n2 = I) {
    let r2 = {
      ...I,
      ...n2
    }, i2 = await q(e2, { fireImmediately: true }), a2, o2;
    if ("width" in t2 && "height" in t2 && "data" in t2) {
      let { data: e3, width: n3, height: s3 } = t2, c2 = Y(e3), l2 = c2.byteLength;
      if (o2 = i2._malloc(l2), !o2) throw Error(`Failed to allocate ${l2} bytes in WASM memory`);
      try {
        i2.HEAPU8.set(c2, o2), a2 = i2.readBarcodesFromPixmap(o2, n3, s3, L(r2));
      } finally {
        i2._free(o2);
      }
    } else {
      let e3, n3;
      if ("buffer" in t2) [e3, n3] = [t2.byteLength, t2];
      else if ("byteLength" in t2) [e3, n3] = [t2.byteLength, new Uint8Array(t2)];
      else if ("size" in t2) [e3, n3] = [t2.size, new Uint8Array(await t2.arrayBuffer())];
      else throw TypeError("Invalid input type");
      if (o2 = i2._malloc(e3), !o2) throw Error(`Failed to allocate ${e3} bytes in WASM memory`);
      try {
        i2.HEAPU8.set(n3, o2), a2 = i2.readBarcodesFromImage(o2, e3, L(r2));
      } finally {
        i2._free(o2);
      }
    }
    let s2 = [];
    for (let e3 = 0; e3 < a2.size(); ++e3) s2.push(R(a2.get(e3)));
    return s2;
  }
  var Q = {
    ...I,
    formats: [...I.formats]
  };
  var $ = { ...B };

  // node_modules/zxing-wasm/dist/es/reader/index.js
  async function w2(e2 = {}) {
    var t2, n2, r2, i2 = e2, a2 = !!globalThis.window, o2 = typeof Bun < "u", s2 = !!globalThis.WorkerGlobalScope;
    (n2 = globalThis.process) != null && (n2 = n2.versions) != null && n2.node && ((r2 = globalThis.process) == null || r2.type);
    var c2, l2 = "";
    function u2(e3) {
      return i2.locateFile ? i2.locateFile(e3, l2) : l2 + e3;
    }
    var d2, f2;
    if (a2 || s2 || o2) {
      try {
        l2 = new URL(".", c2).href;
      } catch {
      }
      s2 && (f2 = (e3) => {
        var t3 = new XMLHttpRequest();
        return t3.open("GET", e3, false), t3.responseType = "arraybuffer", t3.send(null), new Uint8Array(t3.response);
      }), d2 = async (e3) => {
        var t3 = await fetch(e3, { credentials: "same-origin" });
        if (t3.ok) return t3.arrayBuffer();
        throw Error(t3.status + " : " + t3.url);
      };
    }
    console.log.bind(console);
    var p2 = console.error.bind(console), m2, h2 = false, g2, _2, v2 = false;
    function y2() {
      var e3 = Fn.buffer;
      C2 = new Int8Array(e3), x2 = new Int16Array(e3), i2.HEAPU8 = O2 = new Uint8Array(e3), E2 = new Uint16Array(e3), S2 = new Int32Array(e3), D2 = new Uint32Array(e3), w3 = new Float32Array(e3), T3 = new Float64Array(e3);
    }
    function ee() {
      if (i2.preRun) for (typeof i2.preRun == "function" && (i2.preRun = [i2.preRun]); i2.preRun.length; ) me(i2.preRun.shift());
      k3(pe);
    }
    function te() {
      v2 = true, $2.ra();
    }
    function ne() {
      if (i2.postRun) for (typeof i2.postRun == "function" && (i2.postRun = [i2.postRun]); i2.postRun.length; ) fe(i2.postRun.shift());
      k3(de);
    }
    function re(e3) {
      var t3, n3;
      (t3 = i2.onAbort) == null || t3.call(i2, e3), e3 = "Aborted(" + e3 + ")", p2(e3), h2 = true, e3 += ". Build with -sASSERTIONS for more info.";
      var r3 = new WebAssembly.RuntimeError(e3);
      throw (n3 = _2) == null || n3(r3), r3;
    }
    var b2;
    function ie() {
      return u2("zxing_reader.wasm");
    }
    function ae(e3) {
      if (e3 == b2 && m2) return new Uint8Array(m2);
      if (f2) return f2(e3);
      throw "both async and sync fetching of the wasm failed";
    }
    async function oe(e3) {
      if (!m2) try {
        var t3 = await d2(e3);
        return new Uint8Array(t3);
      } catch {
      }
      return ae(e3);
    }
    async function se(e3, t3) {
      try {
        var n3 = await oe(e3);
        return await WebAssembly.instantiate(n3, t3);
      } catch (e4) {
        p2(`failed to asynchronously prepare wasm: ${e4}`), re(e4);
      }
    }
    async function ce(e3, t3, n3) {
      if (!e3 && WebAssembly.instantiateStreaming) try {
        var r3 = fetch(t3, { credentials: "same-origin" });
        return await WebAssembly.instantiateStreaming(r3, n3);
      } catch (e4) {
        p2(`wasm streaming compile failed: ${e4}`), p2("falling back to ArrayBuffer instantiation");
      }
      return se(t3, n3);
    }
    function le() {
      return { a: Rn };
    }
    async function ue() {
      function e3(e4, t4) {
        return $2 = e4.exports, Ln($2), y2(), $2;
      }
      function t3(t4) {
        return e3(t4.instance);
      }
      var n3 = le();
      return i2.instantiateWasm ? new Promise((t4, r3) => {
        i2.instantiateWasm(n3, (n4, r4) => {
          t4(e3(n4, r4));
        });
      }) : (b2 != null || (b2 = ie()), t3(await ce(m2, b2, n3)));
    }
    var x2, S2, C2, w3, T3, E2, D2, O2, k3 = (e3) => {
      for (; e3.length > 0; ) e3.shift()(i2);
    }, de = [], fe = (e3) => de.push(e3), pe = [], me = (e3) => pe.push(e3), A2 = (e3) => On(e3), j2 = () => kn(), M2 = [], he = 0, ge = (e3) => {
      var t3 = new ve(e3);
      return t3.get_caught() || (t3.set_caught(true), he--), t3.set_rethrown(false), M2.push(t3), En(e3);
    }, N2 = 0, _e = () => {
      Q2(0, 0);
      var e3 = M2.pop();
      jn(e3.excPtr), N2 = 0;
    };
    class ve {
      constructor(e3) {
        this.excPtr = e3, this.ptr = e3 - 24;
      }
      set_type(e3) {
        D2[this.ptr + 4 >> 2] = e3;
      }
      get_type() {
        return D2[this.ptr + 4 >> 2];
      }
      set_destructor(e3) {
        D2[this.ptr + 8 >> 2] = e3;
      }
      get_destructor() {
        return D2[this.ptr + 8 >> 2];
      }
      set_caught(e3) {
        e3 = +!!e3, C2[this.ptr + 12] = e3;
      }
      get_caught() {
        return C2[this.ptr + 12] != 0;
      }
      set_rethrown(e3) {
        e3 = +!!e3, C2[this.ptr + 13] = e3;
      }
      get_rethrown() {
        return C2[this.ptr + 13] != 0;
      }
      init(e3, t3) {
        this.set_adjusted_ptr(0), this.set_type(e3), this.set_destructor(t3);
      }
      set_adjusted_ptr(e3) {
        D2[this.ptr + 16 >> 2] = e3;
      }
      get_adjusted_ptr() {
        return D2[this.ptr + 16 >> 2];
      }
    }
    var P2 = (e3) => Dn(e3), ye = (e3) => {
      var t3 = N2;
      if (!t3) return P2(0), 0;
      var n3 = new ve(t3);
      n3.set_adjusted_ptr(t3);
      var r3 = n3.get_type();
      if (!r3) return P2(0), t3;
      for (var i3 of e3) {
        if (i3 === 0 || i3 === r3) break;
        var a3 = n3.ptr + 16;
        if (Mn(i3, r3, a3)) return P2(i3), t3;
      }
      return P2(r3), t3;
    }, be = () => ye([]), xe = (e3) => ye([e3]), Se = (e3, t3) => ye([e3, t3]), Ce = () => {
      var e3 = M2.pop();
      e3 || re("no exception to throw");
      var t3 = e3.excPtr;
      throw e3.get_rethrown() || (M2.push(e3), e3.set_rethrown(true), e3.set_caught(false), he++), An(t3), N2 = t3, N2;
    }, we = (e3, t3, n3) => {
      throw new ve(e3).init(t3, n3), An(e3), N2 = e3, he++, N2;
    }, Te = (e3) => {
      throw N2 || (N2 = e3), N2;
    }, Ee = () => re(""), F2 = {}, De = (e3) => {
      for (; e3.length; ) {
        var t3 = e3.pop();
        e3.pop()(t3);
      }
    };
    function I2(e3) {
      return this.fromWireType(D2[e3 >> 2]);
    }
    var L2 = {}, R2 = {}, z = {}, Oe = class extends Error {
      constructor(e3) {
        super(e3), this.name = "InternalError";
      }
    }, B2 = (e3) => {
      throw new Oe(e3);
    }, V = (e3, t3, n3) => {
      e3.forEach((e4) => z[e4] = t3);
      function r3(t4) {
        var r4 = n3(t4);
        r4.length !== e3.length && B2("Mismatched type converter count");
        for (var i4 = 0; i4 < e3.length; ++i4) G2(e3[i4], r4[i4]);
      }
      var i3 = Array(t3.length), a3 = [], o3 = 0;
      {
        let e4 = t3;
        for (let t4 = 0; t4 < e4.length; ++t4) {
          let n4 = e4[t4];
          R2.hasOwnProperty(n4) ? i3[t4] = R2[n4] : (a3.push(n4), L2.hasOwnProperty(n4) || (L2[n4] = []), L2[n4].push(() => {
            i3[t4] = R2[n4], ++o3, o3 === a3.length && r3(i3);
          }));
        }
      }
      a3.length === 0 && r3(i3);
    }, ke = (e3) => {
      var t3 = F2[e3];
      delete F2[e3];
      var n3 = t3.rawConstructor, r3 = t3.rawDestructor, i3 = t3.fields, a3 = i3.map((e4) => e4.getterReturnType).concat(i3.map((e4) => e4.setterArgumentType));
      V([e3], a3, (e4) => {
        var a4 = {};
        {
          let t4 = i3;
          for (let n4 = 0; n4 < t4.length; ++n4) {
            let r4 = t4[n4], o3 = e4[n4], s3 = r4.getter, c3 = r4.getterContext, l3 = e4[n4 + i3.length], u3 = r4.setter, d3 = r4.setterContext;
            a4[r4.fieldName] = {
              read: (e5) => o3.fromWireType(s3(c3, e5)),
              write: (e5, t5) => {
                var n5 = [];
                u3(d3, e5, l3.toWireType(n5, t5)), De(n5);
              },
              optional: o3.optional
            };
          }
        }
        return [{
          name: t3.name,
          fromWireType: (e5) => {
            var t4 = {};
            for (var n4 in a4) t4[n4] = a4[n4].read(e5);
            return r3(e5), t4;
          },
          toWireType: (e5, t4) => {
            for (var i4 in a4) if (!(i4 in t4) && !a4[i4].optional) throw TypeError(`Missing field: "${i4}"`);
            var o3 = n3();
            for (i4 in a4) a4[i4].write(o3, t4[i4]);
            return e5 !== null && e5.push(r3, o3), o3;
          },
          readValueFromPointer: I2,
          destructorFunction: r3
        }];
      });
    }, Ae = (e3, t3, n3, r3, i3) => {
    }, H2 = (e3) => {
      for (var t3 = ""; ; ) {
        var n3 = O2[e3++];
        if (!n3) return t3;
        t3 += String.fromCharCode(n3);
      }
    }, U2 = class extends Error {
      constructor(e3) {
        super(e3), this.name = "BindingError";
      }
    }, W2 = (e3) => {
      throw new U2(e3);
    };
    function je(e3, t3) {
      let n3 = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      var r3 = t3.name;
      if (e3 || W2(`type "${r3}" must have a positive integer typeid pointer`), R2.hasOwnProperty(e3)) {
        if (n3.ignoreDuplicateRegistrations) return;
        W2(`Cannot register type '${r3}' twice`);
      }
      if (R2[e3] = t3, delete z[e3], L2.hasOwnProperty(e3)) {
        var i3 = L2[e3];
        delete L2[e3], i3.forEach((e4) => e4());
      }
    }
    function G2(e3, t3) {
      return je(e3, t3, arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {});
    }
    var Me = (e3, t3, n3, r3) => {
      t3 = H2(t3), G2(e3, {
        name: t3,
        fromWireType: function(e4) {
          return !!e4;
        },
        toWireType: function(e4, t4) {
          return t4 ? n3 : r3;
        },
        readValueFromPointer: function(e4) {
          return this.fromWireType(O2[e4]);
        },
        destructorFunction: null
      });
    }, Ne = (e3) => ({
      count: e3.count,
      deleteScheduled: e3.deleteScheduled,
      preservePointerOnDelete: e3.preservePointerOnDelete,
      ptr: e3.ptr,
      ptrType: e3.ptrType,
      smartPtr: e3.smartPtr,
      smartPtrType: e3.smartPtrType
    }), Pe = (e3) => {
      function t3(e4) {
        return e4.$$.ptrType.registeredClass.name;
      }
      W2(t3(e3) + " instance already deleted");
    }, Fe = false, Ie = (e3) => {
    }, Le = (e3) => {
      e3.smartPtr ? e3.smartPtrType.rawDestructor(e3.smartPtr) : e3.ptrType.registeredClass.rawDestructor(e3.ptr);
    }, Re = (e3) => {
      --e3.count.value, e3.count.value === 0 && Le(e3);
    }, K2 = (e3) => globalThis.FinalizationRegistry ? (Fe = new FinalizationRegistry((e4) => {
      Re(e4.$$);
    }), K2 = (e4) => {
      var t3 = e4.$$;
      if (t3.smartPtr) {
        var n3 = { $$: t3 };
        Fe.register(e4, n3, e4);
      }
      return e4;
    }, Ie = (e4) => Fe.unregister(e4), K2(e3)) : (K2 = (e4) => e4, e3), ze = [], Be = () => {
      for (; ze.length; ) {
        var e3 = ze.pop();
        e3.$$.deleteScheduled = false, e3.delete();
      }
    }, Ve, He = () => {
      let e3 = Ue.prototype;
      Object.assign(e3, {
        isAliasOf(e4) {
          if (!(this instanceof Ue) || !(e4 instanceof Ue)) return false;
          var t4 = this.$$.ptrType.registeredClass, n3 = this.$$.ptr;
          e4.$$ = e4.$$;
          for (var r3 = e4.$$.ptrType.registeredClass, i3 = e4.$$.ptr; t4.baseClass; ) n3 = t4.upcast(n3), t4 = t4.baseClass;
          for (; r3.baseClass; ) i3 = r3.upcast(i3), r3 = r3.baseClass;
          return t4 === r3 && n3 === i3;
        },
        clone() {
          if (this.$$.ptr || Pe(this), this.$$.preservePointerOnDelete) return this.$$.count.value += 1, this;
          var e4 = K2(Object.create(Object.getPrototypeOf(this), { $$: { value: Ne(this.$$) } }));
          return e4.$$.count.value += 1, e4.$$.deleteScheduled = false, e4;
        },
        delete() {
          this.$$.ptr || Pe(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && W2("Object already scheduled for deletion"), Ie(this), Re(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
        },
        isDeleted() {
          return !this.$$.ptr;
        },
        deleteLater() {
          return this.$$.ptr || Pe(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && W2("Object already scheduled for deletion"), ze.push(this), ze.length === 1 && Ve && Ve(Be), this.$$.deleteScheduled = true, this;
        }
      });
      let t3 = Symbol.dispose;
      t3 && (e3[t3] = e3.delete);
    };
    function Ue() {
    }
    var We = (e3, t3) => Object.defineProperty(t3, "name", { value: e3 }), Ge = {}, Ke = (e3, t3, n3) => {
      if (e3[t3].overloadTable === void 0) {
        var r3 = e3[t3];
        e3[t3] = function() {
          var r4 = [...arguments];
          return e3[t3].overloadTable.hasOwnProperty(r4.length) || W2(`Function '${n3}' called with an invalid number of arguments (${r4.length}) - expects one of (${e3[t3].overloadTable})!`), e3[t3].overloadTable[r4.length].apply(this, r4);
        }, e3[t3].overloadTable = [], e3[t3].overloadTable[r3.argCount] = r3;
      }
    }, qe = (e3, t3, n3) => {
      i2.hasOwnProperty(e3) ? ((n3 === void 0 || i2[e3].overloadTable !== void 0 && i2[e3].overloadTable[n3] !== void 0) && W2(`Cannot register public name '${e3}' twice`), Ke(i2, e3, e3), i2[e3].overloadTable.hasOwnProperty(n3) && W2(`Cannot register multiple overloads of a function with the same number of arguments (${n3})!`), i2[e3].overloadTable[n3] = t3) : (i2[e3] = t3, i2[e3].argCount = n3);
    }, Je = 48, Ye = 57, Xe = (e3) => {
      e3 = e3.replace(/[^a-zA-Z0-9_]/g, "$");
      var t3 = e3.charCodeAt(0);
      return t3 >= Je && t3 <= Ye ? `_${e3}` : e3;
    };
    function Ze(e3, t3, n3, r3, i3, a3, o3, s3) {
      this.name = e3, this.constructor = t3, this.instancePrototype = n3, this.rawDestructor = r3, this.baseClass = i3, this.getActualType = a3, this.upcast = o3, this.downcast = s3, this.pureVirtualFunctions = [];
    }
    var Qe = (e3, t3, n3) => {
      for (; t3 !== n3; ) t3.upcast || W2(`Expected null or instance of ${n3.name}, got an instance of ${t3.name}`), e3 = t3.upcast(e3), t3 = t3.baseClass;
      return e3;
    }, $e = (e3) => {
      if (e3 === null) return "null";
      var t3 = typeof e3;
      return t3 === "object" || t3 === "array" || t3 === "function" ? e3.toString() : "" + e3;
    };
    function et(e3, t3) {
      if (t3 === null) return this.isReference && W2(`null is not a valid ${this.name}`), 0;
      t3.$$ || W2(`Cannot pass "${$e(t3)}" as a ${this.name}`), t3.$$.ptr || W2(`Cannot pass deleted object as a pointer of type ${this.name}`);
      var n3 = t3.$$.ptrType.registeredClass;
      return Qe(t3.$$.ptr, n3, this.registeredClass);
    }
    function tt(e3, t3) {
      var n3;
      if (t3 === null) return this.isReference && W2(`null is not a valid ${this.name}`), this.isSmartPointer ? (n3 = this.rawConstructor(), e3 !== null && e3.push(this.rawDestructor, n3), n3) : 0;
      (!t3 || !t3.$$) && W2(`Cannot pass "${$e(t3)}" as a ${this.name}`), t3.$$.ptr || W2(`Cannot pass deleted object as a pointer of type ${this.name}`), !this.isConst && t3.$$.ptrType.isConst && W2(`Cannot convert argument of type ${t3.$$.smartPtrType ? t3.$$.smartPtrType.name : t3.$$.ptrType.name} to parameter type ${this.name}`);
      var r3 = t3.$$.ptrType.registeredClass;
      if (n3 = Qe(t3.$$.ptr, r3, this.registeredClass), this.isSmartPointer) switch (t3.$$.smartPtr === void 0 && W2("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy) {
        case 0:
          t3.$$.smartPtrType === this ? n3 = t3.$$.smartPtr : W2(`Cannot convert argument of type ${t3.$$.smartPtrType ? t3.$$.smartPtrType.name : t3.$$.ptrType.name} to parameter type ${this.name}`);
          break;
        case 1:
          n3 = t3.$$.smartPtr;
          break;
        case 2:
          if (t3.$$.smartPtrType === this) n3 = t3.$$.smartPtr;
          else {
            var i3 = t3.clone();
            n3 = this.rawShare(n3, X2.toHandle(() => i3.delete())), e3 !== null && e3.push(this.rawDestructor, n3);
          }
          break;
        default:
          W2("Unsupported sharing policy");
      }
      return n3;
    }
    function nt(e3, t3) {
      if (t3 === null) return this.isReference && W2(`null is not a valid ${this.name}`), 0;
      t3.$$ || W2(`Cannot pass "${$e(t3)}" as a ${this.name}`), t3.$$.ptr || W2(`Cannot pass deleted object as a pointer of type ${this.name}`), t3.$$.ptrType.isConst && W2(`Cannot convert argument of type ${t3.$$.ptrType.name} to parameter type ${this.name}`);
      var n3 = t3.$$.ptrType.registeredClass;
      return Qe(t3.$$.ptr, n3, this.registeredClass);
    }
    var rt = (e3, t3, n3) => {
      if (t3 === n3) return e3;
      if (n3.baseClass === void 0) return null;
      var r3 = rt(e3, t3, n3.baseClass);
      return r3 === null ? null : n3.downcast(r3);
    }, it = {}, at = (e3, t3) => {
      for (t3 === void 0 && W2("ptr should not be undefined"); e3.baseClass; ) t3 = e3.upcast(t3), e3 = e3.baseClass;
      return t3;
    }, ot = (e3, t3) => (t3 = at(e3, t3), it[t3]), st = (e3, t3) => ((!t3.ptrType || !t3.ptr) && B2("makeClassHandle requires ptr and ptrType"), !!t3.smartPtrType != !!t3.smartPtr && B2("Both smartPtrType and smartPtr must be specified"), t3.count = { value: 1 }, K2(Object.create(e3, { $$: {
      value: t3,
      writable: true
    } })));
    function ct(e3) {
      var t3 = this.getPointee(e3);
      if (!t3) return this.destructor(e3), null;
      var n3 = ot(this.registeredClass, t3);
      if (n3 !== void 0) {
        if (n3.$$.count.value === 0) return n3.$$.ptr = t3, n3.$$.smartPtr = e3, n3.clone();
        var r3 = n3.clone();
        return this.destructor(e3), r3;
      }
      function i3() {
        return this.isSmartPointer ? st(this.registeredClass.instancePrototype, {
          ptrType: this.pointeeType,
          ptr: t3,
          smartPtrType: this,
          smartPtr: e3
        }) : st(this.registeredClass.instancePrototype, {
          ptrType: this,
          ptr: e3
        });
      }
      var a3 = Ge[this.registeredClass.getActualType(t3)];
      if (!a3) return i3.call(this);
      var o3 = this.isConst ? a3.constPointerType : a3.pointerType, s3 = rt(t3, this.registeredClass, o3.registeredClass);
      return s3 === null ? i3.call(this) : this.isSmartPointer ? st(o3.registeredClass.instancePrototype, {
        ptrType: o3,
        ptr: s3,
        smartPtrType: this,
        smartPtr: e3
      }) : st(o3.registeredClass.instancePrototype, {
        ptrType: o3,
        ptr: s3
      });
    }
    var lt = () => {
      Object.assign(ut.prototype, {
        getPointee(e3) {
          return this.rawGetPointee && (e3 = this.rawGetPointee(e3)), e3;
        },
        destructor(e3) {
          var t3;
          (t3 = this.rawDestructor) == null || t3.call(this, e3);
        },
        readValueFromPointer: I2,
        fromWireType: ct
      });
    };
    function ut(e3, t3, n3, r3, i3, a3, o3, s3, c3, l3, u3) {
      this.name = e3, this.registeredClass = t3, this.isReference = n3, this.isConst = r3, this.isSmartPointer = i3, this.pointeeType = a3, this.sharingPolicy = o3, this.rawGetPointee = s3, this.rawConstructor = c3, this.rawShare = l3, this.rawDestructor = u3, !i3 && t3.baseClass === void 0 ? r3 ? (this.toWireType = et, this.destructorFunction = null) : (this.toWireType = nt, this.destructorFunction = null) : this.toWireType = tt;
    }
    var dt = (e3, t3, n3) => {
      i2.hasOwnProperty(e3) || B2("Replacing nonexistent public symbol"), i2[e3].overloadTable !== void 0 && n3 !== void 0 ? i2[e3].overloadTable[n3] = t3 : (i2[e3] = t3, i2[e3].argCount = n3);
    }, ft = {}, pt = (e3, t3, n3) => {
      e3 = e3.replace(/p/g, "i");
      var r3 = ft[e3];
      return r3(t3, ...n3);
    }, mt = [], q2 = (e3) => {
      var t3 = mt[e3];
      return t3 || (mt[e3] = t3 = In.get(e3)), t3;
    }, ht = function(e3, t3) {
      let n3 = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
      if (arguments.length > 3 && arguments[3] !== void 0 && arguments[3], e3.includes("j")) return pt(e3, t3, n3);
      var r3 = q2(t3)(...n3);
      function i3(e4) {
        return e4;
      }
      return i3(r3);
    }, gt = function(e3, t3) {
      let n3 = arguments.length > 2 && arguments[2] !== void 0 && arguments[2];
      return function() {
        return ht(e3, t3, [...arguments], n3);
      };
    }, J2 = function(e3, t3) {
      arguments.length > 2 && arguments[2] !== void 0 && arguments[2], e3 = H2(e3);
      function n3() {
        return e3.includes("j") ? gt(e3, t3) : q2(t3);
      }
      var r3 = n3();
      return typeof r3 != "function" && W2(`unknown function pointer with signature ${e3}: ${t3}`), r3;
    };
    class _t extends Error {
    }
    var vt = (e3) => {
      var t3 = wn(e3), n3 = H2(t3);
      return Z(t3), n3;
    }, yt = (e3, t3) => {
      var n3 = [], r3 = {};
      function i3(e4) {
        if (!r3[e4] && !R2[e4]) {
          if (z[e4]) {
            z[e4].forEach(i3);
            return;
          }
          n3.push(e4), r3[e4] = true;
        }
      }
      throw t3.forEach(i3), new _t(`${e3}: ` + n3.map(vt).join([", "]));
    }, bt = (e3, t3, n3, r3, i3, a3, o3, s3, c3, l3, u3, d3, f3) => {
      u3 = H2(u3), a3 = J2(i3, a3), s3 && (s3 = J2(o3, s3)), l3 && (l3 = J2(c3, l3)), f3 = J2(d3, f3);
      var p3 = Xe(u3);
      qe(p3, function() {
        yt(`Cannot construct ${u3} due to unbound types`, [r3]);
      }), V([
        e3,
        t3,
        n3
      ], r3 ? [r3] : [], (t4) => {
        t4 = t4[0];
        var n4, i4;
        r3 ? (n4 = t4.registeredClass, i4 = n4.instancePrototype) : i4 = Ue.prototype;
        var o4 = We(u3, function() {
          if (Object.getPrototypeOf(this) !== c4) throw new U2(`Use 'new' to construct ${u3}`);
          if (d4.constructor_body === void 0) throw new U2(`${u3} has no accessible constructor`);
          var e4 = [...arguments], t5 = d4.constructor_body[e4.length];
          if (t5 === void 0) throw new U2(`Tried to invoke ctor of ${u3} with invalid number of parameters (${e4.length}) - expected (${Object.keys(d4.constructor_body).toString()}) parameters instead!`);
          return t5.apply(this, e4);
        }), c4 = Object.create(i4, { constructor: { value: o4 } });
        o4.prototype = c4;
        var d4 = new Ze(u3, o4, c4, f3, n4, a3, s3, l3);
        if (d4.baseClass) {
          var m3;
          (m3 = d4.baseClass).__derivedClasses != null || (m3.__derivedClasses = []), d4.baseClass.__derivedClasses.push(d4);
        }
        var h3 = new ut(u3, d4, true, false, false), g3 = new ut(u3 + "*", d4, false, false, false), _3 = new ut(u3 + " const*", d4, false, true, false);
        return Ge[e3] = {
          pointerType: g3,
          constPointerType: _3
        }, dt(p3, o4), [
          h3,
          g3,
          _3
        ];
      });
    }, xt = (e3, t3) => {
      for (var n3 = [], r3 = 0; r3 < e3; r3++) n3.push(D2[t3 + r3 * 4 >> 2]);
      return n3;
    };
    function St(e3) {
      for (var t3 = 1; t3 < e3.length; ++t3) if (e3[t3] !== null && e3[t3].destructorFunction === void 0) return true;
      return false;
    }
    function Ct(e3, t3, n3, r3, i3, a3) {
      var o3 = t3.length;
      o3 < 2 && W2("argTypes array size mismatch! Must at least get return value and 'this' types!");
      var s3 = t3[1] !== null && n3 !== null, c3 = St(t3), l3 = !t3[0].isVoid, u3 = o3 - 2, d3 = Array(u3), f3 = [], p3 = [];
      return We(e3, function() {
        p3.length = 0;
        var e4;
        f3.length = s3 ? 2 : 1, f3[0] = i3, s3 && (e4 = t3[1].toWireType(p3, this), f3[1] = e4);
        for (var n4 = 0; n4 < u3; ++n4) d3[n4] = t3[n4 + 2].toWireType(p3, n4 < 0 || arguments.length <= n4 ? void 0 : arguments[n4]), f3.push(d3[n4]);
        var a4 = r3(...f3);
        function o4(n5) {
          if (c3) De(p3);
          else for (var r4 = s3 ? 1 : 2; r4 < t3.length; r4++) {
            var i4 = r4 === 1 ? e4 : d3[r4 - 2];
            t3[r4].destructorFunction !== null && t3[r4].destructorFunction(i4);
          }
          if (l3) return t3[0].fromWireType(n5);
        }
        return o4(a4);
      });
    }
    var wt = (e3, t3, n3, r3, i3, a3) => {
      var o3 = xt(t3, n3);
      i3 = J2(r3, i3), V([], [e3], (e4) => {
        e4 = e4[0];
        var n4 = `constructor ${e4.name}`;
        if (e4.registeredClass.constructor_body === void 0 && (e4.registeredClass.constructor_body = []), e4.registeredClass.constructor_body[t3 - 1] !== void 0) throw new U2(`Cannot register multiple constructors with identical number of parameters (${t3 - 1}) for class '${e4.name}'! Overload resolution is currently only performed using the parameter count, not actual type info!`);
        return e4.registeredClass.constructor_body[t3 - 1] = () => {
          yt(`Cannot construct ${e4.name} due to unbound types`, o3);
        }, V([], o3, (r4) => (r4.splice(1, 0, null), e4.registeredClass.constructor_body[t3 - 1] = Ct(n4, r4, null, i3, a3), [])), [];
      });
    }, Tt = (e3) => {
      e3 = e3.trim();
      let t3 = e3.indexOf("(");
      return t3 === -1 ? e3 : e3.slice(0, t3);
    }, Et = (e3, t3, n3, r3, i3, a3, o3, s3, c3, l3) => {
      var u3 = xt(n3, r3);
      t3 = H2(t3), t3 = Tt(t3), a3 = J2(i3, a3, c3), V([], [e3], (e4) => {
        e4 = e4[0];
        var r4 = `${e4.name}.${t3}`;
        t3.startsWith("@@") && (t3 = Symbol[t3.substring(2)]), s3 && e4.registeredClass.pureVirtualFunctions.push(t3);
        function i4() {
          yt(`Cannot call ${r4} due to unbound types`, u3);
        }
        var l4 = e4.registeredClass.instancePrototype, d3 = l4[t3];
        return d3 === void 0 || d3.overloadTable === void 0 && d3.className !== e4.name && d3.argCount === n3 - 2 ? (i4.argCount = n3 - 2, i4.className = e4.name, l4[t3] = i4) : (Ke(l4, t3, r4), l4[t3].overloadTable[n3 - 2] = i4), V([], u3, (i5) => {
          var s4 = Ct(r4, i5, e4, a3, o3, c3);
          return l4[t3].overloadTable === void 0 ? (s4.argCount = n3 - 2, l4[t3] = s4) : l4[t3].overloadTable[n3 - 2] = s4, [];
        }), [];
      });
    }, Dt = [], Y2 = [
      0,
      1,
      ,
      1,
      null,
      1,
      true,
      1,
      false,
      1
    ], Ot = (e3) => {
      e3 > 9 && --Y2[e3 + 1] === 0 && (Y2[e3] = void 0, Dt.push(e3));
    }, X2 = {
      toValue: (e3) => (e3 || W2(`Cannot use deleted val. handle = ${e3}`), Y2[e3]),
      toHandle: (e3) => {
        switch (e3) {
          case void 0:
            return 2;
          case null:
            return 4;
          case true:
            return 6;
          case false:
            return 8;
          default: {
            let t3 = Dt.pop() || Y2.length;
            return Y2[t3] = e3, Y2[t3 + 1] = 1, t3;
          }
        }
      }
    }, kt = {
      name: "emscripten::val",
      fromWireType: (e3) => {
        var t3 = X2.toValue(e3);
        return Ot(e3), t3;
      },
      toWireType: (e3, t3) => X2.toHandle(t3),
      readValueFromPointer: I2,
      destructorFunction: null
    }, At = (e3) => G2(e3, kt), jt = (e3, t3) => {
      switch (t3) {
        case 4:
          return function(e4) {
            return this.fromWireType(w3[e4 >> 2]);
          };
        case 8:
          return function(e4) {
            return this.fromWireType(T3[e4 >> 3]);
          };
        default:
          throw TypeError(`invalid float width (${t3}): ${e3}`);
      }
    }, Mt = (e3, t3, n3) => {
      t3 = H2(t3), G2(e3, {
        name: t3,
        fromWireType: (e4) => e4,
        toWireType: (e4, t4) => t4,
        readValueFromPointer: jt(t3, n3),
        destructorFunction: null
      });
    }, Nt = (e3, t3, n3, r3, i3, a3, o3, s3) => {
      var c3 = xt(t3, n3);
      e3 = H2(e3), e3 = Tt(e3), i3 = J2(r3, i3, o3), qe(e3, function() {
        yt(`Cannot call ${e3} due to unbound types`, c3);
      }, t3 - 1), V([], c3, (n4) => {
        var r4 = [n4[0], null].concat(n4.slice(1));
        return dt(e3, Ct(e3, r4, null, i3, a3, o3), t3 - 1), [];
      });
    }, Pt = (e3, t3, n3) => {
      switch (t3) {
        case 1:
          return n3 ? (e4) => C2[e4] : (e4) => O2[e4];
        case 2:
          return n3 ? (e4) => x2[e4 >> 1] : (e4) => E2[e4 >> 1];
        case 4:
          return n3 ? (e4) => S2[e4 >> 2] : (e4) => D2[e4 >> 2];
        default:
          throw TypeError(`invalid integer width (${t3}): ${e3}`);
      }
    }, Ft = (e3, t3, n3, r3, i3) => {
      t3 = H2(t3);
      let a3 = r3 === 0, o3 = (e4) => e4;
      if (a3) {
        var s3 = 32 - 8 * n3;
        o3 = (e4) => e4 << s3 >>> s3, i3 = o3(i3);
      }
      G2(e3, {
        name: t3,
        fromWireType: o3,
        toWireType: (e4, t4) => t4,
        readValueFromPointer: Pt(t3, n3, r3 !== 0),
        destructorFunction: null
      });
    }, It = (e3, t3, n3) => {
      let r3 = (e4, t4) => {
        let n4 = 0;
        return {
          next() {
            if (n4 >= e4) return { done: true };
            let r4 = n4;
            return n4++, {
              value: t4(r4),
              done: false
            };
          },
          [Symbol.iterator]() {
            return this;
          }
        };
      };
      e3[Symbol.iterator] || (e3[Symbol.iterator] = function() {
        let e4 = this[t3]();
        return r3(e4, (e5) => this[n3](e5));
      });
    }, Lt = (e3, t3, n3, r3) => {
      n3 = H2(n3), r3 = H2(r3), V([], [e3, t3], (e4) => {
        let t4 = e4[0];
        return It(t4.registeredClass.instancePrototype, n3, r3), [];
      });
    }, Rt = (e3, t3, n3) => {
      var r3 = [
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        Float32Array,
        Float64Array
      ][t3];
      function i3(e4) {
        var t4 = D2[e4 >> 2], n4 = D2[e4 + 4 >> 2];
        return new r3(C2.buffer, n4, t4);
      }
      n3 = H2(n3), G2(e3, {
        name: n3,
        fromWireType: i3,
        readValueFromPointer: i3
      }, { ignoreDuplicateRegistrations: true });
    }, zt = Object.assign({ optional: true }, kt), Bt = (e3, t3) => {
      G2(e3, zt);
    }, Vt = (e3, t3, n3, r3) => {
      if (!(r3 > 0)) return 0;
      for (var i3 = n3, a3 = n3 + r3 - 1, o3 = 0; o3 < e3.length; ++o3) {
        var s3 = e3.codePointAt(o3);
        if (s3 <= 127) {
          if (n3 >= a3) break;
          t3[n3++] = s3;
        } else if (s3 <= 2047) {
          if (n3 + 1 >= a3) break;
          t3[n3++] = 192 | s3 >> 6, t3[n3++] = 128 | s3 & 63;
        } else if (s3 <= 65535) {
          if (n3 + 2 >= a3) break;
          t3[n3++] = 224 | s3 >> 12, t3[n3++] = 128 | s3 >> 6 & 63, t3[n3++] = 128 | s3 & 63;
        } else {
          if (n3 + 3 >= a3) break;
          t3[n3++] = 240 | s3 >> 18, t3[n3++] = 128 | s3 >> 12 & 63, t3[n3++] = 128 | s3 >> 6 & 63, t3[n3++] = 128 | s3 & 63, o3++;
        }
      }
      return t3[n3] = 0, n3 - i3;
    }, Ht = (e3, t3, n3) => Vt(e3, O2, t3, n3), Ut = (e3) => {
      for (var t3 = 0, n3 = 0; n3 < e3.length; ++n3) {
        var r3 = e3.charCodeAt(n3);
        r3 <= 127 ? t3++ : r3 <= 2047 ? t3 += 2 : r3 >= 55296 && r3 <= 57343 ? (t3 += 4, ++n3) : t3 += 3;
      }
      return t3;
    }, Wt = globalThis.TextDecoder && new TextDecoder(), Gt = (e3, t3, n3, r3) => {
      var i3 = t3 + n3;
      if (r3) return i3;
      for (; e3[t3] && !(t3 >= i3); ) ++t3;
      return t3;
    }, Kt = function(e3) {
      let t3 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0, n3 = arguments.length > 2 ? arguments[2] : void 0, r3 = arguments.length > 3 ? arguments[3] : void 0;
      var i3 = Gt(e3, t3, n3, r3);
      if (i3 - t3 > 16 && e3.buffer && Wt) return Wt.decode(e3.subarray(t3, i3));
      for (var a3 = ""; t3 < i3; ) {
        var o3 = e3[t3++];
        if (!(o3 & 128)) {
          a3 += String.fromCharCode(o3);
          continue;
        }
        var s3 = e3[t3++] & 63;
        if ((o3 & 224) == 192) {
          a3 += String.fromCharCode((o3 & 31) << 6 | s3);
          continue;
        }
        var c3 = e3[t3++] & 63;
        if (o3 = (o3 & 240) == 224 ? (o3 & 15) << 12 | s3 << 6 | c3 : (o3 & 7) << 18 | s3 << 12 | c3 << 6 | e3[t3++] & 63, o3 < 65536) a3 += String.fromCharCode(o3);
        else {
          var l3 = o3 - 65536;
          a3 += String.fromCharCode(55296 | l3 >> 10, 56320 | l3 & 1023);
        }
      }
      return a3;
    }, qt = (e3, t3, n3) => e3 ? Kt(O2, e3, t3, n3) : "", Jt = (e3, t3) => {
      t3 = H2(t3);
      var n3 = true;
      G2(e3, {
        name: t3,
        fromWireType(e4) {
          var t4 = D2[e4 >> 2], r3 = e4 + 4, i3;
          if (n3) i3 = qt(r3, t4, true);
          else {
            i3 = "";
            for (var a3 = 0; a3 < t4; ++a3) i3 += String.fromCharCode(O2[r3 + a3]);
          }
          return Z(e4), i3;
        },
        toWireType(e4, t4) {
          t4 instanceof ArrayBuffer && (t4 = new Uint8Array(t4));
          var r3, i3 = typeof t4 == "string";
          i3 || ArrayBuffer.isView(t4) && t4.BYTES_PER_ELEMENT == 1 || W2("Cannot pass non-string to std::string"), r3 = n3 && i3 ? Ut(t4) : t4.length;
          var a3 = Tn(4 + r3 + 1), o3 = a3 + 4;
          if (D2[a3 >> 2] = r3, i3) {
            if (n3) Ht(t4, o3, r3 + 1);
            else for (var s3 = 0; s3 < r3; ++s3) {
              var c3 = t4.charCodeAt(s3);
              c3 > 255 && (Z(a3), W2("String has UTF-16 code units that do not fit in 8 bits")), O2[o3 + s3] = c3;
            }
          } else O2.set(t4, o3);
          return e4 !== null && e4.push(Z, a3), a3;
        },
        readValueFromPointer: I2,
        destructorFunction(e4) {
          Z(e4);
        }
      });
    }, Yt = globalThis.TextDecoder ? new TextDecoder("utf-16le") : void 0, Xt = (e3, t3, n3) => {
      var r3 = e3 >> 1, i3 = Gt(E2, r3, t3 / 2, n3);
      if (i3 - r3 > 16 && Yt) return Yt.decode(E2.subarray(r3, i3));
      for (var a3 = "", o3 = r3; o3 < i3; ++o3) {
        var s3 = E2[o3];
        a3 += String.fromCharCode(s3);
      }
      return a3;
    }, Zt = (e3, t3, n3) => {
      if (n3 != null || (n3 = 2147483647), n3 < 2) return 0;
      n3 -= 2;
      for (var r3 = t3, i3 = n3 < e3.length * 2 ? n3 / 2 : e3.length, a3 = 0; a3 < i3; ++a3) {
        var o3 = e3.charCodeAt(a3);
        x2[t3 >> 1] = o3, t3 += 2;
      }
      return x2[t3 >> 1] = 0, t3 - r3;
    }, Qt = (e3) => e3.length * 2, $t = (e3, t3, n3) => {
      for (var r3 = "", i3 = e3 >> 2, a3 = 0; !(a3 >= t3 / 4); a3++) {
        var o3 = D2[i3 + a3];
        if (!o3 && !n3) break;
        r3 += String.fromCodePoint(o3);
      }
      return r3;
    }, en = (e3, t3, n3) => {
      if (n3 != null || (n3 = 2147483647), n3 < 4) return 0;
      for (var r3 = t3, i3 = r3 + n3 - 4, a3 = 0; a3 < e3.length; ++a3) {
        var o3 = e3.codePointAt(a3);
        if (o3 > 65535 && a3++, S2[t3 >> 2] = o3, t3 += 4, t3 + 4 > i3) break;
      }
      return S2[t3 >> 2] = 0, t3 - r3;
    }, tn = (e3) => {
      for (var t3 = 0, n3 = 0; n3 < e3.length; ++n3) e3.codePointAt(n3) > 65535 && n3++, t3 += 4;
      return t3;
    }, nn = (e3, t3, n3) => {
      n3 = H2(n3);
      var r3, i3, a3;
      t3 === 2 ? (r3 = Xt, i3 = Zt, a3 = Qt) : (r3 = $t, i3 = en, a3 = tn), G2(e3, {
        name: n3,
        fromWireType: (e4) => {
          var n4 = D2[e4 >> 2], i4 = r3(e4 + 4, n4 * t3, true);
          return Z(e4), i4;
        },
        toWireType: (e4, r4) => {
          typeof r4 != "string" && W2(`Cannot pass non-string to C++ string type ${n3}`);
          var o3 = a3(r4), s3 = Tn(4 + o3 + t3);
          return D2[s3 >> 2] = o3 / t3, i3(r4, s3 + 4, o3 + t3), e4 !== null && e4.push(Z, s3), s3;
        },
        readValueFromPointer: I2,
        destructorFunction(e4) {
          Z(e4);
        }
      });
    }, rn = (e3, t3, n3, r3, i3, a3) => {
      F2[e3] = {
        name: H2(t3),
        rawConstructor: J2(n3, r3),
        rawDestructor: J2(i3, a3),
        fields: []
      };
    }, an = (e3, t3, n3, r3, i3, a3, o3, s3, c3, l3) => {
      F2[e3].fields.push({
        fieldName: H2(t3),
        getterReturnType: n3,
        getter: J2(r3, i3),
        getterContext: a3,
        setterArgumentType: o3,
        setter: J2(s3, c3),
        setterContext: l3
      });
    }, on = (e3, t3) => {
      t3 = H2(t3), G2(e3, {
        isVoid: true,
        name: t3,
        fromWireType: () => void 0,
        toWireType: (e4, t4) => void 0
      });
    }, sn = [], cn = (e3) => {
      var t3 = sn.length;
      return sn.push(e3), t3;
    }, ln = (e3, t3) => {
      var n3 = R2[e3];
      return n3 === void 0 && W2(`${t3} has unknown type ${vt(e3)}`), n3;
    }, un = (e3, t3) => {
      for (var n3 = Array(e3), r3 = 0; r3 < e3; ++r3) n3[r3] = ln(D2[t3 + r3 * 4 >> 2], `parameter ${r3}`);
      return n3;
    }, dn = (e3, t3, n3) => {
      var r3 = [], i3 = e3(r3, n3);
      return r3.length && (D2[t3 >> 2] = X2.toHandle(r3)), i3;
    }, fn = {}, pn = (e3) => {
      var t3 = fn[e3];
      return t3 === void 0 ? H2(e3) : t3;
    }, mn = (e3, t3, n3) => {
      var [r3, ...i3] = un(e3, t3), a3 = r3.toWireType.bind(r3), o3 = i3.map((e4) => e4.readValueFromPointer.bind(e4));
      e3--;
      var s3 = Array(e3);
      return cn(We(`methodCaller<(${i3.map((e4) => e4.name)}) => ${r3.name}>`, (t4, r4, i4, c3) => {
        for (var l3 = 0, u3 = 0; u3 < e3; ++u3) s3[u3] = o3[u3](c3 + l3), l3 += 8;
        var d3;
        switch (n3) {
          case 0:
            d3 = X2.toValue(t4).apply(null, s3);
            break;
          case 2:
            d3 = Reflect.construct(X2.toValue(t4), s3);
            break;
          case 3:
            d3 = s3[0];
            break;
          case 1:
            d3 = X2.toValue(t4)[pn(r4)](...s3);
        }
        return dn(a3, i4, d3);
      }));
    }, hn = (e3) => e3 ? (e3 = pn(e3), X2.toHandle(globalThis[e3])) : X2.toHandle(globalThis), gn = (e3) => {
      e3 > 9 && (Y2[e3 + 1] += 1);
    }, _n = (e3, t3, n3, r3, i3) => sn[e3](t3, n3, r3, i3), vn = (e3) => {
      De(X2.toValue(e3)), Ot(e3);
    }, yn = () => 2147483648, bn = (e3, t3) => Math.ceil(e3 / t3) * t3, xn = (e3) => {
      var t3 = (e3 - Fn.buffer.byteLength + 65535) / 65536 | 0;
      try {
        return Fn.grow(t3), y2(), 1;
      } catch {
      }
    }, Sn = (e3) => {
      var t3 = O2.length;
      e3 >>>= 0;
      var n3 = yn();
      if (e3 > n3) return false;
      for (var r3 = 1; r3 <= 4; r3 *= 2) {
        var i3 = t3 * (1 + 0.2 / r3);
        if (i3 = Math.min(i3, e3 + 100663296), xn(Math.min(n3, bn(Math.max(e3, i3), 65536)))) return true;
      }
      return false;
    }, Cn = (e3) => e3;
    if (He(), lt(), i2.noExitRuntime && i2.noExitRuntime, i2.print && i2.print, i2.printErr && (p2 = i2.printErr), i2.wasmBinary && (m2 = i2.wasmBinary), i2.arguments && i2.arguments, i2.thisProgram && i2.thisProgram, i2.preInit) for (typeof i2.preInit == "function" && (i2.preInit = [i2.preInit]); i2.preInit.length > 0; ) i2.preInit.shift()();
    var wn, Z, Tn, En, Q2, Dn, On, kn, An, jn, Mn, Nn, Pn, Fn, In;
    function Ln(e3) {
      wn = e3.sa, Z = i2._free = e3.ta, Tn = i2._malloc = e3.va, En = e3.wa, Q2 = e3.xa, Dn = e3.ya, On = e3.za, kn = e3.Aa, An = e3.Ba, jn = e3.Ca, Mn = e3.Da, Nn = ft.viijjijjjjjj = e3.Ea, Pn = ft.iiijj = e3.Fa, Fn = e3.qa, In = e3.ua;
    }
    var Rn = {
      r: ge,
      J: _e,
      a: be,
      i: xe,
      l: Se,
      T: Ce,
      q: we,
      e: Te,
      Z: Ee,
      na: ke,
      Y: Ae,
      ha: Me,
      la: bt,
      ka: wt,
      E: Et,
      fa: At,
      U: Mt,
      V: Nt,
      x: Ft,
      ja: Lt,
      s: Rt,
      ma: Bt,
      ga: Jt,
      P: nn,
      F: rn,
      oa: an,
      ia: on,
      I: mn,
      pa: Ot,
      C: hn,
      Q: gn,
      H: _n,
      aa: vn,
      _: Sn,
      da: ar,
      S: cr,
      z: mr,
      K: Kn,
      b: Vn,
      A: sr,
      ba: fr,
      d: Un,
      M: pr,
      h: Gn,
      j: Qn,
      p: $n,
      N: or,
      w: nr,
      O: tr,
      B: rr,
      W: yr,
      c: qn,
      m: zn,
      $: hr,
      g: Hn,
      R: lr,
      L: _r,
      f: Wn,
      G: gr,
      k: Bn,
      ca: ur,
      n: er,
      u: Yn,
      D: ir,
      y: Zn,
      t: dr,
      o: Jn,
      ea: Xn,
      X: vr,
      v: Cn
    };
    function zn(e3, t3) {
      var n3 = j2();
      try {
        q2(e3)(t3);
      } catch (e4) {
        if (A2(n3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Bn(e3, t3, n3, r3, i3) {
      var a3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3);
      } catch (e4) {
        if (A2(a3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Vn(e3, t3) {
      var n3 = j2();
      try {
        return q2(e3)(t3);
      } catch (e4) {
        if (A2(n3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Hn(e3, t3, n3) {
      var r3 = j2();
      try {
        q2(e3)(t3, n3);
      } catch (e4) {
        if (A2(r3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Un(e3, t3, n3) {
      var r3 = j2();
      try {
        return q2(e3)(t3, n3);
      } catch (e4) {
        if (A2(r3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Wn(e3, t3, n3, r3) {
      var i3 = j2();
      try {
        q2(e3)(t3, n3, r3);
      } catch (e4) {
        if (A2(i3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Gn(e3, t3, n3, r3) {
      var i3 = j2();
      try {
        return q2(e3)(t3, n3, r3);
      } catch (e4) {
        if (A2(i3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Kn(e3, t3, n3, r3, i3, a3) {
      var o3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3, a3);
      } catch (e4) {
        if (A2(o3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function qn(e3) {
      var t3 = j2();
      try {
        q2(e3)();
      } catch (e4) {
        if (A2(t3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Jn(e3, t3, n3, r3, i3, a3, o3, s3, c3, l3, u3) {
      var d3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3, s3, c3, l3, u3);
      } catch (e4) {
        if (A2(d3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Yn(e3, t3, n3, r3, i3, a3, o3) {
      var s3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3);
      } catch (e4) {
        if (A2(s3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Xn(e3, t3, n3, r3, i3, a3, o3, s3, c3, l3, u3, d3, f3, p3, m3, h3, g3) {
      var _3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3, s3, c3, l3, u3, d3, f3, p3, m3, h3, g3);
      } catch (e4) {
        if (A2(_3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Zn(e3, t3, n3, r3, i3, a3, o3, s3, c3) {
      var l3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3, s3, c3);
      } catch (e4) {
        if (A2(l3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function Qn(e3, t3, n3, r3, i3) {
      var a3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3);
      } catch (e4) {
        if (A2(a3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function $n(e3, t3, n3, r3, i3, a3) {
      var o3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3, a3);
      } catch (e4) {
        if (A2(o3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function er(e3, t3, n3, r3, i3, a3) {
      var o3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3);
      } catch (e4) {
        if (A2(o3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function tr(e3, t3, n3, r3, i3, a3, o3, s3) {
      var c3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3, a3, o3, s3);
      } catch (e4) {
        if (A2(c3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function nr(e3, t3, n3, r3, i3, a3, o3) {
      var s3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3, a3, o3);
      } catch (e4) {
        if (A2(s3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function rr(e3, t3, n3, r3, i3, a3, o3, s3, c3) {
      var l3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3, a3, o3, s3, c3);
      } catch (e4) {
        if (A2(l3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function ir(e3, t3, n3, r3, i3, a3, o3, s3) {
      var c3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3, s3);
      } catch (e4) {
        if (A2(c3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function ar(e3, t3, n3) {
      var r3 = j2();
      try {
        return q2(e3)(t3, n3);
      } catch (e4) {
        if (A2(r3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function or(e3, t3, n3, r3, i3, a3, o3) {
      var s3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3, a3, o3);
      } catch (e4) {
        if (A2(s3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function sr(e3, t3, n3, r3) {
      var i3 = j2();
      try {
        return q2(e3)(t3, n3, r3);
      } catch (e4) {
        if (A2(i3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function cr(e3, t3, n3, r3) {
      var i3 = j2();
      try {
        return q2(e3)(t3, n3, r3);
      } catch (e4) {
        if (A2(i3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function lr(e3, t3, n3, r3, i3, a3, o3, s3, c3) {
      var l3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3, s3, c3);
      } catch (e4) {
        if (A2(l3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function ur(e3, t3, n3, r3, i3, a3, o3, s3) {
      var c3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3, s3);
      } catch (e4) {
        if (A2(c3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function dr(e3, t3, n3, r3, i3, a3, o3, s3, c3, l3) {
      var u3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3, s3, c3, l3);
      } catch (e4) {
        if (A2(u3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function fr(e3, t3, n3) {
      var r3 = j2();
      try {
        return q2(e3)(t3, n3);
      } catch (e4) {
        if (A2(r3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function pr(e3, t3, n3, r3, i3) {
      var a3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3);
      } catch (e4) {
        if (A2(a3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function mr(e3, t3, n3, r3, i3, a3) {
      var o3 = j2();
      try {
        return q2(e3)(t3, n3, r3, i3, a3);
      } catch (e4) {
        if (A2(o3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function hr(e3, t3, n3) {
      var r3 = j2();
      try {
        q2(e3)(t3, n3);
      } catch (e4) {
        if (A2(r3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function gr(e3, t3, n3, r3, i3, a3, o3) {
      var s3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3, a3, o3);
      } catch (e4) {
        if (A2(s3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function _r(e3, t3, n3, r3, i3) {
      var a3 = j2();
      try {
        q2(e3)(t3, n3, r3, i3);
      } catch (e4) {
        if (A2(a3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function vr(e3, t3, n3, r3, i3, a3, o3, s3, c3, l3, u3, d3, f3, p3, m3, h3, g3, _3, v3, y3) {
      var ee2 = j2();
      try {
        Nn(e3, t3, n3, r3, i3, a3, o3, s3, c3, l3, u3, d3, f3, p3, m3, h3, g3, _3, v3, y3);
      } catch (e4) {
        if (A2(ee2), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function yr(e3, t3, n3, r3, i3, a3, o3) {
      var s3 = j2();
      try {
        return Pn(e3, t3, n3, r3, i3, a3, o3);
      } catch (e4) {
        if (A2(s3), e4 !== e4 + 0) throw e4;
        Q2(1, 0);
      }
    }
    function br() {
      ee();
      function e3() {
        var e4, t3;
        i2.calledRun = true, !h2 && (te(), (e4 = g2) == null || e4(i2), (t3 = i2.onRuntimeInitialized) == null || t3.call(i2), ne());
      }
      i2.setStatus ? (i2.setStatus("Running..."), setTimeout(() => {
        setTimeout(() => i2.setStatus(""), 1), e3();
      }, 1)) : e3();
    }
    var $2 = await ue();
    return br(), t2 = v2 ? i2 : new Promise((e3, t3) => {
      g2 = e3, _2 = t3;
    }), t2;
  }
  function T2(e2) {
    return q(w2, e2);
  }
  async function k2(e2, t2) {
    return X(w2, e2, t2);
  }

  // src/utils/dom-scanner.js
  var isWasmConfigured = false;
  function ensureWasmConfigured() {
    if (isWasmConfigured) return;
    try {
      const wasmUrl = typeof browser !== "undefined" && browser.runtime && browser.runtime.getURL ? browser.runtime.getURL("dist/zxing_reader.wasm") : "dist/zxing_reader.wasm";
      T2({
        overrides: {
          locateFile: (path) => path.endsWith(".wasm") ? wasmUrl : path
        }
      });
      isWasmConfigured = true;
    } catch (err) {
      console.warn("[QR Radar] DOM Scanner Wasm config error:", err);
    }
  }
  var offscreenCanvas = null;
  var offscreenCtx = null;
  function getOffscreenCanvas(width, height) {
    if (typeof document === "undefined") return null;
    if (!offscreenCanvas) {
      offscreenCanvas = document.createElement("canvas");
      offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
    }
    if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
    }
    return { canvas: offscreenCanvas, ctx: offscreenCtx };
  }
  function isElementInViewport(el, margin = 50) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    if (el.hidden || el.style?.display === "none" || el.style?.visibility === "hidden" || el.style?.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 12 || rect.height <= 12) return false;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
    const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
    const inBounds = rect.bottom >= -margin && rect.top <= vh + margin && rect.right >= -margin && rect.left <= vw + margin;
    if (!inBounds) return false;
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        return false;
      }
    } else if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") {
          return false;
        }
      } catch {
      }
    }
    return true;
  }
  async function scanMediaElement(el, maxDimension = 1920) {
    if (!el) return [];
    let width = 0;
    let height = 0;
    if (el.tagName === "IMG") {
      if (el._qrRadarTainted) return [];
      if (!el.complete || !el.naturalWidth || !el.naturalHeight) return [];
      width = el.naturalWidth;
      height = el.naturalHeight;
      const currentSrc = el.currentSrc || el.src;
      if (el._qrRadarCached !== void 0 && el._qrRadarCachedSrc === currentSrc) {
        if (!el._qrRadarCached || el._qrRadarCached.length === 0) return [];
        const rect = el.getBoundingClientRect();
        const scaleX = rect.width / el._qrRadarCachedW;
        const scaleY = rect.height / el._qrRadarCachedH;
        return el._qrRadarCached.map((item) => ({
          data: item.data,
          location: {
            topLeftCorner: { x: rect.left + item.loc.topLeftCorner.x * scaleX, y: rect.top + item.loc.topLeftCorner.y * scaleY },
            topRightCorner: { x: rect.left + item.loc.topRightCorner.x * scaleX, y: rect.top + item.loc.topRightCorner.y * scaleY },
            bottomRightCorner: { x: rect.left + item.loc.bottomRightCorner.x * scaleX, y: rect.top + item.loc.bottomRightCorner.y * scaleY },
            bottomLeftCorner: { x: rect.left + item.loc.bottomLeftCorner.x * scaleX, y: rect.top + item.loc.bottomLeftCorner.y * scaleY }
          },
          rect,
          element: el,
          isDom: true
        }));
      }
    } else if (el.tagName === "CANVAS") {
      if (el._qrRadarTainted) return [];
      width = el.width;
      height = el.height;
      if (el._qrRadarIsStatic && el._qrRadarCached !== void 0 && (el._qrRadarSkipCount || 0) < 10) {
        el._qrRadarSkipCount = (el._qrRadarSkipCount || 0) + 1;
        if (!el._qrRadarCached || el._qrRadarCached.length === 0) return [];
        const rect = el.getBoundingClientRect();
        const scaleX = rect.width / el._qrRadarCachedW;
        const scaleY = rect.height / el._qrRadarCachedH;
        return el._qrRadarCached.map((item) => ({
          data: item.data,
          location: {
            topLeftCorner: { x: rect.left + item.loc.topLeftCorner.x * scaleX, y: rect.top + item.loc.topLeftCorner.y * scaleY },
            topRightCorner: { x: rect.left + item.loc.topRightCorner.x * scaleX, y: rect.top + item.loc.topRightCorner.y * scaleY },
            bottomRightCorner: { x: rect.left + item.loc.bottomRightCorner.x * scaleX, y: rect.top + item.loc.bottomRightCorner.y * scaleY },
            bottomLeftCorner: { x: rect.left + item.loc.bottomLeftCorner.x * scaleX, y: rect.top + item.loc.bottomLeftCorner.y * scaleY }
          },
          rect,
          element: el,
          isDom: true
        }));
      }
      el._qrRadarSkipCount = 0;
    } else if (el.tagName === "VIDEO") {
      if (el._qrRadarTainted) return [];
      if (el.readyState < 2 || !el.videoWidth || !el.videoHeight) return [];
      width = el.videoWidth;
      height = el.videoHeight;
      const currentTime = el.currentTime;
      if (el._qrRadarVideoTime === currentTime && el._qrRadarCached !== void 0) {
        if (!el._qrRadarCached || el._qrRadarCached.length === 0) return [];
        const rect = el.getBoundingClientRect();
        const scaleX = rect.width / el._qrRadarCachedW;
        const scaleY = rect.height / el._qrRadarCachedH;
        return el._qrRadarCached.map((item) => ({
          data: item.data,
          location: {
            topLeftCorner: { x: rect.left + item.loc.topLeftCorner.x * scaleX, y: rect.top + item.loc.topLeftCorner.y * scaleY },
            topRightCorner: { x: rect.left + item.loc.topRightCorner.x * scaleX, y: rect.top + item.loc.topRightCorner.y * scaleY },
            bottomRightCorner: { x: rect.left + item.loc.bottomRightCorner.x * scaleX, y: rect.top + item.loc.bottomRightCorner.y * scaleY },
            bottomLeftCorner: { x: rect.left + item.loc.bottomLeftCorner.x * scaleX, y: rect.top + item.loc.bottomLeftCorner.y * scaleY }
          },
          rect,
          element: el,
          isDom: true
        }));
      }
    } else {
      return [];
    }
    if (width < 20 || height < 20) return [];
    const effectiveMax = el.tagName === "VIDEO" ? Math.min(maxDimension, 720) : maxDimension;
    let scanW = width;
    let scanH = height;
    if (scanW > effectiveMax || scanH > effectiveMax) {
      const ratio = Math.min(effectiveMax / scanW, effectiveMax / scanH);
      scanW = Math.round(scanW * ratio);
      scanH = Math.round(scanH * ratio);
    }
    if (typeof document === "undefined") return [];
    const buffer = getOffscreenCanvas(scanW, scanH);
    if (!buffer || !buffer.ctx) return [];
    const { canvas, ctx } = buffer;
    try {
      ctx.drawImage(el, 0, 0, scanW, scanH);
      let imgData = ctx.getImageData(0, 0, scanW, scanH);
      if (el.tagName === "CANVAS") {
        const p2 = imgData.data;
        const step = Math.max(1, Math.floor(p2.length / 32));
        let hash = 2166136261;
        for (let i2 = 0; i2 < p2.length; i2 += step) {
          hash = (hash ^ p2[i2]) * 16777619 >>> 0;
        }
        if (el._qrRadarCachedHash === hash && el._qrRadarCached !== void 0) {
          el._qrRadarStaticHits = (el._qrRadarStaticHits || 0) + 1;
          if (el._qrRadarStaticHits >= 2) {
            el._qrRadarIsStatic = true;
          }
          if (!el._qrRadarCached || el._qrRadarCached.length === 0) return [];
          const rect = el.getBoundingClientRect();
          const scaleX = rect.width / el._qrRadarCachedW;
          const scaleY = rect.height / el._qrRadarCachedH;
          return el._qrRadarCached.map((item) => ({
            data: item.data,
            location: {
              topLeftCorner: { x: rect.left + item.loc.topLeftCorner.x * scaleX, y: rect.top + item.loc.topLeftCorner.y * scaleY },
              topRightCorner: { x: rect.left + item.loc.topRightCorner.x * scaleX, y: rect.top + item.loc.topRightCorner.y * scaleY },
              bottomRightCorner: { x: rect.left + item.loc.bottomRightCorner.x * scaleX, y: rect.top + item.loc.bottomRightCorner.y * scaleY },
              bottomLeftCorner: { x: rect.left + item.loc.bottomLeftCorner.x * scaleX, y: rect.top + item.loc.bottomLeftCorner.y * scaleY }
            },
            rect,
            element: el,
            isDom: true
          }));
        }
        el._qrRadarCachedHash = hash;
        el._qrRadarStaticHits = 0;
        el._qrRadarIsStatic = false;
      }
      const found = [];
      try {
        ensureWasmConfigured();
        const results = await k2(
          { data: imgData.data, width: scanW, height: scanH },
          { formats: ["QRCode"], maxNumberOfSymbols: 4, tryHarder: true }
        );
        if (Array.isArray(results) && results.length > 0) {
          const rect = el.getBoundingClientRect();
          const scaleX = rect.width / scanW;
          const scaleY = rect.height / scanH;
          for (const code of results) {
            if (!code.text || !code.position) continue;
            const location = {
              topLeftCorner: {
                x: rect.left + code.position.topLeft.x * scaleX,
                y: rect.top + code.position.topLeft.y * scaleY
              },
              topRightCorner: {
                x: rect.left + code.position.topRight.x * scaleX,
                y: rect.top + code.position.topRight.y * scaleY
              },
              bottomRightCorner: {
                x: rect.left + code.position.bottomRight.x * scaleX,
                y: rect.top + code.position.bottomRight.y * scaleY
              },
              bottomLeftCorner: {
                x: rect.left + code.position.bottomLeft.x * scaleX,
                y: rect.top + code.position.bottomLeft.y * scaleY
              }
            };
            found.push({
              data: code.text,
              location,
              rect,
              element: el,
              isDom: true
            });
          }
        }
      } catch (err) {
        console.warn("[QR Radar] scanMediaElement decode error:", err);
      }
      if (el.tagName === "IMG" || el.tagName === "VIDEO" || el.tagName === "CANVAS") {
        const currentSrc = el.currentSrc || el.src;
        el._qrRadarCachedSrc = currentSrc;
        el._qrRadarCachedW = scanW;
        el._qrRadarCachedH = scanH;
        if (el.tagName === "VIDEO") el._qrRadarVideoTime = el.currentTime;
        el._qrRadarCached = found.map((f2) => ({
          data: f2.data,
          loc: {
            topLeftCorner: { x: (f2.location.topLeftCorner.x - f2.rect.left) * (scanW / f2.rect.width), y: (f2.location.topLeftCorner.y - f2.rect.top) * (scanH / f2.rect.height) },
            topRightCorner: { x: (f2.location.topRightCorner.x - f2.rect.left) * (scanW / f2.rect.width), y: (f2.location.topRightCorner.y - f2.rect.top) * (scanH / f2.rect.height) },
            bottomRightCorner: { x: (f2.location.bottomRightCorner.x - f2.rect.left) * (scanW / f2.rect.width), y: (f2.location.bottomRightCorner.y - f2.rect.top) * (scanH / f2.rect.height) },
            bottomLeftCorner: { x: (f2.location.bottomLeftCorner.x - f2.rect.left) * (scanW / f2.rect.width), y: (f2.location.bottomLeftCorner.y - f2.rect.top) * (scanH / f2.rect.height) }
          }
        }));
      }
      return found;
    } catch (err) {
      if (el.tagName === "IMG" && (el.currentSrc || el.src)) {
        const src = el.currentSrc || el.src;
        if (src.startsWith("http://") || src.startsWith("https://")) {
          return scanRemoteImageViaBackground(el, src);
        }
      }
      console.warn(`[QR Radar] scanMediaElement failed for ${el.tagName}#${el.id || "?"} (${scanW}x${scanH}):`, err?.message || err);
      el._qrRadarTainted = true;
      offscreenCanvas = null;
      offscreenCtx = null;
      return [];
    }
  }
  async function scanRemoteImageViaBackground(el, src) {
    if (typeof browser === "undefined" || !browser.runtime || !browser.runtime.sendMessage) {
      return [];
    }
    if (el._qrRadarFetchingRemote) {
      return [];
    }
    el._qrRadarFetchingRemote = true;
    try {
      const response = await browser.runtime.sendMessage({
        type: "SCAN_REMOTE_IMAGE",
        url: src
      });
      el._qrRadarFetchingRemote = false;
      const remoteQrs = response?.qrs || [];
      const rect = el.getBoundingClientRect();
      el._qrRadarCachedSrc = src;
      el._qrRadarCachedW = el.naturalWidth || rect.width;
      el._qrRadarCachedH = el.naturalHeight || rect.height;
      el._qrRadarCached = remoteQrs.map((q2) => ({
        data: q2.data,
        loc: {
          topLeftCorner: { x: q2.relLoc.topLeftCorner.x * el._qrRadarCachedW, y: q2.relLoc.topLeftCorner.y * el._qrRadarCachedH },
          topRightCorner: { x: q2.relLoc.topRightCorner.x * el._qrRadarCachedW, y: q2.relLoc.topRightCorner.y * el._qrRadarCachedH },
          bottomRightCorner: { x: q2.relLoc.bottomRightCorner.x * el._qrRadarCachedW, y: q2.relLoc.bottomRightCorner.y * el._qrRadarCachedH },
          bottomLeftCorner: { x: q2.relLoc.bottomLeftCorner.x * el._qrRadarCachedW, y: q2.relLoc.bottomLeftCorner.y * el._qrRadarCachedH }
        }
      }));
      return remoteQrs.map((item) => ({
        data: item.data,
        location: {
          topLeftCorner: { x: rect.left + item.relLoc.topLeftCorner.x * rect.width, y: rect.top + item.relLoc.topLeftCorner.y * rect.height },
          topRightCorner: { x: rect.left + item.relLoc.topRightCorner.x * rect.width, y: rect.top + item.relLoc.topRightCorner.y * rect.height },
          bottomRightCorner: { x: rect.left + item.relLoc.bottomRightCorner.x * rect.width, y: rect.top + item.relLoc.bottomRightCorner.y * rect.height },
          bottomLeftCorner: { x: rect.left + item.relLoc.bottomLeftCorner.x * rect.width, y: rect.top + item.relLoc.bottomLeftCorner.y * rect.height }
        },
        rect,
        element: el,
        isDom: true
      }));
    } catch (e2) {
      el._qrRadarFetchingRemote = false;
      el._qrRadarTainted = true;
      return [];
    }
  }
  async function scanVisibleDomImages() {
    if (typeof document === "undefined") return [];
    const elements = Array.from(document.querySelectorAll("img, canvas"));
    const allResults = [];
    for (const el of elements) {
      if (isElementInViewport(el)) {
        const results = await scanMediaElement(el);
        if (Array.isArray(results) && results.length > 0) {
          allResults.push(...results);
        }
      }
    }
    return allResults;
  }
  function getVisibleVideoRects() {
    if (typeof document === "undefined") return [];
    const videos = Array.from(document.querySelectorAll("video"));
    const rects = [];
    for (const v2 of videos) {
      if (isElementInViewport(v2)) {
        const r2 = v2.getBoundingClientRect();
        if (r2.width > 20 && r2.height > 20) {
          rects.push({
            left: Math.round(r2.left),
            top: Math.round(r2.top),
            width: Math.round(r2.width),
            height: Math.round(r2.height),
            isTainted: !!v2._qrRadarTainted
          });
        }
      }
    }
    return rects;
  }

  // src/content/overlay.js
  var QRBoxTracker = class {
    constructor(id, root, options, callbacks = {}) {
      this.id = id;
      this.root = root;
      this.options = options;
      this.callbacks = callbacks;
      this.boxElement = null;
      this.hudCard = null;
      this.miniBadge = null;
      this.currentLocation = null;
      this.cachedBounds = null;
      this.lastDetectedText = null;
      this.anchorElement = null;
      this.anchorOffset = null;
      this.docBounds = null;
      this.isDomLocked = false;
      this.isFixed = false;
      this._isFixedForAnchor = null;
      this.missingFrames = 0;
      this.maxMissingFrames = 2;
      this.lastWidth = 0;
      this.lastHeight = 0;
      this.lastX = null;
      this.lastY = null;
      this.lastDocLeft = null;
      this.lastDocTop = null;
      this.lastDocWidth = null;
      this.lastDocHeight = null;
      this.createDom();
    }
    /**
     * Builds the DOM elements for this box.
     */
    createDom() {
      this.boxElement = document.createElement("div");
      this.boxElement.className = "qr-radar-box qr-hidden";
      this.boxElement.dataset.trackerId = this.id;
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
    }
    /**
     * Updates tracker position and content.
     * @param {any} targetLoc
     * @param {string} text
     * @param {HTMLElement} [anchorEl=null]
     * @param {boolean} [isDom=false]
     */
    update(targetLoc, text, anchorEl = null, isDom = false) {
      if (!this.boxElement) return;
      this.missingFrames = 0;
      this.boxElement.classList.remove("qr-hidden");
      if (isDom) {
        this.isDomLocked = true;
        if (anchorEl) this.anchorElement = anchorEl;
      }
      const shouldSnap = !this.currentLocation || isDom || this.currentLocation && distance(this.currentLocation.topLeftCorner, targetLoc.topLeftCorner) > 20;
      this.currentLocation = shouldSnap ? targetLoc : lerpLocation(this.currentLocation, targetLoc, 0.6);
      const bounds = computeBounds(this.currentLocation);
      this.cachedBounds = bounds;
      const prevAnchor = this.anchorElement;
      if (!this.anchorElement || !this.anchorElement.isConnected) {
        this.anchorElement = anchorEl || findAnchorElement(bounds.centerX, bounds.centerY);
      }
      const isStaticImg = this.anchorElement && this.anchorElement.tagName === "IMG";
      if (!this.anchorOffset || !isStaticImg || this.anchorElement !== prevAnchor) {
        this.anchorOffset = computeAnchorOffset(this.anchorElement, bounds);
      }
      if (this.anchorElement !== this._isFixedForAnchor) {
        this._isFixedForAnchor = this.anchorElement;
        this.isFixed = isElementFixed(this.anchorElement);
        if (this.isFixed) {
          this.boxElement.classList.add("qr-fixed-anchor");
        } else {
          this.boxElement.classList.remove("qr-fixed-anchor");
        }
      }
      const isFullscreen = typeof document !== "undefined" && !!document.fullscreenElement;
      const scrollX = !isFullscreen && typeof window !== "undefined" ? window.pageXOffset || window.scrollX || 0 : 0;
      const scrollY = !isFullscreen && typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
      this.docBounds = {
        docX: bounds.minX + scrollX,
        docY: bounds.minY + scrollY,
        width: bounds.width,
        height: bounds.height
      };
      const isFixedPos = this.isFixed || isFullscreen;
      const targetX = isFixedPos ? bounds.minX : this.docBounds.docX;
      const targetY = isFixedPos ? bounds.minY : this.docBounds.docY;
      this.applyPosition(targetX, targetY, bounds.width, bounds.height, true, isFixedPos);
      if (text !== this.lastDetectedText) {
        const isInitial = this.lastDetectedText === null;
        this.lastDetectedText = text;
        this.renderCardContent(text);
        if (isInitial && this.callbacks.onNew) {
          this.callbacks.onNew(text);
        }
      }
    }
    /**
     * Applies position and card orientation using GPU compositor.
     */
    applyPosition(x2, y2, width, height, isVisible, isFixed = false) {
      if (!this.boxElement) return;
      if (!isVisible) {
        this.boxElement.style.visibility = "hidden";
        return;
      }
      this.boxElement.style.visibility = "visible";
      const rx = Math.round(x2 * 10) / 10;
      const ry = Math.round(y2 * 10) / 10;
      if (this.lastX !== rx || this.lastY !== ry) {
        this.lastX = rx;
        this.lastY = ry;
        this.boxElement.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      }
      if (width > 0 && this.lastWidth !== width) {
        this.lastWidth = width;
        this.boxElement.style.width = `${Math.round(width)}px`;
      }
      if (height > 0 && this.lastHeight !== height) {
        this.lastHeight = height;
        this.boxElement.style.height = `${Math.round(height)}px`;
      }
      const effW = width || this.lastWidth || 0;
      const effH = height || this.lastHeight || 0;
      const minDim = Math.min(effW, effH);
      if (minDim > 0) {
        if (minDim < 60) {
          this.boxElement.classList.add("qr-tiny");
          this.boxElement.classList.remove("qr-small");
        } else if (minDim < 110) {
          this.boxElement.classList.add("qr-small");
          this.boxElement.classList.remove("qr-tiny");
        } else {
          this.boxElement.classList.remove("qr-small", "qr-tiny");
        }
      }
      const scrollY = typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
      const viewportY = isFixed ? y2 : y2 - scrollY;
      const spaceBelow = (typeof window !== "undefined" ? window.innerHeight : 1080) - (viewportY + (height || 0));
      if (this.hudCard) {
        const isFlipped = this.hudCard.classList.contains("qr-flipped");
        if (isFlipped) {
          if (spaceBelow > 220) {
            this.hudCard.classList.remove("qr-flipped");
          }
        } else {
          if (spaceBelow < 140) {
            this.hudCard.classList.add("qr-flipped");
          }
        }
      }
    }
    /**
     * High-frequency rAF position sync: tracks moving/animating anchor elements.
     * Compares previous rect coordinates to eliminate layout thrashing if still.
     */
    updateLivePosition() {
      if (!this.boxElement || this.boxElement.classList.contains("qr-hidden")) {
        return;
      }
      if (this.anchorElement) {
        if (!this.anchorElement.isConnected) {
          this.boxElement.classList.add("qr-hidden");
          return;
        }
        if (this.anchorElement.hidden || this.anchorElement.style?.display === "none" || this.anchorElement.style?.visibility === "hidden" || this.anchorElement.style?.opacity === "0") {
          this.boxElement.classList.add("qr-hidden");
          return;
        }
      }
      const isTrackedMedia = this.anchorElement && (this.anchorElement.tagName === "IMG" || this.anchorElement.tagName === "VIDEO");
      if (isTrackedMedia && this.anchorElement.isConnected && this.anchorOffset) {
        const isFullscreen = typeof document !== "undefined" && !!document.fullscreenElement;
        const isFixedPos = this.isFixed || isFullscreen;
        const rect = this.anchorElement.getBoundingClientRect();
        const scrollX = !isFullscreen && typeof window !== "undefined" ? window.pageXOffset || window.scrollX || 0 : 0;
        const scrollY = !isFullscreen && typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
        const docLeft = isFixedPos ? rect.left : rect.left + scrollX;
        const docTop = isFixedPos ? rect.top : rect.top + scrollY;
        if (docLeft === this.lastDocLeft && docTop === this.lastDocTop && rect.width === this.lastDocWidth && rect.height === this.lastDocHeight) {
          return;
        }
        this.lastDocLeft = docLeft;
        this.lastDocTop = docTop;
        this.lastDocWidth = rect.width;
        this.lastDocHeight = rect.height;
        const pos = resolveAnchorPosition(this.anchorElement, this.anchorOffset);
        if (pos) {
          const targetX = isFixedPos ? pos.x : pos.docX;
          const targetY = isFixedPos ? pos.y : pos.docY;
          this.applyPosition(targetX, targetY, pos.width, pos.height, pos.isVisible, isFixedPos);
        }
      }
    }
    /**
     * Scroll compensation for this box.
     */
    onScroll() {
      if (!this.boxElement || this.boxElement.classList.contains("qr-hidden")) {
        return;
      }
      if (this.hudCard && this.lastY !== null) {
        const scrollY = typeof window !== "undefined" ? window.pageYOffset || window.scrollY || 0 : 0;
        const viewportY = this.isFixed ? this.lastY : this.lastY - scrollY;
        const spaceBelow = (typeof window !== "undefined" ? window.innerHeight : 1080) - (viewportY + (this.lastHeight || 0));
        const isFlipped = this.hudCard.classList.contains("qr-flipped");
        if (isFlipped) {
          if (spaceBelow > 220) {
            this.hudCard.classList.remove("qr-flipped");
          }
        } else {
          if (spaceBelow < 140) {
            this.hudCard.classList.add("qr-flipped");
          }
        }
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
        copyBtn.addEventListener("click", (e2) => {
          e2.stopPropagation();
          if (this.callbacks.copy) {
            this.callbacks.copy(text, copyBtn);
          }
        });
      }
      if (this.miniBadge) {
        const typeLabels = {
          url: "URL",
          wifi: "WiFi",
          email: "Mail",
          phone: "Tel",
          sms: "SMS",
          geo: "Geo",
          text: "Text"
        };
        const typeText = typeLabels[parsed.type] || "QR";
        const typeSpan = this.miniBadge.querySelector(".qr-mini-type");
        if (typeSpan) typeSpan.textContent = typeText;
        this.miniBadge.className = `qr-radar-mini-badge qr-mini-${parsed.type}`;
      }
    }
    /**
     * Destroys tracker DOM element.
     */
    destroy() {
      if (this.boxElement && this.boxElement.parentNode) {
        this.boxElement.parentNode.removeChild(this.boxElement);
      }
      this.boxElement = null;
      this.hudCard = null;
      this.miniBadge = null;
      this.anchorElement = null;
      this.anchorOffset = null;
    }
  };
  var QROverlayManager = class {
    constructor(options = {}) {
      this.options = {
        soundEnabled: false,
        autoCopy: false,
        themeColor: "gold",
        cardDisplayMode: "hover",
        glowAnimation: false,
        cornerBrackets: true,
        onStopRequested: () => {
        },
        ...options
      };
      this.root = null;
      this.trackers = /* @__PURE__ */ new Map();
      this.rafId = null;
      this.isScrolling = false;
      this.scrollTimer = null;
      this.audioCtx = null;
      this.lastChimeTime = 0;
      this.fullscreenHandler = null;
    }
    /**
     * Applies CSS classes for themes, display mode, and animations to root overlay.
     */
    applySettingsClasses() {
      if (!this.root) return;
      this.root.className = [
        `theme-${this.options.themeColor || "gold"}`,
        `mode-${this.options.cardDisplayMode || "hover"}`,
        this.options.glowAnimation === false ? "no-glow" : "",
        this.options.cornerBrackets === false ? "no-brackets" : ""
      ].filter(Boolean).join(" ");
    }
    /**
     * Updates customizable options dynamically.
     */
    updateSettings(newSettings) {
      this.options = { ...this.options, ...newSettings };
      this.applySettingsClasses();
      for (const tracker of this.trackers.values()) {
        tracker.options = { ...tracker.options, ...newSettings };
        if (tracker.lastDetectedText) {
          tracker.renderCardContent(tracker.lastDetectedText);
        }
      }
    }
    /**
     * Sets up fullscreen listeners to keep overlay visible inside video players in fullscreen mode (e.g. YouTube).
     */
    setupFullscreenListener() {
      if (this.fullscreenHandler || typeof document === "undefined") return;
      this.fullscreenHandler = () => {
        const target = document.fullscreenElement || document.documentElement || document.body;
        if (this.root && target && this.root.parentElement !== target) {
          target.appendChild(this.root);
        }
        for (const tracker of this.trackers.values()) {
          tracker._isFixedForAnchor = null;
          tracker.lastDocLeft = null;
          tracker.lastDocTop = null;
        }
      };
      document.addEventListener("fullscreenchange", this.fullscreenHandler);
      document.addEventListener("webkitfullscreenchange", this.fullscreenHandler);
    }
    /**
     * Initializes overlay DOM structure.
     */
    mount() {
      if (this.root && this.root.isConnected) return;
      if (!this.root) {
        this.root = document.createElement("div");
        this.root.id = "qr-radar-root";
        this.applySettingsClasses();
      }
      const mountTarget = document.fullscreenElement || document.documentElement || document.body;
      if (mountTarget && this.root.parentElement !== mountTarget) {
        mountTarget.appendChild(this.root);
      }
      this.setupFullscreenListener();
    }
    /**
     * Synchronizes detected items (from either DOM scanner or Screen capture).
     * Smart deduplication: keeps DOM anchor priority, prevents live & DOM fight.
     * @param {Array<{ data: string, location: any, element?: HTMLElement, isDom?: boolean }>} items
     * @param {'dom' | 'screen'} source
     */
    syncTrackers(items, source) {
      if (!this.root) this.mount();
      const matchedTrackerIds = /* @__PURE__ */ new Set();
      for (const item of items) {
        if (!item || !item.data || !item.location) continue;
        const itemBounds = computeBounds(item.location);
        let matchedTracker = null;
        for (const tracker of this.trackers.values()) {
          const isSameText = tracker.lastDetectedText === item.data;
          const isNear = tracker.cachedBounds && areBoundsNear(tracker.cachedBounds, itemBounds, 90);
          if (isSameText || isNear) {
            matchedTracker = tracker;
            break;
          }
        }
        if (matchedTracker) {
          matchedTrackerIds.add(matchedTracker.id);
          if (matchedTracker.isDomLocked && source === "screen") {
            matchedTracker.missingFrames = 0;
          } else {
            matchedTracker.update(item.location, item.data, item.element || null, source === "dom");
          }
        } else {
          const trackerId = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const tracker = new QRBoxTracker(trackerId, this.root, this.options, {
            onNew: (text) => this.onNewQRAcquired(text),
            copy: (text, btn) => this.copyToClipboard(text, btn)
          });
          tracker.update(item.location, item.data, item.element || null, source === "dom");
          this.trackers.set(trackerId, tracker);
          matchedTrackerIds.add(trackerId);
        }
      }
      for (const [id, tracker] of this.trackers.entries()) {
        if (!matchedTrackerIds.has(id)) {
          if (source === "dom" && !tracker.isDomLocked) {
            continue;
          }
          if (source === "screen" && tracker.isDomLocked) {
            if (tracker.anchorElement && isElementInViewport(tracker.anchorElement)) {
              continue;
            }
          }
          tracker.missingFrames++;
          if (tracker.missingFrames >= 2 && tracker.boxElement) {
            tracker.boxElement.classList.add("qr-hidden");
          }
          if (tracker.missingFrames > 5) {
            tracker.destroy();
            this.trackers.delete(id);
          }
        }
      }
      if (this.trackers.size > 0) {
        this.startTrackingLoop();
      } else {
        this.stopTrackingLoop();
      }
    }
    /**
     * Updates from full screen screenshot capture.
     * @param {any[]} qrResults
     * @param {number} scanWidth
     * @param {number} scanHeight
     */
    updateFromScreen(qrResults, scanWidth, scanHeight) {
      if (this.isScrolling) {
        return;
      }
      if (!qrResults || !Array.isArray(qrResults) || qrResults.length === 0) {
        this.onScreenQrNotFound();
        return;
      }
      const scaleX = window.innerWidth / scanWidth;
      const scaleY = window.innerHeight / scanHeight;
      const items = qrResults.map((qr) => {
        const rawLoc = qr.location;
        const location = {
          topLeftCorner: { x: rawLoc.topLeftCorner.x * scaleX, y: rawLoc.topLeftCorner.y * scaleY },
          topRightCorner: { x: rawLoc.topRightCorner.x * scaleX, y: rawLoc.topRightCorner.y * scaleY },
          bottomRightCorner: { x: rawLoc.bottomRightCorner.x * scaleX, y: rawLoc.bottomRightCorner.y * scaleY },
          bottomLeftCorner: { x: rawLoc.bottomLeftCorner.x * scaleX, y: rawLoc.bottomLeftCorner.y * scaleY }
        };
        return {
          data: qr.data,
          location,
          isDom: false
        };
      });
      this.syncTrackers(items, "screen");
    }
    /**
     * Updates from in-page DOM image scanning.
     * @param {Array<{ data: string, location: any, element: HTMLElement }>} domResults
     */
    updateFromDom(domResults) {
      if (!domResults || !Array.isArray(domResults)) return;
      this.syncTrackers(domResults, "dom");
    }
    /**
     * Called when screen capture found 0 QR codes.
     * Does NOT wipe DOM-anchored images that are still visible!
     */
    onScreenQrNotFound() {
      for (const [id, tracker] of this.trackers.entries()) {
        if (tracker.isDomLocked) {
          continue;
        }
        tracker.missingFrames++;
        if (tracker.missingFrames >= 2 && tracker.boxElement) {
          tracker.boxElement.classList.add("qr-hidden");
        }
        if (tracker.missingFrames > 5) {
          tracker.destroy();
          this.trackers.delete(id);
        }
      }
    }
    /**
     * Legacy single-QR update bridge.
     * @param {any} qrResult
     * @param {number} [scaleX=1]
     * @param {number} [scaleY=1]
     * @param {HTMLElement} [knownAnchor=null]
     */
    update(qrResult, scaleX = 1, scaleY = 1, knownAnchor = null) {
      if (!qrResult) {
        this.onScreenQrNotFound();
        return;
      }
      if (knownAnchor) {
        this.updateFromDom([{
          data: qrResult.data,
          location: qrResult.location,
          element: knownAnchor,
          isDom: true
        }]);
      } else {
        const scanWidth = window.innerWidth / scaleX;
        const scanHeight = window.innerHeight / scaleY;
        this.updateFromScreen([qrResult], scanWidth, scanHeight);
      }
    }
    /**
     * 60/120 FPS Real-time scroll compensation across all active trackers.
     */
    onScroll() {
      this.isScrolling = true;
      if (this.scrollTimer) clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        this.isScrolling = false;
      }, 130);
      for (const tracker of this.trackers.values()) {
        tracker.onScroll();
      }
    }
    /**
     * Triggered when a new QR code is acquired.
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
      const now = Date.now();
      if (this.options.soundEnabled && now - this.lastChimeTime > 250) {
        this.lastChimeTime = now;
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
     * Monitor refresh rate (60/120/144 Hz) position tracking loop.
     * Only active while visible trackers exist on screen (0% idle CPU).
     */
    startTrackingLoop() {
      if (this.rafId || typeof requestAnimationFrame === "undefined") return;
      const tick = () => {
        if (!this.root || this.trackers.size === 0) {
          this.rafId = null;
          return;
        }
        let activeCount = 0;
        for (const tracker of this.trackers.values()) {
          if (!tracker.boxElement || tracker.boxElement.classList.contains("qr-hidden")) {
            continue;
          }
          activeCount++;
          tracker.updateLivePosition();
        }
        if (activeCount > 0) {
          this.rafId = requestAnimationFrame(tick);
        } else {
          this.rafId = null;
        }
      };
      this.rafId = requestAnimationFrame(tick);
    }
    stopTrackingLoop() {
      if (this.rafId && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    /**
     * Unmounts overlay and cleans up all trackers.
     */
    unmount() {
      this.stopTrackingLoop();
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer);
        this.scrollTimer = null;
      }
      for (const tracker of this.trackers.values()) {
        tracker.destroy();
      }
      this.trackers.clear();
      if (this.fullscreenHandler && typeof document !== "undefined") {
        document.removeEventListener("fullscreenchange", this.fullscreenHandler);
        document.removeEventListener("webkitfullscreenchange", this.fullscreenHandler);
        this.fullscreenHandler = null;
      }
      if (this.root && this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
      this.root = null;
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
  var domScanInterval = null;
  var domObserver = null;
  var domMutationDebounce = null;
  var lastReportedVideoKey = "";
  var cachedContentSettings = null;
  var settingsCacheTime = 0;
  var SETTINGS_CACHE_TTL = 5e3;
  async function getCachedContentSettings() {
    const now = Date.now();
    if (!cachedContentSettings || now - settingsCacheTime > SETTINGS_CACHE_TTL) {
      cachedContentSettings = await getSettings();
      settingsCacheTime = now;
    }
    return cachedContentSettings;
  }
  var lastVideoRectsReportTime = 0;
  var videoResizeObserver = null;
  function observeVideoElement(v2) {
    if (typeof ResizeObserver === "undefined" || !v2) return;
    if (!videoResizeObserver) {
      videoResizeObserver = new ResizeObserver(() => {
        reportVisibleVideoRects(true);
      });
    }
    try {
      videoResizeObserver.observe(v2);
    } catch {
    }
  }
  function reportVisibleVideoRects(force = false) {
    const now = Date.now();
    if (!force && now - lastVideoRectsReportTime < 500) return;
    lastVideoRectsReportTime = now;
    const rects = getVisibleVideoRects();
    const key = rects.map((r2) => `${r2.left},${r2.top},${r2.width},${r2.height}`).join(";");
    if (!force && key === lastReportedVideoKey) {
      return;
    }
    lastReportedVideoKey = key;
    if (typeof document !== "undefined") {
      const vids = document.querySelectorAll("video");
      for (const v2 of vids) {
        observeVideoElement(v2);
      }
    }
    try {
      browser.runtime.sendMessage({
        type: "VIDEO_RECTS_UPDATE",
        rects,
        dpr: window.devicePixelRatio || 1,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      }).catch(() => {
      });
    } catch {
    }
  }
  function getDomScanIntervalMs(scanRate) {
    const fps = Math.max(1, Math.min(15, Math.round((Number(scanRate) || 12) / 2)));
    return Math.round(1e3 / fps);
  }
  function updateDomScanRate(scanRate) {
    if (domScanInterval) {
      clearInterval(domScanInterval);
      domScanInterval = null;
    }
    if (isMounted) {
      const intervalMs = getDomScanIntervalMs(scanRate);
      domScanInterval = setInterval(triggerDomScan, intervalMs);
    }
  }
  async function triggerDomScan() {
    if (!isMounted) return;
    const settings = await getCachedContentSettings();
    if (settings.scanDomImages === false) return;
    reportVisibleVideoRects();
    const results = await scanVisibleDomImages();
    if (Array.isArray(results)) {
      if (results.length > 0) {
        if (!overlay) {
          await initOverlay();
        }
        if (overlay) {
          overlay.updateFromDom(results);
        }
        try {
          browser.runtime.sendMessage({
            type: "DOM_QR_DETECTED",
            qrData: results[0].data
          }).catch(() => {
          });
        } catch {
        }
      } else if (overlay) {
        overlay.updateFromDom([]);
      }
    }
  }
  function setupDomObserver() {
    if (domObserver || typeof MutationObserver === "undefined") return;
    domObserver = new MutationObserver((mutations) => {
      let hasRelevantMutation = false;
      for (const m2 of mutations) {
        if (m2.type === "childList") {
          for (const node of m2.addedNodes) {
            if (node.nodeType === 1 && (node.tagName === "IMG" || node.tagName === "VIDEO" || node.tagName === "CANVAS" || node.querySelector?.("img, video, canvas"))) {
              hasRelevantMutation = true;
              break;
            }
          }
        } else if (m2.type === "attributes" && (m2.attributeName === "src" || m2.attributeName === "srcset")) {
          hasRelevantMutation = true;
          break;
        }
        if (hasRelevantMutation) break;
      }
      if (!hasRelevantMutation) return;
      clearTimeout(domMutationDebounce);
      domMutationDebounce = setTimeout(() => {
        reportVisibleVideoRects();
        triggerDomScan();
      }, 200);
    });
    if (document.body) {
      domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "srcset"]
      });
    }
  }
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
      scanRate: settings.scanRate || 2,
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
    reportVisibleVideoRects();
    if (settings.scanDomImages !== false) {
      setupDomObserver();
      triggerDomScan();
      updateDomScanRate(settings.scanRate || 2);
    }
    return overlay;
  }
  function teardownOverlay() {
    if (domScanInterval) {
      clearInterval(domScanInterval);
      domScanInterval = null;
    }
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
    clearTimeout(domMutationDebounce);
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
          const qrs = message.qrResults || (message.qrResult ? [message.qrResult] : []);
          if (!overlay) {
            initOverlay().then((ov) => {
              ov.updateFromScreen(qrs, message.scanWidth, message.scanHeight);
            });
          } else {
            overlay.updateFromScreen(qrs, message.scanWidth, message.scanHeight);
          }
          sendResponse({ received: true });
          return false;
        }
        case "QR_NOT_FOUND": {
          if (overlay) {
            overlay.onScreenQrNotFound();
          }
          sendResponse({ received: true });
          return false;
        }
        case "SETTINGS_UPDATED": {
          cachedContentSettings = message.settings || null;
          settingsCacheTime = message.settings ? Date.now() : 0;
          if (overlay && message.settings) {
            overlay.updateSettings(message.settings);
          }
          if (message.settings) {
            if (message.settings.scanDomImages === false) {
              if (domScanInterval) {
                clearInterval(domScanInterval);
                domScanInterval = null;
              }
              if (domObserver) {
                domObserver.disconnect();
                domObserver = null;
              }
            } else if (message.settings.scanDomImages === true || isMounted) {
              setupDomObserver();
              triggerDomScan();
              updateDomScanRate(message.settings.scanRate);
            }
          }
          sendResponse({ success: true });
          return false;
        }
      }
    });
  }
  var scrollNotifyTimer = null;
  var isScrollingActive = false;
  window.addEventListener("scroll", () => {
    if (overlay) {
      overlay.onScroll();
    }
    if (!isScrollingActive) {
      isScrollingActive = true;
      try {
        browser.runtime.sendMessage({ type: "SCROLL_START" }).catch(() => {
        });
      } catch {
      }
    }
    clearTimeout(scrollNotifyTimer);
    scrollNotifyTimer = setTimeout(() => {
      isScrollingActive = false;
      try {
        browser.runtime.sendMessage({ type: "SCROLL_END" }).catch(() => {
        });
      } catch {
      }
      reportVisibleVideoRects();
      triggerDomScan();
    }, 140);
  }, { passive: true });
  window.addEventListener("resize", () => {
    reportVisibleVideoRects(true);
    if (overlay) {
      overlay.onScroll();
    }
  }, { passive: true });
  var onFullscreenChange = () => {
    reportVisibleVideoRects(true);
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  function onSpaNavigation() {
    getCachedContentSettings().then((settings) => {
      if (settings && settings.globalActive) {
        if (!overlay) {
          initOverlay();
        } else {
          reportVisibleVideoRects();
          triggerDomScan();
        }
      }
    }).catch(() => {
    });
  }
  window.addEventListener("yt-navigate-finish", onSpaNavigation);
  window.addEventListener("popstate", onSpaNavigation);
  window.addEventListener("hashchange", onSpaNavigation);
  window.addEventListener("keydown", (e2) => {
    if (e2.altKey && (e2.key === "q" || e2.key === "\u0439" || e2.key === "Q" || e2.key === "\u0419")) {
      e2.preventDefault();
      try {
        browser.runtime.sendMessage({ type: "TOGGLE_SCAN" }).catch(() => {
        });
      } catch {
      }
    }
  });
  getSettings().then((settings) => {
    if (settings && settings.globalActive) {
      initOverlay();
    }
  }).catch(() => {
  });
})();
