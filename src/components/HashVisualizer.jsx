import './HashVisualizer.css';
import { useState, useEffect, useCallback } from 'react';
import { sha256, bytesToHex, bytesToBits, countDifferentBits } from '../utils/hash';
import { parseHash, setHashParam } from '../utils/urlState';

function getBitClass(bit, differs, color) {
  if (differs) return bit === 1 ? 'hash-bit--differs-1' : 'hash-bit--differs-0';
  if (bit === 1) return color === 'green' ? 'hash-bit--same-1-green' : 'hash-bit--same-1-blue';
  return 'hash-bit--same-0';
}

function getCharClass(differs, color) {
  if (differs) return 'hash-hex-char--differs';
  return color === 'green' ? 'hash-hex-char--same-green' : 'hash-hex-char--same-blue';
}

function BitGrid({ bits, compareBits, label, color }) {
  if (!bits || bits.length === 0) return null;
  return (
    <div className="hash-bit-grid">
      <div className="hash-bit-grid__label">{label} — bit grid (256 bits)</div>
      <div className="hash-bit-grid__cells">
        {bits.map((bit, i) => {
          const differs = compareBits && compareBits[i] !== bit;
          return (
            <div
              key={i}
              title={`Bit ${i}: ${bit}`}
              className={`hash-bit ${getBitClass(bit, differs, color)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function HashDisplay({ hash, compareHash, label, color }) {
  if (!hash) return (
    <div className={`hash-display hash-display--${color} hash-display--empty`}>
      <div className="hash-display__label">{label}: —</div>
    </div>
  );

  const hexStr = bytesToHex(hash);
  const compareHexStr = compareHash ? bytesToHex(compareHash) : null;

  return (
    <div className={`hash-display hash-display--${color}`}>
      <div className="hash-display__label">{label}</div>
      <div className="hash-display__hex">
        {hexStr.split('').map((ch, i) => {
          const differs = compareHexStr && compareHexStr[i] !== ch;
          return (
            <span key={i} className={`hash-hex-char ${getCharClass(differs, color)}`}>{ch}</span>
          );
        })}
      </div>
    </div>
  );
}

function InputBox({ label, value, onChange, color, placeholder }) {
  return (
    <div className="hash-input-box">
      <label className="hash-input-box__label">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`hash-textarea hash-textarea--${color}`}
      />
    </div>
  );
}

export default function HashVisualizer() {
  const [inputA, setInputA] = useState(() => parseHash().params.get('a') ?? 'Hello, CryptoVis!');
  const [inputB, setInputB] = useState(() => parseHash().params.get('b') ?? 'Hello, CryptoVis.');
  const [hashA, setHashA] = useState(null);
  const [hashB, setHashB] = useState(null);
  const [bitsA, setBitsA] = useState(null);
  const [bitsB, setBitsB] = useState(null);
  const [singleInput, setSingleInput] = useState('');
  const [singleHash, setSingleHash] = useState(null);

  const updateA = useCallback(async (val) => {
    const h = await sha256(val);
    setHashA(h);
    setBitsA(bytesToBits(h));
  }, []);

  const updateB = useCallback(async (val) => {
    const h = await sha256(val);
    setHashB(h);
    setBitsB(bytesToBits(h));
  }, []);

  const updateSingle = useCallback(async (val) => {
    if (!val) { setSingleHash(null); return; }
    const h = await sha256(val);
    setSingleHash(h);
  }, []);

  useEffect(() => { updateA(inputA); setHashParam('a', inputA); }, [inputA]);
  useEffect(() => { updateB(inputB); setHashParam('b', inputB); }, [inputB]);
  useEffect(() => { updateSingle(singleInput); }, [singleInput]);

  const diffBits = hashA && hashB ? countDifferentBits(bitsA, bitsB) : null;
  const diffBytes = hashA && hashB ? hashA.filter((b, i) => b !== hashB[i]).length : null;
  const diffPct = diffBits != null ? ((diffBits / 256) * 100).toFixed(1) : null;

  const meterClass = diffBits > 100 ? 'hash-meter-fill--red' : diffBits > 50 ? 'hash-meter-fill--amber' : 'hash-meter-fill--green';
  const statValueClass = diffBits > 100 ? 'hash-stat__value--red' : diffBits > 50 ? 'hash-stat__value--amber' : 'hash-stat__value--green';

  return (
    <div style={{ width: '100%' }}>
      <div className="hash-header">
        <h1 className="hash-title">SHA-256 & Avalanche Effect</h1>
        <p className="hash-subtitle">
          A cryptographic hash function takes any input and produces a fixed-size fingerprint. Change one character and the output looks completely different. That property -- called the avalanche effect -- is the foundation of password storage, digital signatures, and blockchain integrity.
        </p>
      </div>

      {/* Live single hash */}
      <div className="hash-live-section">
        <div className="hash-live-section__title">Live SHA-256</div>
        <p className="hash-live-section__desc">
          SHA-256 always produces a 256-bit (32-byte) output, shown here as 64 hex characters. The same input always produces the same hash. But there is no way to reverse it: given only the hash, you cannot recover the input. This is called pre-image resistance and it is what makes hashing useful for passwords -- a server can store the hash and verify a login without ever storing the actual password.
        </p>
        <input
          value={singleInput}
          onChange={e => setSingleInput(e.target.value)}
          placeholder="Type anything -- hash updates live..."
          className="hash-live-input"
        />
        {singleHash ? (
          <div className="hash-live-result">
            <div className="hash-live-hex">{bytesToHex(singleHash)}</div>
            <div style={{ marginTop: '12px' }}>
              <div className="hash-live-bit-label">BIT PATTERN (256 squares -- green = 1, dark = 0)</div>
              <div className="hash-live-bits">
                {bytesToBits(singleHash).map((bit, i) => (
                  <div key={i} className={`hash-live-bit${bit === 1 ? ' hash-live-bit--on' : ' hash-live-bit--off'}`} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="hash-live-placeholder">SHA-256("") = e3b0c44298fc1c149afb...</div>
        )}
      </div>

      {/* Avalanche section */}
      <div className="hash-avalanche-section">
        <div className="hash-avalanche-section__title">Avalanche Effect -- Side-by-Side Comparison</div>
        <p className="hash-avalanche-section__desc">
          Start with identical text in both boxes. Change one character and watch how many output bits flip. A secure hash function must flip roughly 50% of output bits for any single-bit input change -- less than that, and patterns in the output could leak information about the input. Red squares below are bits that differ between the two hashes.
        </p>

        <div className="hash-inputs-grid">
          <InputBox label="Input A" value={inputA} onChange={setInputA} color="green" placeholder="Type text A..." />
          <InputBox label="Input B" value={inputB} onChange={setInputB} color="blue" placeholder="Type text B..." />
        </div>

        {/* Diff stats */}
        {diffBits != null && (
          <div className="hash-diff-stats">
            <div className="hash-stat-box">
              <div className={`hash-stat__value ${statValueClass}`}>{diffBits}</div>
              <div className="hash-stat__label">bits differ (of 256)</div>
            </div>
            <div className="hash-stat-box">
              <div className="hash-stat__value hash-stat__value--amber">{diffPct}%</div>
              <div className="hash-stat__label">of output bits flipped</div>
            </div>
            <div className="hash-stat-box">
              <div className="hash-stat__value hash-stat__value--blue">{diffBytes}</div>
              <div className="hash-stat__label">bytes differ (of 32)</div>
            </div>
            <div className="hash-stat-box hash-stat-box--flex">
              <div className="hash-meter-track">
                <div className={`hash-meter-fill ${meterClass}`} style={{ width: `${diffPct}%` }} />
              </div>
              <div className="hash-meter-label">
                {parseFloat(diffPct) < 30 ? 'Low avalanche' : parseFloat(diffPct) < 45 ? 'Good avalanche' : 'Excellent avalanche'}
              </div>
            </div>
          </div>
        )}

        {/* Hash displays */}
        <div className="hash-displays-grid">
          <HashDisplay hash={hashA} compareHash={hashB} label="SHA-256(A)" color="green" />
          <HashDisplay hash={hashB} compareHash={hashA} label="SHA-256(B)" color="blue" />
        </div>

        {/* Bit grids */}
        <div className="hash-bit-grids">
          <BitGrid bits={bitsA} compareBits={bitsB} label="Hash A" color="green" />
          <BitGrid bits={bitsB} compareBits={bitsA} label="Hash B" color="blue" />
        </div>

        {diffBits != null && (
          <div className="hash-legend">
            <span className="hash-legend__red">Red bits</span> differ between the two hashes.{' '}
            <span className="hash-legend__green">Green bits</span> are 1 and same.{' '}
            <span className="hash-legend__dark">Dark bits</span> are 0 and same.
          </div>
        )}
      </div>

      {/* How SHA-256 works */}
      <div className="hash-explainer-section">
        <div className="hash-explainer-section__title">How SHA-256 Works</div>
        <div className="hash-cards-grid">
          {[
            {
              title: 'Padding',
              color: 'var(--accent-blue)',
              body: 'The input is padded to a multiple of 512 bits. SHA-256 appends a single 1-bit, then zeros, then a 64-bit encoding of the original message length. This ensures messages of different lengths produce structurally different inputs to the compression function, preventing length-extension attacks.',
            },
            {
              title: '64 Rounds per Block',
              color: 'var(--accent-green)',
              body: 'Each 512-bit message block goes through 64 rounds of compression. Each round uses a round constant (derived from cube roots of the first 64 primes), a 32-bit word from the message schedule, and bitwise operations: Ch (choice), Maj (majority), sigma rotations, and modular addition. The round constants are specifically chosen to destroy any algebraic structure.',
            },
            {
              title: 'Eight Working Variables',
              color: 'var(--accent-purple)',
              body: 'The compression function maintains 8 working variables (a through h), each 32 bits. At each of the 64 rounds, all 8 variables are updated based on the current round\'s input and operations. Every variable feeds into the next round\'s computation, so a single changed bit in any round propagates forward and affects all subsequent rounds.',
            },
            {
              title: 'Merkle-Damgard Construction',
              color: 'var(--accent-amber)',
              body: 'SHA-256 uses the Merkle-Damgard construction: each block\'s output is mixed back into the state before the next block is processed. The final 256-bit hash is the concatenation of 8 state words after all blocks are processed. This chaining means the hash of a long message cannot be computed without processing every single byte.',
            },
          ].map(({ title, color, body }) => (
            <div key={title} className="hash-info-card">
              <div className="hash-info-card__title" style={{ color }}>{title}</div>
              <div className="hash-info-card__body">{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Why hashing matters */}
      <div className="hash-why-section">
        <div className="hash-why-section__title">Why Cryptographic Hashing Matters</div>
        <div className="hash-cards-grid">
          {[
            {
              title: 'Password Storage',
              color: 'var(--accent-green)',
              body: 'Websites never store your password directly. They store SHA-256 (or bcrypt/argon2) of your password. At login, they hash what you typed and compare. If the database leaks, attackers get hashes, not passwords. Cracking requires guessing billions of candidates and hashing each one.',
            },
            {
              title: 'Digital Signatures',
              color: 'var(--accent-blue)',
              body: 'Signing a 10MB document with RSA directly would be impossibly slow. Instead, SHA-256 produces a 32-byte fingerprint of the document, and only that fingerprint is signed. If even one byte of the document changes, the hash changes completely and the signature becomes invalid.',
            },
            {
              title: 'Blockchain Integrity',
              color: 'var(--accent-purple)',
              body: 'Each Bitcoin block contains the SHA-256 hash of the previous block. Changing any historical transaction would change that block\'s hash, breaking the chain for every subsequent block. An attacker would have to redo the proof-of-work for every block after the tampered one -- more computation than the rest of the network combined.',
            },
            {
              title: 'File Integrity',
              color: 'var(--accent-amber)',
              body: 'Software publishers post SHA-256 checksums of their downloads. After downloading, you hash the file and compare. If the hash matches, the file is byte-for-byte identical to what was published. A man-in-the-middle who modified the file in transit would produce a completely different hash, immediately detectable.',
            },
          ].map(({ title, color, body }) => (
            <div key={title} className="hash-info-card">
              <div className="hash-info-card__title" style={{ color }}>{title}</div>
              <div className="hash-info-card__body">{body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
