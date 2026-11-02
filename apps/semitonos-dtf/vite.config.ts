import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/herramientas/semitonos-dtf/',
  plugins: [react()],
  build: {
    outDir: '../../dist/herramientas/semitonos-dtf',
    emptyOutDir: false,
  },
})
