import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import obfuscator from 'vite-plugin-bundle-obfuscator'
import { SECURITY_HEADERS } from './security-headers.js'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Production builds only: scramble the app's own code. Libraries (React,
    // Supabase) are split out and left alone so the site stays fast.
    obfuscator({
      apply: 'build',
      enable: true,
      log: false,
      autoExcludeNodeModules: {
        enable: true,
        manualChunks: ['react-router', 'react-dom', 'react', '@supabase', 'scheduler'],
      },
      threadPool: true,
      options: {
        compact: true,
        identifierNamesGenerator: 'hexadecimal', // names become _0x4a2b…
        renameGlobals: false,
        stringArray: true, // every string (table names, RPC names, routes) moved into an encoded array
        stringArrayThreshold: 1,
        stringArrayEncoding: ['base64'],
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayIndexShift: true,
        stringArrayWrappersCount: 2,
        stringArrayWrappersType: 'function',
        splitStrings: true,
        splitStringsChunkLength: 6,
        transformObjectKeys: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.4,
        numbersToExpressions: true,
        simplify: true,
        selfDefending: true, // breaks if the code is re-formatted to be read
        debugProtection: true, // the debugger loop trap: freezes DevTools once opened
        debugProtectionInterval: 2000,
        disableConsoleOutput: true,
        unicodeEscapeSequence: false,
      },
    }),
  ],
  // Same headers as production, so `vite preview` behaves like the live site.
  preview: { headers: SECURITY_HEADERS },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // No readable file names like "Admin-xxxx.js". Library chunks keep their
        // "vendor-…" name: the obfuscator uses it to leave them untouched.
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: (chunk) => (chunk.name.startsWith('vendor-') ? 'assets/[name]-[hash].js' : 'assets/[hash].js'),
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },
})
