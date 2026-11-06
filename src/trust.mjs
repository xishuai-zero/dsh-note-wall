/**
 * Structural request fence for the plugin's own same-origin routes.
 *
 * A plugin prefix route outranks the shell's `/api` handling in the web
 * server's longest-prefix dispatch, so these routes must refuse the callers the
 * shell itself would refuse: non-loopback peers, non-loopback hosts, cross-site
 * fetches, and foreign origins. The Host header alone is caller-controlled, so
 * the TCP peer address is checked first whenever the server exposes it.
 */

const LOOPBACK_NAMES = new Set(['127.0.0.1', '[::1]', '::1', 'localhost']);
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Desktop relay: the Electron shell loads plugin pages through dsh-app://app. */
const APP_PROTOCOL = 'dsh-app:';
const APP_HOSTNAME = 'app';

function headerOf(request, name) {
  const value = request?.headers?.[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function authorityOf(value, defaultScheme = 'http') {
  if (typeof value !== 'string' || value === '') return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return new URL(value);
    return new URL(`${defaultScheme}://${value}`);
  } catch {
    return null;
  }
}

export function isLoopbackHost(value) {
  const authority = authorityOf(value);
  return authority !== null && LOOPBACK_NAMES.has(authority.hostname);
}

/** True when a TCP peer address belongs to the local machine. */
export function isLoopbackAddress(value) {
  return typeof value === 'string' && LOOPBACK_ADDRESSES.has(value);
}

function isAppSource(value) {
  const authority = authorityOf(value);
  return authority !== null
    && authority.protocol === APP_PROTOCOL
    && authority.hostname === APP_HOSTNAME;
}

/**
 * @returns {string | undefined} a short refusal reason, or undefined to allow.
 */
export function structuralRejection(request) {
  const peer = request?.socket?.remoteAddress;
  if (typeof peer === 'string' && peer !== '' && !isLoopbackAddress(peer)) return 'non-loopback-peer';

  const host = authorityOf(headerOf(request, 'host'));
  if (host === null) return 'missing-host';
  if (!LOOPBACK_NAMES.has(host.hostname)) return 'non-loopback-host';

  const site = headerOf(request, 'sec-fetch-site');
  if (site === 'cross-site') return 'cross-site';

  const origin = headerOf(request, 'origin');
  const referer = headerOf(request, 'referer');
  // The desktop relay uses the same app origin for both headers; accept either
  // shape so Origin and Referer behave identically.
  if (origin !== undefined && isAppSource(origin)) return undefined;
  if (origin === undefined && referer !== undefined && isAppSource(referer)) return undefined;

  const source = origin ?? referer;
  if (source === undefined) return undefined;
  const authority = authorityOf(source);
  if (authority === null) return 'unparsable-source';
  if (authority.hostname !== host.hostname) return 'host-mismatch';
  if (authority.port !== host.port) return 'port-mismatch';
  if (authority.protocol !== 'http:' && authority.protocol !== 'https:') return 'scheme-mismatch';
  return undefined;
}
