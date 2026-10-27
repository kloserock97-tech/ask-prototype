import { defineConfig } from 'vite'

// relative base so the build works on GitHub Pages under /<repo>/
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0 },
})
