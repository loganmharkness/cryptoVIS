import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, RefreshCw, Shuffle } from 'lucide-react';
import { aesEncryptSteps, hexToBytes, stringToBytes, bytesToHex } from '../utils/aes';

const SPEEDS = { slow: 3500, medium: 1800, fast: 700 };

const OP_LABELS = {
  initial: 'Initial State',
  addRoundKey: 'AddRoundKey',
  subBytes: 'SubBytes',
  shiftRows: 'ShiftRows',
  mixColumns: 'MixColumns',
};

const OP_COLORS = {
  initial: '#8892a4',
  addRoundKey: '#0ea5e9',
  subBytes: '#f59e0b',
  shiftRows: '#a855f7',
  mixColumns: '#00ff88',
};

const OP_EXPLAINERS = {
  initial: 'The plaintext bytes are arranged into a 4×4 state matrix (column-major order). Each cell shows one byte in hex.',
  addRoundKey: 'Each byte of the state is XORed with the corresponding byte of the round key. This mixes in the key material.',
  subBytes: 'Each byte is replaced by its substitute in the AES S-box — a fixed 16×16 lookup table. This provides non-linearity (confusion).',
  shiftRows: 'Row 0 stays. Row 1 shifts left by 1. Row 2 by 2. Row 3 by 3. This provides diffusion across columns.',
  mixColumns: 'Each column is treated as a polynomial over GF(2⁸) and multiplied by a fixed matrix. Spreads bits across the column.',
};

function HexCell({ value, prevValue, op, row, col, animKey }) {
  const changed = prevValue !== undefined && value !== prevValue;
  const baseColor = OP_COLORS[op] || '#8892a4';

  const getBg = () => {
    if (!changed) return 'var(--bg-elevated)';
    if (op === 'subBytes') return 'rgba(245,158,11,0.25)';
    if (op === 'addRoundKey') return 'rgba(14,165,233,0.25)';
    if (op === 'shiftRows') return 'rgba(168,85,247,0.20)';
    if (op === 'mixColumns') return 'rgba(0,255,136,0.20)';
    return 'rgba(255,255,255,0.1)';
  };

  const getAnim = () => {
    if (!changed) return undefined;
    if (op === 'subBytes') return 'cell-flip 0.45s ease-in-out';
    if (op === 'addRoundKey') return 'xor-flash 0.5s ease-out';
    if (op === 'shiftRows') return 'shift-row 0.5s ease-in-out';
    if (op === 'mixColumns') return 'xor-flash 0.55s ease-out';
    return undefined;
  };

  return (
    <div
      key={animKey}
      style={{
        width: '52px', height: '52px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px',
        background: getBg(),
        border: `1px solid ${changed ? baseColor + '55' : 'var(--border)'}`,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '13px',
        color: changed ? baseColor : 'var(--text-primary)',
        animation: getAnim(),
        transition: 'background 0.3s, color 0.3s, border-color 0.3s',
        userSelect: 'none',
      }}
    >
      {value.toString(16).padStart(2, '0')}
    </div>
  );
}

