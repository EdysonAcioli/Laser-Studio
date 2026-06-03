import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: '.',
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@laser/shared-ui': path.resolve(__dirname, '../../packages/shared-ui/src'),
      '@laser/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@laser/plugin-sdk': path.resolve(__dirname, '../../packages/plugin-sdk/src'),
      '@laser/gcode-engine': path.resolve(__dirname, '../../packages/gcode-engine/src'),
      '@laser/canvas-engine': path.resolve(__dirname, '../../packages/canvas-engine/src'),
      '@laser/machine-driver': path.resolve(__dirname, '../../packages/machine-driver/src')
    }
  },
  server: {
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
