import { useState, useEffect, useCallback } from 'react';
import { sha256, bytesToHex, bytesToBits, countDifferentBits } from '../utils/hash';

function BitGrid({ bits, compareBits, label, color }) {
  if (!bits || bits.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
        {label} — bit grid (256 bits)
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(32, 1fr)',
        gap: '2px',
        width: '100%',
      }}>
        {bits.map((bit, i) => {
          const differs = compareBits && compareBits[i] !== bit;
          return (
            <div
              key={i}
              title={`Bit ${i}: ${bit}`}
              style={{
                aspectRatio: '1',
                borderRadius: '2px',
                background: differs
                  ? (bit === 1 ? '#ef444499' : '#ef444433')
                  : bit === 1
                    ? (color === 'green' ? 'rgba(0,255,136,0.7)' : 'rgba(14,165,233,0.7)')
                    : 'var(--bg-elevated)',
                border: `1px solid ${differs ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                transition: 'background 0.15s, border-color 0.15s',
                animation: differs ? 'bit-change 0.3s ease-out' : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function HashDisplay({ hash, compareHash, label, color }) {
  if (!hash) return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px',
      fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-muted)',
    }}>
      {label}: —
    </div>
  );

  const hexStr = bytesToHex(hash);
  const compareHexStr = compareHash ? bytesToHex(compareHash) : null;

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: `1px solid ${color === 'green' ? 'rgba(0,255,136,0.15)' : 'rgba(14,165,233,0.15)'}`,
      borderRadius: '8px', padding: '10px 12px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', letterSpacing: '0.5px', lineHeight: '1.8', wordBreak: 'break-all' }}>
        {hexStr.split('').map((ch, i) => {
          const differs = compareHexStr && compareHexStr[i] !== ch;
          return (
            <span key={i} style={{
              color: differs ? '#ef4444' : (color === 'green' ? 'var(--accent-green)' : 'var(--accent-blue)'),
              fontWeight: differs ? '700' : '400',
              transition: 'color 0.15s',
            }}>{ch}</span>
          );
        })}
      </div>
    </div>
  );
}

function InputBox({ label, value, onChange, color, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${color === 'green' ? 'rgba(0,255,136,0.2)' : 'rgba(14,165,233,0.2)'}`,
          borderRadius: '8px', padding: '10px 12px',
          color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
          resize: 'vertical', outline: 'none', width: '100%',
          lineHeight: '1.5',
        }}
        onFocus={e => { e.target.style.borderColor = color === 'green' ? 'rgba(0,255,136,0.5)' : 'rgba(14,165,233,0.5)'; }}
        onBlur={e => { e.target.style.borderColor = color === 'green' ? 'rgba(0,255,136,0.2)' : 'rgba(14,165,233,0.2)'; }}
      />
    </div>
  );
}

export default function HashVisualizer() {
  const [inputA, setInputA] = useState('Hello, CryptoVis!');
  const [inputB, setInputB] = useState('Hello, CryptoVis.');
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

  useEffect(() => { updateA(inputA); }, [inputA]);
  useEffect(() => { updateB(inputB); }, [inputB]);
  useEffect(() => { updateSingle(singleInput); }, [singleInput]);

  const diffBits = hashA && hashB ? countDifferentBits(bitsA, bitsB) : null;
  const diffBytes = hashA && hashB
    ? hashA.filter((b, i) => b !== hashB[i]).length
    : null;
  const diffPct = diffBits != null ? ((diffBits / 256) * 100).toFixed(1) : null;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
          SHA-256 & Avalanche Effect
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '14px' }}>
          A one-bit change in input should flip ~50% of the output bits. That's the avalanche effect — the foundation of cryptographic hash strength.
        </p>
      </div>

      {/* Live single hash */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
          Live SHA-256
        </div>
        <input
          value={singleInput}
          onChange={e => setSingleInput(e.target.value)}
          placeholder="Type anything — hash updates live…"
          style={{
            width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', marginBottom: '12px',
          }}
        />
        {singleHash ? (
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
              color: 'var(--accent-green)', wordBreak: 'break-all', lineHeight: '1.8',
              letterSpacing: '1px', animation: 'fadeIn 0.1s ease-out',
            }}>
              {bytesToHex(singleHash)}
            </div>
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                BIT PATTERN (256 squares — green = 1, dark = 0)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(32, 1fr)', gap: '2px' }}>
                {bytesToBits(singleHash).map((bit, i) => (
                  <div key={i} style={{
                    aspectRatio: '1', borderRadius: '2px',
                    background: bit === 1 ? 'rgba(0,255,136,0.7)' : 'var(--bg-elevated)',
                    transition: 'background 0.1s',
                  }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            SHA-256("") = e3b0c44298fc1c149afb...
          </div>
        )}
      </div>

      {/* Avalanche section */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
          Avalanche Effect — Side-by-Side Comparison
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Start with identical text in both boxes. Change one character in one box and watch how many hash bits flip.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <InputBox
            label="Input A"
            value={inputA}
            onChange={setInputA}
            color="green"
            placeholder="Type text A…"
          />
          <InputBox
            label="Input B"
            value={inputB}
            onChange={setInputB}
            color="blue"
            placeholder="Type text B…"
          />
        </div>

        {/* Diff stats */}
        {diffBits != null && (
          <div style={{
            display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace', color: diffBits > 100 ? '#ef4444' : diffBits > 50 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                {diffBits}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>bits differ (of 256)</div>
            </div>
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-amber)' }}>
                {diffPct}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>of output bits flipped</div>
            </div>
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-blue)' }}>
                {diffBytes}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>bytes differ (of 32)</div>
            </div>
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 16px', flex: 1,
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                flex: 1, height: '8px', borderRadius: '4px', background: 'var(--bg-card)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${diffPct}%`,
                  borderRadius: '4px',
                  background: diffBits > 100 ? '#ef4444' : diffBits > 50 ? 'var(--accent-amber)' : 'var(--accent-green)',
                  transition: 'width 0.2s ease-out, background 0.2s',
                }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {parseFloat(diffPct) < 30 ? 'Low avalanche' : parseFloat(diffPct) < 45 ? 'Good avalanche' : 'Excellent avalanche'}
              </div>
            </div>
          </div>
        )}

        {/* Hash displays */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <HashDisplay hash={hashA} compareHash={hashB} label="SHA-256(A)" color="green" />
          <HashDisplay hash={hashB} compareHash={hashA} label="SHA-256(B)" color="blue" />
        </div>

        {/* Bit grids */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <BitGrid bits={bitsA} compareBits={bitsB} label="Hash A" color="green" />
          <BitGrid bits={bitsB} compareBits={bitsA} label="Hash B" color="blue" />
        </div>

        {diffBits != null && (
          <div style={{
            marginTop: '12px', padding: '10px 14px',
            background: 'var(--bg-elevated)', borderRadius: '8px',
            fontSize: '12px', color: 'var(--text-secondary)',
          }}>
            <span style={{ color: '#ef4444', fontWeight: '600' }}>Red bits</span> differ between the two hashes.{' '}
            <span style={{ color: 'var(--accent-green)' }}>Green bits</span> are 1 and same.{' '}
            <span style={{ color: 'var(--text-muted)' }}>Dark bits</span> are 0 and same.
          </div>
        )}
      </div>

      {/* How SHA-256 works explainer */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '20px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
          How SHA-256 Works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { title: 'Pre-processing', body: 'Message is padded to a multiple of 512 bits. A "1" bit, zeros, then the original length are appended.' },
            { title: '64 Rounds', body: 'Each 512-bit chunk goes through 64 rounds of mixing using bitwise operations (AND, XOR, rotate, add) and round constants.' },
            { title: 'Compression', body: 'Eight 32-bit working variables (a–h) are updated each round. Result is mixed into the hash state.' },
            { title: 'Output', body: 'Final 256-bit hash = concatenation of 8 state words. Any change in input cascades through all 64 rounds — the avalanche effect.' },
          ].map(({ title, body }) => (
            <div key={title} style={{
              background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 14px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', marginBottom: '6px' }}>{title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{body}</div>
            </div>
          ))}
        </div>
        
      </div>
    </div>
  );
}
