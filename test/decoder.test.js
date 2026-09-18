import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

test('jsQR accurately decodes rendered QR code image buffer', async () => {
  const secretPayload = 'https://antigravity.ai/scanner-verify-token-9988';

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
