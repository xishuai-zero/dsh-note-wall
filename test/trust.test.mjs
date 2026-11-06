import assert from 'node:assert/strict';
import test from 'node:test';

import { isLoopbackAddress, structuralRejection } from '../src/trust.mjs';

function request({ host = '127.0.0.1:10632', origin, referer, site = 'same-origin', peer = '127.0.0.1' } = {}) {
  const headers = { host };
  if (origin !== undefined) headers.origin = origin;
  if (referer !== undefined) headers.referer = referer;
  if (site !== undefined) headers['sec-fetch-site'] = site;
  return { headers, socket: { remoteAddress: peer } };
}

test('loopback peers with a loopback Host and same-origin requests are accepted', () => {
  assert.equal(structuralRejection(request()), undefined);
  assert.equal(structuralRejection(request({ origin: 'http://127.0.0.1:10632' })), undefined);
  assert.equal(structuralRejection(request({ peer: '::1', host: '[::1]:10632', origin: 'http://[::1]:10632' })), undefined);
});

test('the TCP peer address outranks a spoofed loopback Host header', () => {
  assert.equal(structuralRejection(request({ host: '127.0.0.1:10632', peer: '192.168.1.20' })), 'non-loopback-peer');
  assert.equal(structuralRejection(request({ host: '127.0.0.1:10632', peer: '::ffff:192.168.1.20' })), 'non-loopback-peer');
});

test('non-loopback Host headers and cross-site fetches are refused', () => {
  assert.equal(structuralRejection(request({ host: '192.168.1.20:10632' })), 'non-loopback-host');
  assert.equal(structuralRejection(request({ site: 'cross-site' })), 'cross-site');
  assert.equal(structuralRejection(request({ host: '' })), 'missing-host');
});

test('the desktop relay origin/referer dsh-app://app is accepted symmetrically', () => {
  assert.equal(structuralRejection(request({ origin: 'dsh-app://app' })), undefined);
  assert.equal(structuralRejection(request({ referer: 'dsh-app://app/panel' })), undefined);
});

test('foreign or mismatched origins are refused', () => {
  assert.equal(structuralRejection(request({ origin: 'https://evil.example' })), 'host-mismatch');
  assert.equal(
    structuralRejection(request({ host: '127.0.0.1:10632', origin: 'http://127.0.0.1:9999' })),
    'port-mismatch',
  );
  assert.equal(structuralRejection(request({ origin: 'ftp://127.0.0.1:10632' })), 'scheme-mismatch');
  assert.equal(structuralRejection(request({ origin: 'not a url' })), 'unparsable-source');
});

test('isLoopbackAddress only accepts local peer addresses', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('10.0.0.2'), false);
  assert.equal(isLoopbackAddress(undefined), false);
});
