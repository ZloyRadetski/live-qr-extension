/**
 * Release packaging script for Mozilla Add-ons (AMO).
 * Generates two clean, standard ZIP archives in release/:
 * 1. qr-radar-v1.0.0.zip — the extension package for installation / upload
 * 2. qr-radar-v1.0.0-sources.zip — clean source code for Mozilla AMO reviewers
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';

/**
 * Pure Node.js standard ZIP archive generator (Zero external dependencies).
 * Enforces forward slashes (/) for cross-platform and Mozilla AMO validator compliance.
 * @param {Array<{ name: string, data: Buffer }>} files 
 * @param {string} outPath 
 */
function createZip(files, outPath) {
  const localHeaders = [];
  const centralEntries = [];
  let offset = 0;

  for (const file of files) {
    const cleanName = file.name.replace(/\\/g, '/');
    const nameBuf = Buffer.from(cleanName, 'utf8');
    const uncompressed = file.data;
    const crc = zlib.crc32(uncompressed);
    const compressed = zlib.deflateRawSync(uncompressed);

    // Local file header (30 bytes + nameBuf.length)
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    lh.writeUInt16LE(20, 4);         // Version needed: 2.0
    lh.writeUInt16LE(0x0800, 6);     // Flags: UTF-8 (bit 11)
    lh.writeUInt16LE(8, 8);          // Compression: Deflate
    lh.writeUInt16LE(0, 10);         // Mod time
    lh.writeUInt16LE(0, 12);         // Mod date
    lh.writeUInt32LE(crc, 14);       // CRC-32
    lh.writeUInt32LE(compressed.length, 18);   // Comp size
    lh.writeUInt32LE(uncompressed.length, 22); // Uncomp size
    lh.writeUInt16LE(nameBuf.length, 26);      // Name len
    lh.writeUInt16LE(0, 28);                   // Extra len
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, compressed);

    // Central directory header (46 bytes + nameBuf.length)
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    cd.writeUInt16LE(20, 4);         // Version made by: 2.0
    cd.writeUInt16LE(20, 6);         // Version needed: 2.0
    cd.writeUInt16LE(0x0800, 8);     // Flags: UTF-8
    cd.writeUInt16LE(8, 10);         // Compression: Deflate
    cd.writeUInt16LE(0, 12);         // Mod time
    cd.writeUInt16LE(0, 14);         // Mod date
    cd.writeUInt32LE(crc, 16);       // CRC-32
    cd.writeUInt32LE(compressed.length, 20);   // Comp size
    cd.writeUInt32LE(uncompressed.length, 24); // Uncomp size
    cd.writeUInt16LE(nameBuf.length, 28);      // Name len
    cd.writeUInt16LE(0, 30);                   // Extra len
    cd.writeUInt16LE(0, 32);                   // Comment len
    cd.writeUInt16LE(0, 34);                   // Disk start
    cd.writeUInt16LE(0, 36);                   // Internal attrs
    cd.writeUInt32LE(0, 38);                   // External attrs
    cd.writeUInt32LE(offset, 42);              // Local header offset
    nameBuf.copy(cd, 46);

    centralEntries.push(cd);
    offset += lh.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralEntries);
  const cdSize = centralDir.length;
  const cdOffset = offset;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
  eocd.writeUInt16LE(0, 4);          // Disk num
  eocd.writeUInt16LE(0, 6);          // Start disk
  eocd.writeUInt16LE(files.length, 8);  // Disk entries
  eocd.writeUInt16LE(files.length, 10); // Total entries
  eocd.writeUInt32LE(cdSize, 12);       // CD size
  eocd.writeUInt32LE(cdOffset, 16);     // CD offset
  eocd.writeUInt16LE(0, 20);            // Comment len

  const outBuffer = Buffer.concat([...localHeaders, centralDir, eocd]);
  fs.writeFileSync(outPath, outBuffer);
}

function collectFiles(dir, baseDir = dir) {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath, baseDir));
    } else {
      const relName = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const data = fs.readFileSync(fullPath);
      result.push({ name: relName, data });
    }
  }
  return result;
}

async function packageRelease() {
  console.log('[Release] Building production bundles...');
  execSync('node build.js', { stdio: 'inherit' });

  const releaseDir = path.resolve('release');
  if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true, force: true });
  }
  fs.mkdirSync(releaseDir, { recursive: true });

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = pkg.version || '1.0.0';

  // 1. Collect Extension Runtime Files
  const extFiles = [
    { name: 'manifest.json', data: fs.readFileSync('manifest.json') },
    ...collectFiles('icons').map((f) => ({ name: `icons/${f.name}`, data: f.data })),
    ...collectFiles('dist').map((f) => ({ name: `dist/${f.name}`, data: f.data })),
    { name: 'src/popup/popup.html', data: fs.readFileSync('src/popup/popup.html') },
    { name: 'src/popup/popup.css', data: fs.readFileSync('src/popup/popup.css') }
  ];

  const extZipName = `qr-radar-v${version}.zip`;
  const extZipPath = path.join(releaseDir, extZipName);
  createZip(extFiles, extZipPath);

  // 2. Collect Reviewer Source Code Files
  const reviewerNotes = `# Build Instructions for Mozilla AMO Reviewers

This add-on uses \`esbuild\` to bundle modern ES modules into browser-compatible scripts.

## Requirements
- Node.js >= 18.0.0
- npm >= 9.0.0

## Steps to Reproduce the Build
1. Extract this source archive into an empty directory.
2. Run \`npm install\` to install the dependencies (\`esbuild\`, \`zxing-wasm\`, \`jsqr\`, \`qrcode\`).
3. Run \`npm run build\` (or \`node build.js\`).
4. The output bundles and WebAssembly binaries will be generated in \`dist/\`:
   - \`dist/background.bundle.js\`
   - \`dist/content.bundle.js\`
   - \`dist/decoder.worker.bundle.js\`
   - \`dist/zxing_reader.wasm\`
   - \`dist/popup.bundle.js\`
   - \`dist/overlay.css\`
`;

  const srcFiles = [
    { name: 'manifest.json', data: fs.readFileSync('manifest.json') },
    { name: 'package.json', data: fs.readFileSync('package.json') },
    { name: 'package-lock.json', data: fs.readFileSync('package-lock.json') },
    { name: 'build.js', data: fs.readFileSync('build.js') },
    { name: 'package.js', data: fs.readFileSync('package.js') },
    { name: 'BUILD.md', data: Buffer.from(reviewerNotes, 'utf8') },
    ...collectFiles('icons').map((f) => ({ name: `icons/${f.name}`, data: f.data })),
    ...collectFiles('src').map((f) => ({ name: `src/${f.name}`, data: f.data }))
  ];

  if (fs.existsSync('README.md')) {
    srcFiles.push({ name: 'README.md', data: fs.readFileSync('README.md') });
  }

  const srcZipName = `qr-radar-v${version}-sources.zip`;
  const srcZipPath = path.join(releaseDir, srcZipName);
  createZip(srcFiles, srcZipPath);

  console.log('\n[Release] Done successfully!');
  console.log(`  1. Extension package for AMO upload: release/${extZipName} (${(fs.statSync(extZipPath).size / 1024).toFixed(1)} KB)`);
  console.log(`  2. Source code for AMO reviewer:     release/${srcZipName} (${(fs.statSync(srcZipPath).size / 1024).toFixed(1)} KB)\n`);
}

packageRelease().catch((err) => {
  console.error('[Release] Error:', err);
  process.exit(1);
});
