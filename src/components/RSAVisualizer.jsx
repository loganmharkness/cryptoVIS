import './RSAVisualizer.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, RefreshCw, Lock, Unlock, KeyRound } from 'lucide-react';
import { generateRSASteps, buildRSAStepsFromPrimes, rsaEncrypt, rsaDecrypt, isPrime } from '../utils/rsa';
import { parseHash, setHashParam } from '../utils/urlState';

const SPEEDS = { slow: 4000, medium: 2000, fast: 800 };

function WhyBox({ children }) {
  return (
    <div className="rsa-why-box">
      <div className="rsa-why-box__title">Why this matters</div>
      <p className="rsa-why-box__body">{children}</p>
    </div>
  );
}

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span className="rsa-tooltip"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && <span className="rsa-tooltip__popup">{text}</span>}
    </span>
  );
}

function Tag({ children, color = 'green' }) {
  return (
    <span className={`rsa-tag rsa-tag--${color}`}>{children}</span>
  );
}

function BigNum({ value, label, color = 'green', animate }) {
  return (
    <div className={`rsa-bignum rsa-bignum--${color}${animate ? ' rsa-bignum--animate' : ''}`}>
      <div className="rsa-bignum__label">{label}</div>
      <div
        className={`rsa-bignum__value rsa-bignum__value--${color}`}
        style={{ fontSize: String(value).length > 15 ? '11px' : '14px' }}
      >
        {value}
      </div>
    </div>
  );
}

function PrimeCandidates({ candidates, found }) {
  const visible = candidates.slice(0, 12);
  return (
    <div className="rsa-prime-candidates">
      {visible.map((c, i) => {
        const stateClass = c.value === found
          ? 'rsa-prime-cand--found'
          : c.isPrime
            ? 'rsa-prime-cand--prime'
            : 'rsa-prime-cand--rejected';
        return (
          <div key={i} className={`rsa-prime-cand ${stateClass}`}>
            {String(c.value)}
            {c.value === found && <span style={{ marginLeft: '4px' }}>✓</span>}
            {c.value !== found && !c.isPrime && <span className="rsa-prime-cand__cross">✗</span>}
          </div>
        );
      })}
    </div>
  );
}

