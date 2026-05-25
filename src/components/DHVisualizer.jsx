import './DHVisualizer.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, RefreshCw, Lock, Unlock, ArrowRight, ArrowLeft } from 'lucide-react';
import { generateDHSteps } from '../utils/dh';

const SPEEDS = { slow: 4000, medium: 2000, fast: 800 };

const STEP_TITLES = [
  'Agree on public parameters',
  'Alice picks a private key',
  'Bob picks a private key',
  'Alice computes her public key',
  'Bob computes his public key',
  'Exchange public keys over the wire',
  'Alice computes the shared secret',
  'Bob computes the shared secret',
  'Shared secret established',
];

const STEP_EXPLAINERS = [
  'Alice and Bob agree on a prime p and a generator g, which is a primitive root modulo p. A primitive root is a number whose successive powers cycle through every integer from 1 to p-1 before repeating. For example with p=7 and g=3: 3^1=3, 3^2=2, 3^3=6, 3^4=4, 3^5=5, 3^6=1. All 6 non-zero values appear. Both p and g are fully public.',
  'Alice secretly picks a random integer a in the range [2, p-2]. This is her private exponent. It never gets transmitted or stored anywhere outside her machine. In real DH, a would be hundreds of bits long. We use a small number here so you can verify the arithmetic by hand.',
  'Bob independently picks his own random b. Neither party knows the other\'s private key at any point -- this is the key insight. They have never had a private channel. Each person\'s secret exists only on their own machine.',
  'Alice computes A = g^a mod p. Fast exponentiation (square-and-multiply) does this in O(log a) multiplications. But given only A, g, and p, recovering a requires solving the discrete logarithm problem: "what power of g gives A mod p?" There is no known efficient algorithm for this.',
  'Bob computes B = g^b mod p using the same one-way function. Note that A and B look like random numbers to anyone who does not know a or b -- there is no visible mathematical structure in the outputs that would hint at the private keys.',
  'Alice sends A to Bob. Bob sends B to Alice. An eavesdropper captures both. They now know g, p, A = g^a mod p, and B = g^b mod p. To compute the shared secret g^(ab) mod p they need either a or b. Getting a from A requires solving the discrete log problem.',
  'Alice computes S = B^a mod p. Substituting B = g^b: S = (g^b)^a mod p = g^(b*a) mod p = g^(ab) mod p. She uses Bob\'s public key as the base and her own private key as the exponent.',
  'Bob computes S = A^b mod p = (g^a)^b mod p = g^(ab) mod p. Both Alice and Bob are computing g to the power (a*b) mod p, arriving at it from different directions using only their own private key and the other party\'s public key.',
  'Both computed g^(ab) mod p independently and arrived at the same result. This value was never on the wire. An attacker who recorded every packet -- g, p, A, B -- cannot derive it without solving the discrete log problem.',
];

const STEP_WHY = [
  'Using a primitive root g ensures the group {g^1, g^2, ..., g^(p-1)} contains all p-1 possible nonzero values mod p. This maximises the search space an attacker must explore when trying to solve the discrete log. A non-primitive-root generator would produce a smaller subgroup, reducing the effective key space and making brute force feasible.',
  'The security of DH rests entirely on keeping a (and b) secret. Modern TLS uses ephemeral keys: a fresh a is generated for each connection and discarded immediately after use. This is called forward secrecy. Even if an attacker records encrypted traffic today and later compromises a server\'s long-term keys, they still cannot decrypt old sessions because those ephemeral private keys are permanently gone.',
  'Two independent secrets are needed because the shared result g^(ab) requires both to compute. An attacker who captures g^a and g^b and wants to compute g^(ab) faces the Computational Diffie-Hellman (CDH) problem. It is believed to be as hard as the discrete log problem, though this has not been formally proven -- CDH hardness is an assumption, not a theorem.',
  'The discrete log problem is the mathematical hardness assumption underlying DH. Fast exponentiation computes g^a mod p in O(log a) multiplications. The best known discrete log algorithms -- index calculus, number field sieve -- have subexponential but still enormous complexity for 2048-bit p. For comparison, the discrete log of a 2048-bit number requires more computation than has ever been performed in history.',
  'The outputs A and B are computationally indistinguishable from random group elements. This is intentional. If public keys leaked partial information about private keys (such as the high-order bits), an attacker could narrow the search space dramatically. The modular reduction destroys such patterns, and this property -- that public keys reveal nothing about private keys -- is called computational indistinguishability.',
  'Every HTTPS connection your browser makes uses a form of this exchange. TLS 1.3 mandates (EC)DHE (ephemeral Diffie-Hellman on elliptic curves) for all key establishment. The eavesdropper in this step represents a passive attacker, a nation-state recording encrypted traffic, or a compromised router. None of them can derive the shared secret from the intercepted values.',
  'The commutativity of exponents -- (g^b)^a = (g^a)^b = g^(ab) -- is the mathematical trick that makes the whole protocol work. This property holds in any commutative group. Modern ECDH replaces the multiplicative integers mod p with an elliptic curve group, where "exponentiation" becomes scalar multiplication of a curve point. ECDH offers equivalent security with far shorter keys: 256-bit ECDH vs 3072-bit classical DH.',
  'In real protocols, the raw shared secret S is never used directly as an encryption key. S is fed through a Key Derivation Function (KDF) such as HKDF, which mixes S with a nonce and context to produce cryptographically uniform keys of the required length. This step ensures that even if S has slightly non-uniform bits, the derived keys are indistinguishable from random.',
  'Diffie and Hellman\'s 1976 paper "New Directions in Cryptography" is one of the most cited papers in computer science history. Before it, two strangers who had never met could not establish a private channel without a trusted courier. DH changed this permanently. Today it underpins TLS, SSH, Signal, WhatsApp, iMessage, and most encrypted communication on earth.',
];

