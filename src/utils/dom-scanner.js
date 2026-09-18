/**
 * DOM Media Scanner utility.
 * Inspects visible <img>, <canvas>, and media elements directly in the page
 * at full native resolution, bypassing screen downsampling and JPEG compression.
 */

import jsQR from 'jsqr';
import { maskQrRegion } from './coordinates.js';

/**
 * Checks whether an element is roughly within the visible browser viewport.
 * @param {HTMLElement} el
 * @param {number} [margin=50]
 * @returns {boolean}
 */
export function isElementInViewport(el, margin = 50) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  return (
    rect.bottom >= -margin &&
    rect.top <= vh + margin &&
    rect.right >= -margin &&
    rect.left <= vw + margin &&
    rect.width > 12 &&
    rect.height > 12
  );
}

/**
 * Scans an individual <img> or <canvas> element for all QR codes at its full native resolution.
 * @param {HTMLImageElement | HTMLCanvasElement} el
 * @param {number} [maxDimension=1200]
 * @returns {Array<{ data: string, location: any, rect: DOMRect, element: HTMLElement }>}
 */
export function scanMediaElement(el, maxDimension = 1200) {
  if (!el) return [];

  let width = 0;
  let height = 0;

  if (el.tagName === 'IMG') {
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
    width = el.width;
    height = el.height;
  } else {
    return [];
  }

  // Skip tiny icons that cannot possibly be QR codes (< 20px)
  if (width < 20 || height < 20) return [];

  // Scale down if insanely large (> 1200px)
  let scanW = width;
  let scanH = height;
  if (scanW > maxDimension || scanH > maxDimension) {
    const ratio = Math.min(maxDimension / scanW, maxDimension / scanH);
    scanW = Math.round(scanW * ratio);
    scanH = Math.round(scanH * ratio);
  }

  if (typeof document === 'undefined') return [];

  const canvas = document.createElement('canvas');
  canvas.width = scanW;
  canvas.height = scanH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  try {
    ctx.drawImage(el, 0, 0, scanW, scanH);
    let imgData = ctx.getImageData(0, 0, scanW, scanH);
    const found = [];
    const maxPerElement = 4;
    let count = 0;

    while (count < maxPerElement) {
      const code = jsQR(imgData.data, scanW, scanH, {
        inversionAttempts: 'attemptBoth'
      });
      if (!code) break;

      const rect = el.getBoundingClientRect();
      const scaleX = rect.width / scanW;
      const scaleY = rect.height / scanH;

      // Project location points to absolute viewport coordinates
      const location = {
        topLeftCorner: {
          x: rect.left + code.location.topLeftCorner.x * scaleX,
          y: rect.top + code.location.topLeftCorner.y * scaleY
        },
        topRightCorner: {
          x: rect.left + code.location.topRightCorner.x * scaleX,
          y: rect.top + code.location.topRightCorner.y * scaleY
        },
        bottomRightCorner: {
          x: rect.left + code.location.bottomRightCorner.x * scaleX,
          y: rect.top + code.location.bottomRightCorner.y * scaleY
        },
        bottomLeftCorner: {
          x: rect.left + code.location.bottomLeftCorner.x * scaleX,
          y: rect.top + code.location.bottomLeftCorner.y * scaleY
        }
      };

      found.push({
        data: code.data,
        location,
        rect,
        element: el,
        isDom: true
      });

      count++;
      // Mask this QR region on the offscreen canvas to detect any additional QRs
      maskQrRegion(ctx, code.location);
      imgData = ctx.getImageData(0, 0, scanW, scanH);
    }

    if (el.tagName === 'IMG') {
      const currentSrc = el.currentSrc || el.src;
      el._qrRadarCachedSrc = currentSrc;
      el._qrRadarCachedW = scanW;
      el._qrRadarCachedH = scanH;
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
  } catch {
    // Cross-origin image (CORS) or tainted canvas - ignore safely
    return [];
  }
}

/**
 * Scans all visible <img> and <canvas> tags on the page.
 * @returns {Array<{ data: string, location: any, rect: DOMRect, element: HTMLElement, isDom: boolean }>}
 */
export function scanVisibleDomImages() {
  if (typeof document === 'undefined') return [];

  const elements = Array.from(document.querySelectorAll('img, canvas'));
  const allResults = [];

  for (const el of elements) {
    if (isElementInViewport(el)) {
      const results = scanMediaElement(el);
      if (Array.isArray(results) && results.length > 0) {
        allResults.push(...results);
      }
    }
  }

  return allResults;
}
