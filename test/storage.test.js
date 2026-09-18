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

test('DEFAULT_SETTINGS contains all customizable fields', () => {
  assert.ok(DEFAULT_SETTINGS.themeColor);
  assert.ok(DEFAULT_SETTINGS.cardDisplayMode);
  assert.equal(typeof DEFAULT_SETTINGS.glowAnimation, 'boolean');
  assert.equal(typeof DEFAULT_SETTINGS.cornerBrackets, 'boolean');
  assert.equal(typeof DEFAULT_SETTINGS.soundEnabled, 'boolean');
  assert.equal(typeof DEFAULT_SETTINGS.autoCopy, 'boolean');
  assert.equal(typeof DEFAULT_SETTINGS.pauseOnScroll, 'boolean');
  assert.ok(Array.isArray(DEFAULT_SETTINGS.blacklist));
});
