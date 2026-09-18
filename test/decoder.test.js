import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

test('jsQR accurately decodes rendered QR code image buffer', async () => {
  const secretPayload = 'https://github.com/ZloyRadetski/live-qr-extension/scanner-verify-token-9988';

  // Render QR to PNG buffer
  const pngBuffer = await QRCode.toBuffer(secretPayload, {
    width: 250,
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' }
  });

  // Decode PNG to RGBA pixels
  const png = PNG.sync.read(pngBuffer);
  assert.equal(png.width, 250);
  assert.equal(png.height, 250);

  // Run jsQR decoder
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

  assert.ok(decoded, 'Decoder should return result');
  assert.equal(decoded.data, secretPayload);
  assert.ok(decoded.location, 'Decoder should provide polygon coordinates');
  assert.ok(decoded.location.topLeftCorner.x >= 0);
  assert.ok(decoded.location.topRightCorner.x > decoded.location.topLeftCorner.x);
});

test('decodeVideoCrops safely handles empty or null video inputs without throwing', async () => {
  const { decodeVideoCrops, tabVideoRects } = await import('../src/background/background.js');
  
  assert.equal(decodeVideoCrops(null, null), null);
  assert.equal(decodeVideoCrops(null, { rects: [] }), null);
  assert.equal(decodeVideoCrops({ width: 100, height: 100 }, null), null);
  assert.equal(decodeVideoCrops({ width: 100, height: 100 }, { rects: [] }), null);
  assert.ok(tabVideoRects instanceof Map);
});

test('computeFrameHash produces identical hash for identical inputs', async () => {
  const { computeFrameHash } = await import('../src/background/background.js');

  const sampleUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/AAABBBCCDDEE==';

  const h1 = computeFrameHash(sampleUrl);
  const h2 = computeFrameHash(sampleUrl);
  assert.equal(h1, h2, 'Same input must produce same hash');
  assert.equal(typeof h1, 'number', 'Hash must be a number');
});

test('computeFrameHash produces different hashes for different frames', async () => {
  const { computeFrameHash } = await import('../src/background/background.js');

  const urlA = 'data:image/jpeg;base64,AAAABBBBCCCC';
  const urlB = 'data:image/jpeg;base64,XXXXYYYYZZZZ';

  assert.notEqual(computeFrameHash(urlA), computeFrameHash(urlB), 'Different inputs must produce different hashes');
});

test('computeFrameHash handles edge cases without throwing', async () => {
  const { computeFrameHash } = await import('../src/background/background.js');

  assert.doesNotThrow(() => computeFrameHash(''));
  assert.doesNotThrow(() => computeFrameHash('x'));
  assert.equal(computeFrameHash(''), 0, 'Empty string should return 0');
});

