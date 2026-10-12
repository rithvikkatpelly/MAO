import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Content Security Policy for the built app. `vite preview` sends it; production hosting must
// send the same header (docs/guardrails.md). The dev server does not, because hot reload
// needs inline scripts. Set VITE_API_BASE so connect-src allows your API.
const api = process.env.VITE_API_BASE ?? 'http://localhost:8000'
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${api} https://accounts.google.com/gsi/`,
  'frame-src https://accounts.google.com/gsi/',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: {
    headers: {
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    },
  },
})
