import { KeyRound, Grid3x3, Hash } from 'lucide-react';

const tabs = [
  { id: 'rsa', label: 'RSA Keys', icon: KeyRound, desc: 'Key generation walkthrough' },
  { id: 'aes', label: 'AES Cipher', icon: Grid3x3, desc: 'Block encryption rounds' },
  { id: 'hash', label: 'Hashing', icon: Hash, desc: 'Avalanche effect' },
];

export default function Layout({ active, setActive, children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        minWidth: '220px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, #00ff88, #0ea5e9)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '700',
              fontFamily: 'JetBrains Mono, monospace',
              color: '#000',
            }}>CV</div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>CryptoVis</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Crypto Playground</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  marginBottom: '2px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(0,255,136,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent-green)' : '2px solid transparent',
                  color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={16} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{tab.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{tab.desc}</div>
                </div>
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            Web Crypto API · Manual math
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {children}
      </main>
    </div>
  );
}
