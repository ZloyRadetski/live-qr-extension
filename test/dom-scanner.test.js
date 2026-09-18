import test from 'node:test';
import assert from 'node:assert/strict';
import { isElementInViewport, scanMediaElement, scanVisibleDomImages } from '../src/utils/dom-scanner.js';

test('isElementInViewport accurately detects visible vs hidden elements', () => {
  const visibleEl = {
    getBoundingClientRect: () => ({
      left: 100,
      right: 300,
      top: 50,
      bottom: 250,
      width: 200,
      height: 200
    })
  };

  const hiddenEl = {
    getBoundingClientRect: () => ({
      left: 100,
      right: 300,
      top: -600,
      bottom: -400,
      width: 200,
      height: 200
    })
  };

  const tinyEl = {
    getBoundingClientRect: () => ({
      left: 100,
      right: 105,
      top: 100,
      bottom: 105,
      width: 5,
      height: 5
    })
  };

  assert.equal(isElementInViewport(visibleEl), true);
  assert.equal(isElementInViewport(hiddenEl), false);
  assert.equal(isElementInViewport(tinyEl), false);
});

test('scanMediaElement safely rejects invalid, incomplete, or tiny images', () => {
  // Incomplete image
  assert.deepEqual(scanMediaElement({ tagName: 'IMG', complete: false }), []);

  // Tiny image (< 20px)
  assert.deepEqual(scanMediaElement({ tagName: 'IMG', complete: true, naturalWidth: 10, naturalHeight: 10 }), []);

  // Non-media tag
  assert.deepEqual(scanMediaElement({ tagName: 'DIV' }), []);
});

test('scanVisibleDomImages safely returns empty array in non-browser environment', () => {
  const res = scanVisibleDomImages();
  assert.deepEqual(res, []);
});

