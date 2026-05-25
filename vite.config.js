import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/cryptoVIS/',
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'app.html'),
    },
  },
})
