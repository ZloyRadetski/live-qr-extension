/**
 * Real-Time Stream Scanner Engine.
 * Captures the display stream (current tab / screen), throttles frames,
 * and feeds image data to jsQR.
 */

import jsQR from 'jsqr';

export class StreamScanner {
  /**
   * @param {Object} options
   * @param {number} [options.fps=15] - Target detection rate
   * @param {number} [options.maxWidth=1280] - Maximum scan width for CPU efficiency
   * @param {(result: any, scaleX: number, scaleY: number) => void} options.onFrame
   * @param {() => void} [options.onStopped] - Triggered when stream is ended by user
   * @param {(err: Error) => void} [options.onError]
   */
  constructor(options = {}) {
    this.fps = options.fps || 15;
    this.maxWidth = options.maxWidth || 1280;
    this.onFrame = options.onFrame || (() => {});
    this.onStopped = options.onStopped || (() => {});
    this.onError = options.onError || (() => {});

    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.timerId = null;
    this.isRunning = false;
    this.lastScanTime = 0;
  }

  /**
   * Starts display media capture and scanning loop.
   */
  async start() {
    if (this.isRunning) return;

    try {
      // Prompt user to select tab or screen
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          frameRate: { ideal: this.fps, max: 30 }
        },
        audio: false
      });

      // Listen for when user clicks native "Stop sharing" in Firefox
      const track = this.stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener('ended', () => {
          this.stop();
          this.onStopped();
        });
      }

      // Hidden video element to play incoming stream
      this.video = document.createElement('video');
      this.video.autoplay = true;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = this.stream;

      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(resolve).catch(resolve);
        };
      });

      // Setup scan canvas
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      this.isRunning = true;
      this.lastScanTime = performance.now();
      this.loop();
    } catch (err) {
      this.stop();
      this.onError(err);
      throw err;
    }
  }

  /**
   * Processing loop with precise FPS throttling via setTimeout.
   * Using setTimeout instead of requestAnimationFrame avoids firing at the monitor
   * refresh rate (60/120 Hz) when the scan target is much lower (e.g. 5–15 FPS).
   */
  loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    const frameInterval = 1000 / this.fps;
    const elapsed = now - this.lastScanTime;

    if (elapsed >= frameInterval) {
      this.scanCurrentFrame();
      this.lastScanTime = now;
    }

    // Sleep for the remaining time in this interval, minimum 4ms
    const nextDelay = Math.max(4, frameInterval - (performance.now() - this.lastScanTime));
    this.timerId = setTimeout(() => this.loop(), nextDelay);
  }

  /**
   * Grabs current video frame, resizes if needed, and decodes with jsQR.
   */
  scanCurrentFrame() {
    if (!this.video || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const videoW = this.video.videoWidth;
    const videoH = this.video.videoHeight;

    if (!videoW || !videoH) return;

    // Compute downscaled scan dimensions for high performance
    let scanW = videoW;
    let scanH = videoH;

    if (scanW > this.maxWidth) {
      const ratio = this.maxWidth / scanW;
      scanW = Math.round(scanW * ratio);
      scanH = Math.round(scanH * ratio);
    }

    if (this.canvas.width !== scanW || this.canvas.height !== scanH) {
      this.canvas.width = scanW;
      this.canvas.height = scanH;
    }

    // Draw video frame to canvas
    this.ctx.drawImage(this.video, 0, 0, scanW, scanH);

    // Extract raw pixels
    const imageData = this.ctx.getImageData(0, 0, scanW, scanH);

    // Call jsQR
    const decoder = jsQR || (typeof window !== 'undefined' ? window.jsQR : null);
    let qrResult = null;

    if (decoder) {
      qrResult = decoder(imageData.data, scanW, scanH, {
        inversionAttempts: 'dontInvert'
      });
    }

    // Calculate scale factors from scan canvas to browser viewport
    const scaleX = window.innerWidth / scanW;
    const scaleY = window.innerHeight / scanH;

    this.onFrame(qrResult, scaleX, scaleY);
  }

  /**
   * Sets a new FPS rate on the fly.
   * @param {number} newFps
   */
  setFps(newFps) {
    if (newFps > 0) {
      this.fps = newFps;
    }
  }

  /**
   * Stops video tracks, halts animation frame loop, and cleans up.
   */
  stop() {
    this.isRunning = false;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }

    this.canvas = null;
    this.ctx = null;
  }
}
