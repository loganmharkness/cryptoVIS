import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, RefreshCw, Lock, Unlock, KeyRound } from 'lucide-react';
import { generateRSASteps, buildRSAStepsFromPrimes, rsaEncrypt, rsaDecrypt, isPrime } from '../utils/rsa';

const SPEEDS = { slow: 4000, medium: 2000, fast: 800 };

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1d27', border: '1px solid var(--border-bright)',
          color: 'var(--text-primary)', padding: '6px 10px', borderRadius: '6px',
          fontSize: '12px', whiteSpace: 'nowrap', zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          fontFamily: 'Inter, sans-serif', fontWeight: 400,
        }}>{text}</span>
      )}
    </span>
  );
}

function Tag({ children, color = 'green' }) {
  const colors = {
    green: 'rgba(0,255,136,0.15)',
    blue: 'rgba(14,165,233,0.15)',
    purple: 'rgba(168,85,247,0.15)',
    amber: 'rgba(245,158,11,0.15)',
  };
  const textColors = {
    green: 'var(--accent-green)',
    blue: 'var(--accent-blue)',
    purple: 'var(--accent-purple)',
    amber: 'var(--accent-amber)',
  };
  return (
    <span style={{
      background: colors[color],
      color: textColors[color],
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: '600',
    }}>{children}</span>
  );
}

