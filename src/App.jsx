import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import RSAVisualizer from './components/RSAVisualizer';
import AESVisualizer from './components/AESVisualizer';
import HashVisualizer from './components/HashVisualizer';
import DHVisualizer from './components/DHVisualizer';
import { parseHash, setHashTab } from './utils/urlState';

const VALID_TABS = new Set(['rsa', 'aes', 'hash', 'dh']);

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const { tab } = parseHash();
    return VALID_TABS.has(tab) ? tab : 'rsa';
  });

  useEffect(() => {
    const handler = () => {
      const { tab } = parseHash();
      setActiveTab(VALID_TABS.has(tab) ? tab : 'rsa');
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const handleSetActive = (tab) => {
    setHashTab(tab);
    setActiveTab(tab);
  };

  return (
    <Layout active={activeTab} setActive={handleSetActive}>
      {activeTab === 'rsa' && <RSAVisualizer />}
      {activeTab === 'aes' && <AESVisualizer />}
      {activeTab === 'hash' && <HashVisualizer />}
      {activeTab === 'dh' && <DHVisualizer />}
    </Layout>
  );
}
