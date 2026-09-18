/**
 * Overlay HUD Manager for QR Code Radar.
 * Injects and manages the visual tracking bounding box, HUD cards, and status bar.
 */

import { classifyContent } from '../utils/parser.js';
import { computeBounds, lerpLocation, areBoundsNear, distance } from '../utils/coordinates.js';
import { addScanHistory } from '../utils/storage.js';
import { findAnchorElement, computeAnchorOffset, resolveAnchorPosition, isElementFixed } from '../utils/dom-anchor.js';
import { isElementInViewport } from '../utils/dom-scanner.js';

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
    this.cachedBounds = null; // cached computeBounds(currentLocation) to avoid recompute in syncTrackers
    this.lastDetectedText = null;
    this.anchorElement = null;
    this.anchorOffset = null;
    this.docBounds = null;
    this.isDomLocked = false;
    this.isFixed = false;
    this._isFixedForAnchor = null; // anchor element reference when isFixed was last computed
    this.missingFrames = 0;
    this.maxMissingFrames = 2; // Fast disappearance on lost track
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.lastX = null;
    this.lastY = null;
    this.lastDocLeft = null;
    this.lastDocTop = null;
    this.lastDocWidth = null;
    this.lastDocHeight = null;

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

    // Smooth location: direct DOM scan is exact; for screen captures, snap immediately if moving fast
    const shouldSnap = !this.currentLocation || isDom || (this.currentLocation && distance(this.currentLocation.topLeftCorner, targetLoc.topLeftCorner) > 20);
    this.currentLocation = shouldSnap
      ? targetLoc
      : lerpLocation(this.currentLocation, targetLoc, 0.6);

    const bounds = computeBounds(this.currentLocation);
    this.cachedBounds = bounds; // cache for syncTrackers lookup

    // Anchor to DOM element
    const prevAnchor = this.anchorElement;
    if (!this.anchorElement || !this.anchorElement.isConnected) {
      this.anchorElement = anchorEl || findAnchorElement(bounds.centerX, bounds.centerY);
    }

    // If anchor is a static image, the QR code inside the image file does not move within the image.
    // For CANVAS, VIDEO, or dynamic elements, the QR code moves inside the element, so always update anchorOffset.
    const isStaticImg = this.anchorElement && this.anchorElement.tagName === 'IMG';
    if (!this.anchorOffset || !isStaticImg || this.anchorElement !== prevAnchor) {
      this.anchorOffset = computeAnchorOffset(this.anchorElement, bounds);
    }

    // isFixed: computed only once per anchor element (getComputedStyle DOM walk is expensive).
    // Re-computed only when the anchor element reference changes.
    if (this.anchorElement !== this._isFixedForAnchor) {
      this._isFixedForAnchor = this.anchorElement;
      this.isFixed = isElementFixed(this.anchorElement);
      if (this.isFixed) {
        this.boxElement.classList.add('qr-fixed-anchor');
      } else {
        this.boxElement.classList.remove('qr-fixed-anchor');
      }
    }

    // Document-relative fallback: in fullscreen mode, scroll offsets must never displace the overlay
    const isFullscreen = typeof document !== 'undefined' && !!document.fullscreenElement;
    const scrollX = (!isFullscreen && typeof window !== 'undefined') ? (window.pageXOffset || window.scrollX || 0) : 0;
    const scrollY = (!isFullscreen && typeof window !== 'undefined') ? (window.pageYOffset || window.scrollY || 0) : 0;

    this.docBounds = {
      docX: bounds.minX + scrollX,
      docY: bounds.minY + scrollY,
      width: bounds.width,
      height: bounds.height
    };

    // Position: in fullscreen or fixed anchor, bounds are viewport-relative directly
    const isFixedPos = this.isFixed || isFullscreen;
    const targetX = isFixedPos ? bounds.minX : this.docBounds.docX;
    const targetY = isFixedPos ? bounds.minY : this.docBounds.docY;
    this.applyPosition(targetX, targetY, bounds.width, bounds.height, true, isFixedPos);

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
  applyPosition(x, y, width, height, isVisible, isFixed = false) {
    if (!this.boxElement) return;

    if (!isVisible) {
      this.boxElement.style.visibility = 'hidden';
      return;
    }

    this.boxElement.style.visibility = 'visible';
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;

    if (this.lastX !== rx || this.lastY !== ry) {
      this.lastX = rx;
      this.lastY = ry;
      this.boxElement.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    }

    if (width > 0 && this.lastWidth !== width) {
      this.lastWidth = width;
      this.boxElement.style.width = `${Math.round(width)}px`;
    }
    if (height > 0 && this.lastHeight !== height) {
      this.lastHeight = height;
      this.boxElement.style.height = `${Math.round(height)}px`;
    }

    // Adaptive sizing for small/tiny QR codes to keep overlays elegant and proportional
    const effW = width || this.lastWidth || 0;
    const effH = height || this.lastHeight || 0;
    const minDim = Math.min(effW, effH);
    if (minDim > 0) {
      if (minDim < 60) {
        this.boxElement.classList.add('qr-tiny');
        this.boxElement.classList.remove('qr-small');
      } else if (minDim < 110) {
        this.boxElement.classList.add('qr-small');
        this.boxElement.classList.remove('qr-tiny');
      } else {
        this.boxElement.classList.remove('qr-small', 'qr-tiny');
      }
    }

    // Flip HUD card if too close to bottom of screen (using viewport coordinates + hysteresis)
    const scrollY = typeof window !== 'undefined' ? (window.pageYOffset || window.scrollY || 0) : 0;
    const viewportY = isFixed ? y : (y - scrollY);
    const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 1080) - (viewportY + (height || 0));

    if (this.hudCard) {
      const isFlipped = this.hudCard.classList.contains('qr-flipped');
      if (isFlipped) {
        if (spaceBelow > 220) {
          this.hudCard.classList.remove('qr-flipped');
        }
      } else {
        if (spaceBelow < 140) {
          this.hudCard.classList.add('qr-flipped');
        }
      }
    }
  }

  /**
   * High-frequency rAF position sync: tracks moving/animating anchor elements.
   * Compares previous rect coordinates to eliminate layout thrashing if still.
   */
  updateLivePosition() {
    if (!this.boxElement || this.boxElement.classList.contains('qr-hidden')) {
      return;
    }

    if (this.anchorElement) {
      if (!this.anchorElement.isConnected) {
        this.boxElement.classList.add('qr-hidden');
        return;
      }
      if (
        this.anchorElement.hidden ||
        this.anchorElement.style?.display === 'none' ||
        this.anchorElement.style?.visibility === 'hidden' ||
        this.anchorElement.style?.opacity === '0'
      ) {
        this.boxElement.classList.add('qr-hidden');
        return;
      }
    }

    // High-frequency sync for media elements (IMG, VIDEO) moving or resizing on the page
    const isTrackedMedia = this.anchorElement && (this.anchorElement.tagName === 'IMG' || this.anchorElement.tagName === 'VIDEO');
    if (isTrackedMedia && this.anchorElement.isConnected && this.anchorOffset) {
      const isFullscreen = typeof document !== 'undefined' && !!document.fullscreenElement;
      const isFixedPos = this.isFixed || isFullscreen;
      const rect = this.anchorElement.getBoundingClientRect();
      const scrollX = (!isFullscreen && typeof window !== 'undefined') ? (window.pageXOffset || window.scrollX || 0) : 0;
      const scrollY = (!isFullscreen && typeof window !== 'undefined') ? (window.pageYOffset || window.scrollY || 0) : 0;

      // For document elements, compare document coordinates (rect.left + scrollX, rect.top + scrollY)
      // This is CONSTANT during scrolling, so scrolling consumes 0 CPU and doesn't dirty the DOM!
      const docLeft = isFixedPos ? rect.left : (rect.left + scrollX);
      const docTop = isFixedPos ? rect.top : (rect.top + scrollY);

      if (
        docLeft === this.lastDocLeft &&
        docTop === this.lastDocTop &&
        rect.width === this.lastDocWidth &&
        rect.height === this.lastDocHeight
      ) {
        return; // Exact same position in document, 0 CPU cost
      }

      this.lastDocLeft = docLeft;
      this.lastDocTop = docTop;
      this.lastDocWidth = rect.width;
      this.lastDocHeight = rect.height;

      const pos = resolveAnchorPosition(this.anchorElement, this.anchorOffset);
      if (pos) {
        const targetX = isFixedPos ? pos.x : pos.docX;
        const targetY = isFixedPos ? pos.y : pos.docY;
        this.applyPosition(targetX, targetY, pos.width, pos.height, pos.isVisible, isFixedPos);
      }
    }
  }

  /**
   * Scroll compensation for this box.
   */
  onScroll() {
    if (!this.boxElement || this.boxElement.classList.contains('qr-hidden')) {
      return;
    }

    // Document-positioned boxes move natively with page scrolling (0ms lag, hardware compositor synced).
    // We only update the card flip orientation if needed.
    if (this.hudCard && this.lastY !== null) {
      const scrollY = typeof window !== 'undefined' ? (window.pageYOffset || window.scrollY || 0) : 0;
      const viewportY = this.isFixed ? this.lastY : (this.lastY - scrollY);
      const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 1080) - (viewportY + (this.lastHeight || 0));

      const isFlipped = this.hudCard.classList.contains('qr-flipped');
      if (isFlipped) {
        if (spaceBelow > 220) {
          this.hudCard.classList.remove('qr-flipped');
        }
      } else {
        if (spaceBelow < 140) {
          this.hudCard.classList.add('qr-flipped');
        }
      }
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
        url: 'URL',
        wifi: 'WiFi',
        email: 'Mail',
        phone: 'Tel',
        sms: 'SMS',
        geo: 'Geo',
        text: 'Text'
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
    this.anchorOffset = null;
  }
}

