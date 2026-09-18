/**
 * Content classifier and parser for QR Code payloads.
 * Modular, pure functions with zero browser-specific dependencies.
 */

/**
 * Classifies and parses raw QR code content into a structured object.
 * @param {string} raw - The raw decoded string from QR code.
 * @returns {{
 *   type: 'url' | 'wifi' | 'email' | 'phone' | 'sms' | 'geo' | 'text',
 *   raw: string,
 *   title: string,
 *   summary: string,
 *   metadata?: Record<string, any>,
 *   actionUrl?: string
 * }}
 */
export function classifyContent(raw) {
  if (typeof raw !== 'string') {
    return {
      type: 'text',
      raw: '',
      title: 'Empty',
      summary: ''
    };
  }

  const trimmed = raw.trim();

  // 1. URL Check
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return {
        type: 'url',
        raw: trimmed,
        title: url.hostname,
        summary: trimmed,
        actionUrl: trimmed
      };
    } catch {
      // Invalid URL syntax, fall through
    }
  }

  // 2. WiFi Config (e.g. WIFI:S:MyNetwork;T:WPA;P:secret123;H:false;;)
  if (/^WIFI:/i.test(trimmed)) {
    const wifiData = parseWifiString(trimmed);
    return {
      type: 'wifi',
      raw: trimmed,
      title: wifiData.ssid ? `WiFi: ${wifiData.ssid}` : 'WiFi Network',
      summary: wifiData.ssid ? `SSID: ${wifiData.ssid} (${wifiData.type || 'Open'})` : trimmed,
      metadata: wifiData
    };
  }

  // 3. Email (mailto:... or standard email address)
  if (/^mailto:/i.test(trimmed) || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    const email = trimmed.replace(/^mailto:/i, '').split('?')[0];
    return {
      type: 'email',
      raw: trimmed,
      title: `Email: ${email}`,
      summary: email,
      actionUrl: trimmed.startsWith('mailto:') ? trimmed : `mailto:${email}`
    };
  }

  // 4. Phone (tel:... or plain international phone format)
  if (/^tel:/i.test(trimmed) || /^\+?[0-9\s\-()]{7,20}$/.test(trimmed)) {
    const phone = trimmed.replace(/^tel:/i, '').trim();
    return {
      type: 'phone',
      raw: trimmed,
      title: `Call: ${phone}`,
      summary: phone,
      actionUrl: `tel:${phone.replace(/\s+/g, '')}`
    };
  }

  // 5. SMS (smsto:... or sms:...)
  if (/^(smsto|sms):/i.test(trimmed)) {
    const parts = trimmed.replace(/^(smsto|sms):/i, '').split(':');
    const number = parts[0] || '';
    const body = parts.slice(1).join(':') || '';
    return {
      type: 'sms',
      raw: trimmed,
      title: `SMS: ${number}`,
      summary: body ? `${number} — "${body}"` : number,
      metadata: { number, body },
      actionUrl: trimmed
    };
  }

  // 6. Geo Location (geo:lat,lng or geo:lat,lng,alt)
  if (/^geo:/i.test(trimmed)) {
    const coords = trimmed.replace(/^geo:/i, '').split('?')[0].split(',');
    const lat = parseFloat(coords[0]);
    const lng = parseFloat(coords[1]);
    const isValid = !isNaN(lat) && !isNaN(lng);
    return {
      type: 'geo',
      raw: trimmed,
      title: isValid ? `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Location',
      summary: trimmed,
      metadata: isValid ? { lat, lng } : {},
      actionUrl: isValid ? `https://www.google.com/maps?q=${lat},${lng}` : undefined
    };
  }

  // 7. General Text / Fallback
  return {
    type: 'text',
    raw: trimmed,
    title: 'Text Snippet',
    summary: truncateString(trimmed, 90)
  };
}

/**
 * Parses WIFI:S:... string into an object.
 * @param {string} str
 */
export function parseWifiString(str) {
  const clean = str.replace(/^WIFI:/i, '');
  const result = {
    ssid: '',
    type: 'WPA',
    password: '',
    hidden: false
  };

  const regex = /([STPH]):((?:\\;|[^;])*);/gi;
  let match;
  while ((match = regex.exec(clean)) !== null) {
    const key = match[1].toUpperCase();
    const value = match[2].replace(/\\;/g, ';').replace(/\\\\/g, '\\');
    if (key === 'S') result.ssid = value;
    else if (key === 'T') result.type = value;
    else if (key === 'P') result.password = value;
    else if (key === 'H') result.hidden = value.toLowerCase() === 'true';
  }

  return result;
}

/**
 * Truncates string with ellipsis if exceeds max length.
 * @param {string} str
 * @param {number} max
 */
export function truncateString(str, max = 80) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}
