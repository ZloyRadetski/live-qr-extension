/**
 * Coordinate mapping, smoothing, and geometric utilities for QR code tracking.
 * Pure functions suitable for both unit testing and browser runtime.
 */

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{
 *   topLeftCorner: Point,
 *   topRightCorner: Point,
 *   bottomRightCorner: Point,
 *   bottomLeftCorner: Point
 * }} QRLocation
 */

/**
 * Projects a single point from scan canvas dimensions to target viewport dimensions.
 * @param {Point} point
 * @param {number} scaleX
 * @param {number} scaleY
 * @returns {Point}
 */
export function projectPoint(point, scaleX, scaleY) {
  return {
    x: point.x * scaleX,
    y: point.y * scaleY
  };
}

/**
 * Projects all 4 corner points of a detected QR code location.
 * @param {QRLocation} location
 * @param {number} scaleX
 * @param {number} scaleY
 * @returns {QRLocation}
 */
export function projectLocation(location, scaleX, scaleY) {
  return {
    topLeftCorner: projectPoint(location.topLeftCorner, scaleX, scaleY),
    topRightCorner: projectPoint(location.topRightCorner, scaleX, scaleY),
    bottomRightCorner: projectPoint(location.bottomRightCorner, scaleX, scaleY),
    bottomLeftCorner: projectPoint(location.bottomLeftCorner, scaleX, scaleY)
  };
}

/**
 * Computes bounding rectangle (min/max and center) from 4 corner points.
 * @param {QRLocation} location
 * @returns {{
 *   minX: number,
 *   minY: number,
 *   maxX: number,
 *   maxY: number,
 *   width: number,
 *   height: number,
 *   centerX: number,
 *   centerY: number
 * }}
 */
export function computeBounds(location) {
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

/**
 * Linear interpolation (lerp) between two numbers.
 * @param {number} start
 * @param {number} end
 * @param {number} factor (0..1)
 */
export function lerp(start, end, factor = 0.35) {
  return start + (end - start) * factor;
}

/**
 * Smooths a point with linear interpolation.
 * @param {Point} current
 * @param {Point} target
 * @param {number} factor
 * @returns {Point}
 */
export function lerpPoint(current, target, factor = 0.35) {
  if (!current) return { ...target };
  return {
    x: lerp(current.x, target.x, factor),
    y: lerp(current.y, target.y, factor)
  };
}

/**
 * Smooths an entire 4-corner location with linear interpolation.
 * @param {QRLocation | null} current
 * @param {QRLocation} target
 * @param {number} factor
 * @returns {QRLocation}
 */
export function lerpLocation(current, target, factor = 0.35) {
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

/**
 * Euclidean distance between two points.
 * @param {Point} p1
 * @param {Point} p2
 */
export function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Computes approximate rotation angle in degrees from top-left to top-right corner.
 * @param {Point} topLeft
 * @param {Point} topRight
 * @returns {number} Angle in degrees (-180..180)
 */
export function computeRotationAngle(topLeft, topRight) {
  const radians = Math.atan2(topRight.y - topLeft.y, topRight.x - topLeft.x);
  return (radians * 180) / Math.PI;
}

/**
 * Masks a QR code polygon on a 2D canvas context with solid color
 * so single-barcode decoders can search for remaining QR codes.
 * @param {any} ctx - 2D Canvas context
 * @param {QRLocation} location
 * @param {number} [margin=4]
 * @param {string} [fillColor='#ffffff']
 */
export function maskQrRegion(ctx, location, margin = 4, fillColor = '#ffffff') {
  if (!ctx || !location) return;
  const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br, bottomLeftCorner: bl } = location;
  if (!tl || !tr || !br || !bl) return;

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(tl.x - margin, tl.y - margin);
  ctx.lineTo(tr.x + margin, tr.y - margin);
  ctx.lineTo(br.x + margin, br.y + margin);
  ctx.lineTo(bl.x - margin, bl.y + margin);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Checks if two bounding boxes are spatially close / overlapping.
 * @param {{ centerX: number, centerY: number }} b1
 * @param {{ centerX: number, centerY: number }} b2
 * @param {number} [maxDistance=60]
 * @returns {boolean}
 */
export function areBoundsNear(b1, b2, maxDistance = 60) {
  if (!b1 || !b2) return false;
  const dx = b1.centerX - b2.centerX;
  const dy = b1.centerY - b2.centerY;
  return (dx * dx + dy * dy) <= (maxDistance * maxDistance);
}

/**
 * Masks a QR code polygon directly inside an ImageData buffer (CPU-side).
 * Fills the quadrilateral with white pixels using a scanline edge-fill algorithm,
 * eliminating the need for a second getImageData() GPU readback when multiple QRs are present.
 *
 * @param {ImageData} imageData - The ImageData object whose .data buffer will be mutated.
 * @param {QRLocation} location - Four corner points of the QR code.
 * @param {number} [margin=4] - Extra pixels to expand the filled region.
 */
export function maskQrRegionInBuffer(imageData, location, margin = 4) {
  if (!imageData || !location) return;
  const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br, bottomLeftCorner: bl } = location;
  if (!tl || !tr || !br || !bl) return;

  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  // Expand corners outward by margin
  const pts = [
    { x: tl.x - margin, y: tl.y - margin },
    { x: tr.x + margin, y: tr.y - margin },
    { x: br.x + margin, y: br.y + margin },
    { x: bl.x - margin, y: bl.y + margin }
  ];

  // Compute scanline bounds
  let minY = Math.max(0, Math.floor(Math.min(pts[0].y, pts[1].y, pts[2].y, pts[3].y)));
  let maxY = Math.min(h - 1, Math.ceil(Math.max(pts[0].y, pts[1].y, pts[2].y, pts[3].y)));

  const n = pts.length;

  for (let y = minY; y <= maxY; y++) {
    // Find x-intersections of scanline y with each polygon edge
    const xIntersections = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        xIntersections.push(a.x + t * (b.x - a.x));
      }
    }
    if (xIntersections.length < 2) continue;
    xIntersections.sort((a, b) => a - b);

    const xStart = Math.max(0, Math.floor(xIntersections[0]));
    const xEnd = Math.min(w - 1, Math.ceil(xIntersections[xIntersections.length - 1]));

    // Fill scanline with white (RGBA = 255, 255, 255, 255)
    const rowBase = y * w * 4;
    for (let x = xStart; x <= xEnd; x++) {
      const idx = rowBase + x * 4;
      data[idx]     = 255; // R
      data[idx + 1] = 255; // G
      data[idx + 2] = 255; // B
      data[idx + 3] = 255; // A
    }
  }
}

