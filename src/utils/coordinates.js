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
