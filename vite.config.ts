import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content-Security-Policy for the built renderer. Only remote-free sources are allowed:
// img-src keeps Markdown in a model reply from loading remote images, connect-src keeps the
// page from calling out (all Ollama traffic goes through the main process). It is injected
// at build time only, because the Vite dev server needs an inline preamble and a websocket.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'haverom-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      )
  };
}

// base: './' so the built index.html works when Electron loads it via file://.
export default defineConfig({
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
