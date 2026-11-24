import test from 'node:test';
import assert from 'node:assert/strict';
import { planTiles, mergeQrResults, locationCenter } from '../src/utils/tiling.js';

const box = (x, y, s) => ({
  topLeftCorner: { x, y },
  topRightCorner: { x: x + s, y },
  bottomRightCorner: { x: x + s, y: y + s },
  bottomLeftCorner: { x, y: y + s }
});

test('planTiles returns a single tile for areas not larger than the tile size', () => {
  assert.deepEqual(planTiles(500, 300, 640, 224), [{ x: 0, y: 0, w: 500, h: 300 }]);
  assert.deepEqual(planTiles(0, 100), []);
});

test('planTiles covers every pixel and keeps tiles inside the area', () => {
  for (const [w, h] of [[1920, 1080], [3840, 2160], [2561, 1441], [641, 641]]) {
    const tiles = planTiles(w, h, 640, 224);
    for (const t of tiles) {
      assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= w && t.y + t.h <= h, `tile out of bounds ${JSON.stringify(t)}`);
    }
    // Every QR up to `overlap` px wide at any position must fit fully inside one tile.
    for (let px = 0; px + 224 <= w; px += 37) {
      for (let py = 0; py + 224 <= h; py += 41) {
        const ok = tiles.some((t) => px >= t.x && py >= t.y && px + 224 <= t.x + t.w && py + 224 <= t.y + t.h);
        assert.ok(ok, `${w}x${h}: 224px code at ${px},${py} not fully covered`);
      }
    }
  }
});

test('mergeQrResults drops the same code found by several passes but keeps distinct ones', () => {
  const a = [{ data: 'A', location: box(100, 100, 80) }];
  const dupOfA = [{ data: 'A', location: box(103, 98, 80) }];
  const sameTextElsewhere = [{ data: 'A', location: box(900, 500, 80) }];
  const other = [{ data: 'B', location: box(100, 100, 80) }];

  const merged = mergeQrResults(a, dupOfA, sameTextElsewhere, other);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map((m) => m.data), ['A', 'A', 'B']);
  assert.deepEqual(locationCenter(merged[0].location), { x: 140, y: 140 }, 'first (most precise) pass wins');
});

test('mergeQrResults tolerates empty and invalid input', () => {
  assert.deepEqual(mergeQrResults(), []);
  assert.deepEqual(mergeQrResults(null, undefined, [], [{ data: 'x' }]), []);
});
