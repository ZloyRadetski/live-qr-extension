/**
 * DOM Media Scanner utility.
 * Inspects visible <img>, <canvas>, and media elements directly in the page
 * at full native resolution, bypassing screen downsampling and JPEG compression.
 */

import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';
import { mapLocation } from './tiling.js';

let isWasmConfigured = false;

function ensureWasmConfigured() {
  if (isWasmConfigured) return;
  try {
    const wasmUrl = typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL
      ? browser.runtime.getURL('dist/zxing_reader.wasm')
      : 'dist/zxing_reader.wasm';
    prepareZXingModule({
      overrides: {
        locateFile: (path) => (path.endsWith('.wasm') ? wasmUrl : path)
      }
    });
    isWasmConfigured = true;
  } catch (err) {
    console.warn('[QR Radar] DOM Scanner Wasm config error:', err);
  }
}

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

const MIN_ELEMENT_PX = 8;      // smallest displayed size worth inspecting
const MIN_NATURAL_PX = 16;     // smallest natural size worth decoding (a version-1 QR is 21 modules)
const UPSCALE_TARGET_PX = 240; // smaller sources are enlarged (crisp) up to ~this size for the decoder
const MAX_HEAVY_PER_TICK = 3;  // decodes per scan tick; the rest is picked up on the next tick
const SHADOW_REFRESH_MS = 2000;

let heavyDecodes = 0;

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
  if (rect.width <= MIN_ELEMENT_PX || rect.height <= MIN_ELEMENT_PX) return false;

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
 * Projects cached scan-space QR locations of an element onto its current on-screen rect.
 * @param {HTMLElement} el
 */
function mapCachedResults(el) {
  if (!el._qrRadarCached || el._qrRadarCached.length === 0) return [];
  const rect = el.getBoundingClientRect();
  const scaleX = rect.width / el._qrRadarCachedW;
  const scaleY = rect.height / el._qrRadarCachedH;
  const project = (p) => ({ x: rect.left + p.x * scaleX, y: rect.top + p.y * scaleY });
  return el._qrRadarCached.map((item) => ({
    data: item.data,
    location: mapLocation(item.loc, project),
    rect,
    element: el,
    isDom: true
  }));
}

/**
 * Cheap pixel fingerprint of a canvas readback: ~512 samples on an odd pixel stride so every
 * row/column residue is visited (a QR drawn into a previously blank canvas always changes it).
 * @param {Uint8ClampedArray} p RGBA data
 */