function WhyBox({ children }) {
  return (
    <div className="dh-why-box">
      <div className="dh-why-box__title">Why this matters</div>
      <p className="dh-why-box__body">{children}</p>
    </div>
  );
}

function Tag({ children, color = 'green' }) {
  return (
    <span className={`dh-tag dh-tag--${color}`}>{children}</span>
  );
}

function ValueRow({ label, value, subtext, color = 'green', locked = false, animate = false }) {
  return (
    <div className={`dh-value-row dh-value-row--${color}${animate ? ' dh-value-row--animate' : ''}`}>
      <div className="dh-value-row__label">
        {locked ? <Lock size={10} /> : <Unlock size={10} />}
        {label}
      </div>
      <div className={`dh-value-row__val dh-value-row__val--${color}`}>
        {String(value)}
      </div>
      {subtext && <div className="dh-value-row__sub">{subtext}</div>}
    </div>
  );
}

function WireParam({ label, value, color = 'amber', animate = false }) {
  return (
    <div className={`dh-wire-param dh-wire-param--${color}${animate ? ' dh-wire-param--animate' : ''}`}>
      <div className="dh-wire-param__label">{label}</div>
      <div className={`dh-wire-param__val dh-wire-param__val--${color}`}>
        {String(value)}
      </div>
    </div>
  );
}

