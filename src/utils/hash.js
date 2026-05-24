export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray;
}

export function bytesToHex(bytes) {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function bytesToBits(bytes) {
  return bytes.flatMap(b => {
    const bits = [];
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    return bits;
  });
}

export function countDifferentBits(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i++) count += a[i] !== b[i] ? 1 : 0;
  return count;
}