function BigNum({ value, label, color = 'green', animate }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${color === 'green' ? 'rgba(0,255,136,0.2)' : color === 'blue' ? 'rgba(14,165,233,0.2)' : color === 'purple' ? 'rgba(168,85,247,0.2)' : 'rgba(245,158,11,0.2)'}`,
      borderRadius: '8px',
      padding: '12px 16px',
      animation: animate ? 'fadeIn 0.4s ease-out' : undefined,
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: String(value).length > 15 ? '11px' : '14px',
        color: color === 'green' ? 'var(--accent-green)' : color === 'blue' ? 'var(--accent-blue)' : color === 'purple' ? 'var(--accent-purple)' : 'var(--accent-amber)',
        wordBreak: 'break-all',
        lineHeight: '1.5',
      }}>{value}</div>
    </div>
  );
}

function PrimeCandidates({ candidates, found }) {
  const visible = candidates.slice(0, 12);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
      {visible.map((c, i) => (
        <div key={i} style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '12px',
          padding: '3px 8px',
          borderRadius: '4px',
          background: c.value === found ? 'rgba(0,255,136,0.2)' : c.isPrime ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
          color: c.value === found ? 'var(--accent-green)' : c.isPrime ? 'var(--accent-amber)' : '#6b7280',
          border: `1px solid ${c.value === found ? 'rgba(0,255,136,0.3)' : 'transparent'}`,
          transition: 'all 0.2s',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {String(c.value)}
          {c.value === found && <span style={{ marginLeft: '4px' }}>✓</span>}
          {c.value !== found && !c.isPrime && <span style={{ marginLeft: '4px', color: '#ef4444' }}>✗</span>}
        </div>
      ))}
    </div>
  );
}

function EuclidTable({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', marginTop: '12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Step', 'Quotient', 'Remainder', 's', 't'].map(h => (
              <th key={h} style={{ padding: '6px 8px', color: 'var(--text-muted)', fontWeight: '500', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.slice(0, 8).map((row, i) => (
            <tr key={i} style={{
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              animation: `fadeIn 0.3s ease-out ${i * 80}ms both`,
            }}>
              <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }}>{i + 1}</td>
              <td style={{ padding: '5px 8px', color: 'var(--accent-amber)' }}>{String(row.q)}</td>
              <td style={{ padding: '5px 8px', color: 'var(--accent-blue)' }}>{String(row.r)}</td>
              <td style={{ padding: '5px 8px', color: 'var(--accent-purple)' }}>{String(row.s)}</td>
              <td style={{ padding: '5px 8px', color: 'var(--accent-green)' }}>{String(row.t)}</td>
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
  'We need two large prime numbers p and q. A prime number has no divisors other than 1 and itself.',
  'We pick a second prime q, different from p. The security of RSA depends on the difficulty of finding p and q given only their product n.',
  'n = p × q is the RSA modulus. It is public. Its size determines the key strength.',
  'φ(n) (Euler\'s totient) counts integers from 1 to n that are coprime with n. For RSA, φ(n) = (p-1)(q-1).',
  'e is the public exponent. It must be coprime with φ(n), meaning gcd(e, φ(n)) = 1. Common choice: 65537.',
  'd is the private exponent — the modular inverse of e mod φ(n). The Extended Euclidean Algorithm finds it.',
  'Public key: (e, n) — share this freely. Private key: (d, n) — keep this secret. Encrypt: m^e mod n. Decrypt: c^d mod n.',
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
  }, [customP, customQ, canApplyCustom]);

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

  const visible = step >= 0;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
          RSA Key Generation
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '14px' }}>
          Step-by-step walkthrough of how RSA public/private keys are generated from two prime numbers.
        </p>
      </div>

      {/* Controls */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px', marginBottom: '20px',
        display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center',
      }}>
        <button onClick={generate} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)',
          color: 'var(--accent-green)', padding: '8px 16px', borderRadius: '8px',
          cursor: 'pointer', fontSize: '13px', fontWeight: '500',
        }}>
          <RefreshCw size={14} /> New Keys
        </button>

        <button onClick={() => setCustomMode(m => !m)} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: customMode ? 'rgba(168,85,247,0.15)' : 'var(--bg-elevated)',
          border: `1px solid ${customMode ? 'rgba(168,85,247,0.4)' : 'var(--border)'}`,
          color: customMode ? 'var(--accent-purple)' : 'var(--text-secondary)',
          padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
        }}>
          <KeyRound size={14} /> Custom Primes
        </button>

        <button onClick={() => setStep(s => Math.max(-1, s - 1))} disabled={step <= -1} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          color: step <= -1 ? 'var(--text-muted)' : 'var(--text-primary)',
          padding: '8px 12px', borderRadius: '8px', cursor: step <= -1 ? 'default' : 'pointer', fontSize: '13px',
        }}>
          <SkipBack size={14} /> Back
        </button>

        <button onClick={() => setStep(s => Math.min(maxStep, s + 1))} disabled={step >= maxStep} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          color: step >= maxStep ? 'var(--text-muted)' : 'var(--text-primary)',
          padding: '8px 12px', borderRadius: '8px', cursor: step >= maxStep ? 'default' : 'pointer', fontSize: '13px',
        }}>
          Next <SkipForward size={14} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Speed:</span>
          {['slow', 'medium', 'fast'].map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
              background: speed === s ? 'rgba(168,85,247,0.15)' : 'transparent',
              border: `1px solid ${speed === s ? 'rgba(168,85,247,0.4)' : 'var(--border)'}`,
              color: speed === s ? 'var(--accent-purple)' : 'var(--text-muted)',
            }}>{s}</button>
          ))}
          <button onClick={() => setPlaying(p => !p)} disabled={step >= maxStep} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: playing ? 'rgba(239,68,68,0.1)' : 'rgba(14,165,233,0.1)',
            border: `1px solid ${playing ? 'rgba(239,68,68,0.3)' : 'rgba(14,165,233,0.3)'}`,
            color: playing ? '#ef4444' : 'var(--accent-blue)',
            padding: '8px 16px', borderRadius: '8px', cursor: step >= maxStep ? 'default' : 'pointer', fontSize: '13px', fontWeight: '500',
          }}>
            {playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
          </button>
        </div>
      </div>

      {/* Custom prime inputs */}
      {customMode && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: '12px', padding: '16px', marginBottom: '20px',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-purple)', marginBottom: '12px', fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <KeyRound size={13} /> Enter your own prime numbers
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {[
              { label: 'p', value: customP, set: setCustomP, status: pStatus },
              { label: 'q', value: customQ, set: setCustomQ, status: qStatus },
            ].map(({ label, value, set, status }) => {
              const isValid = status === 'valid';
              const isError = status !== 'empty' && status !== 'valid';
              const borderColor = isValid ? 'rgba(0,255,136,0.4)' : isError ? 'rgba(239,68,68,0.4)' : 'var(--border)';
              const statusText = {
                empty: '',
                invalid: 'Not a valid integer',
                'too-small': 'Must be ≥ 2',
                'not-prime': 'Not a prime number',
                valid: 'Prime ✓',
              }[status];
              const statusColor = isValid ? 'var(--accent-green)' : '#ef4444';
              return (
                <div key={label} style={{ flex: '1', minWidth: '160px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                    Prime {label}
                  </div>
                  <input
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={`e.g. ${label === 'p' ? '61' : '53'}`}
                    style={{
                      width: '100%', background: 'var(--bg-elevated)',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '6px', padding: '8px 12px',
                      color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: '14px',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                  />
                  {statusText && (
                    <div style={{ fontSize: '11px', color: statusColor, marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {statusText}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: sameValue || (pStatus !== 'empty' || qStatus !== 'empty') ? '0' : '0' }}>
              <button
                onClick={generateFromCustom}
                disabled={!canApplyCustom}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: canApplyCustom ? 'rgba(168,85,247,0.15)' : 'var(--bg-elevated)',
                  border: `1px solid ${canApplyCustom ? 'rgba(168,85,247,0.4)' : 'var(--border)'}`,
                  color: canApplyCustom ? 'var(--accent-purple)' : 'var(--text-muted)',
                  padding: '8px 16px', borderRadius: '8px',
                  cursor: canApplyCustom ? 'pointer' : 'default', fontSize: '13px', fontWeight: '500',
                  marginTop: '20px',
                }}
              >
                <RefreshCw size={13} /> Generate
              </button>
            </div>
          </div>
          {sameValue && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
              p and q must be different primes
            </div>
          )}
        </div>
      )}

      {/* Step progress bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {STEP_TITLES.map((title, i) => (
          <div key={i} onClick={() => setStep(i)} style={{
            flex: 1, height: '4px', borderRadius: '2px', cursor: 'pointer',
            background: i <= step ? 'var(--accent-green)' : 'var(--bg-elevated)',
            transition: 'background 0.3s',
          }} title={title} />
        ))}
      </div>

      {/* Current step display */}
      {step >= 0 && step < STEP_TITLES.length && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
          borderRadius: '12px', padding: '20px', marginBottom: '20px',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Tag color="green">Step {step + 1}/{STEP_TITLES.length}</Tag>
            <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {STEP_TITLES[step]}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
            {STEP_EXPLAINERS[step]}
          </p>

          {data && (
            <div style={{ display: 'grid', gap: '12px' }}>
              {step === 0 && (
                <>
                  <PrimeCandidates candidates={data.pCandidates} found={data.p} />
                  <BigNum value={String(data.p)} label="p — chosen prime" color="green" animate />
                </>
              )}
              {step === 1 && (
                <>
                  <PrimeCandidates candidates={data.qCandidates} found={data.q} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <BigNum value={String(data.p)} label="p" color="green" />
                    <BigNum value={String(data.q)} label="q — chosen prime" color="blue" animate />
                  </div>
                </>
              )}
              {step === 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                  <BigNum value={String(data.p)} label="p" color="green" />
                  <span style={{ color: 'var(--text-muted)', fontSize: '20px', textAlign: 'center' }}>×</span>
                  <BigNum value={String(data.q)} label="q" color="blue" />
                  <span style={{ color: 'var(--text-muted)', fontSize: '20px', textAlign: 'center' }}>=</span>
                  <BigNum value={String(data.n)} label="n = p × q (modulus)" color="amber" animate />
                </div>
              )}
              {step === 3 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
                      φ(n) = (p−1) × (q−1) = ({String(data.p - 1n)}) × ({String(data.q - 1n)})
                    </div>
                    <BigNum value={String(data.phi)} label="φ(n) — Euler's totient" color="purple" animate />
                  </div>
                  <BigNum value={String(data.n)} label="n (modulus)" color="amber" />
                </div>
              )}
              {step === 4 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <BigNum value={String(data.e)} label="e — public exponent" color="blue" animate />
                  <BigNum value={String(data.phi)} label="φ(n)" color="purple" />
                  <div style={{ gridColumn: '1/-1', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    gcd({String(data.e)}, {String(data.phi)}) = 1  ✓  coprime
                  </div>
                </div>
              )}
              {step === 5 && (
                <>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    Finding d such that: e × d ≡ 1 (mod φ(n))
                  </div>
                  <EuclidTable steps={data.euclidSteps} />
                  <BigNum value={String(data.d)} label="d — private exponent" color="purple" animate />
                </>
              )}
              {step === 6 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{
                    background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)',
                    borderRadius: '10px', padding: '16px',
                  }}>
                    <div style={{ color: 'var(--accent-green)', fontWeight: '600', marginBottom: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Unlock size={14} /> Public Key
                    </div>
                    <BigNum value={String(data.e)} label="e (public exponent)" color="green" />
                    <div style={{ marginTop: '8px' }}>
                      <BigNum value={String(data.n)} label="n (modulus)" color="green" />
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: '10px', padding: '16px',
                  }}>
                    <div style={{ color: 'var(--accent-purple)', fontWeight: '600', marginBottom: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={14} /> Private Key
                    </div>
                    <BigNum value={String(data.d)} label="d (private exponent)" color="purple" />
                    <div style={{ marginTop: '8px' }}>
                      <BigNum value={String(data.n)} label="n (modulus)" color="purple" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Encrypt/decrypt demo — shown when keys are revealed */}
      {step >= 6 && data && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '20px',
          animation: 'fadeIn 0.4s ease-out',
        }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', fontFamily: 'JetBrains Mono, monospace' }}>
            Mini Encrypt / Decrypt Demo
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Enter an integer m where 0 ≤ m &lt; {String(data.n)}. Cipher: c = m^e mod n. Recover: m = c^d mod n.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>Message (integer)</div>
              <input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', width: '160px',
                }}
              />
            </div>
            <button onClick={handleEncrypt} style={{
              background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)',
              color: 'var(--accent-green)', padding: '8px 16px', borderRadius: '8px',
              cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Lock size={13} /> Encrypt
            </button>
            {encrypted != null && (
              <button onClick={handleDecrypt} style={{
                background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
                color: 'var(--accent-purple)', padding: '8px 16px', borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <Unlock size={13} /> Decrypt
              </button>
            )}
          </div>

          {encrypted != null && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', animation: 'fadeIn 0.3s ease-out' }}>
              <BigNum value={msgInput} label="Plaintext m" color="blue" />
              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>c = m^e mod n</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-green)', fontSize: '11px' }}>e = {String(data.e)}</div>
              </div>
              <BigNum value={String(encrypted)} label="Ciphertext c" color="amber" animate />
              {decrypted != null && (
                <>
                  <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>m = c^d mod n</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-purple)', fontSize: '11px' }}>d = {String(data.d)}</div>
                  </div>
                  <BigNum value={String(decrypted)} label={`Decrypted ${decrypted === BigInt(msgInput) ? '✓ matches!' : '✗ mismatch'}`} color={decrypted === BigInt(msgInput) ? 'green' : 'red'} animate />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {step < 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--text-muted)', fontSize: '14px',
        }}>
          Press <strong style={{ color: 'var(--accent-blue)' }}>Play</strong> or <strong style={{ color: 'var(--accent-blue)' }}>Next</strong> to begin the walkthrough.
        </div>
      )}
    </div>
  );
}
