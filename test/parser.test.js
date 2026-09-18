import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyContent, parseWifiString, truncateString } from '../src/utils/parser.js';

test('classifyContent - URLs', () => {
  const res1 = classifyContent('https://example.com/some/path?id=123');
  assert.equal(res1.type, 'url');
  assert.equal(res1.title, 'example.com');
  assert.equal(res1.actionUrl, 'https://example.com/some/path?id=123');

  const res2 = classifyContent('http://sub.domain.org');
  assert.equal(res2.type, 'url');
  assert.equal(res2.title, 'sub.domain.org');
});

test('classifyContent - WiFi configurations', () => {
  const wifiRaw = 'WIFI:S:HomeNetwork;T:WPA;P:SuperSecretPass;H:false;;';
  const res = classifyContent(wifiRaw);
  assert.equal(res.type, 'wifi');
  assert.equal(res.metadata?.ssid, 'HomeNetwork');
  assert.equal(res.metadata?.password, 'SuperSecretPass');
  assert.equal(res.metadata?.type, 'WPA');
  assert.equal(res.metadata?.hidden, false);
});

test('classifyContent - Emails', () => {
  const res1 = classifyContent('mailto:dev@antigravity.ai?subject=Hello');
  assert.equal(res1.type, 'email');
  assert.equal(res1.summary, 'dev@antigravity.ai');

  const res2 = classifyContent('simple.user@example.com');
  assert.equal(res2.type, 'email');
  assert.equal(res2.actionUrl, 'mailto:simple.user@example.com');
});

test('classifyContent - Phone numbers', () => {
  const res1 = classifyContent('tel:+1234567890');
  assert.equal(res1.type, 'phone');
  assert.equal(res1.actionUrl, 'tel:+1234567890');

  const res2 = classifyContent('+1 (555) 234-5678');
  assert.equal(res2.type, 'phone');
  assert.equal(res2.actionUrl, 'tel:+1(555)234-5678');
});

test('classifyContent - SMS', () => {
  const res = classifyContent('smsto:+18005550199:Hello there');
  assert.equal(res.type, 'sms');
  assert.equal(res.metadata?.number, '+18005550199');
  assert.equal(res.metadata?.body, 'Hello there');
});

test('classifyContent - Geo location', () => {
  const res = classifyContent('geo:37.7749,-122.4194');
  assert.equal(res.type, 'geo');
  assert.equal(res.metadata?.lat, 37.7749);
  assert.equal(res.metadata?.lng, -122.4194);
  assert.ok(res.actionUrl?.includes('37.7749,-122.4194'));
});

test('classifyContent - Plain text fallback', () => {
  const res = classifyContent('Just some regular notes and thoughts');
  assert.equal(res.type, 'text');
  assert.equal(res.raw, 'Just some regular notes and thoughts');
});

test('truncateString helper', () => {
  assert.equal(truncateString('Short text', 20), 'Short text');
  assert.equal(truncateString('This is a much longer string', 10), 'This is a…');
});
