/**
 * DOM Media Scanner utility.
 * Inspects visible <img>, <canvas>, and media elements directly in the page
 * at full native resolution, bypassing screen downsampling and JPEG compression.
 */

import { readBarcodes } from 'zxing-wasm/reader';

let offscreenCanvas = null;
let offscreenCtx = null;

function getOffscreenCanvas(width, height) {
  if (typeof document === 'undefined') return null;
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
  }
  return { canvas: offscreenCanvas, ctx: offscreenCtx };
}

/**
 * Checks whether an element is roughly within the visible browser viewport and actually visible.
 * @param {HTMLElement} el
 * @param {number} [margin=50]
 * @returns {boolean}
 */
export function isElementInViewport(el, margin = 50) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;

  // Direct fast check for element hidden attributes or inline styles
  if (el.hidden || el.style?.display === 'none' || el.style?.visibility === 'hidden' || el.style?.opacity === '0') {
    return false;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width <= 12 || rect.height <= 12) return false;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  const inBounds = (
    rect.bottom >= -margin &&
    rect.top <= vh + margin &&
    rect.right >= -margin &&
    rect.left <= vw + margin
  );
  if (!inBounds) return false;

  // Native fast visibility check (avoids forced layout reflow)
  if (typeof el.checkVisibility === 'function') {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      return false;
    }
  } else if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0'
      ) {
        return false;
      }
    } catch {}
  }

  return true;
}

/**
 * Scans an individual <img> or <canvas> element for all QR codes at its full native resolution.
 * @param {HTMLImageElement | HTMLCanvasElement} el
 * @param {number} [maxDimension=1200]
 * @returns {Array<{ data: string, location: any, rect: DOMRect, element: HTMLElement }>}
 */
