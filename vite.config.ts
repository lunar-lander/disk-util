import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  },
  server: {
    port: 5173
  }
})