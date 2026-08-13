/**
 * Renderer-only Vite config.
 *
 * Runs the ZARA interface in a plain browser without launching Electron.
 * Useful for previewing and for verifying the UI in environments where the
 * Electron binary is unavailable. Desktop-only features correctly report
 * themselves as unavailable in this mode.
 */
import path from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import pkg from './package.json'
import { vadStaticCopyTargets } from './build/vadAssets'

export default defineConfig({
  resolve: {
    alias: {
      'onnxruntime-web/wasm': path.resolve(
        process.cwd(),
        'node_modules/onnxruntime-web/dist/ort.wasm.min.mjs'
      ),
    },
  },
  optimizeDeps: {
    include: ['@ricky0123/vad-web', 'onnxruntime-web/wasm'],
  },
  plugins: [
    vue(),
    tailwindcss(),
    viteStaticCopy({ targets: [...vadStaticCopyTargets] }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3344,
    strictPort: true,
    // Accept the sandboxed preview host.
    allowedHosts: true,
    watch: { ignored: ['**/user-customization/**'] },
  },
  // Tailwind v4 runs through its Vite plugin; disable the legacy postcss
  // pipeline so the root postcss.config.js is not applied twice.
  css: {
    postcss: {
      plugins: [],
    },
  },
  clearScreen: false,
  define: {
    global: {},
    __APP_MODE__: JSON.stringify('web'),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
})
