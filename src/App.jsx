import { useState } from 'react';
import Layout from './components/Layout';
import RSAVisualizer from './components/RSAVisualizer';
import AESVisualizer from './components/AESVisualizer';
import HashVisualizer from './components/HashVisualizer';

export default function App() {
  const [activeTab, setActiveTab] = useState('rsa');

  return (
    <Layout active={activeTab} setActive={setActiveTab}>
      {activeTab === 'rsa' && <RSAVisualizer />}
      {activeTab === 'aes' && <AESVisualizer />}
      {activeTab === 'hash' && <HashVisualizer />}
    </Layout>
  );
}
