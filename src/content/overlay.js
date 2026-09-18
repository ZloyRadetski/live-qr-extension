/**
 * Overlay HUD Manager for QR Code Radar.
 * Injects and manages the visual tracking bounding box, HUD cards, and status bar.
 */

import { classifyContent } from '../utils/parser.js';
import { computeBounds, lerpLocation, areBoundsNear } from '../utils/coordinates.js';
import { addScanHistory } from '../utils/storage.js';
import { findAnchorElement, computeAnchorOffset, resolveAnchorPosition } from '../utils/dom-anchor.js';

/**
 * Individual QR Tracker managing a single on-screen bounding box and HUD card.
 */
class QRBoxTracker {
  constructor(id, root, options, callbacks = {}) {
    this.id = id;
    this.root = root;
    this.options = options;
    this.callbacks = callbacks;

    this.boxElement = null;
    this.hudCard = null;
    this.miniBadge = null;

    this.currentLocation = null;
    this.lastDetectedText = null;
    this.anchorElement = null;
    this.anchorOffset = null;
    this.docBounds = null;
    this.isDomLocked = false;
    this.missingFrames = 0;
    this.maxMissingFrames = 8;
    this.lastWidth = 0;
    this.lastHeight = 0;

    this.createDom();
  }

  /**
   * Builds the DOM elements for this box.
   */
  createDom() {
    this.boxElement = document.createElement('div');
    this.boxElement.className = 'qr-radar-box qr-hidden';
    this.boxElement.dataset.trackerId = this.id;
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
  }