export class QROverlayManager {
  constructor(options = {}) {
    this.options = {
      soundEnabled: false,
      autoCopy: false,
      themeColor: 'gold',
      cardDisplayMode: 'hover',
      glowAnimation: false,
      cornerBrackets: true,
      onStopRequested: () => {},
      ...options
    };

    this.root = null;
    this.trackers = new Map(); // id -> QRBoxTracker
    this.rafId = null;
    this.isScrolling = false;
    this.scrollTimer = null;
    this.audioCtx = null;
    this.lastChimeTime = 0;
    this.fullscreenHandler = null;
  }

  /**
   * Applies CSS classes for themes, display mode, and animations to root overlay.
   */
  applySettingsClasses() {
    if (!this.root) return;
    this.root.className = [
      `theme-${this.options.themeColor || 'gold'}`,
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
    for (const tracker of this.trackers.values()) {
      tracker.options = { ...tracker.options, ...newSettings };
      if (tracker.lastDetectedText) {
        tracker.renderCardContent(tracker.lastDetectedText);
      }
    }
  }

  /**
   * Sets up fullscreen listeners to keep overlay visible inside video players in fullscreen mode (e.g. YouTube).
   */
  setupFullscreenListener() {
    if (this.fullscreenHandler || typeof document === 'undefined') return;

    this.fullscreenHandler = () => {
      const target = document.fullscreenElement || document.documentElement || document.body;
      if (this.root && target && this.root.parentElement !== target) {
        target.appendChild(this.root);
      }
      // Force position update and isFixed re-check on all active trackers
      for (const tracker of this.trackers.values()) {
        tracker._isFixedForAnchor = null;
        tracker.lastDocLeft = null;
        tracker.lastDocTop = null;
      }
    };

    document.addEventListener('fullscreenchange', this.fullscreenHandler);
    document.addEventListener('webkitfullscreenchange', this.fullscreenHandler);
  }

  /**
   * Initializes overlay DOM structure.
   */
  mount() {
    if (this.root && this.root.isConnected) return;

    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'qr-radar-root';
      this.applySettingsClasses();
    }

    const mountTarget = document.fullscreenElement || document.documentElement || document.body;
    if (mountTarget && this.root.parentElement !== mountTarget) {
      mountTarget.appendChild(this.root);
    }

    this.setupFullscreenListener();
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

      // Find matching tracker by data or spatial overlap.
      // Use cachedBounds to avoid re-running computeBounds on every tracker every frame.
      for (const tracker of this.trackers.values()) {
        const isSameText = tracker.lastDetectedText === item.data;
        const isNear = tracker.cachedBounds && areBoundsNear(tracker.cachedBounds, itemBounds, 90);

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
        // SOURCE SEPARATION:
        // 1. DOM scan ONLY manages DOM trackers (tracker.isDomLocked === true).
        // It must never touch or hide screen-captured trackers!
        if (source === 'dom' && !tracker.isDomLocked) {
          continue;
        }

        // 2. Screen capture must not kill DOM-locked trackers that are visible in viewport!
        if (source === 'screen' && tracker.isDomLocked) {
          if (tracker.anchorElement && isElementInViewport(tracker.anchorElement)) {
            continue;
          }
        }

        tracker.missingFrames++;

        // Hysteresis: hide when missing for 2 consecutive scans, destroy after 5
        // Single frame dropped by jsQR will NEVER cause flickering!
        if (tracker.missingFrames >= 2 && tracker.boxElement) {
          tracker.boxElement.classList.add('qr-hidden');
        }

        if (tracker.missingFrames > 5) {
          tracker.destroy();
          this.trackers.delete(id);
        }
      }
    }

