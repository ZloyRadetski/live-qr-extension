import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

function createIcon(size) {
  const png = new PNG({ width: size, height: size });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Base background: dark slate blue (#0d1117)
      png.data[idx] = 13;
      png.data[idx + 1] = 17;
      png.data[idx + 2] = 23;
      png.data[idx + 3] = 255;

      // Rounded border margin
      const margin = Math.max(1, Math.floor(size * 0.08));
      const innerSize = size - margin * 2;
      const nx = (x - margin) / innerSize;
      const ny = (y - margin) / innerSize;

      // Check if point is inside QR finder corners (3 corners)
      const isTopLeft = nx >= 0.1 && nx <= 0.45 && ny >= 0.1 && ny <= 0.45;
      const isTopRight = nx >= 0.55 && nx <= 0.9 && ny >= 0.1 && ny <= 0.45;
      const isBottomLeft = nx >= 0.1 && nx <= 0.45 && ny >= 0.55 && ny <= 0.9;
      const isTarget = nx >= 0.6 && nx <= 0.85 && ny >= 0.6 && ny <= 0.85;

      if (isTopLeft || isTopRight || isBottomLeft) {
        // Cyan color (#00f0ff)
        png.data[idx] = 0;
        png.data[idx + 1] = 240;
        png.data[idx + 2] = 255;
      } else if (isTarget) {
        // Emerald green (#38ef7d)
        png.data[idx] = 56;
        png.data[idx + 1] = 239;
        png.data[idx + 2] = 125;
      }
    }
  }

  const outPath = path.resolve(`icons/icon-${size}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log(`Generated ${outPath}`);
}

[16, 32, 48, 128].forEach(createIcon);
