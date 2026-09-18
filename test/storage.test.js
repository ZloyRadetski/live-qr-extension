import test from 'node:test';
import assert from 'node:assert/strict';
import { isDomainBlacklisted, DEFAULT_SETTINGS } from '../src/utils/storage.js';

test('isDomainBlacklisted correctly matches exact and subdomain entries', () => {
  const blacklist = ['example.com', 'secure-bank.org'];

  assert.equal(isDomainBlacklisted('https://example.com/page', blacklist), true);
  assert.equal(isDomainBlacklisted('https://sub.example.com/login', blacklist), true);
  assert.equal(isDomainBlacklisted('https://deep.sub.example.com/', blacklist), true);
  assert.equal(isDomainBlacklisted('https://secure-bank.org/account', blacklist), true);

  // Non-matching domains
  assert.equal(isDomainBlacklisted('https://google.com', blacklist), false);
  assert.equal(isDomainBlacklisted('https://notexample.com', blacklist), false);
  assert.equal(isDomainBlacklisted('invalid-url', blacklist), false);
});

test('DEFAULT_SETTINGS contains all customizable fields with correct default values', () => {
  assert.equal(DEFAULT_SETTINGS.themeColor, 'gold');
  assert.equal(DEFAULT_SETTINGS.cardDisplayMode, 'hover');
  assert.equal(DEFAULT_SETTINGS.glowAnimation, false);
  assert.equal(DEFAULT_SETTINGS.cornerBrackets, true);
  assert.equal(DEFAULT_SETTINGS.soundEnabled, false);
  assert.equal(DEFAULT_SETTINGS.autoCopy, false);
  assert.equal(DEFAULT_SETTINGS.pauseOnScroll, true);
  assert.equal(DEFAULT_SETTINGS.scanResolution, '1080');
  assert.equal(DEFAULT_SETTINGS.scanDomImages, true);
  assert.equal(DEFAULT_SETTINGS.scanRate, 2);
  assert.ok(Array.isArray(DEFAULT_SETTINGS.blacklist));
});

test('scanRate values up to 30 FPS compute correct intervals and idle throttling', () => {
  const computeDelay = (rate, hasActive) => {
    const userFps = Math.max(1, Math.min(30, Number(rate) || 2));
    const effectiveFps = hasActive
      ? userFps
      : Math.max(1, Math.min(6, userFps));
    return Math.round(1000 / effectiveFps);
  };

  assert.equal(computeDelay(1, true), 1000);
  assert.equal(computeDelay(10, true), 100);
  assert.equal(computeDelay(20, true), 50);
  assert.equal(computeDelay(30, true), 33);
  assert.equal(computeDelay(60, true), 33); // clamped to 30

  // Idle scales adaptively (capped at 6 FPS)
  assert.equal(computeDelay(1, false), 1000);
  assert.equal(computeDelay(2, false), 500);
  assert.equal(computeDelay(10, false), 167); // capped at 6 FPS
  assert.equal(computeDelay(30, false), 167); // capped at 6 FPS
});

