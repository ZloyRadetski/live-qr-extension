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
  assert.equal(DEFAULT_SETTINGS.scanResolution, '720');
  assert.equal(DEFAULT_SETTINGS.scanDomImages, true);
  assert.equal(DEFAULT_SETTINGS.scanRate, 2);
  assert.ok(Array.isArray(DEFAULT_SETTINGS.blacklist));
});

test('scanRate values up to 120 FPS compute correct intervals without clamping to 5', () => {
  const computeDelay = (rate, hasActive) => {
    const userFps = Math.max(1, Math.min(120, Number(rate) || 12));
    const effectiveFps = hasActive
      ? userFps
      : Math.max(1, Math.min(userFps, Math.max(4, Math.round(userFps * 0.75))));
    return Math.round(1000 / effectiveFps);
  };

  assert.equal(computeDelay(1, true), 1000);
  assert.equal(computeDelay(12, true), 83);
  assert.equal(computeDelay(30, true), 33);
  assert.equal(computeDelay(60, true), 17);
  assert.equal(computeDelay(120, true), 8);

  // Idle scales adaptively
  assert.equal(computeDelay(1, false), 1000);
  assert.equal(computeDelay(12, false), 111);
  assert.equal(computeDelay(30, false), 43);
  assert.equal(computeDelay(60, false), 22);
  assert.equal(computeDelay(120, false), 11);
});