export async function scanMediaElement(el, maxDimension = 1200) {
  if (!el) return [];

  let width = 0;
  let height = 0;

  if (el.tagName === 'IMG') {
    if (el._qrRadarTainted) return [];
    if (!el.complete || !el.naturalWidth || !el.naturalHeight) return [];
    width = el.naturalWidth;
    height = el.naturalHeight;

    const currentSrc = el.currentSrc || el.src;
    if (el._qrRadarCached !== undefined && el._qrRadarCachedSrc === currentSrc) {
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
  } else if (el.tagName === 'CANVAS') {
    if (el._qrRadarTainted) return [];
    width = el.width;
    height = el.height;

    // Fast path: if canvas was verified static, reuse cached result directly without GPU readback
    if (el._qrRadarIsStatic && el._qrRadarCached !== undefined && (el._qrRadarSkipCount || 0) < 10) {
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
  } else if (el.tagName === 'VIDEO') {
    if (el._qrRadarTainted) return [];
    if (el.readyState < 2 || !el.videoWidth || !el.videoHeight) return [];
    width = el.videoWidth;
    height = el.videoHeight;

    // Per-frame cache: skip decode if video frame hasn't advanced since last scan
    // currentTime is a float in seconds; changes every rendered frame
    const currentTime = el.currentTime;
    if (el._qrRadarVideoTime === currentTime && el._qrRadarCached !== undefined) {
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

  // Skip tiny icons that cannot possibly be QR codes (< 20px)
  if (width < 20 || height < 20) return [];

  // Scale down for optimal speed/accuracy balance
  // IMG: cap at maxDimension (1200px default)
  // VIDEO: cap at 720px — high-res not needed, decoder works well at moderate resolution
  const effectiveMax = el.tagName === 'VIDEO' ? Math.min(maxDimension, 720) : maxDimension;
  let scanW = width;
  let scanH = height;
  if (scanW > effectiveMax || scanH > effectiveMax) {
    const ratio = Math.min(effectiveMax / scanW, effectiveMax / scanH);
    scanW = Math.round(scanW * ratio);
    scanH = Math.round(scanH * ratio);
  }

  if (typeof document === 'undefined') return [];

  const buffer = getOffscreenCanvas(scanW, scanH);
  if (!buffer || !buffer.ctx) return [];
  const { canvas, ctx } = buffer;

  try {
    ctx.drawImage(el, 0, 0, scanW, scanH);
    let imgData = ctx.getImageData(0, 0, scanW, scanH);

    // Fast canvas pixel fingerprint check (< 0.01 ms)
    if (el.tagName === 'CANVAS') {
      const p = imgData.data;
      const step = Math.max(1, Math.floor(p.length / 32));
      let hash = 0x811c9dc5;
      for (let i = 0; i < p.length; i += step) {
        hash = ((hash ^ p[i]) * 0x01000193) >>> 0;
      }

      if (el._qrRadarCachedHash === hash && el._qrRadarCached !== undefined) {
        // Content has not changed at all — promote to static after 2 consecutive identical frames
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
      const results = await readBarcodes(
        { data: imgData.data, width: scanW, height: scanH },
        { formats: ['QRCode'], maxNumberOfSymbols: 4, tryHarder: false }
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
      console.warn('[QR Radar] scanMediaElement decode error:', err);
    }

    if (el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS') {
      const currentSrc = el.currentSrc || el.src;
      el._qrRadarCachedSrc = currentSrc;
      el._qrRadarCachedW = scanW;
      el._qrRadarCachedH = scanH;
      // Store video frame timestamp for per-frame cache
      if (el.tagName === 'VIDEO') el._qrRadarVideoTime = el.currentTime;
      el._qrRadarCached = found.map((f) => ({
        data: f.data,
        loc: {
          topLeftCorner: { x: (f.location.topLeftCorner.x - f.rect.left) * (scanW / f.rect.width), y: (f.location.topLeftCorner.y - f.rect.top) * (scanH / f.rect.height) },
          topRightCorner: { x: (f.location.topRightCorner.x - f.rect.left) * (scanW / f.rect.width), y: (f.location.topRightCorner.y - f.rect.top) * (scanH / f.rect.height) },
          bottomRightCorner: { x: (f.location.bottomRightCorner.x - f.rect.left) * (scanW / f.rect.width), y: (f.location.bottomRightCorner.y - f.rect.top) * (scanH / f.rect.height) },
          bottomLeftCorner: { x: (f.location.bottomLeftCorner.x - f.rect.left) * (scanW / f.rect.width), y: (f.location.bottomLeftCorner.y - f.rect.top) * (scanH / f.rect.height) }
        }
      }));
    }

    return found;
  } catch (err) {
    // Cross-origin image (CORS) or tainted canvas - safely isolate
    console.warn(`[QR Radar] scanMediaElement failed for ${el.tagName}#${el.id || '?'} (${scanW}x${scanH}):`, err?.message || err);
    el._qrRadarTainted = true;
    // Reset canvas singleton so other elements are not poisoned
    offscreenCanvas = null;
    offscreenCtx = null;
    return [];
  }

}

/**
 * Scans all visible <img>, <canvas>, and <video> tags on the page.
 * @returns {Promise<Array<{ data: string, location: any, rect: DOMRect, element: HTMLElement, isDom: boolean }>>}
 */
export async function scanVisibleDomImages() {
  if (typeof document === 'undefined') return [];

  const elements = Array.from(document.querySelectorAll('img, canvas, video'));
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


/**
 * Collects bounding rects for all visible HTML5 <video> elements in the viewport.
 * Used for targeted high-resolution screen capture decoding.
 * @returns {Array<{ left: number, top: number, width: number, height: number, isTainted: boolean }>}
 */
export function getVisibleVideoRects() {
  if (typeof document === 'undefined') return [];

  const videos = Array.from(document.querySelectorAll('video'));
  const rects = [];

  for (const v of videos) {
    if (isElementInViewport(v)) {
      const r = v.getBoundingClientRect();
      if (r.width > 20 && r.height > 20) {
        rects.push({
          left: Math.round(r.left),
          top: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height),
          isTainted: !!v._qrRadarTainted
        });
      }
    }
  }

  return rects;
}
