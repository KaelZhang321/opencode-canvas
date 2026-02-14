import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:3100',
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react'
          }
          if (id.includes('node_modules/@babel/parser')) {
            return 'babel-parser'
          }
          if (id.includes('node_modules/@babel/generator')) {
            return 'babel-generator'
          }
          if (id.includes('node_modules/@babel/types')) {
            return 'babel-types'
          }
          return undefined
        },
      },
    },
  },
})
