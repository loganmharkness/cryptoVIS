import './Layout.css';
import { KeyRound, Grid3x3, Hash, Handshake } from 'lucide-react';

const tabs = [
  { id: 'rsa', label: 'RSA Keys', icon: KeyRound, desc: 'Key generation walkthrough' },
  { id: 'aes', label: 'AES Cipher', icon: Grid3x3, desc: 'Block encryption rounds' },
  { id: 'hash', label: 'Hashing', icon: Hash, desc: 'Avalanche effect' },
  { id: 'dh', label: 'Diffie-Hellman', icon: Handshake, desc: 'Key exchange protocol' },
];

export default function Layout({ active, setActive, children }) {
  return (
    <div className="layout">
      <aside className="layout__sidebar">
        <div className="layout__logo-wrap">
          <a href="/" className="layout__logo-link">
            <div className="layout__logo-badge">CV</div>
            <div>
              <div className="layout__logo-name">CryptoVis</div>
              <div className="layout__logo-sub">Crypto Visualisation</div>
            </div>
          </a>
        </div>

        <nav className="layout__nav">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`nav-btn${isActive ? ' nav-btn--active' : ''}`}
              >
                <Icon size={16} />
                <div>
                  <div className="nav-btn__label">{tab.label}</div>
                  <div className="nav-btn__desc">{tab.desc}</div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="layout__footer">
          <div className="layout__footer-text">
            Web Crypto API · Manual math
          </div>
        </div>
      </aside>

      <main className="layout__main">
        {children}
      </main>
    </div>
  );
}
