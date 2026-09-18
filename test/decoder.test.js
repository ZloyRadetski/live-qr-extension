import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import { readBarcodes } from 'zxing-wasm/reader';

test('zxing-wasm WebAssembly decoder accurately decodes rendered QR code image buffer', async () => {
  const secretPayload = 'https://github.com/ZloyRadetski/live-qr-extension/scanner-verify-token-9988';

  const pngBuffer = await QRCode.toBuffer(secretPayload, {
    width: 250,
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' }
  });

  const png = PNG.sync.read(pngBuffer);
  const results = await readBarcodes(
    { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height },
    { formats: ['QRCode'] }
  );

  assert.equal(results.length, 1, 'zxing-wasm should return 1 result');
  assert.equal(results[0].text, secretPayload);
  assert.ok(results[0].position, 'zxing-wasm should provide position coordinates');
  assert.ok(results[0].position.topLeft.x >= 0);
  assert.ok(results[0].position.topRight.x > results[0].position.topLeft.x);
});

test('decodeVideoCrops safely handles empty or null video inputs without throwing', async () => {
  const { decodeVideoCrops, tabVideoRects } = await import('../src/background/background.js');

  assert.equal(await decodeVideoCrops(null, null), null);
  assert.equal(await decodeVideoCrops(null, { rects: [] }), null);
  assert.equal(await decodeVideoCrops({ width: 100, height: 100 }, null), null);
  assert.equal(await decodeVideoCrops({ width: 100, height: 100 }, { rects: [] }), null);
  assert.ok(tabVideoRects instanceof Map);
});

test('decodeVideoCrops projects coordinates accurately with DPR mismatch (LibreWolf RFP simulation)', async () => {
  const { decodeVideoCrops } = await import('../src/background/background.js');

  // Generate a test QR code buffer
  const payload = 'https://example.com/video-qr-pos-test';
  const qrPngBuffer = await QRCode.toBuffer(payload, { width: 100, margin: 2 });
  const qrPng = PNG.sync.read(qrPngBuffer);

  // Simulate a 1920x1080 physical screenshot image with a video at CSS (200, 100, 800, 450)
  // Scale is 1.25x (viewport 1536x864), but DPR is spoofed to 1.0 (LibreWolf RFP).
  const imgW = 1920;
  const imgH = 1080;
  const videoCSS = { left: 200, top: 100, width: 800, height: 450 };
  const scale = 1.25;

  // Place QR inside video at physical offset (+200, +150) -> CSS offset (+160, +120)
  const qrPhysOffsetX = 200;
  const qrPhysOffsetY = 150;

  let canvasW = 0, canvasH = 0;

  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          set width(w) { canvasW = w; },
          get width() { return canvasW; },
          set height(h) { canvasH = h; },
          get height() { return canvasH; },
          getContext: () => ({
            drawImage: () => {},
            getImageData: (x, y, w, h) => {
              const data = new Uint8ClampedArray(w * h * 4);
              data.fill(255);

              for (let qy = 0; qy < qrPng.height; qy++) {
                for (let qx = 0; qx < qrPng.width; qx++) {
                  const targetX = qrPhysOffsetX + qx;
                  const targetY = qrPhysOffsetY + qy;
                  if (targetX >= 0 && targetX < w && targetY >= 0 && targetY < h) {
                    const srcIdx = (qy * qrPng.width + qx) * 4;
                    const dstIdx = (targetY * w + targetX) * 4;
                    data[dstIdx] = qrPng.data[srcIdx];
                    data[dstIdx + 1] = qrPng.data[srcIdx + 1];
                    data[dstIdx + 2] = qrPng.data[srcIdx + 2];
                    data[dstIdx + 3] = qrPng.data[srcIdx + 3];
                  }
                }
              }
              return { data, width: w, height: h };
            }
          })
        };
      }
      return {};
    }
  };

  const fakeImg = { width: imgW, height: imgH };
  const videoInfo = {
    rects: [videoCSS],
    dpr: 1.0, // Spoofed by LibreWolf RFP!
    viewportWidth: 1536,
    viewportHeight: 864
  };

  const result = await decodeVideoCrops(fakeImg, videoInfo);

  delete global.document;

  assert.ok(result, 'decodeVideoCrops should return a result');
  assert.equal(result.qrs.length, 1);
  assert.equal(result.qrs[0].data, payload);

  // Expected CSS position: videoCSS.left (200) + qrPhysOffsetX / scale (200 / 1.25 = 160) = 360
  // and videoCSS.top (100) + qrPhysOffsetY / scale (150 / 1.25 = 120) = 220
  const loc = result.qrs[0].location;
  assert.ok(Math.abs(loc.topLeftCorner.x - 360) <= 8, `Expected x ~ 360, got ${loc.topLeftCorner.x}`);
  assert.ok(Math.abs(loc.topLeftCorner.y - 220) <= 8, `Expected y ~ 220, got ${loc.topLeftCorner.y}`);

  // scanWidth/Height must equal the CSS viewport so overlay scaleX/Y is 1.0
  assert.equal(result.scanWidth, 1536);
  assert.equal(result.scanHeight, 864);
});

test('computeFrameHash is unaffected by fetch-to-blob refactor (no regression)', async () => {
  const { computeFrameHash } = await import('../src/background/background.js');

  // Simulate a realistic data URL prefix (JPEG)
  const fakeDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
  const h1 = computeFrameHash(fakeDataUrl);
  const h2 = computeFrameHash(fakeDataUrl);
  assert.equal(h1, h2, 'Hash must be deterministic');
  assert.ok(h1 !== 0, 'Hash must be non-zero for non-empty input');
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

test('fastBase64ToBytes accurately decodes base64 strings with all padding variants', async () => {
  const { fastBase64ToBytes } = await import('../src/background/background.js');

  // Test various byte lengths (0, 1, 2 pad chars)
  const samples = [
    'Hello World!',
    'A',
    'AB',
    'ABC',
    'Testing fast base64 decoder lookup table with various symbols 1234567890 !@#$%^&*()_+',
    String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i))
  ];

  for (const str of samples) {
    const expected = Buffer.from(str, 'binary');
    const b64 = expected.toString('base64');
    const decoded = fastBase64ToBytes(b64);
    assert.deepEqual(Buffer.from(decoded), expected, `Mismatch decoding base64 for sample length ${str.length}`);

    // Verify startIndex offset works identically without slicing
    const prefix = 'data:image/jpeg;base64,';
    const withPrefix = prefix + b64;
    const decodedWithOffset = fastBase64ToBytes(withPrefix, prefix.length);
    assert.deepEqual(Buffer.from(decodedWithOffset), expected, `Mismatch decoding base64 with startIndex for sample length ${str.length}`);
  }
});

test('dataUrlToBlob creates a Blob with correct mime type and payload', async () => {
  const { dataUrlToBlob } = await import('../src/background/background.js');

  const text = 'QR_RADAR_DATA_URL_TEST';
  const b64 = Buffer.from(text).toString('base64');
  const dataUrl = `data:text/plain;base64,${b64}`;

  const blob = dataUrlToBlob(dataUrl);
  assert.ok(blob instanceof Blob, 'Should return an instance of Blob');
  assert.equal(blob.type, 'text/plain');
  assert.equal(blob.size, text.length);

  const arrayBuffer = await blob.arrayBuffer();
  assert.equal(Buffer.from(arrayBuffer).toString('utf-8'), text);

  // Invalid URL without comma
  assert.equal(dataUrlToBlob('invalid_data_url'), null);
});