    if (this.trackers.size > 0) {
      this.startTrackingLoop();
    } else {
      this.stopTrackingLoop();
    }
  }

  /**
   * Updates from full screen screenshot capture.
   * @param {any[]} qrResults
   * @param {number} scanWidth
   * @param {number} scanHeight
   */
  updateFromScreen(qrResults, scanWidth, scanHeight) {
    // Drop stale screenshot results if user is actively scrolling
    if (this.isScrolling) {
      return;
    }

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
      // Screen capture not finding QRs must never kill DOM-locked trackers!
      if (tracker.isDomLocked) {
        continue;
      }

      tracker.missingFrames++;
      if (tracker.missingFrames >= 2 && tracker.boxElement) {
        tracker.boxElement.classList.add('qr-hidden');
      }

      if (tracker.missingFrames > 5) {
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
   * Monitor refresh rate (60/120/144 Hz) position tracking loop.
   * Only active while visible trackers exist on screen (0% idle CPU).
   */
  startTrackingLoop() {
    if (this.rafId || typeof requestAnimationFrame === 'undefined') return;

    const tick = () => {
      if (!this.root || this.trackers.size === 0) {
        this.rafId = null;
        return;
      }

      let activeCount = 0;
      for (const tracker of this.trackers.values()) {
        if (!tracker.boxElement || tracker.boxElement.classList.contains('qr-hidden')) {
          continue;
        }
        activeCount++;
        tracker.updateLivePosition();
      }

      if (activeCount > 0) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stopTrackingLoop() {
    if (this.rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Unmounts overlay and cleans up all trackers.
   */
  unmount() {
    this.stopTrackingLoop();
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }

    for (const tracker of this.trackers.values()) {
      tracker.destroy();
    }
    this.trackers.clear();

    if (this.fullscreenHandler && typeof document !== 'undefined') {
      document.removeEventListener('fullscreenchange', this.fullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this.fullscreenHandler);
      this.fullscreenHandler = null;
    }

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
