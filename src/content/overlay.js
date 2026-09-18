/**
 * Overlay HUD Manager for QR Code Radar.
 * Injects and manages the visual tracking bounding box, HUD cards, and status bar.
 */

import { classifyContent } from '../utils/parser.js';
import { computeBounds, lerpLocation } from '../utils/coordinates.js';
import { addScanHistory } from '../utils/storage.js';
import { findAnchorElement, computeAnchorOffset, resolveAnchorPosition } from '../utils/dom-anchor.js';

export class QROverlayManager {
  constructor(options = {}) {
    this.options = {
      soundEnabled: true,
      autoCopy: false,
      onStopRequested: () => {},
      ...options
    };

    this.root = null;
    this.boxElement = null;
    this.hudCard = null;
    this.miniBadge = null;

    this.currentLocation = null;
    this.lastDetectedText = null;
    this.docBounds = null;
    this.anchorElement = null;
    this.anchorOffset = null;
    this.isScrolling = false;
    this.scrollTimer = null;
    this.missingFrames = 0;
    this.maxMissingFrames = 8; // Fade out after ~8 missing frames
    this.audioCtx = null;
  }

  /**
   * Initializes overlay DOM structure.
   */
  mount() {
    if (this.root) return;

    this.root = document.createElement('div');
    this.root.id = 'qr-radar-root';

    // Bounding Box & Corners
    this.boxElement = document.createElement('div');
    this.boxElement.className = 'qr-radar-box qr-hidden';
    this.boxElement.innerHTML = `
      <div class="qr-radar-box-frame">
        <div class="qr-radar-corner qr-radar-corner-tl"></div>
        <div class="qr-radar-corner qr-radar-corner-tr"></div>
        <div class="qr-radar-corner qr-radar-corner-bl"></div>
        <div class="qr-radar-corner qr-radar-corner-br"></div>
        <div class="qr-radar-mini-badge" title="Hover for details">
          <span class="qr-mini-dot"></span>
          <span class="qr-mini-type">QR</span>
        </div>
      </div>
    `;

    this.miniBadge = this.boxElement.querySelector('.qr-radar-mini-badge');

    // Floating HUD Card (hidden by default, expands on hover)
    this.hudCard = document.createElement('div');
    this.hudCard.className = 'qr-radar-hud-card';
    this.boxElement.appendChild(this.hudCard);

    this.root.appendChild(this.boxElement);
    document.body.appendChild(this.root);
  }

  /**
   * Updates HUD with newly detected QR code.
   * @param {{ location: any, data: string }} qrResult
   * @param {number} scaleX
   * @param {number} scaleY
   */
  update(qrResult, scaleX, scaleY) {
    if (!this.root) this.mount();

    if (!qrResult) {
      this.missingFrames++;
      if (this.missingFrames > this.maxMissingFrames) {
        this.boxElement.classList.add('qr-hidden');
        this.currentLocation = null;
        this.anchorElement = null;
        this.anchorOffset = null;
        this.docBounds = null;
      }
      return;
    }

    this.missingFrames = 0;
    this.boxElement.classList.remove('qr-hidden');

    // If user is actively scrolling, do not let delayed screenshot coordinates jerk the box
    if (this.isScrolling) {
      const text = qrResult.data;
      if (text !== this.lastDetectedText) {
        this.lastDetectedText = text;
        this.renderCardContent(text);
        this.onNewQRAcquired(text);
      }
      return;
    }

    // Scale location points
    const rawLoc = qrResult.location;
    const targetLoc = {
      topLeftCorner: { x: rawLoc.topLeftCorner.x * scaleX, y: rawLoc.topLeftCorner.y * scaleY },
      topRightCorner: { x: rawLoc.topRightCorner.x * scaleX, y: rawLoc.topRightCorner.y * scaleY },
      bottomRightCorner: { x: rawLoc.bottomRightCorner.x * scaleX, y: rawLoc.bottomRightCorner.y * scaleY },
      bottomLeftCorner: { x: rawLoc.bottomLeftCorner.x * scaleX, y: rawLoc.bottomLeftCorner.y * scaleY }
    };

    // Smooth location
    this.currentLocation = lerpLocation(this.currentLocation, targetLoc, 0.45);
    const bounds = computeBounds(this.currentLocation);

    // Anchor to the real DOM element under the QR code (IMG, VIDEO, CANVAS, etc.)
    if (!this.anchorElement || !this.anchorElement.isConnected) {
      this.anchorElement = findAnchorElement(bounds.centerX, bounds.centerY);
    }
    this.anchorOffset = computeAnchorOffset(this.anchorElement, bounds);

    // Document-relative fallback
    this.docBounds = {
      docX: bounds.minX + window.scrollX,
      docY: bounds.minY + window.scrollY,
      width: bounds.width,
      height: bounds.height
    };

    // Apply viewport position
    this.applyPosition(bounds.minX, bounds.minY, bounds.width, bounds.height, true);

    // New QR detected or changed?
    const text = qrResult.data;
    if (text !== this.lastDetectedText) {
      this.lastDetectedText = text;
      this.renderCardContent(text);
      this.onNewQRAcquired(text);
    }
  }

