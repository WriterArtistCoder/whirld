import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '', // Relative paths
  build: {  // Compile to docs
    outDir: '../docs'
  },
  plugins: [react()],
  server: {
    port: 3000
  }
})
