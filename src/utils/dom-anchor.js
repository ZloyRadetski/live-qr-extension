/**
 * DOM Anchor utilities for locking QR radar frames to actual page elements.
 * Keeps bounding boxes locked at 60/120 FPS during scrolling without screenshot lag.
 */

/**
 * Finds the most relevant visual DOM element located at (centerX, centerY).
 * @param {number} centerX - Viewport X
 * @param {number} centerY - Viewport Y
 * @param {string} [ignoreRootId='qr-radar-root']
 * @returns {HTMLElement | null}
 */
export function findAnchorElement(centerX, centerY, ignoreRootId = 'qr-radar-root') {
  if (typeof document === 'undefined' || !document.elementsFromPoint) {
    return null;
  }

  const elements = document.elementsFromPoint(centerX, centerY) || [];

  // Filter out our own overlay root
  const candidates = elements.filter((el) => {
    return el && el.id !== ignoreRootId && !el.closest(`#${ignoreRootId}`);
  });

  if (candidates.length === 0) return null;

  // 1. Prioritize media elements that display visual content
  const mediaTags = ['IMG', 'VIDEO', 'CANVAS', 'SVG', 'PICTURE'];
  for (const el of candidates) {
    if (mediaTags.includes(el.tagName)) {
      return el;
    }
  }

  // 2. Check for elements with background images
  for (const el of candidates) {
    try {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && !bg.includes('initial')) {
        return el;
      }
    } catch {}
  }

  // 3. Pick the smallest enclosing element (deepest in DOM) that isn't BODY or HTML
  const nonBody = candidates.filter((el) => el.tagName !== 'BODY' && el.tagName !== 'HTML');
  if (nonBody.length > 0) {
    // Sort by bounding area (smallest first)
    nonBody.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    });
    return nonBody[0];
  }

  return candidates[0] || null;
}

/**
 * Computes offset of bounds relative to anchor element.
 * @param {{ getBoundingClientRect: () => DOMRect | { left: number, top: number } }} anchorEl
 * @param {{ minX: number, minY: number, width: number, height: number }} bounds
 * @returns {{ offsetX: number, offsetY: number, width: number, height: number }}
 */
export function computeAnchorOffset(anchorEl, bounds) {
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

/**
 * Checks if an element or any of its ancestors has position: fixed.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isElementFixed(el) {
  if (!el || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return false;
  }
  let curr = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    try {
      const pos = window.getComputedStyle(curr).position;
      if (pos === 'fixed') return true;
    } catch {
      break;
    }
    curr = curr.parentElement;
  }
  return false;
}

/**
 * Resolves current viewport position of the anchor.
 * @param {HTMLElement} anchorEl
 * @param {{ offsetX: number, offsetY: number, width: number, height: number, relX?: number, relY?: number, relW?: number, relH?: number, initialWidth?: number }} offset
 * @param {{ innerWidth: number, innerHeight: number }} [viewport]
 * @returns {{ x: number, y: number, docX: number, docY: number, width: number, height: number, isVisible: boolean } | null}
 */
export function resolveAnchorPosition(anchorEl, offset, viewport) {
  if (!anchorEl || (typeof anchorEl.isConnected === 'boolean' && !anchorEl.isConnected)) {
    return null;
  }

  const vw = viewport?.innerWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1920);
  const vh = viewport?.innerHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 1080);
  const scrollX = typeof window !== 'undefined' ? (window.pageXOffset || window.scrollX || 0) : 0;
  const scrollY = typeof window !== 'undefined' ? (window.pageYOffset || window.scrollY || 0) : 0;

  const rect = anchorEl.getBoundingClientRect();

  // If the anchor element was scaled/resized (e.g. CSS hover scale or responsive resize), adapt bounds proportionally
  let x, y, width, height;
  if (offset.relX !== undefined && offset.initialWidth > 0 && Math.abs(rect.width - offset.initialWidth) > 1.5) {
    width = rect.width * offset.relW;
    height = rect.height * offset.relH;
    x = rect.left + rect.width * offset.relX;
    y = rect.top + rect.height * offset.relY;
  } else {
    x = rect.left + offset.offsetX;
    y = rect.top + offset.offsetY;
    width = offset.width;
    height = offset.height;
  }

  const isVisible = (
    y + height >= -10 &&
    y <= vh + 10 &&
    x + width >= -10 &&
    x <= vw + 10
  );

  return {
    x,
    y,
    docX: x + scrollX,
    docY: y + scrollY,
    width,
    height,
    isVisible
  };
}
