/**
 * Test bench script to generate dynamic QR codes, animate rotating canvas QR,
 * and simulate video feed.
 */

import QRCode from 'qrcode';
import { QROverlayManager } from '../src/content/overlay.js';

// Setup sample QRs
async function renderSampleQRs() {
  const urlCanvas = document.getElementById('qr-url');
  if (urlCanvas) {
    await QRCode.toCanvas(urlCanvas, 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions', {
      width: 180,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
  }

  const wifiCanvas = document.getElementById('qr-wifi');
  if (wifiCanvas) {
    await QRCode.toCanvas(wifiCanvas, 'WIFI:S:Quantum_Lab;T:WPA;P:Hexa9918Secret;H:false;;', {
      width: 180,
      margin: 2,
      color: { dark: '#0a192f', light: '#ffffff' }
    });
  }

  const phoneCanvas = document.getElementById('qr-phone');
  if (phoneCanvas) {
    await QRCode.toCanvas(phoneCanvas, 'tel:+18005550199', {
      width: 180,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' }
    });
  }

  const smallImg = document.getElementById('qr-small-img');
  if (smallImg) {
    const dataUrl = await QRCode.toDataURL('https://antigravity.ai/tiny-dom-qr-test', {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    smallImg.src = dataUrl;
  }

  // Multi-QR Test Section
  const multi1 = document.getElementById('multi-qr-1');
  if (multi1) {
    multi1.src = await QRCode.toDataURL('https://github.com', {
      width: 200,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' }
    });
  }

  const multi2 = document.getElementById('multi-qr-2');
  if (multi2) {
    await QRCode.toCanvas(multi2, 'mailto:test@radar.io', {
      width: 140,
      margin: 2,
      color: { dark: '#047857', light: '#ffffff' }
    });
  }

  const multi3 = document.getElementById('multi-qr-3');
  if (multi3) {
    multi3.src = await QRCode.toDataURL('smsto:+123456789', {
      width: 200,
      margin: 2,
      color: { dark: '#6b21a8', light: '#ffffff' }
    });
  }
}

// Custom QR Generator
async function setupCustomGenerator() {
  const input = document.getElementById('custom-text');
  const btn = document.getElementById('generate-btn');
  const canvas = document.getElementById('custom-qr-canvas');

  if (!input || !btn || !canvas) return;

  async function generate() {
    const text = input.value.trim() || 'https://antigravity.ai';
    await QRCode.toCanvas(canvas, text, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
  }

  btn.addEventListener('click', generate);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') generate();
  });

  generate();
}

// Moving & Rotating QR on Canvas
async function setupAnimatedCanvas() {
  const canvas = document.getElementById('moving-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Generate an offscreen QR image
  const offscreenCanvas = document.createElement('canvas');
  await QRCode.toCanvas(offscreenCanvas, 'https://antigravity.ai/realtime-radar-moving', {
    width: 140,
    margin: 2
  });

  let angle = 0;
  let posX = 100;
  let direction = 1;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Update position and rotation
    posX += direction * 0.8;
    if (posX > canvas.width - 160 || posX < 40) {
      direction *= -1;
    }
    angle += 0.006;

    // Draw rotating QR
    ctx.save();
    ctx.translate(posX + 70, 130);
    ctx.rotate(angle);
    ctx.drawImage(offscreenCanvas, -70, -70);
    ctx.restore();

    requestAnimationFrame(animate);
  }

  animate();
}

// In-Page Simulation Demo (Shows HUD without extension)
function setupInPageSimulation() {
  const simBtn = document.getElementById('simulate-hud-btn');
  if (!simBtn) return;

  simBtn.addEventListener('click', () => {
    const existing = document.getElementById('qr-radar-root');
    if (existing) {
      existing.remove();
      simBtn.textContent = 'Simulate HUD Overlay';
      return;
    }

    simBtn.textContent = 'Hide Simulated HUD';

    const overlay = new QROverlayManager({
      soundEnabled: true,
      autoCopy: false,
      onStopRequested: () => {
        overlay.unmount();
        simBtn.textContent = 'Simulate HUD Overlay';
      }
    });

    overlay.mount();

    // Position mock detection over the first sample QR
    const sample = document.getElementById('qr-url');
    if (sample) {
      const rect = sample.getBoundingClientRect();
      const mockResult = {
        data: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions',
        location: {
          topLeftCorner: { x: rect.left, y: rect.top },
          topRightCorner: { x: rect.right, y: rect.top },
          bottomRightCorner: { x: rect.right, y: rect.bottom },
          bottomLeftCorner: { x: rect.left, y: rect.bottom }
        }
      };
      overlay.update(mockResult, 1, 1);
    }
  });
}

function initTestBench() {
  renderSampleQRs();
  setupCustomGenerator();
  setupAnimatedCanvas();
  setupInPageSimulation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTestBench);
} else {
  initTestBench();
}
