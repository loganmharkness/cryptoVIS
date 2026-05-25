export function parseHash() {
  const raw = window.location.hash.slice(1);
  const qIdx = raw.indexOf('?');
  if (qIdx === -1) return { tab: raw || 'rsa', params: new URLSearchParams() };
  return {
    tab: raw.slice(0, qIdx) || 'rsa',
    params: new URLSearchParams(raw.slice(qIdx + 1)),
  };
}

export function setHashTab(tab) {
  const { params } = parseHash();
  const str = params.toString();
  window.location.hash = tab + (str ? '?' + str : '');
}

// Uses replaceState so typing doesn't flood browser history.
export function setHashParam(key, value) {
  const { tab, params } = parseHash();
  if (value == null) {
    params.delete(key);
  } else {
    params.set(key, String(value));
  }
  const str = params.toString();
  history.replaceState(null, '', '#' + tab + (str ? '?' + str : ''));
}
