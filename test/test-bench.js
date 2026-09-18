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

// Blinking & Toggle Test (Card 8)
async function setupBlinkingTest() {
  const img = document.getElementById('blinking-qr-img');
  const canvas = document.getElementById('blinking-qr-canvas');
  const toggleBtn = document.getElementById('toggle-blink-manual');
  const autoBtn = document.getElementById('toggle-blink-auto');
  const intervalSelect = document.getElementById('blink-interval-select');
  const modeSelect = document.getElementById('blink-mode-select');
  const statusBadge = document.getElementById('blink-status-badge');
  const statsSpan = document.getElementById('blink-stats');

  if (!img || !canvas || !toggleBtn) return;

  // Render initial QRs
  const dataUrl = await QRCode.toDataURL('https://antigravity.ai/blink-test-img', {
    width: 200,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });
  img.src = dataUrl;

  const offscreen = document.createElement('canvas');
  offscreen.width = 150;
  offscreen.height = 150;
  await QRCode.toCanvas(offscreen, 'https://antigravity.ai/blink-test-canvas', {
    width: 150,
    margin: 2,
    color: { dark: '#031326', light: '#ffffff' }
  });

  const ctx = canvas.getContext('2d');
  function drawCanvasQR() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  }
  function clearCanvasQR() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  drawCanvasQR();

  let isVisible = true;
  let toggleCount = 0;
  let autoTimer = null;
  let autoRunning = true;

  function setVisibleState(visible, mode) {
    isVisible = visible;
    toggleCount++;
    if (statsSpan) statsSpan.textContent = `Переключений: ${toggleCount}`;

    if (statusBadge) {
      if (visible) {
        statusBadge.style.background = 'rgba(56, 239, 125, 0.15)';
        statusBadge.style.color = '#38ef7d';
        statusBadge.style.borderColor = 'rgba(56, 239, 125, 0.3)';
        statusBadge.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #38ef7d; box-shadow: 0 0 8px #38ef7d;"></span> STATUS: VISIBLE`;
      } else {
        statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBadge.style.color = '#ef4444';
        statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        statusBadge.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #ef4444;"></span> STATUS: HIDDEN`;
      }
    }

    // Reset styles
    img.style.display = '';
    img.style.visibility = '';
    img.style.opacity = '';
    canvas.style.display = '';
    canvas.style.visibility = '';
    canvas.style.opacity = '';

    if (visible) {
      drawCanvasQR();
    } else {
      if (mode === 'display') {
        img.style.display = 'none';
        canvas.style.display = 'none';
      } else if (mode === 'visibility') {
        img.style.visibility = 'hidden';
        canvas.style.visibility = 'hidden';
      } else if (mode === 'opacity') {
        img.style.opacity = '0';
        canvas.style.opacity = '0';
      } else if (mode === 'clear') {
        clearCanvasQR();
        img.style.display = 'none';
      }
    }
  }

  function toggle() {
    const mode = modeSelect ? modeSelect.value : 'display';
    setVisibleState(!isVisible, mode);
  }

  function restartAutoBlink() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (!autoRunning) return;
    const interval = parseInt(intervalSelect ? intervalSelect.value : '1000', 10) || 1000;
    autoTimer = setInterval(toggle, interval);
  }

  toggleBtn.addEventListener('click', () => {
    // If user clicks manual toggle, stop auto-blink
    autoRunning = false;
    if (autoBtn) autoBtn.textContent = 'Auto-Blink: OFF';
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    toggle();
  });

  if (autoBtn) {
    autoBtn.addEventListener('click', () => {
      autoRunning = !autoRunning;
      autoBtn.textContent = autoRunning ? 'Auto-Blink: ON' : 'Auto-Blink: OFF';
      if (autoRunning) {
        restartAutoBlink();
      } else if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    });
  }

  if (intervalSelect) {
    intervalSelect.addEventListener('change', () => {
      if (autoRunning) restartAutoBlink();
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      setVisibleState(isVisible, modeSelect.value);
    });
  }

  restartAutoBlink();
}

function initTestBench() {
  renderSampleQRs();
  setupCustomGenerator();
  setupAnimatedCanvas();
  setupBlinkingTest();
  setupInPageSimulation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTestBench);
} else {
  initTestBench();
}