function EuclidTable({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="rsa-euclid-wrap">
      <table className="rsa-euclid-table">
        <thead>
          <tr>
            {['Step', 'Quotient', 'Remainder', 's', 't'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.slice(0, 8).map((row, i) => (
            <tr key={i} className="rsa-euclid-row" style={{ animation: `fadeIn 0.3s ease-out ${i * 80}ms both` }}>
              <td className="rsa-euclid-td-step">{i + 1}</td>
              <td className="rsa-euclid-td-q">{String(row.q)}</td>
              <td className="rsa-euclid-td-r">{String(row.r)}</td>
              <td className="rsa-euclid-td-s">{String(row.s)}</td>
              <td className="rsa-euclid-td-t">{String(row.t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STEP_TITLES = [
  'Select prime p',
  'Select prime q',
  'Compute n = p × q',
  'Compute φ(n) = (p-1)(q-1)',
  'Choose e (coprime to φ(n))',
  'Compute d via Extended Euclidean',
  'Keys revealed',
];

const STEP_EXPLAINERS = [
  'RSA requires two large prime numbers. We start by finding p. A prime has exactly two divisors: 1 and itself. We test candidates using the Miller-Rabin primality test, which confirms primality probabilistically in milliseconds. In production RSA, p would be 1024-2048 bits long. We use small primes here so the arithmetic stays readable.',
  'We pick a second prime q, distinct from p. If p = q, then n = p^2, which is far easier to factor. In real RSA, p and q are also chosen to be roughly the same bit-length and to pass additional checks: not too close together, not sharing small factors with common values, to close off known attacks.',
  'n = p * q is the RSA modulus. It appears in both the public key and the private key. All encryption and decryption happen modulo n, meaning results are always reduced to the range [0, n-1]. The bit-length of n is what people mean when they say "RSA-2048".',
  'Euler\'s totient φ(n) counts how many integers from 1 to n share no common factor with n. For a product of two distinct primes: φ(n) = (p-1)(q-1). This is the size of the multiplicative group we work in and governs which exponents produce valid encryption and decryption relationships.',
  'e must satisfy gcd(e, φ(n)) = 1 so that a modular inverse d exists. The value 65537 = 2^16 + 1 is the near-universal choice in practice. It is prime, has only two 1-bits in binary (making exponentiation fast via square-and-multiply), and is large enough to resist small-exponent attacks.',
  'd is defined by e * d ≡ 1 (mod φ(n)), meaning d is the modular inverse of e. The Extended Euclidean Algorithm finds it in O(log n) steps. d is the private exponent: applying it undoes what e did. It must stay secret forever because it can decrypt any message ever encrypted to this public key.',
  'Public key (e, n): share it freely. Private key (d, n): never transmit it. Encrypt: c = m^e mod n. Decrypt: m = c^d mod n. The math works because e * d = 1 mod φ(n), so raising m to e then d gives m^(ed) = m^(1 + k*φ(n)) = m, by Fermat\'s little theorem.',
];

const STEP_WHY = [
  'Primes are the raw material of RSA security. Multiplying two large primes together is trivial and instant. Factoring the result back into its components is believed to require exponential time with the best known algorithms. This asymmetry -- cheap in one direction, astronomically expensive in the other -- is what lets you publish a key that anyone can encrypt with but only you can decrypt.',
  'Real RSA keys use primes with 512-2048 bits each. No computer has ever successfully factored a properly generated 2048-bit RSA modulus. The RSA Factoring Challenge offered cash prizes for factoring specific numbers; RSA-2048 remains unfactored as of 2024. Using two primes of similar size, with no small factors, is what keeps the key in that safe zone.',
  'Anyone who can factor n into p and q can compute φ(n) = (p-1)(q-1), then compute d from e, and decrypt everything ever sent to this key. The entire security of RSA reduces to one question: is factoring n computationally hard? For 2048-bit n, with current algorithms (General Number Field Sieve) and hardware, the answer is yes -- it would take longer than the age of the universe.',
  'φ(n) is the secret structure inside n. If an attacker knew φ(n), they could compute d directly without factoring n. But computing φ(n) from n alone is believed to be as hard as factoring n itself. This is not obvious -- it is a non-trivial mathematical result that makes the whole RSA security argument coherent.',
  '65537 is the standard public exponent in virtually every RSA implementation -- OpenSSL, Java, .NET, Python. Small values like e=3 have a known weakness: if the same unpadded message is sent to 3 different recipients, the cube root of the product of the three ciphertexts reveals the plaintext directly. Larger e values, combined with proper padding (OAEP), eliminate this class of attack.',
  'd is the most sensitive value in RSA. Anyone who obtains d can: decrypt all past and future messages, forge signatures, and factor n (there is an efficient algorithm to factor n given e and d). In practice, private keys are stored in hardware security modules (HSMs) or encrypted at rest. Key ceremonies for root certificate authorities involve physical security controls and multiple witnesses.',
  'RSA solved the key distribution problem that blocked secure communication for centuries. Before asymmetric cryptography (1970s), two parties had to meet in person or trust a courier to share a secret before communicating privately. With RSA, Bob can send Alice a secure message without ever having spoken to her -- he just uses her public key, which she posted on her website.',
];

export default function RSAVisualizer() {
  const [step, setStep] = useState(-1);
  const [data, setData] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('medium');
  const [msgInput, setMsgInput] = useState('42');
  const [encrypted, setEncrypted] = useState(null);
  const [decrypted, setDecrypted] = useState(null);
  const [customMode, setCustomMode] = useState(false);
  const [customP, setCustomP] = useState('');
  const [customQ, setCustomQ] = useState('');
  const timerRef = useRef(null);

  const maxStep = STEP_TITLES.length - 1;

  function validatePrime(str) {
    if (!str.trim()) return 'empty';
    try {
      const n = BigInt(str.trim());
      if (n < 2n) return 'too-small';
      return isPrime(n) ? 'valid' : 'not-prime';
    } catch {
      return 'invalid';
    }
  }

  const pStatus = validatePrime(customP);
  const qStatus = validatePrime(customQ);
  const bothValid = pStatus === 'valid' && qStatus === 'valid';
  const sameValue = bothValid && BigInt(customP.trim()) === BigInt(customQ.trim());
  const canApplyCustom = bothValid && !sameValue;

  const generate = useCallback(() => {
    const result = generateRSASteps(16);
    setData(result);
    setStep(-1);
    setEncrypted(null);
    setDecrypted(null);
    setPlaying(false);
    setHashParam('p', null);
    setHashParam('q', null);
  }, []);

  const generateFromCustom = useCallback(() => {
    if (!canApplyCustom) return;
    const p = BigInt(customP.trim());
    const q = BigInt(customQ.trim());
    const result = buildRSAStepsFromPrimes(p, q);
    setData(result);
    setStep(-1);
    setEncrypted(null);
    setDecrypted(null);
    setPlaying(false);
    setHashParam('p', customP.trim());
    setHashParam('q', customQ.trim());
  }, [customP, customQ, canApplyCustom]);

  // On mount: load custom primes from URL if present, else generate random.
  useEffect(() => {
    const { params } = parseHash();
    const urlP = params.get('p');
    const urlQ = params.get('q');
    if (urlP && urlQ) {
      setCustomMode(true);
      setCustomP(urlP);
      setCustomQ(urlQ);
      try {
        const p = BigInt(urlP);
        const q = BigInt(urlQ);
        if (isPrime(p) && isPrime(q) && p !== q) {
          setData(buildRSAStepsFromPrimes(p, q));
          return;
        }
      } catch {}
    }
    generate();
  }, []);

  useEffect(() => {
    if (playing) {
      timerRef.current = setTimeout(() => {
        setStep(s => {
          if (s >= maxStep) { setPlaying(false); return s; }
          return s + 1;
        });
      }, SPEEDS[speed]);
    }
    return () => clearTimeout(timerRef.current);
  }, [playing, step, speed, maxStep]);

  const handleEncrypt = () => {
    if (!data) return;
    try {
      const m = BigInt(msgInput.trim());
      if (m >= data.n) { alert(`Message must be < n (${data.n})`); return; }
      const c = rsaEncrypt(m, data.e, data.n);
      setEncrypted(c);
      setDecrypted(null);
    } catch { alert('Enter a valid integer'); }
  };

  const handleDecrypt = () => {
    if (!data || encrypted == null) return;
    const m = rsaDecrypt(encrypted, data.d, data.n);
    setDecrypted(m);
  };

  return (
    <div style={{ width: '100%' }}>
      <div className="rsa-header">
        <h1 className="rsa-title">RSA Key Generation</h1>
        <p className="rsa-subtitle">
          Step-by-step walkthrough of how RSA public/private keys are generated from two prime numbers.
        </p>
      </div>

      {/* Controls */}
      <div className="rsa-controls">
        <button onClick={generate} className="rsa-btn-regen">
          <RefreshCw size={14} /> New Keys
        </button>

        <button
          onClick={() => setCustomMode(m => !m)}
          className={`rsa-btn-custom-toggle${customMode ? ' rsa-btn-custom-toggle--active' : ''}`}
        >
          <KeyRound size={14} /> Custom Primes
        </button>

        <button
          onClick={() => setStep(s => Math.max(-1, s - 1))}
          disabled={step <= -1}
          className="rsa-btn-nav"
        >
          <SkipBack size={14} /> Back
        </button>

        <button
          onClick={() => setStep(s => Math.min(maxStep, s + 1))}
          disabled={step >= maxStep}
          className="rsa-btn-nav"
        >
          Next <SkipForward size={14} />
        </button>

        <div className="rsa-controls__right">
          <span className="rsa-speed-label">Speed:</span>
          {['slow', 'medium', 'fast'].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rsa-btn-speed${speed === s ? ' rsa-btn-speed--active' : ''}`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setPlaying(p => !p)}
            disabled={step >= maxStep}
            className={`rsa-btn-play${playing ? ' rsa-btn-play--playing' : ''}`}
          >
            {playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
          </button>
        </div>
      </div>

      {/* Custom prime inputs */}
      {customMode && (
        <div className="rsa-custom-panel">
          <div className="rsa-custom-panel__title">
            <KeyRound size={13} /> Enter your own prime numbers
          </div>
          <div className="rsa-custom-panel__inputs">
            {[
              { label: 'p', value: customP, set: setCustomP, status: pStatus },
              { label: 'q', value: customQ, set: setCustomQ, status: qStatus },
            ].map(({ label, value, set, status }) => {
              const isValid = status === 'valid';
              const isError = status !== 'empty' && status !== 'valid';
              const statusText = {
                empty: '',
                invalid: 'Not a valid integer',
                'too-small': 'Must be >= 2',
                'not-prime': 'Not a prime number',
                valid: 'Prime ✓',
              }[status];
              return (
                <div key={label} className="rsa-custom-panel__field">
                  <div className="rsa-custom-panel__field-label">Prime {label}</div>
                  <input
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={`e.g. ${label === 'p' ? '61' : '53'}`}
                    className={`rsa-prime-input${isValid ? ' rsa-prime-input--valid' : isError ? ' rsa-prime-input--error' : ''}`}
                  />
                  {statusText && (
                    <div className={`rsa-prime-status${isValid ? ' rsa-prime-status--valid' : ' rsa-prime-status--error'}`}>
                      {statusText}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="rsa-custom-panel__apply">
              <button
                onClick={generateFromCustom}
                disabled={!canApplyCustom}
                className={`rsa-btn-apply${canApplyCustom ? ' rsa-btn-apply--ready' : ''}`}
              >
                <RefreshCw size={13} /> Generate
              </button>
            </div>
          </div>
          {sameValue && (
            <div className="rsa-custom-panel__error">p and q must be different primes</div>
          )}
        </div>
      )}

      {/* Step progress bar */}
      <div className="rsa-step-bar">
        {STEP_TITLES.map((title, i) => (
          <div
            key={i}
            onClick={() => setStep(i)}
            className={`rsa-step-bar__seg${i <= step ? ' rsa-step-bar__seg--done' : ''}`}
            title={title}
          />
        ))}
      </div>

      {/* Current step display */}
      {step >= 0 && step < STEP_TITLES.length && (
        <div className="rsa-step-card">
          <div className="rsa-step-card__header">
            <Tag color="green">Step {step + 1}/{STEP_TITLES.length}</Tag>
            <span className="rsa-step-card__title">{STEP_TITLES[step]}</span>
          </div>
          <p className="rsa-step-card__explainer">{STEP_EXPLAINERS[step]}</p>
          <WhyBox>{STEP_WHY[step]}</WhyBox>
          <div className="rsa-step-card__spacer" />

          {data && (
            <div className="rsa-step-grid">
              {step === 0 && (
                <>
                  <PrimeCandidates candidates={data.pCandidates} found={data.p} />
                  <BigNum value={String(data.p)} label="p — chosen prime" color="green" animate />
                </>
              )}
              {step === 1 && (
                <>
                  <PrimeCandidates candidates={data.qCandidates} found={data.q} />
                  <div className="rsa-two-col">
                    <BigNum value={String(data.p)} label="p" color="green" />
                    <BigNum value={String(data.q)} label="q — chosen prime" color="blue" animate />
                  </div>
                </>
              )}
              {step === 2 && (
                <div className="rsa-step2-grid">
                  <BigNum value={String(data.p)} label="p" color="green" />
                  <span className="rsa-step2-op">×</span>
                  <BigNum value={String(data.q)} label="q" color="blue" />
                  <span className="rsa-step2-op">=</span>
                  <BigNum value={String(data.n)} label="n = p × q (modulus)" color="amber" animate />
                </div>
              )}
              {step === 3 && (
                <div className="rsa-two-col">
                  <div>
                    <div className="rsa-formula-hint">
                      φ(n) = (p−1) × (q−1) = ({String(data.p - 1n)}) × ({String(data.q - 1n)})
                    </div>
                    <BigNum value={String(data.phi)} label="φ(n) — Euler's totient" color="purple" animate />
                  </div>
                  <BigNum value={String(data.n)} label="n (modulus)" color="amber" />
                </div>
              )}
              {step === 4 && (
                <div className="rsa-two-col">
                  <BigNum value={String(data.e)} label="e — public exponent" color="blue" animate />
                  <BigNum value={String(data.phi)} label="φ(n)" color="purple" />
                  <div className="rsa-coprime-note">
                    gcd({String(data.e)}, {String(data.phi)}) = 1  ✓  coprime
                  </div>
                </div>
              )}
              {step === 5 && (
                <>
                  <div className="rsa-euclid-finding">
                    Finding d such that: e × d ≡ 1 (mod φ(n))
                  </div>
                  <EuclidTable steps={data.euclidSteps} />
                  <BigNum value={String(data.d)} label="d — private exponent" color="purple" animate />
                </>
              )}
              {step === 6 && (
                <div className="rsa-key-grid">
                  <div className="rsa-key-box rsa-key-box--public">
                    <div className="rsa-key-box__header rsa-key-box__header--public">
                      <Unlock size={14} /> Public Key
                    </div>
                    <BigNum value={String(data.e)} label="e (public exponent)" color="green" />
                    <div className="rsa-key-box__secondary">
                      <BigNum value={String(data.n)} label="n (modulus)" color="green" />
                    </div>
                  </div>
                  <div className="rsa-key-box rsa-key-box--private">
                    <div className="rsa-key-box__header rsa-key-box__header--private">
                      <Lock size={14} /> Private Key
                    </div>
                    <BigNum value={String(data.d)} label="d (private exponent)" color="purple" />
                    <div className="rsa-key-box__secondary">
                      <BigNum value={String(data.n)} label="n (modulus)" color="purple" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Encrypt/decrypt demo */}
      {step >= 6 && data && (
        <div className="rsa-demo-card">
          <div className="rsa-demo-title">Mini Encrypt / Decrypt Demo</div>
          <div className="rsa-demo-hint">
            Enter an integer m where 0 &lt;= m &lt; {String(data.n)}. Cipher: c = m^e mod n. Recover: m = c^d mod n.
          </div>
          <div className="rsa-demo-inputs">
            <div>
              <div className="rsa-demo-field-label">Message (integer)</div>
              <input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                className="rsa-demo-input"
              />
            </div>
            <button onClick={handleEncrypt} className="rsa-btn-encrypt">
              <Lock size={13} /> Encrypt
            </button>
            {encrypted != null && (
              <button onClick={handleDecrypt} className="rsa-btn-decrypt">
                <Unlock size={13} /> Decrypt
              </button>
            )}
          </div>

          {encrypted != null && (
            <div className="rsa-demo-result">
              <BigNum value={msgInput} label="Plaintext m" color="blue" />
              <div className="rsa-demo-arrow">
                <div className="rsa-demo-arrow__formula">c = m^e mod n</div>
                <div className="rsa-demo-arrow__key rsa-demo-arrow__key--green">e = {String(data.e)}</div>
              </div>
              <BigNum value={String(encrypted)} label="Ciphertext c" color="amber" animate />
              {decrypted != null && (
                <>
                  <div className="rsa-demo-arrow">
                    <div className="rsa-demo-arrow__formula">m = c^d mod n</div>
                    <div className="rsa-demo-arrow__key rsa-demo-arrow__key--purple">d = {String(data.d)}</div>
                  </div>
                  <BigNum
                    value={String(decrypted)}
                    label={`Decrypted ${decrypted === BigInt(msgInput) ? '✓ matches!' : '✗ mismatch'}`}
                    color={decrypted === BigInt(msgInput) ? 'green' : 'red'}
                    animate
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {step < 0 && (
        <div className="rsa-start-prompt">
          Press <strong className="rsa-start-prompt__key">Play</strong> or <strong className="rsa-start-prompt__key">Next</strong> to begin the walkthrough.
        </div>
      )}
    </div>
  );
}
