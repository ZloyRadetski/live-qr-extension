/**
 * Build script for Firefox extension bundles.
 */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

async function build() {
  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Bundle Content Script
  console.log('[Build] Bundling content script...');
  await esbuild.build({
    entryPoints: ['src/content/content.js'],
    bundle: true,
    outfile: 'dist/content.bundle.js',
    format: 'iife',
    target: ['firefox109'],
    sourcemap: false,
    minify: false
  });

  // 2. Bundle Popup Script
  console.log('[Build] Bundling popup script...');
  await esbuild.build({
    entryPoints: ['src/popup/popup.js'],
    bundle: true,
    outfile: 'dist/popup.bundle.js',
    format: 'iife',
    target: ['firefox109'],
    sourcemap: false,
    minify: false
  });

  // 3. Bundle Background Script
  console.log('[Build] Bundling background script...');
  await esbuild.build({
    entryPoints: ['src/background/background.js'],
    bundle: true,
    outfile: 'dist/background.bundle.js',
    format: 'iife',
    target: ['firefox109'],
    sourcemap: false,
    minify: false
  });

  // 4. Copy Overlay CSS to dist
  console.log('[Build] Copying overlay CSS...');
  fs.copyFileSync('src/content/overlay.css', 'dist/overlay.css');

  // 5. Bundle Test Bench
  console.log('[Build] Bundling test bench...');
  await esbuild.build({
    entryPoints: ['test/test-bench.js'],
    bundle: true,
    outfile: 'test/test-bench.bundle.js',
    format: 'esm',
    sourcemap: false
  });

  console.log('[Build] Done successfully!');
}

build().catch((err) => {
  console.error('[Build] Failed:', err);
  process.exit(1);
});
