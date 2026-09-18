import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAnchorOffset, resolveAnchorPosition, isElementFixed } from '../src/utils/dom-anchor.js';

test('computeAnchorOffset calculates relative coordinates inside element', () => {
  const fakeElement = {
    getBoundingClientRect: () => ({ left: 200, top: 150, width: 400, height: 300 })
  };

  const bounds = {
    minX: 250,
    minY: 180,
    width: 80,
    height: 80
  };

  const offset = computeAnchorOffset(fakeElement, bounds);
  assert.equal(offset.offsetX, 50);
  assert.equal(offset.offsetY, 30);
  assert.equal(offset.width, 80);
  assert.equal(offset.height, 80);
});

test('resolveAnchorPosition accurately updates on element movement', () => {
  // Element moved down-right by 100px due to scroll/layout
  const fakeElement = {
    isConnected: true,
    getBoundingClientRect: () => ({ left: 300, top: 250, width: 400, height: 300 })
  };

  const offset = {
    offsetX: 50,
    offsetY: 30,
    width: 80,
    height: 80
  };

  const resolved = resolveAnchorPosition(fakeElement, offset, { innerWidth: 1000, innerHeight: 800 });
  assert.ok(resolved);
  assert.equal(resolved.x, 350);
  assert.equal(resolved.y, 280);
  assert.equal(resolved.isVisible, true);
  assert.equal(typeof resolved.docX, 'number');
  assert.equal(typeof resolved.docY, 'number');
});

test('resolveAnchorPosition marks elements scrolled out of view as hidden', () => {
  // Scrolled far above viewport
  const fakeElement = {
    isConnected: true,
    getBoundingClientRect: () => ({ left: 100, top: -500, width: 200, height: 200 })
  };

  const offset = { offsetX: 0, offsetY: 0, width: 100, height: 100 };
  const resolved = resolveAnchorPosition(fakeElement, offset, { innerWidth: 1000, innerHeight: 800 });
  assert.ok(resolved);
  assert.equal(resolved.isVisible, false);
});

test('resolveAnchorPosition scales proportionally when anchor element resizes', () => {
  const originalEl = {
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 200 })
  };
  const bounds = { minX: 150, minY: 150, width: 50, height: 50 };
  const offset = computeAnchorOffset(originalEl, bounds);

  // Element scaled by 2x (e.g. zoom, CSS transform scale, or responsive layout)
  const scaledEl = {
    isConnected: true,
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 400, height: 400 })
  };

  const resolved = resolveAnchorPosition(scaledEl, offset, { innerWidth: 1000, innerHeight: 800 });
  assert.ok(resolved);
  // In 200px element, QR was at 50px (25%). In 400px element, it should be at 100px (25%) -> x = 200
  assert.equal(resolved.x, 200);
  assert.equal(resolved.y, 200);
  assert.equal(resolved.width, 100);
  assert.equal(resolved.height, 100);
});

test('isElementFixed detects fixed positioning on element or parent hierarchy', () => {
  // Mock window and getComputedStyle in node
  global.window = {
    getComputedStyle: (el) => ({
      position: el._mockPosition || 'static'
    })
  };
  global.document = {
    body: {},
    documentElement: {}
  };

  const staticEl = { _mockPosition: 'static', parentElement: null };
  assert.equal(isElementFixed(staticEl), false);

  const fixedEl = { _mockPosition: 'fixed', parentElement: null };
  assert.equal(isElementFixed(fixedEl), true);

  const childOfFixed = {
    _mockPosition: 'relative',
    parentElement: {
      _mockPosition: 'fixed',
      parentElement: global.document.body
    }
  };
  assert.equal(isElementFixed(childOfFixed), true);

  const deepStatic = {
    _mockPosition: 'absolute',
    parentElement: {
      _mockPosition: 'relative',
      parentElement: global.document.body
    }
  };
  assert.equal(isElementFixed(deepStatic), false);

  delete global.window;
  delete global.document;
});
