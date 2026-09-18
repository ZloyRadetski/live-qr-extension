/**
 * QR Decoder Web Worker.
 *
 * Runs jsQR entirely off the main thread, eliminating 4–15 ms CPU spikes per frame.
 * Receives a transferred ArrayBuffer (zero-copy), performs the full detection loop
 * with CPU-side masking, and returns decoded QR array via postMessage.
 *
 * Protocol:
 *   IN  { id: number, buffer: ArrayBuffer, width: number, height: number, maxQRs?: number }
 *   OUT { id: number, qrs: Array<{ data: string, location: QRLocation }> }
 */

import jsQR from 'jsqr';
import { maskQrRegionInBuffer } from '../utils/coordinates.js';

self.onmessage = ({ data }) => {
  const { id, buffer, width, height, maxQRs = 4 } = data;

  // Wrap transferred ArrayBuffer as Uint8ClampedArray — zero-copy view
  const pixels = new Uint8ClampedArray(buffer);
  // imageData-like object required by maskQrRegionInBuffer
  const imageData = { data: pixels, width, height };
  const qrs = [];
  let count = 0;

  while (count < maxQRs) {
    let code = jsQR(pixels, width, height, { inversionAttempts: 'dontInvert' });
    if (!code) {
      code = jsQR(pixels, width, height, { inversionAttempts: 'onlyInvert' });
    }
    if (!code) break;

    // Serialize only plain-object fields — location is already a plain object
    qrs.push({ data: code.data, location: code.location });
    count++;

    // Mask found QR in the CPU buffer so next pass finds remaining QRs
    maskQrRegionInBuffer(imageData, code.location);
  }

  // Transfer the buffer back to avoid it being stranded in the Worker heap
  self.postMessage({ id, qrs }, [buffer]);
};
