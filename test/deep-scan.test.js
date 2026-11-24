import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';

/**
 * Synthetic 4K "screenshot" with a tiny QR code (2 px per module, odd offset so that the fast
 * pass's 2x downscale smears every module across pixel boundaries). The mocked canvas implements
 * drawImage with real box/bilinear resampling, so these tests exercise the real tile planning,
 * upscaling and coordinate-mapping code of decodeDataUrl.
 */
const SCREEN_W = 3840;
const SCREEN_H = 2160;
const MODULE_PX = 2;
const QUIET = 4;
const QR_X = 2501; // odd => blur after downscale
const QR_Y = 1301;

function buildScreen(payload) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const data = new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4).fill(240);
  const side = (n + QUIET * 2) * MODULE_PX;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / MODULE_PX) - QUIET;
      const my = Math.floor(y / MODULE_PX) - QUIET;
      const dark = mx >= 0 && my >= 0 && mx < n && my < n && qr.modules.get(my, mx);
      const v = dark ? 15 : 240;
      const i = ((QR_Y + y) * SCREEN_W + (QR_X + x)) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
  // QR top-left corner (first finder pattern) in screen pixels
  return { data, finderTopLeft: { x: QR_X + QUIET * MODULE_PX, y: QR_Y + QUIET * MODULE_PX }, size: n * MODULE_PX };
}

// background.js caches its canvases per module, so the mocks read the screen through this holder
let currentScreen = null;

function makeCanvasMock() {
  return () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'low',
        drawImage(_bitmap, ...a) {
          let sx = 0, sy = 0, sw = SCREEN_W, sh = SCREEN_H, dx = 0, dy = 0, dw, dh;
          if (a.length === 4) [dx, dy, dw, dh] = a;
          else[sx, sy, sw, sh, dx, dy, dw, dh] = a;
          this._img = { sx, sy, sw, sh, dw, dh };
        },
        getImageData(_x, _y, w, h) {
          const screen = currentScreen;
          const { sx, sy, sw, sh } = this._img;
          const out = new Uint8ClampedArray(w * h * 4);
          const kx = sw / w;
          const ky = sh / h;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let v;
              if (kx > 1 || ky > 1) {
                // box filter
                const x0 = Math.floor(sx + x * kx), x1 = Math.max(x0 + 1, Math.floor(sx + (x + 1) * kx));
                const y0 = Math.floor(sy + y * ky), y1 = Math.max(y0 + 1, Math.floor(sy + (y + 1) * ky));
                let acc = 0, c = 0;
                for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { acc += screen.data[(yy * SCREEN_W + xx) * 4]; c++; }
                v = acc / c;
              } else {
                // bilinear
                const fx = Math.min(SCREEN_W - 1, Math.max(0, sx + (x + 0.5) * kx - 0.5));
                const fy = Math.min(SCREEN_H - 1, Math.max(0, sy + (y + 0.5) * ky - 0.5));
                const x0 = Math.floor(fx), y0 = Math.floor(fy);
                const x1 = Math.min(SCREEN_W - 1, x0 + 1), y1 = Math.min(SCREEN_H - 1, y0 + 1);
                const tx = fx - x0, ty = fy - y0;
                const p = (xx, yy) => screen.data[(yy * SCREEN_W + xx) * 4];
                v = (p(x0, y0) * (1 - tx) + p(x1, y0) * tx) * (1 - ty) + (p(x0, y1) * (1 - tx) + p(x1, y1) * tx) * ty;
              }
              const o = (y * w + x) * 4;
              out[o] = out[o + 1] = out[o + 2] = v;
              out[o + 3] = 255;
            }
          }
          return { data: out, width: w, height: h };
        }
      })
    };
    return canvas;
  };
}

test('deep pass finds a 2px/module QR code in a 4K frame and reports its position in scan space', async () => {
  const payload = 'https://example.com/tiny-qr-deep-scan?token=abc123';
  const screen = buildScreen(payload);

  currentScreen = screen;
  global.document = { createElement: (tag) => (tag === 'canvas' ? makeCanvasMock()() : {}) };
  global.createImageBitmap = async () => ({ width: SCREEN_W, height: SCREEN_H, close() {} });

  try {
    const { decodeDataUrl } = await import('../src/background/background.js');
    // A valid (tiny) data URL: the bitmap itself is mocked
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

    const deep = await decodeDataUrl(dataUrl, 1920, null, { deep: true });
    assert.ok(deep, 'decodeDataUrl must return a result');
    assert.equal(deep.scanWidth, 1920, 'scan space is the downscaled fast-pass canvas');
    assert.equal(deep.scanHeight, 1080);
    assert.equal(deep.qrs.length, 1, 'exactly one code, duplicates from overlapping tiles merged');
    assert.equal(deep.qrs[0].data, payload);

    // Location must be expressed in 1920x1080 scan space (screen / 2)
    const tl = deep.qrs[0].location.topLeftCorner;
    const expectX = screen.finderTopLeft.x / 2;
    const expectY = screen.finderTopLeft.y / 2;
    assert.ok(Math.abs(tl.x - expectX) <= 4, `x ${tl.x} should be ~${expectX}`);
    assert.ok(Math.abs(tl.y - expectY) <= 4, `y ${tl.y} should be ~${expectY}`);
    const br = deep.qrs[0].location.bottomRightCorner;
    assert.ok(Math.abs((br.x - tl.x) - screen.size / 2) <= 6, 'code width in scan space ~ size/2');
  } finally {
    delete global.document;
    delete global.createImageBitmap;
  }
});

test('deep pass leaves an empty frame empty (flat tiles are skipped, no false positives)', async () => {
  const blank = { data: new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4).fill(235), finderTopLeft: { x: 0, y: 0 }, size: 0 };
  currentScreen = blank;
  global.document = { createElement: (tag) => (tag === 'canvas' ? makeCanvasMock()() : {}) };
  global.createImageBitmap = async () => ({ width: SCREEN_W, height: SCREEN_H, close() {} });

  try {
    const { decodeDataUrl } = await import('../src/background/background.js');
    const res = await decodeDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==', 1920, null, { deep: true });
    assert.ok(res);
    assert.deepEqual(res.qrs, []);
    assert.equal(res.qr, null);
  } finally {
    delete global.document;
    delete global.createImageBitmap;
  }
});
