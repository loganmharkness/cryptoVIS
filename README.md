# CryptoVis

An interactive cryptography playground that animates the math behind RSA, AES, SHA-256, and Diffie-Hellman -- step by step, no black boxes.

---

## Tools

**RSA Key Generation**
Walks through prime selection, modular arithmetic, and key derivation. Supports custom primes or random generation. Animates each step of the Euclidean algorithm and shows public/private key construction.

**AES-128 Block Cipher**
Visualizes all 10 rounds of AES encryption on a 4x4 state matrix. Each operation (SubBytes, ShiftRows, MixColumns, AddRoundKey) is animated individually with per-byte highlighting. Accepts plaintext as text or hex.

**SHA-256 and Avalanche Effect**
Hashes two inputs side by side and highlights every bit that differs between the outputs. Shows how a single character change flips roughly half the output bits. Includes a live single-input hasher.

**Diffie-Hellman Key Exchange**
Simulates the full DH handshake between two parties. Shows public parameters, private secrets, public keys, and how both sides independently arrive at the same shared secret.

---

## How It Works

All cryptographic operations are implemented from scratch in pure JavaScript -- no external crypto libraries. The AES and RSA implementations live in `src/utils/` and are written to be readable alongside the visualizations. SHA-256 uses the Web Crypto API (`crypto.subtle.digest`).

URL state is encoded in the hash so any view is shareable. Tab navigation uses `window.location.hash`; input params use `history.replaceState` to avoid flooding browser history.

---

## Tech Stack

| | |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 + component CSS files |
| Icons | Lucide React |
| Deployment | GitHub Pages via GitHub Actions |

---

## Setup and Run

**Requirements:** Node 20+

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173/cryptoVIS/`.

```bash
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```


---

## Project Structure

```
cryptoVIS/
├── index.html              # Landing page (plain HTML, Tailwind CDN)
├── app.html                # React app entry point
├── landing.css             # Styles for the landing page
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx             # Tab routing, URL hash sync
│   ├── components/
│   │   ├── Layout.jsx      # Sidebar navigation shell
│   │   ├── RSAVisualizer.jsx
│   │   ├── AESVisualizer.jsx
│   │   ├── HashVisualizer.jsx
│   │   └── DHVisualizer.jsx
│   └── utils/
│       ├── rsa.js          # Miller-Rabin primality, BigInt key math
│       ├── aes.js          # Pure JS AES-128 (S-box, key schedule, rounds)
│       ├── hash.js         # SHA-256 helpers, bit diffing
│       ├── dh.js           # Diffie-Hellman parameter generation
│       └── urlState.js     # Hash-based URL state helpers
└── .github/workflows/
    └── deploy.yml          # Build and deploy to GitHub Pages
```

---

## URL State

Each tab encodes its inputs in the URL hash so any configuration is shareable:

| Tab | Example |
|---|---|
| RSA | `#rsa?p=61&q=53` |
| AES | `#aes?plain=Hello&key=2b7e151628aed2a6abf7158809cf4f3c&mode=text` |
| Hash | `#hash?a=Hello!&b=Hello.` |
| DH | `#dh` (randomly generated, no params) |