function canvasFingerprint(p) {
  const pixels = p.length >> 2;
  const stride = Math.max(1, Math.floor(pixels / 512)) | 1;
  let hash = 0x811c9dc5;
  for (let px = 0; px < pixels; px += stride) {
    hash = ((hash ^ p[px * 4 + 1]) * 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Scans an individual <img> or <canvas> element for all QR codes at its full native resolution.
 * @param {HTMLImageElement | HTMLCanvasElement} el
 * @param {number} [maxDimension=1920]
 * @param {{ cachedOnly?: boolean }} [opts] cachedOnly: never decode, only report what is already known
 * @returns {Array<{ data: string, location: any, rect: DOMRect, element: HTMLElement }>}
 */
export async function scanMediaElement(el, maxDimension = 1920, opts = {}) {
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
      return mapCachedResults(el);
    }
  } else if (el.tagName === 'CANVAS') {
    if (el._qrRadarTainted) return [];
    width = el.width;
    height = el.height;

    // Fast path: if canvas was verified static, reuse cached result directly without GPU readback
    if (el._qrRadarIsStatic && el._qrRadarCached !== undefined && (el._qrRadarSkipCount || 0) < 10) {
      el._qrRadarSkipCount = (el._qrRadarSkipCount || 0) + 1;
      return mapCachedResults(el);
    }
    // Animated canvases (games, maps, charts) back off exponentially instead of being read back every tick
    if (el._qrRadarCached !== undefined && el._qrRadarNextScan && Date.now() < el._qrRadarNextScan) {
      return mapCachedResults(el);
    }
    el._qrRadarSkipCount = 0;
  } else if (el.tagName === 'VIDEO') {
    if (el._qrRadarTainted) return [];
    if (el.readyState < 2 || !el.videoWidth || !el.videoHeight) return [];
    width = el.videoWidth;
    height = el.videoHeight;

    // Per-frame cache: skip decode if video frame hasn't advanced since last scan
    // currentTime is a float in seconds; changes every rendered frame
    if (el._qrRadarVideoTime === el.currentTime && el._qrRadarCached !== undefined) {
      return mapCachedResults(el);
    }
  } else {
    return [];
  }

  // Skip tiny icons that cannot possibly be QR codes
  if (width < MIN_NATURAL_PX || height < MIN_NATURAL_PX) return [];

  // Over the per-tick decode budget: report only what is already known
  if (opts.cachedOnly) return el._qrRadarCached !== undefined ? mapCachedResults(el) : [];

  // Scale down for optimal speed/accuracy balance
  // IMG: cap at maxDimension; VIDEO: cap at 720px — decoder works well at moderate resolution
  const effectiveMax = el.tagName === 'VIDEO' ? Math.min(maxDimension, 720) : maxDimension;
  let scanW = width;
  let scanH = height;
  if (scanW > effectiveMax || scanH > effectiveMax) {
    const ratio = Math.min(effectiveMax / scanW, effectiveMax / scanH);
    scanW = Math.round(scanW * ratio);
    scanH = Math.round(scanH * ratio);
  }

  // Tiny sources (pixel-art QR codes, small icons): enlarge with nearest-neighbour so the
  // decoder's binarizer gets enough pixels per module.
  let crisp = false;
  const longest = Math.max(scanW, scanH);
  if (longest < UPSCALE_TARGET_PX) {
    const factor = Math.min(8, Math.ceil(UPSCALE_TARGET_PX / longest));
    scanW *= factor;
    scanH *= factor;
    crisp = true;
  }

  if (typeof document === 'undefined') return [];

  const buffer = getOffscreenCanvas(scanW, scanH);
  if (!buffer || !buffer.ctx) return [];
  const { canvas, ctx } = buffer;
  heavyDecodes++;

  try {
    ctx.imageSmoothingEnabled = !crisp;
    ctx.drawImage(el, 0, 0, scanW, scanH);
    const imgData = ctx.getImageData(0, 0, scanW, scanH);

    // Fast canvas pixel fingerprint check
    if (el.tagName === 'CANVAS') {
      const hash = canvasFingerprint(imgData.data);

      if (el._qrRadarCachedHash === hash && el._qrRadarCached !== undefined) {
        // Content has not changed at all — promote to static after 2 consecutive identical frames
        el._qrRadarStaticHits = (el._qrRadarStaticHits || 0) + 1;
        if (el._qrRadarStaticHits >= 2) {
          el._qrRadarIsStatic = true;
        }
        return mapCachedResults(el);
      }

      el._qrRadarCachedHash = hash;
      el._qrRadarStaticHits = 0;
      el._qrRadarIsStatic = false;
    }

    /** @type {Array<{ data: string, loc: any }>} QR corners in scan-pixel space */
    const rawFound = [];
    try {
      ensureWasmConfigured();
      const results = await readBarcodes(
        { data: imgData.data, width: scanW, height: scanH },
        { formats: ['QRCode'], maxNumberOfSymbols: 4, tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true }
      );

      if (Array.isArray(results)) {
        for (const code of results) {
          if (!code.text || !code.position) continue;
          rawFound.push({
            data: code.text,
            loc: {
              topLeftCorner: { x: code.position.topLeft.x, y: code.position.topLeft.y },
              topRightCorner: { x: code.position.topRight.x, y: code.position.topRight.y },
              bottomRightCorner: { x: code.position.bottomRight.x, y: code.position.bottomRight.y },
              bottomLeftCorner: { x: code.position.bottomLeft.x, y: code.position.bottomLeft.y }
            }
          });
        }
      }
    } catch (err) {
      console.warn('[QR Radar] scanMediaElement decode error:', err);
    }

    // Cache in scan space; projection to the screen happens in mapCachedResults
    el._qrRadarCachedSrc = el.currentSrc || el.src;
    el._qrRadarCachedW = scanW;
    el._qrRadarCachedH = scanH;
    el._qrRadarCached = rawFound;
    if (el.tagName === 'VIDEO') el._qrRadarVideoTime = el.currentTime;
    if (el.tagName === 'CANVAS') {
      // Found a code: keep polling fast. Otherwise back off 150ms → 2s while the canvas keeps changing.
      el._qrRadarGap = rawFound.length > 0 ? 250 : Math.min(2000, (el._qrRadarGap || 150) * 1.6);
      el._qrRadarNextScan = Date.now() + el._qrRadarGap;
    }

    return mapCachedResults(el);
  } catch (err) {
    // If an <img> fails due to CORS tainted canvas, request background script
    // to fetch and decode the image at native resolution with extension privileges
    if (el.tagName === 'IMG' && (el.currentSrc || el.src)) {
      const src = el.currentSrc || el.src;
      if (src.startsWith('http://') || src.startsWith('https://')) {
        return scanRemoteImageViaBackground(el, src);
      }
    }

    // Canvas or non-http image - safely isolate
    console.warn(`[QR Radar] scanMediaElement failed for ${el.tagName}#${el.id || '?'} (${scanW}x${scanH}):`, err?.message || err);
    el._qrRadarTainted = true;
    // Reset canvas singleton so other elements are not poisoned
    offscreenCanvas = null;
    offscreenCtx = null;
    return [];
  }
}

/**
 * Requests the background script to fetch a cross-origin image without CORS restrictions
 * and scan it at native resolution with zxing-wasm.
 * @param {HTMLImageElement} el
 * @param {string} src
 * @returns {Promise<Array<{ data: string, location: any, rect: DOMRect, element: HTMLElement, isDom: boolean }>>}
 */
async function scanRemoteImageViaBackground(el, src) {
  if (typeof browser === 'undefined' || !browser.runtime || !browser.runtime.sendMessage) {
    return [];
  }
  if (el._qrRadarFetchingRemote) {
    return [];
  }
  el._qrRadarFetchingRemote = true;

  try {
    const response = await browser.runtime.sendMessage({
      type: 'SCAN_REMOTE_IMAGE',
      url: src
    });

    el._qrRadarFetchingRemote = false;
    const remoteQrs = response?.qrs || [];
    const rect = el.getBoundingClientRect();

    el._qrRadarCachedSrc = src;
    el._qrRadarCachedW = el.naturalWidth || rect.width;
    el._qrRadarCachedH = el.naturalHeight || rect.height;
    el._qrRadarCached = remoteQrs.map((q) => ({
      data: q.data,
      loc: {
        topLeftCorner:     { x: q.relLoc.topLeftCorner.x * el._qrRadarCachedW,     y: q.relLoc.topLeftCorner.y * el._qrRadarCachedH },
        topRightCorner:    { x: q.relLoc.topRightCorner.x * el._qrRadarCachedW,    y: q.relLoc.topRightCorner.y * el._qrRadarCachedH },
        bottomRightCorner: { x: q.relLoc.bottomRightCorner.x * el._qrRadarCachedW, y: q.relLoc.bottomRightCorner.y * el._qrRadarCachedH },
        bottomLeftCorner:  { x: q.relLoc.bottomLeftCorner.x * el._qrRadarCachedW,  y: q.relLoc.bottomLeftCorner.y * el._qrRadarCachedH }
      }
    }));

    return remoteQrs.map((item) => ({
      data: item.data,
      location: {
        topLeftCorner:     { x: rect.left + item.relLoc.topLeftCorner.x * rect.width,     y: rect.top + item.relLoc.topLeftCorner.y * rect.height },
        topRightCorner:    { x: rect.left + item.relLoc.topRightCorner.x * rect.width,    y: rect.top + item.relLoc.topRightCorner.y * rect.height },
        bottomRightCorner: { x: rect.left + item.relLoc.bottomRightCorner.x * rect.width, y: rect.top + item.relLoc.bottomRightCorner.y * rect.height },
        bottomLeftCorner:  { x: rect.left + item.relLoc.bottomLeftCorner.x * rect.width,  y: rect.top + item.relLoc.bottomLeftCorner.y * rect.height }
      },
      rect,
      element: el,
      isDom: true
    }));
  } catch (e) {
    el._qrRadarFetchingRemote = false;
    el._qrRadarTainted = true;
    return [];
  }
}

// ─── Element discovery (including open and closed shadow DOM) ─────────────────

let shadowRootsCache = [];
let shadowRootsCacheTime = -Infinity;

/**
 * Finds every shadow root in the document (web components hide their <img>/<canvas> from
 * document.querySelectorAll). Walking all elements is not free, so the result is cached briefly.
 * Firefox exposes closed roots to extensions via openOrClosedShadowRoot.
 * @param {boolean} [force=false]
 * @returns {ShadowRoot[]}
 */
export function getShadowRoots(force = false) {
  if (typeof document === 'undefined') return [];
  const now = Date.now();
  if (!force && now - shadowRootsCacheTime < SHADOW_REFRESH_MS) {
    return shadowRootsCache.filter((r) => r.host && r.host.isConnected);
  }

  const roots = [];
  const stack = [document];
  while (stack.length > 0) {
    const scope = stack.pop();
    for (const node of scope.querySelectorAll('*')) {
      const sr = node.openOrClosedShadowRoot || node.shadowRoot;
      if (sr) {
        roots.push(sr);
        stack.push(sr);
      }
    }
  }
  shadowRootsCache = roots;
  shadowRootsCacheTime = now;
  return roots;
}

/** Forces the next scan to re-discover shadow roots (call when the DOM structure changed). */
export function invalidateShadowRoots() {
  shadowRootsCacheTime = -Infinity;
}

/**
 * All <img> and <canvas> elements of the page, light DOM and shadow DOM.
 * @returns {HTMLElement[]}
 */
export function collectMediaElements() {
  if (typeof document === 'undefined') return [];
  const out = Array.from(document.querySelectorAll('img, canvas'));
  for (const root of getShadowRoots()) {
    out.push(...root.querySelectorAll('img, canvas'));
  }
  return out;
}

/**
 * Scans all visible <img> and <canvas> elements on the page (shadow DOM included).
 * At most MAX_HEAVY_PER_TICK elements are actually decoded per call so a page full of new images
 * never freezes; the remaining ones report only cached results and are decoded on later ticks.
 * @returns {Promise<Array<{ data: string, location: any, rect: DOMRect, element: HTMLElement, isDom: boolean }>>}
 */
export async function scanVisibleDomImages() {
  if (typeof document === 'undefined') return [];

  // Video elements are tracked via getVisibleVideoRects and decoded off-thread in the
  // background worker to avoid freezing page playback.
  const elements = collectMediaElements();
  const allResults = [];
  const startHeavy = heavyDecodes;

  for (const el of elements) {
    if (!isElementInViewport(el)) continue;
    const overBudget = heavyDecodes - startHeavy >= MAX_HEAVY_PER_TICK;
    const results = await scanMediaElement(el, 1920, { cachedOnly: overBudget });
    if (Array.isArray(results) && results.length > 0) {
      allResults.push(...results);
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