  /**
   * Updates tracker position and content.
   * @param {any} targetLoc
   * @param {string} text
   * @param {HTMLElement} [anchorEl=null]
   * @param {boolean} [isDom=false]
   */
  update(targetLoc, text, anchorEl = null, isDom = false) {
    if (!this.boxElement) return;

    this.missingFrames = 0;
    this.boxElement.classList.remove('qr-hidden');

    if (isDom) {
      this.isDomLocked = true;
      if (anchorEl) this.anchorElement = anchorEl;
    }

    // Smooth location
    this.currentLocation = isDom
      ? targetLoc // direct DOM scan is exact, no lerp lag needed
      : lerpLocation(this.currentLocation, targetLoc, 0.45);

    const bounds = computeBounds(this.currentLocation);

    // Anchor to DOM element
    if (!this.anchorElement || !this.anchorElement.isConnected) {
      this.anchorElement = anchorEl || findAnchorElement(bounds.centerX, bounds.centerY);
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

    // Content changed?
    if (text !== this.lastDetectedText) {
      const isInitial = this.lastDetectedText === null;
      this.lastDetectedText = text;
      this.renderCardContent(text);
      if (isInitial && this.callbacks.onNew) {
        this.callbacks.onNew(text);
      }
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
    this.boxElement.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;

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
   * Scroll compensation for this box.
   */
  onScroll() {
    if (!this.boxElement || this.boxElement.classList.contains('qr-hidden')) {
      return;
    }

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
        if (this.callbacks.copy) {
          this.callbacks.copy(text, copyBtn);
        }
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
   * Destroys tracker DOM element.
   */
  destroy() {
    if (this.boxElement && this.boxElement.parentNode) {
      this.boxElement.parentNode.removeChild(this.boxElement);
    }
    this.boxElement = null;
    this.hudCard = null;
    this.miniBadge = null;
    this.anchorElement = null;
  }
}

export class QROverlayManager {
  constructor(options = {}) {
    this.options = {
      soundEnabled: true,
      autoCopy: false,
      themeColor: 'cyan',
      cardDisplayMode: 'hover',
      glowAnimation: true,
      cornerBrackets: true,
      onStopRequested: () => {},
      ...options
    };

    this.root = null;
    this.trackers = new Map(); // id -> QRBoxTracker
    this.isScrolling = false;
    this.scrollTimer = null;
    this.audioCtx = null;
    this.lastChimeTime = 0;
  }

  /**
   * Applies CSS classes for themes, display mode, and animations to root overlay.
   */
  applySettingsClasses() {
    if (!this.root) return;
    this.root.className = [
      `theme-${this.options.themeColor || 'cyan'}`,
      `mode-${this.options.cardDisplayMode || 'hover'}`,
      this.options.glowAnimation === false ? 'no-glow' : '',
      this.options.cornerBrackets === false ? 'no-brackets' : ''
    ].filter(Boolean).join(' ');
  }

  /**
   * Updates customizable options dynamically.
   */
  updateSettings(newSettings) {
    this.options = { ...this.options, ...newSettings };
    this.applySettingsClasses();
  }

  /**
   * Initializes overlay DOM structure.
   */
  mount() {
    if (this.root) return;

    this.root = document.createElement('div');
    this.root.id = 'qr-radar-root';
    this.applySettingsClasses();

    document.body.appendChild(this.root);
  }

  /**
   * Synchronizes detected items (from either DOM scanner or Screen capture).
   * Smart deduplication: keeps DOM anchor priority, prevents live & DOM fight.
   * @param {Array<{ data: string, location: any, element?: HTMLElement, isDom?: boolean }>} items
   * @param {'dom' | 'screen'} source
   */
  syncTrackers(items, source) {
    if (!this.root) this.mount();

    const matchedTrackerIds = new Set();

    for (const item of items) {
      if (!item || !item.data || !item.location) continue;

      const itemBounds = computeBounds(item.location);
      let matchedTracker = null;

      // Find matching tracker by data or spatial overlap
      for (const tracker of this.trackers.values()) {
        const isSameText = tracker.lastDetectedText === item.data;
        const trackerBounds = tracker.currentLocation ? computeBounds(tracker.currentLocation) : null;
        const isNear = trackerBounds && areBoundsNear(trackerBounds, itemBounds, 90);

        if (isSameText || isNear) {
          matchedTracker = tracker;
          break;
        }
      }

      if (matchedTracker) {
        matchedTrackerIds.add(matchedTracker.id);

        // Deduplication rule: If tracker is already DOM-anchored, and incoming is screen capture,
        // PRESERVE the exact DOM anchor! Do not let downsampled screenshot jerk it.
        if (matchedTracker.isDomLocked && source === 'screen') {
          matchedTracker.missingFrames = 0;
        } else {
          matchedTracker.update(item.location, item.data, item.element || null, source === 'dom');
        }
      } else {
        // Create new tracker
        const trackerId = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const tracker = new QRBoxTracker(trackerId, this.root, this.options, {
          onNew: (text) => this.onNewQRAcquired(text),
          copy: (text, btn) => this.copyToClipboard(text, btn)
        });

        tracker.update(item.location, item.data, item.element || null, source === 'dom');
        this.trackers.set(trackerId, tracker);
        matchedTrackerIds.add(trackerId);
      }
    }

    // Clean up trackers not seen in this update
    for (const [id, tracker] of this.trackers.entries()) {
      if (!matchedTrackerIds.has(id)) {
        // If tracker is DOM locked, check if its DOM element is still visible on page
        if (tracker.isDomLocked && tracker.anchorElement && tracker.anchorElement.isConnected) {
          const rect = tracker.anchorElement.getBoundingClientRect();
          const inView = (
            rect.bottom >= 0 &&
            rect.top <= window.innerHeight &&
            rect.right >= 0 &&
            rect.left <= window.innerWidth &&
            rect.width > 12 &&
            rect.height > 12
          );
          if (inView && source === 'screen') {
            // Background screen capture didn't see the tiny DOM image; keep it!
            continue;
          }
        }

        tracker.missingFrames++;
        if (tracker.missingFrames > tracker.maxMissingFrames) {
          tracker.destroy();
          this.trackers.delete(id);
        }
      }
    }
  }

  /**
   * Updates from full screen screenshot capture.
   * @param {any[]} qrResults
   * @param {number} scanWidth
   * @param {number} scanHeight
   */
  updateFromScreen(qrResults, scanWidth, scanHeight) {
    if (!qrResults || !Array.isArray(qrResults) || qrResults.length === 0) {
      this.onScreenQrNotFound();
      return;
    }

    const scaleX = window.innerWidth / scanWidth;
    const scaleY = window.innerHeight / scanHeight;

    const items = qrResults.map((qr) => {
      const rawLoc = qr.location;
      const location = {
        topLeftCorner: { x: rawLoc.topLeftCorner.x * scaleX, y: rawLoc.topLeftCorner.y * scaleY },
        topRightCorner: { x: rawLoc.topRightCorner.x * scaleX, y: rawLoc.topRightCorner.y * scaleY },
        bottomRightCorner: { x: rawLoc.bottomRightCorner.x * scaleX, y: rawLoc.bottomRightCorner.y * scaleY },
        bottomLeftCorner: { x: rawLoc.bottomLeftCorner.x * scaleX, y: rawLoc.bottomLeftCorner.y * scaleY }
      };

      return {
        data: qr.data,
        location,
        isDom: false
      };
    });

    this.syncTrackers(items, 'screen');
  }

  /**
   * Updates from in-page DOM image scanning.
   * @param {Array<{ data: string, location: any, element: HTMLElement }>} domResults
   */
  updateFromDom(domResults) {
    if (!domResults || !Array.isArray(domResults)) return;
    this.syncTrackers(domResults, 'dom');
  }

  /**
   * Called when screen capture found 0 QR codes.
   * Does NOT wipe DOM-anchored images that are still visible!
   */
  onScreenQrNotFound() {
    for (const [id, tracker] of this.trackers.entries()) {
      if (tracker.isDomLocked && tracker.anchorElement && tracker.anchorElement.isConnected) {
        const rect = tracker.anchorElement.getBoundingClientRect();
        const inView = (
          rect.bottom >= 0 &&
          rect.top <= window.innerHeight &&
          rect.right >= 0 &&
          rect.left <= window.innerWidth
        );
        if (inView) continue;
      }

      tracker.missingFrames++;
      if (tracker.missingFrames > tracker.maxMissingFrames) {
        tracker.destroy();
        this.trackers.delete(id);
      }
    }
  }

  /**
   * Legacy single-QR update bridge.
   * @param {any} qrResult
   * @param {number} [scaleX=1]
   * @param {number} [scaleY=1]
   * @param {HTMLElement} [knownAnchor=null]
   */
  update(qrResult, scaleX = 1, scaleY = 1, knownAnchor = null) {
    if (!qrResult) {
      this.onScreenQrNotFound();
      return;
    }

    if (knownAnchor) {
      this.updateFromDom([{
        data: qrResult.data,
        location: qrResult.location,
        element: knownAnchor,
        isDom: true
      }]);
    } else {
      const scanWidth = window.innerWidth / scaleX;
      const scanHeight = window.innerHeight / scaleY;
      this.updateFromScreen([qrResult], scanWidth, scanHeight);
    }
  }

  /**
   * 60/120 FPS Real-time scroll compensation across all active trackers.
   */
  onScroll() {
    this.isScrolling = true;
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      this.isScrolling = false;
    }, 130);

    for (const tracker of this.trackers.values()) {
      tracker.onScroll();
    }
  }

  /**
   * Triggered when a new QR code is acquired.
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

    // Sound chime (debounced to avoid multiple loud chimes)
    const now = Date.now();
    if (this.options.soundEnabled && (now - this.lastChimeTime > 250)) {
      this.lastChimeTime = now;
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
   * Unmounts overlay and cleans up all trackers.
   */
  unmount() {
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }

    for (const tracker of this.trackers.values()) {
      tracker.destroy();
    }
    this.trackers.clear();

    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
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
