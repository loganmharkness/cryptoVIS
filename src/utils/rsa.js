// Miller-Rabin primality test
export function isPrime(n) {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;

  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) { d /= 2n; r++; }

  const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n];
  for (const a of witnesses) {
    if (a >= n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let cont = false;
    for (let i = 0n; i < r - 1n; i++) {
      x = modPow(x, 2n, n);
      if (x === n - 1n) { cont = true; break; }
    }
    if (!cont) return false;
  }
  return true;
}

export function modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

// Extended Euclidean Algorithm — returns [gcd, x, y] such that a*x + b*y = gcd
export function extendedGcd(a, b) {
  const steps = [];
  let oldR = a, r = b;
  let oldS = 1n, s = 0n;
  let oldT = 0n, t = 1n;

  while (r !== 0n) {
    const q = oldR / r;
    steps.push({ q, r: oldR, oldR: r, s: oldS, oldS: s, t: oldT, oldT: t });
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }

  return { gcd: oldR, x: oldS, y: oldT, steps };
}

export function gcd(a, b) {
  while (b !== 0n) { [a, b] = [b, a % b]; }
  return a;
}

// Find modular inverse of e mod phi using extended Euclidean
export function modInverse(e, phi) {
  const { gcd, x } = extendedGcd(e, phi);
  if (gcd !== 1n) return null;
  return ((x % phi) + phi) % phi;
}

// Generate a random bigint in [min, max]
export function randomBigIntInRange(min, max) {
  const range = max - min;
  const bits = range.toString(2).length;
  let rand;
  do {
    rand = BigInt('0x' + [...crypto.getRandomValues(new Uint8Array(Math.ceil(bits / 8)))]
      .map(b => b.toString(16).padStart(2, '0')).join(''));
    rand = rand & ((1n << BigInt(bits)) - 1n);
  } while (rand > range);
  return min + rand;
}

// Generate a random prime of approximately `bits` bits
export function generatePrime(bits = 16) {
  const min = 1n << BigInt(bits - 1);
  const max = (1n << BigInt(bits)) - 1n;
  const candidates = [];
  let p;
  let attempts = 0;
  do {
    p = randomBigIntInRange(min, max) | 1n; // make odd
    attempts++;
    candidates.push({ value: p, isPrime: isPrime(p), attempt: attempts });
  } while (!isPrime(p) && attempts < 200);
  return { prime: p, candidates };
}

// Full RSA key generation with step data for animation
export function generateRSASteps(bits = 16) {
  const pResult = generatePrime(bits);
  let qResult;
  do { qResult = generatePrime(bits); }
  while (qResult.prime === pResult.prime);

  const p = pResult.prime;
  const q = qResult.prime;
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);

  // Choose e: typically 65537, but for small keys pick something coprime to phi
  let e = 65537n;
  if (e >= phi || gcd(e, phi) !== 1n) {
    e = 3n;
    while (e < phi && gcd(e, phi) !== 1n) e += 2n;
  }

  const { gcd: g, x, y, steps: euclidSteps } = extendedGcd(e, phi);
  const d = ((x % phi) + phi) % phi;

  return { p, q, n, phi, e, d, euclidSteps, pCandidates: pResult.candidates, qCandidates: qResult.candidates };
}

// Encrypt/decrypt small numbers (m < n)
export function rsaEncrypt(m, e, n) { return modPow(m, e, n); }
export function rsaDecrypt(c, d, n) { return modPow(c, d, n); }