  /**
   * Applies position and card orientation using GPU compositor.
   */
  applyPosition(x, y, width, height, isVisible) {
    if (!this.boxElement) return;

    if (!isVisible) {
      this.boxElement.style.visibility = 'hidden';
      return;
    }

    this.boxElement.style.visibility = 'visible';
    // GPU-accelerated translate3d bypasses layout reflow and repaints
    this.boxElement.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;

    // Only update dimensions if changed
    if (width > 0 && this.lastWidth !== width) {
      this.lastWidth = width;
      this.boxElement.style.width = `${Math.round(width)}px`;
    }
    if (height > 0 && this.lastHeight !== height) {
      this.lastHeight = height;
      this.boxElement.style.height = `${Math.round(height)}px`;
    }

    // Flip card if too close to bottom of screen
    const spaceBelow = window.innerHeight - (y + height);
    if (spaceBelow < 180) {
      this.hudCard.classList.add('qr-flipped');
    } else {
      this.hudCard.classList.remove('qr-flipped');
    }
  }

  /**
   * Instantly compensates bounding box position on page scroll (60/120 FPS)
   * using real-time DOM element bounding rect.
   */
  onScroll() {
    if (!this.boxElement || this.boxElement.classList.contains('qr-hidden')) {
      return;
    }

    // Freeze background snapshot overwrites during active scroll
    this.isScrolling = true;
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      this.isScrolling = false;
    }, 130);

    // 1. Primary: Track anchored DOM element in real-time
    if (this.anchorElement && this.anchorElement.isConnected && this.anchorOffset) {
      const pos = resolveAnchorPosition(this.anchorElement, this.anchorOffset);
      if (pos) {
        this.applyPosition(pos.x, pos.y, pos.width, pos.height, pos.isVisible);
        return;
      }
    }

    // 2. Fallback: Track document coordinates
    if (this.docBounds) {
      const currentViewportX = this.docBounds.docX - window.scrollX;
      const currentViewportY = this.docBounds.docY - window.scrollY;

      const isOut = (
        currentViewportY + this.docBounds.height < -10 ||
        currentViewportY > window.innerHeight + 10 ||
        currentViewportX + this.docBounds.width < -10 ||
        currentViewportX > window.innerWidth + 10
      );

      this.applyPosition(currentViewportX, currentViewportY, this.docBounds.width, this.docBounds.height, !isOut);
    }
  }

  /**
   * Renders the interactive contents of the HUD card.
   * @param {string} text
   */
  renderCardContent(text) {
    const parsed = classifyContent(text);

    let actionBtnHtml = '';
    if (parsed.type === 'url' && parsed.actionUrl) {
      actionBtnHtml = `
        <a href="${escapeHtml(parsed.actionUrl)}" target="_blank" rel="noopener noreferrer" class="qr-btn qr-btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Open Link
        </a>
      `;
    }

    this.hudCard.innerHTML = `
      <div class="qr-radar-hud-header">
        <span class="qr-radar-type-badge qr-badge-${parsed.type}">${parsed.type}</span>
        <span style="font-size: 11px; color: #8b949e;">${escapeHtml(parsed.title)}</span>
      </div>
      <div class="qr-radar-hud-body">
        ${escapeHtml(parsed.summary)}
      </div>
      <div class="qr-radar-hud-actions">
        <button class="qr-btn qr-btn-secondary qr-copy-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="qr-copy-label">Copy</span>
        </button>
        ${actionBtnHtml}
      </div>
    `;

    // Copy event listener
    const copyBtn = this.hudCard.querySelector('.qr-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(text, copyBtn);
      });
    }

    // Update mini badge label on the frame
    if (this.miniBadge) {
      const typeLabels = {
        url: '🔗 LINK',
        wifi: '📶 WIFI',
        email: '📧 EMAIL',
        phone: '📞 CALL',
        sms: '💬 SMS',
        geo: '📍 GEO',
        text: '📝 TEXT'
      };
      const typeText = typeLabels[parsed.type] || 'QR';
      const typeSpan = this.miniBadge.querySelector('.qr-mini-type');
      if (typeSpan) typeSpan.textContent = typeText;
      this.miniBadge.className = `qr-radar-mini-badge qr-mini-${parsed.type}`;
    }
  }

  /**
   * Triggered when a new QR code is detected.
   * @param {string} text
   */
  onNewQRAcquired(text) {
    const parsed = classifyContent(text);

    // Save to history
    addScanHistory({
      text,
      type: parsed.type,
      title: parsed.title
    }).catch(() => {});

    // Sound chime
    if (this.options.soundEnabled) {
      this.playChime();
    }

    // Auto copy
    if (this.options.autoCopy) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  /**
   * Copies text to clipboard and updates button state.
   */
  async copyToClipboard(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const label = btn.querySelector('.qr-copy-label');
      btn.classList.add('qr-btn-copied');
      if (label) label.textContent = 'Copied! ✓';
      setTimeout(() => {
        btn.classList.remove('qr-btn-copied');
        if (label) label.textContent = 'Copy';
      }, 2000);
    } catch (err) {
      console.warn('[QR-Radar] Clipboard write failed:', err);
    }
  }

  /**
   * Plays a subtle high-tech synth beep using Web Audio API.
   */
  playChime() {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioCtx = new AudioCtx();
      }
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.1); // E6

      gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.15);
    } catch {
      // Audio context might be restricted
    }
  }

  /**
   * Unmounts overlay and cleans up DOM.
   */
  unmount() {
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.boxElement = null;
    this.hudCard = null;
    this.miniBadge = null;
    this.currentLocation = null;
    this.lastDetectedText = null;
    this.anchorElement = null;
    this.anchorOffset = null;
    this.docBounds = null;
    this.isScrolling = false;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
