/**
 * Pure helpers for multi-pass QR scanning (no DOM / browser dependencies, unit-testable in Node).
 *
 * A full-screen frame is first decoded downscaled (fast path). Small QR codes die in that
 * downscale, so a "deep" pass re-reads the frame as overlapping native-resolution tiles
 * (optionally upscaled) where every module still spans enough pixels for the decoder.
 */

/**
 * Splits a width x height area into overlapping tiles.
 * Overlap guarantees that any QR code up to `overlap` px wide lies fully inside at least one tile.
 * @param {number} width
 * @param {number} height
 * @param {number} [tileSize=640]
 * @param {number} [overlap=224]
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
export function planTiles(width, height, tileSize = 640, overlap = 224) {
  if (!(width > 0) || !(height > 0)) return [];
  const step = Math.max(1, tileSize - overlap);

  const axis = (len) => {
    if (len <= tileSize) return [{ start: 0, size: len }];
    const out = [];
    for (let pos = 0; ; pos += step) {
      if (pos + tileSize >= len) {
        out.push({ start: Math.max(0, len - tileSize), size: Math.min(tileSize, len) });
        break;
      }
      out.push({ start: pos, size: tileSize });
    }
    return out;
  };

  const xs = axis(width);
  const ys = axis(height);
  const tiles = [];
  for (const yy of ys) {
    for (const xx of xs) {
      tiles.push({ x: xx.start, y: yy.start, w: xx.size, h: yy.size });
    }
  }
  return tiles;
}

/**
 * Center of a QR location polygon.
 * @param {{ topLeftCorner: {x:number,y:number}, topRightCorner: {x:number,y:number}, bottomRightCorner: {x:number,y:number}, bottomLeftCorner: {x:number,y:number} }} loc
 */
export function locationCenter(loc) {
  return {
    x: (loc.topLeftCorner.x + loc.topRightCorner.x + loc.bottomRightCorner.x + loc.bottomLeftCorner.x) / 4,
    y: (loc.topLeftCorner.y + loc.topRightCorner.y + loc.bottomRightCorner.y + loc.bottomLeftCorner.y) / 4
  };
}

/**
 * Approximate diagonal size of a QR location polygon.
 */
export function locationSize(loc) {
  const dx = loc.bottomRightCorner.x - loc.topLeftCorner.x;
  const dy = loc.bottomRightCorner.y - loc.topLeftCorner.y;
  return Math.hypot(dx, dy);
}

/**
 * Maps a QR location through `(p) => p'` for every corner.
 * @template T
 * @param {any} loc
 * @param {(p: {x:number,y:number}) => {x:number,y:number}} fn
 */
export function mapLocation(loc, fn) {
  return {
    topLeftCorner: fn(loc.topLeftCorner),
    topRightCorner: fn(loc.topRightCorner),
    bottomRightCorner: fn(loc.bottomRightCorner),
    bottomLeftCorner: fn(loc.bottomLeftCorner)
  };
}

/**
 * Merges QR result lists from several passes, dropping duplicates: the same payload whose
 * center lies within half a code-size of an already accepted one is the same physical code.
 * Earlier lists win (put the most precise pass first).
 * @param {Array<Array<{ data: string, location: any }>>} lists
 * @returns {Array<{ data: string, location: any }>}
 */
export function mergeQrResults(...lists) {
  const merged = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const qr of list) {
      if (!qr || !qr.location) continue;
      const c = locationCenter(qr.location);
      const size = Math.max(8, locationSize(qr.location));
      const dup = merged.some((m) => {
        if (m.data !== qr.data) return false;
        const mc = locationCenter(m.location);
        return Math.hypot(mc.x - c.x, mc.y - c.y) <= Math.max(size, locationSize(m.location)) * 0.5;
      });
      if (!dup) merged.push(qr);
    }
  }
  return merged;
}
