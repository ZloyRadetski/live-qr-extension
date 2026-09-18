import test from 'node:test';
import assert from 'node:assert/strict';
import { isElementInViewport, scanMediaElement, scanVisibleDomImages, getVisibleVideoRects } from '../src/utils/dom-scanner.js';

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

  const hiddenAttrEl = {
    hidden: true,
    getBoundingClientRect: () => ({ left: 100, right: 300, top: 50, bottom: 250, width: 200, height: 200 })
  };

  const displayNoneEl = {
    style: { display: 'none' },
    getBoundingClientRect: () => ({ left: 100, right: 300, top: 50, bottom: 250, width: 200, height: 200 })
  };

  const visibilityHiddenEl = {
    style: { visibility: 'hidden' },
    getBoundingClientRect: () => ({ left: 100, right: 300, top: 50, bottom: 250, width: 200, height: 200 })
  };

  const opacityZeroEl = {
    style: { opacity: '0' },
    getBoundingClientRect: () => ({ left: 100, right: 300, top: 50, bottom: 250, width: 200, height: 200 })
  };

  assert.equal(isElementInViewport(visibleEl), true);
  assert.equal(isElementInViewport(hiddenEl), false);
  assert.equal(isElementInViewport(tinyEl), false);
  assert.equal(isElementInViewport(hiddenAttrEl), false);
  assert.equal(isElementInViewport(displayNoneEl), false);
  assert.equal(isElementInViewport(visibilityHiddenEl), false);
  assert.equal(isElementInViewport(opacityZeroEl), false);
});

test('scanMediaElement safely rejects invalid, incomplete, or tiny images', async () => {
  // Incomplete image
  assert.deepEqual(await scanMediaElement({ tagName: 'IMG', complete: false }), []);

  // Tiny image (< 20px)
  assert.deepEqual(await scanMediaElement({ tagName: 'IMG', complete: true, naturalWidth: 10, naturalHeight: 10 }), []);

  // Non-media tag
  assert.deepEqual(await scanMediaElement({ tagName: 'DIV' }), []);

  // Video tag: not ready (readyState 0 or 1)
  assert.deepEqual(await scanMediaElement({ tagName: 'VIDEO', readyState: 0, videoWidth: 640, videoHeight: 480 }), []);
  assert.deepEqual(await scanMediaElement({ tagName: 'VIDEO', readyState: 1, videoWidth: 640, videoHeight: 480 }), []);

  // Video tag: ready but 0 dimensions or tiny
  assert.deepEqual(await scanMediaElement({ tagName: 'VIDEO', readyState: 2, videoWidth: 0, videoHeight: 0 }), []);
  assert.deepEqual(await scanMediaElement({ tagName: 'VIDEO', readyState: 4, videoWidth: 10, videoHeight: 10 }), []);
});

test('scanVisibleDomImages safely returns empty array in non-browser environment', async () => {
  const res = await scanVisibleDomImages();
  assert.deepEqual(res, []);
});

test('scanMediaElement skips tainted cross-origin elements immediately', async () => {
  const taintedVideo = {
    tagName: 'VIDEO',
    _qrRadarTainted: true,
    readyState: 4,
    videoWidth: 1280,
    videoHeight: 720
  };
  const taintedImg = {
    tagName: 'IMG',
    _qrRadarTainted: true,
    complete: true,
    naturalWidth: 500,
    naturalHeight: 500
  };
  const taintedCanvas = {
    tagName: 'CANVAS',
    _qrRadarTainted: true,
    width: 500,
    height: 500
  };

  assert.deepEqual(await scanMediaElement(taintedVideo), []);
  assert.deepEqual(await scanMediaElement(taintedImg), []);
  assert.deepEqual(await scanMediaElement(taintedCanvas), []);
});

test('getVisibleVideoRects safely returns empty array in non-browser environment', () => {
  const rects = getVisibleVideoRects();
  assert.deepEqual(rects, []);
});

