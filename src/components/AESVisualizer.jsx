import './AESVisualizer.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, RefreshCw, Shuffle } from 'lucide-react';
import { aesEncryptSteps, hexToBytes, stringToBytes, bytesToHex } from '../utils/aes';
import { parseHash, setHashParam } from '../utils/urlState';

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

const OP_CELL_CLASS = {
  subBytes: 'aes-hex-cell--sub-bytes',
  addRoundKey: 'aes-hex-cell--add-round-key',
  shiftRows: 'aes-hex-cell--shift-rows',
  mixColumns: 'aes-hex-cell--mix-columns',
  initial: 'aes-hex-cell--initial',
};

const OP_EXPLAINERS = {
  initial: 'The 16-byte plaintext block is loaded into a 4x4 state matrix in column-major order: bytes fill column 0 top-to-bottom, then column 1, and so on. Every AES operation transforms this grid in place. After all 10 rounds the bytes are read back out in the same column-major order to produce the 16-byte ciphertext block.',
  addRoundKey: 'Every byte in the state is XORed (bitwise exclusive-or) with the corresponding byte of the current round key. XOR is its own inverse: (a XOR k) XOR k = a. Round keys are derived from the original 128-bit key via the AES key schedule, which expands one 128-bit key into 11 different 128-bit round keys -- one per round plus the initial one.',
  subBytes: 'Each byte is independently replaced using the AES S-box: a 256-entry lookup table where every input maps to a specific output. The S-box is constructed from modular inversion in GF(2^8) followed by an affine transformation. It has no fixed points (no byte maps to itself) and no opposite fixed points (no byte maps to its bitwise complement).',
  shiftRows: 'The bytes of each row are cyclically shifted left by the row index: row 0 stays put, row 1 shifts left by 1 position, row 2 by 2, row 3 by 3. Bytes that were in the same column are now spread across 4 different columns -- exactly the cross-column mixing that MixColumns needs to operate across the full state.',
  mixColumns: 'Each column of 4 bytes is treated as a degree-3 polynomial over GF(2^8) and multiplied by a fixed polynomial modulo x^4 + 1. The result: each output byte is an XOR-combination of all 4 input bytes with specific multiplication coefficients. Change one input byte and all 4 output bytes change.',
};

const OP_WHY = {
  initial: 'AES always works on fixed 128-bit blocks. For messages longer than 16 bytes, a block cipher mode (CBC, CTR, GCM) chains blocks together and handles padding. The 4x4 matrix layout is not just visual -- ShiftRows and MixColumns are specifically designed around this 2D structure to achieve maximum diffusion across the full state in the minimum number of rounds.',
  addRoundKey: 'Without AddRoundKey, AES would be a public permutation: deterministic, key-independent, and invertible by anyone. This is the only step that introduces secret material into the computation. Everything else (SubBytes, ShiftRows, MixColumns) is public knowledge -- AddRoundKey is what turns a scrambler into a cipher. It is applied at the start, end, and between every round.',
  subBytes: 'SubBytes provides non-linearity, the cryptographic property called "confusion". Without it, AES would be entirely linear and vulnerable to linear cryptanalysis: an attacker could model the cipher as a system of linear equations over GF(2) and solve for the key with far less work than brute force. The S-box was engineered to maximize resistance to both linear and differential cryptanalysis simultaneously.',
  shiftRows: 'Without ShiftRows, each column of the state would be processed independently by MixColumns -- giving 4 separate 32-bit block ciphers each with a 32-bit key subspace. That would be trivially breakable by brute force. ShiftRows forces bytes from different columns to mix, enabling the "wide trail" design strategy where after just 2 rounds every output byte depends on every input byte.',
  mixColumns: 'MixColumns is the primary diffusion engine of AES. Combined with ShiftRows it implements the wide-trail strategy: after 2 complete rounds every output bit depends on every input bit, and after 4 rounds the differential branch number is maximized. This is why 10 rounds provides an enormous security margin -- each additional round makes differential and linear attacks exponentially harder to execute.',
};

function WhyBox({ children }) {
  return (
    <div className="aes-why-box">
      <div className="aes-why-box__title">Why this matters</div>
      <p className="aes-why-box__body">{children}</p>
    </div>
  );
}

