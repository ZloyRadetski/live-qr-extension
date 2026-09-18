import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectPoint,
  projectLocation,
  computeBounds,
  lerp,
  lerpPoint,
  lerpLocation,
  distance,
  computeRotationAngle,
  areBoundsNear,
  maskQrRegion
} from '../src/utils/coordinates.js';

test('projectPoint scales coordinates correctly', () => {
  const pt = { x: 100, y: 200 };
  const scaled = projectPoint(pt, 2, 1.5);
  assert.equal(scaled.x, 200);
  assert.equal(scaled.y, 300);
});

test('projectLocation scales all 4 corners', () => {
  const loc = {
    topLeftCorner: { x: 0, y: 0 },
    topRightCorner: { x: 50, y: 0 },
    bottomRightCorner: { x: 50, y: 50 },
    bottomLeftCorner: { x: 0, y: 50 }
  };
  const projected = projectLocation(loc, 2, 2);
  assert.deepEqual(projected.topLeftCorner, { x: 0, y: 0 });
  assert.deepEqual(projected.topRightCorner, { x: 100, y: 0 });
  assert.deepEqual(projected.bottomRightCorner, { x: 100, y: 100 });
  assert.deepEqual(projected.bottomLeftCorner, { x: 0, y: 100 });
});

test('computeBounds calculates correct bounding rectangle and center', () => {
  const loc = {
    topLeftCorner: { x: 10, y: 20 },
    topRightCorner: { x: 110, y: 20 },
    bottomRightCorner: { x: 110, y: 120 },
    bottomLeftCorner: { x: 10, y: 120 }
  };
  const bounds = computeBounds(loc);
  assert.equal(bounds.minX, 10);
  assert.equal(bounds.minY, 20);
  assert.equal(bounds.maxX, 110);
  assert.equal(bounds.maxY, 120);
  assert.equal(bounds.width, 100);
  assert.equal(bounds.height, 100);
  assert.equal(bounds.centerX, 60);
  assert.equal(bounds.centerY, 70);
});

test('lerp and lerpPoint smooth values toward target', () => {
  assert.equal(lerp(0, 100, 0.5), 50);
  assert.equal(lerp(10, 20, 0.25), 12.5);

  const p1 = { x: 0, y: 100 };
  const p2 = { x: 100, y: 200 };
  const smoothed = lerpPoint(p1, p2, 0.5);
  assert.equal(smoothed.x, 50);
  assert.equal(smoothed.y, 150);
});

test('lerpLocation initializes cleanly if current is null', () => {
  const target = {
    topLeftCorner: { x: 10, y: 10 },
    topRightCorner: { x: 20, y: 10 },
    bottomRightCorner: { x: 20, y: 20 },
    bottomLeftCorner: { x: 10, y: 20 }
  };
  const smoothed = lerpLocation(null, target, 0.5);
  assert.deepEqual(smoothed.topLeftCorner, target.topLeftCorner);
});

test('distance computes euclidean distance', () => {
  const dist = distance({ x: 0, y: 0 }, { x: 3, y: 4 });
  assert.equal(dist, 5);
});

test('computeRotationAngle calculates horizontal orientation angle', () => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 100, y: 0 };
  const angle = computeRotationAngle(p1, p2);
  assert.equal(angle, 0);

  const pVertical = { x: 0, y: 100 };
  const angle90 = computeRotationAngle(p1, pVertical);
  assert.equal(angle90, 90);
});

test('areBoundsNear correctly evaluates spatial proximity', () => {
  const b1 = { centerX: 100, centerY: 100 };
  const b2 = { centerX: 120, centerY: 110 }; // distance = sqrt(400+100) = ~22.3
  const bFar = { centerX: 300, centerY: 300 };

  assert.equal(areBoundsNear(b1, b2, 50), true);
  assert.equal(areBoundsNear(b1, bFar, 50), false);
  assert.equal(areBoundsNear(null, b2), false);
});

test('maskQrRegion safely executes canvas operations', () => {
  let fillCalled = false;
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fill: () => { fillCalled = true; },
    fillStyle: ''
  };

  const loc = {
    topLeftCorner: { x: 10, y: 10 },
    topRightCorner: { x: 50, y: 10 },
    bottomRightCorner: { x: 50, y: 50 },
    bottomLeftCorner: { x: 10, y: 50 }
  };

  maskQrRegion(mockCtx, loc);
  assert.equal(fillCalled, true);
  assert.equal(mockCtx.fillStyle, '#ffffff');

  // Gracefully handles nulls
  assert.doesNotThrow(() => maskQrRegion(null, null));
});