function StateGrid({ state, prevState, op, stepKey }) {
  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 52px)',
        gridTemplateRows: 'repeat(4, 52px)',
        gap: '4px',
      }}>
        {state.map((row, r) =>
          row.map((byte, c) => (
            <HexCell
              key={`${r}-${c}`}
              animKey={`${stepKey}-${r}-${c}`}
              value={byte}
              prevValue={prevState?.[r]?.[c]}
              op={op}
              row={r}
              col={c}
            />
          ))
        )}
      </div>
      {/* Row labels */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        {[0,1,2,3].map(c => (
          <div key={c} style={{ width: '52px', textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            col {c}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundKeyDisplay({ roundKey }) {
  if (!roundKey) return null;
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>Round Key (XOR mask)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 52px)', gap: '4px' }}>
        {Array.from({length:4}, (_,r) =>
          Array.from({length:4}, (_,c) => roundKey[c*4+r]).map((b, c) => (
            <div key={`rk-${r}-${c}`} style={{
              width: '52px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '4px',
              background: 'rgba(14,165,233,0.1)',
              border: '1px solid rgba(14,165,233,0.2)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              color: 'var(--accent-blue)',
            }}>{b.toString(16).padStart(2,'0')}</div>
          ))
        )}
      </div>
    </div>
  );
}

function RoundTimeline({ steps, currentIdx }) {
  // Group steps into rounds for the progress display
  const rounds = [];
  let cur = { round: 0, ops: [] };
  let roundNum = 0;
  for (const s of steps) {
    if (s.op === 'initial') { cur.ops.push(s.op); continue; }
    if (s.op === 'addRoundKey') {
      if (cur.ops.length > 0 && cur.ops[cur.ops.length-1] === 'addRoundKey') {
        rounds.push(cur);
        roundNum++;
        cur = { round: roundNum, ops: ['addRoundKey'] };
      } else {
        cur.ops.push('addRoundKey');
      }
    } else {
      cur.ops.push(s.op);
    }
  }
  rounds.push(cur);

  // Map step index to round
  let stepCounter = 0;
  const stepRound = [];
  for (const r of rounds) {
    for (const op of r.ops) { stepRound.push(r.round); stepCounter++; }
  }

  const activeRound = stepRound[currentIdx] ?? 0;

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
      {rounds.map((r, i) => (
        <div key={i} style={{
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          background: i === activeRound ? 'rgba(0,255,136,0.15)' : 'var(--bg-elevated)',
          color: i === activeRound ? 'var(--accent-green)' : 'var(--text-muted)',
          border: `1px solid ${i === activeRound ? 'rgba(0,255,136,0.3)' : 'transparent'}`,
          transition: 'all 0.2s',
        }}>
          {i === 0 ? 'Init' : `R${i}`}
        </div>
      ))}
    </div>
  );
}

export default function AESVisualizer() {
  const [plaintextMode, setPlaintextMode] = useState('text'); // 'text' | 'hex'
  const [plainInput, setPlainInput] = useState('Hello, CryptoVis');
  const [keyInput, setKeyInput] = useState('2b7e151628aed2a6abf7158809cf4f3c');
  const [steps, setSteps] = useState(null);
  const [ciphertext, setCiphertext] = useState(null);
  const [stepIdx, setStepIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('medium');
  const timerRef = useRef(null);

  const maxIdx = steps ? steps.length - 1 : 0;

  const runAES = useCallback(() => {
    try {
      const plainBytes = plaintextMode === 'hex' ? hexToBytes(plainInput) : stringToBytes(plainInput);
      const keyBytes = hexToBytes(keyInput);
      const result = aesEncryptSteps(plainBytes, keyBytes);
      setSteps(result.steps);
      setCiphertext(result.ciphertext);
      setStepIdx(-1);
      setPlaying(false);
    } catch (e) {
      console.error(e);
    }
  }, [plainInput, keyInput, plaintextMode]);

  useEffect(() => { runAES(); }, []);

  useEffect(() => {
    if (playing && steps) {
      timerRef.current = setTimeout(() => {
        setStepIdx(i => {
          if (i >= maxIdx) { setPlaying(false); return i; }
          return i + 1;
        });
      }, SPEEDS[speed]);
    }
    return () => clearTimeout(timerRef.current);
  }, [playing, stepIdx, speed, maxIdx, steps]);

  const randomize = () => {
    const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2,'0')).join('');
    setPlainInput(randHex(8));
    setKeyInput(randHex(16));
    setPlaintextMode('hex');
  };

  const currentStep = steps && stepIdx >= 0 ? steps[stepIdx] : null;
  const prevStep = steps && stepIdx > 0 ? steps[stepIdx - 1] : null;
  const opColor = currentStep ? OP_COLORS[currentStep.op] : 'var(--text-muted)';

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
          AES-128 Block Cipher
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '14px' }}>
          Visualize all 10 rounds of AES-128 encryption. Each operation on the 4×4 state matrix is animated step by step.
        </p>
      </div>

      {/* Input panel */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Plaintext</span>
              {['text','hex'].map(m => (
                <button key={m} onClick={() => setPlaintextMode(m)} style={{
                  padding: '2px 7px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                  background: plaintextMode === m ? 'rgba(0,255,136,0.1)' : 'transparent',
                  border: `1px solid ${plaintextMode === m ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
                  color: plaintextMode === m ? 'var(--accent-green)' : 'var(--text-muted)',
                }}>{m}</button>
              ))}
            </div>
            <input
              value={plainInput}
              onChange={e => setPlainInput(e.target.value)}
              placeholder={plaintextMode === 'hex' ? '32 hex chars (16 bytes)' : 'up to 16 chars'}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
              }}
            />
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>128-bit Key (hex)</div>
            <input
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="32 hex chars"
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
              }}
            />
          </div>
          <button onClick={randomize} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '8px 14px', borderRadius: '8px',
            cursor: 'pointer', fontSize: '13px',
          }}>
            <Shuffle size={13} /> Random
          </button>
          <button onClick={runAES} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)',
            color: 'var(--accent-green)', padding: '8px 16px', borderRadius: '8px',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500',
          }}>
            <RefreshCw size={13} /> Run AES
          </button>
        </div>
      </div>

      {/* Playback controls */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
        display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
      }}>
        <button onClick={() => setStepIdx(i => Math.max(-1, i - 1))} disabled={stepIdx <= -1} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          color: stepIdx <= -1 ? 'var(--text-muted)' : 'var(--text-primary)',
          padding: '7px 12px', borderRadius: '7px', cursor: stepIdx <= -1 ? 'default' : 'pointer', fontSize: '13px',
        }}>
          <SkipBack size={13} /> Back
        </button>

        <button onClick={() => setStepIdx(i => Math.min(maxIdx, i + 1))} disabled={!steps || stepIdx >= maxIdx} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          color: !steps || stepIdx >= maxIdx ? 'var(--text-muted)' : 'var(--text-primary)',
          padding: '7px 12px', borderRadius: '7px', cursor: !steps || stepIdx >= maxIdx ? 'default' : 'pointer', fontSize: '13px',
        }}>
          Next <SkipForward size={13} />
        </button>

        {steps && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {stepIdx >= 0 ? `${stepIdx + 1} / ${steps.length}` : `— / ${steps.length}`} steps
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Speed:</span>
          {['slow','medium','fast'].map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{
              padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer',
              background: speed === s ? 'rgba(168,85,247,0.15)' : 'transparent',
              border: `1px solid ${speed === s ? 'rgba(168,85,247,0.4)' : 'var(--border)'}`,
              color: speed === s ? 'var(--accent-purple)' : 'var(--text-muted)',
            }}>{s}</button>
          ))}
          <button onClick={() => setPlaying(p => !p)} disabled={!steps || stepIdx >= maxIdx} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: playing ? 'rgba(239,68,68,0.1)' : 'rgba(14,165,233,0.1)',
            border: `1px solid ${playing ? 'rgba(239,68,68,0.3)' : 'rgba(14,165,233,0.3)'}`,
            color: playing ? '#ef4444' : 'var(--accent-blue)',
            padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
          }}>
            {playing ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Play</>}
          </button>
        </div>
      </div>

      {/* Round progress */}
      {steps && stepIdx >= 0 && (
        <RoundTimeline steps={steps} currentIdx={stepIdx} />
      )}

      {/* Step progress bar */}
      {steps && (
        <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
          {steps.map((s, i) => (
            <div
              key={i}
              onClick={() => setStepIdx(i)}
              title={`${OP_LABELS[s.op]}`}
              style={{
                flex: 1, height: '4px', borderRadius: '2px', cursor: 'pointer',
                background: i <= stepIdx ? (OP_COLORS[s.op] || 'var(--accent-green)') : 'var(--bg-elevated)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      )}

      {/* Main visualization */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* State grid */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ marginBottom: '12px' }}>
            {currentStep ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: opColor, boxShadow: `0 0 6px ${opColor}`,
                }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: opColor, fontFamily: 'JetBrains Mono, monospace' }}>
                  {OP_LABELS[currentStep.op]}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                State Matrix (4×4 bytes)
              </span>
            )}
          </div>

          {/* Row labels */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            {[0,1,2,3].map(r => (
              <div key={r} style={{ width: '52px', textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                row {r}
              </div>
            ))}
          </div>

          {currentStep ? (
            <StateGrid
              state={currentStep.state}
              prevState={prevStep?.state}
              op={currentStep.op}
              stepKey={stepIdx}
            />
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 52px)',
              gridTemplateRows: 'repeat(4, 52px)', gap: '4px',
            }}>
              {Array.from({length:16}).map((_,i) => (
                <div key={i} style={{
                  width:'52px', height:'52px', borderRadius:'6px',
                  background:'var(--bg-elevated)', border:'1px solid var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'JetBrains Mono, monospace', fontSize:'13px', color:'var(--text-muted)',
                }}>??</div>
              ))}
            </div>
          )}

          {currentStep?.op === 'addRoundKey' && (
            <RoundKeyDisplay roundKey={currentStep.roundKey} />
          )}
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Operation explainer */}
          <div style={{
            background: 'var(--bg-card)', border: `1px solid ${currentStep ? opColor + '33' : 'var(--border)'}`,
            borderRadius: '12px', padding: '16px',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
              Operation
            </div>
            {currentStep ? (
              <>
                <div style={{ fontSize: '15px', fontWeight: '600', color: opColor, fontFamily: 'JetBrains Mono, monospace', marginBottom: '8px' }}>
                  {OP_LABELS[currentStep.op]}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  {OP_EXPLAINERS[currentStep.op]}
                </p>
              </>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Press Play to begin. AES-128 applies 10 rounds of 4 operations each to the 4×4 state matrix.
              </p>
            )}
          </div>

          {/* Legend */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '14px',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
              Legend
            </div>
            {Object.entries(OP_LABELS).filter(([k]) => k !== 'initial').map(([op, label]) => (
              <div key={op} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: OP_COLORS[op], flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Ciphertext */}
          {ciphertext && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid rgba(0,255,136,0.2)',
              borderRadius: '12px', padding: '14px',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
                Final Ciphertext
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
                color: 'var(--accent-green)', wordBreak: 'break-all', lineHeight: '1.6',
              }}>
                {bytesToHex(ciphertext).match(/.{2}/g).join(' ')}
              </div>
            </div>
          )}

          {/* Hex byte diff count */}
          {currentStep && prevStep && (() => {
            let changed = 0;
            for (let r = 0; r < 4; r++)
              for (let c = 0; c < 4; c++)
                if (currentStep.state[r][c] !== prevStep.state[r][c]) changed++;
            return changed > 0 ? (
              <div style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: opColor, fontFamily: 'JetBrains Mono, monospace' }}>{changed}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  of 16 bytes changed by {OP_LABELS[currentStep.op]}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}