function HexCell({ value, prevValue, op, animKey }) {
  const changed = prevValue !== undefined && value !== prevValue;
  const cellClass = changed ? (OP_CELL_CLASS[op] || 'aes-hex-cell--initial') : '';
  return (
    <div key={animKey} className={`aes-hex-cell${cellClass ? ' ' + cellClass : ''}`}>
      {value.toString(16).padStart(2, '0')}
    </div>
  );
}

function StateGrid({ state, prevState, op, stepKey }) {
  return (
    <div>
      <div className="aes-state-grid">
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
      <div className="aes-col-labels">
        {[0,1,2,3].map(c => (
          <div key={c} className="aes-col-label">col {c}</div>
        ))}
      </div>
    </div>
  );
}

function RoundKeyDisplay({ roundKey }) {
  if (!roundKey) return null;
  return (
    <div className="aes-round-key">
      <div className="aes-round-key__label">Round Key (XOR mask)</div>
      <div className="aes-round-key__grid">
        {Array.from({length:4}, (_,r) =>
          Array.from({length:4}, (_,c) => roundKey[c*4+r]).map((b, c) => (
            <div key={`rk-${r}-${c}`} className="aes-round-key__cell">
              {b.toString(16).padStart(2,'0')}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RoundTimeline({ steps, currentIdx }) {
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

  let stepCounter = 0;
  const stepRound = [];
  for (const r of rounds) {
    for (const op of r.ops) { stepRound.push(r.round); stepCounter++; }
  }

  const activeRound = stepRound[currentIdx] ?? 0;

  return (
    <div className="aes-round-timeline">
      {rounds.map((r, i) => (
        <div key={i} className={`aes-round-pill${i === activeRound ? ' aes-round-pill--active' : ''}`}>
          {i === 0 ? 'Init' : `R${i}`}
        </div>
      ))}
    </div>
  );
}

export default function AESVisualizer() {
  const [plaintextMode, setPlaintextMode] = useState(() => parseHash().params.get('mode') ?? 'text');
  const [plainInput, setPlainInput] = useState(() => parseHash().params.get('plain') ?? 'Hello, CryptoVis');
  const [keyInput, setKeyInput] = useState(() => parseHash().params.get('key') ?? '2b7e151628aed2a6abf7158809cf4f3c');
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

  useEffect(() => { setHashParam('plain', plainInput); }, [plainInput]);
  useEffect(() => { setHashParam('key', keyInput); }, [keyInput]);
  useEffect(() => { setHashParam('mode', plaintextMode); }, [plaintextMode]);

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
      <div className="aes-header">
        <h1 className="aes-title">AES-128 Block Cipher</h1>
        <p className="aes-subtitle">
          Visualize all 10 rounds of AES-128 encryption. Each operation on the 4x4 state matrix is animated step by step.
        </p>
      </div>

      {/* Input panel */}
      <div className="aes-input-panel">
        <div className="aes-input-row">
          <div className="aes-input-field">
            <div className="aes-input-field-header">
              <span className="aes-input-label">Plaintext</span>
              {['text','hex'].map(m => (
                <button
                  key={m}
                  onClick={() => setPlaintextMode(m)}
                  className={`aes-btn-mode${plaintextMode === m ? ' aes-btn-mode--active' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              value={plainInput}
              onChange={e => setPlainInput(e.target.value)}
              placeholder={plaintextMode === 'hex' ? '32 hex chars (16 bytes)' : 'up to 16 chars'}
              className="aes-input"
            />
          </div>
          <div className="aes-input-field">
            <div className="aes-input-label" style={{ marginBottom: '4px' }}>128-bit Key (hex)</div>
            <input
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="32 hex chars"
              className="aes-input"
            />
          </div>
          <button onClick={randomize} className="aes-btn-random">
            <Shuffle size={13} /> Random
          </button>
          <button onClick={runAES} className="aes-btn-run">
            <RefreshCw size={13} /> Run AES
          </button>
        </div>
      </div>

      {/* Playback controls */}
      <div className="aes-controls">
        <button
          onClick={() => setStepIdx(i => Math.max(-1, i - 1))}
          disabled={stepIdx <= -1}
          className="aes-btn-nav"
        >
          <SkipBack size={13} /> Back
        </button>

        <button
          onClick={() => setStepIdx(i => Math.min(maxIdx, i + 1))}
          disabled={!steps || stepIdx >= maxIdx}
          className="aes-btn-nav"
        >
          Next <SkipForward size={13} />
        </button>

        {steps && (
          <div className="aes-step-count">
            {stepIdx >= 0 ? `${stepIdx + 1} / ${steps.length}` : `— / ${steps.length}`} steps
          </div>
        )}

        <div className="aes-controls__right">
          <span className="aes-speed-label">Speed:</span>
          {['slow','medium','fast'].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`aes-btn-speed${speed === s ? ' aes-btn-speed--active' : ''}`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setPlaying(p => !p)}
            disabled={!steps || stepIdx >= maxIdx}
            className={`aes-btn-play${playing ? ' aes-btn-play--playing' : ''}`}
          >
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
        <div className="aes-step-bar">
          {steps.map((s, i) => (
            <div
              key={i}
              onClick={() => setStepIdx(i)}
              title={`${OP_LABELS[s.op]}`}
              className="aes-step-bar__seg"
              style={{ background: i <= stepIdx ? (OP_COLORS[s.op] || 'var(--accent-green)') : 'var(--bg-elevated)' }}
            />
          ))}
        </div>
      )}

      {/* Main visualization */}
      <div className="aes-viz-grid">
        {/* State grid */}
        <div className="aes-state-card">
          <div className="aes-state-card__header">
            {currentStep ? (
              <div className="aes-state-card__header-row">
                <div
                  className="aes-op-dot"
                  style={{ background: opColor, boxShadow: `0 0 6px ${opColor}` }}
                />
                <span className="aes-op-label" style={{ color: opColor }}>
                  {OP_LABELS[currentStep.op]}
                </span>
              </div>
            ) : (
              <span className="aes-state-card__placeholder">State Matrix (4x4 bytes)</span>
            )}
          </div>

          <div className="aes-row-labels">
            {[0,1,2,3].map(r => (
              <div key={r} className="aes-row-label">row {r}</div>
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
            <div className="aes-placeholder-grid">
              {Array.from({length:16}).map((_,i) => (
                <div key={i} className="aes-placeholder-cell">??</div>
              ))}
            </div>
          )}

          {currentStep?.op === 'addRoundKey' && (
            <RoundKeyDisplay roundKey={currentStep.roundKey} />
          )}
        </div>

        {/* Info panel */}
        <div className="aes-info-col">
          {/* Operation explainer */}
          <div
            className="aes-op-info"
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${currentStep ? opColor + '33' : 'var(--border)'}`,
            }}
          >
            <div className="aes-op-info-label">Operation</div>
            {currentStep ? (
              <>
                <div className="aes-op-info__name" style={{ color: opColor }}>
                  {OP_LABELS[currentStep.op]}
                </div>
                <p className="aes-op-info__explainer">
                  {OP_EXPLAINERS[currentStep.op]}
                </p>
                <WhyBox>{OP_WHY[currentStep.op]}</WhyBox>
              </>
            ) : (
              <p className="aes-op-info__placeholder">
                Press Play to begin. AES-128 applies 10 rounds of 4 operations each to the 4x4 state matrix.
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="aes-legend">
            <div className="aes-legend__title">Legend</div>
            {Object.entries(OP_LABELS).filter(([k]) => k !== 'initial').map(([op, label]) => (
              <div key={op} className="aes-legend__row">
                <div className="aes-legend__dot" style={{ background: OP_COLORS[op] }} />
                <span className="aes-legend__label">{label}</span>
              </div>
            ))}
          </div>

          {/* Ciphertext */}
          {ciphertext && (
            <div className="aes-ciphertext">
              <div className="aes-ciphertext__label">Final Ciphertext</div>
              <div className="aes-ciphertext__value">
                {bytesToHex(ciphertext).match(/.{2}/g).join(' ')}
              </div>
            </div>
          )}

          {/* Byte diff count */}
          {currentStep && prevStep && (() => {
            let changed = 0;
            for (let r = 0; r < 4; r++)
              for (let c = 0; c < 4; c++)
                if (currentStep.state[r][c] !== prevStep.state[r][c]) changed++;
            return changed > 0 ? (
              <div className="aes-byte-diff">
                <div className="aes-byte-diff__count" style={{ color: opColor }}>{changed}</div>
                <div className="aes-byte-diff__label">
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