export default function DHVisualizer() {
  const [step, setStep] = useState(-1);
  const [data, setData] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('medium');
  const timerRef = useRef(null);
  const maxStep = STEP_TITLES.length - 1;

  const generate = useCallback(() => {
    setData(generateDHSteps(10));
    setStep(-1);
    setPlaying(false);
  }, []);

  useEffect(() => { generate(); }, []);

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

  return (
    <div style={{ width: '100%' }}>

      <div className="dh-header">
        <h1 className="dh-title">Diffie-Hellman Key Exchange</h1>
        <p className="dh-subtitle">
          Watch Alice and Bob establish a shared secret over a fully public channel -- without ever transmitting it.
        </p>
      </div>

      {/* Controls */}
      <div className="dh-controls">
        <button onClick={generate} className="dh-btn-regen">
          <RefreshCw size={14} /> New Exchange
        </button>

        <button
          onClick={() => setStep(s => Math.max(-1, s - 1))}
          disabled={step <= -1}
          className="dh-btn-nav"
        >
          <SkipBack size={14} /> Back
        </button>

        <button
          onClick={() => setStep(s => Math.min(maxStep, s + 1))}
          disabled={step >= maxStep}
          className="dh-btn-nav"
        >
          Next <SkipForward size={14} />
        </button>

        <div className="dh-controls__right">
          <span className="dh-speed-label">Speed:</span>
          {['slow', 'medium', 'fast'].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`dh-btn-speed${speed === s ? ' dh-btn-speed--active' : ''}`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setPlaying(p => !p)}
            disabled={step >= maxStep}
            className={`dh-btn-play${playing ? ' dh-btn-play--playing' : ''}`}
          >
            {playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
          </button>
        </div>
      </div>

      {/* Step progress bar */}
      <div className="dh-step-bar">
        {STEP_TITLES.map((title, i) => (
          <div
            key={i}
            onClick={() => setStep(i)}
            className={`dh-step-bar__seg${i <= step ? ' dh-step-bar__seg--done' : ''}`}
            title={title}
          />
        ))}
      </div>

      {/* Step explainer */}
      {step >= 0 && (
        <div className="dh-step-card">
          <div className="dh-step-card__header">
            <Tag color="green">Step {step + 1}/{STEP_TITLES.length}</Tag>
            <span className="dh-step-card__title">{STEP_TITLES[step]}</span>
          </div>
          <p className="dh-step-card__explainer">{STEP_EXPLAINERS[step]}</p>
          <WhyBox>{STEP_WHY[step]}</WhyBox>
        </div>
      )}

      {/* Main 3-column visualization */}
      {data && (
        <div className="dh-viz-grid">

          {/* Alice */}
          <div className="dh-alice-panel">
            <div className="dh-alice-panel__header">
              <div className="dh-alice-dot" />
              <span className="dh-alice-label">Alice</span>
            </div>

            {step >= 1 ? (
              <ValueRow
                label="private key a -- never sent"
                value={String(data.a)}
                subtext="chosen secretly"
                color="amber"
                locked
                animate={step === 1}
              />
            ) : (
              <div className="dh-waiting">waiting...</div>
            )}

            {step >= 3 && (
              <ValueRow
                label="public key A = g^a mod p"
                value={String(data.A)}
                subtext={`${String(data.g)}^${String(data.a)} mod ${String(data.p)}`}
                color="green"
                locked={false}
                animate={step === 3}
              />
            )}

            {step >= 6 && (
              <ValueRow
                label="shared secret = B^a mod p"
                value={String(data.sharedA)}
                subtext={`${String(data.B)}^${String(data.a)} mod ${String(data.p)}`}
                color="purple"
                locked
                animate={step === 6}
              />
            )}
          </div>

          {/* Wire / public channel */}
          <div className="dh-wire-panel">
            <div className="dh-wire-panel__title">public wire</div>

            {step >= 0 && (
              <>
                <WireParam label="p -- prime modulus" value={String(data.p)} color="amber" animate={step === 0} />
                <WireParam label="g -- generator" value={String(data.g)} color="amber" animate={step === 0} />
              </>
            )}

            {step >= 5 && (
              <>
                <div className="dh-wire-divider" />
                <div className={`dh-wire-key dh-wire-key--green${step === 5 ? ' dh-wire-key--animate' : ''}`}>
                  <div className="dh-wire-key__label dh-wire-key__label--green">
                    A <ArrowRight size={9} /> Bob
                  </div>
                  <div className="dh-wire-key__val dh-wire-key__val--green">
                    {String(data.A)}
                  </div>
                </div>
                <div className={`dh-wire-key dh-wire-key--blue${step === 5 ? ' dh-wire-key--animate' : ''}`}>
                  <div className="dh-wire-key__label dh-wire-key__label--blue">
                    <ArrowLeft size={9} /> B Alice
                  </div>
                  <div className="dh-wire-key__val dh-wire-key__val--blue">
                    {String(data.B)}
                  </div>
                </div>
              </>
            )}

            {step < 0 && (
              <div className="dh-wire-empty">nothing yet</div>
            )}
          </div>

          {/* Bob */}
          <div className="dh-bob-panel">
            <div className="dh-bob-panel__header">
              <div className="dh-bob-dot" />
              <span className="dh-bob-label">Bob</span>
            </div>

            {step >= 2 ? (
              <ValueRow
                label="private key b -- never sent"
                value={String(data.b)}
                subtext="chosen secretly"
                color="amber"
                locked
                animate={step === 2}
              />
            ) : (
              <div className="dh-waiting">waiting...</div>
            )}

            {step >= 4 && (
              <ValueRow
                label="public key B = g^b mod p"
                value={String(data.B)}
                subtext={`${String(data.g)}^${String(data.b)} mod ${String(data.p)}`}
                color="blue"
                locked={false}
                animate={step === 4}
              />
            )}

            {step >= 7 && (
              <ValueRow
                label="shared secret = A^b mod p"
                value={String(data.sharedB)}
                subtext={`${String(data.A)}^${String(data.b)} mod ${String(data.p)}`}
                color="purple"
                locked
                animate={step === 7}
              />
            )}
          </div>
        </div>
      )}

      {/* Shared secret confirmation banner */}
      {data && step >= 8 && (
        <div className="dh-secret-banner">
          <div className="dh-secret-banner__label">✓ Shared Secret Established</div>
          <div className="dh-secret-banner__value">{String(data.sharedA)}</div>
          <div className="dh-secret-banner__formula">
            g^(a·b) mod p = {String(data.g)}^({String(data.a)}·{String(data.b)}) mod {String(data.p)}
          </div>
          <div className="dh-secret-banner__desc">
            Alice computed it as B^a mod p. Bob computed it as A^b mod p. Both got the same result. The eavesdropper who intercepted A, B, g, and p cannot.
          </div>
        </div>
      )}

      {/* Start prompt */}
      {step < 0 && (
        <div className="dh-start-prompt">
          Press <strong className="dh-start-prompt__key">Play</strong> or <strong className="dh-start-prompt__key">Next</strong> to begin the key exchange.
        </div>
      )}
    </div>
  );
}
