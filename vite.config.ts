import { defineConfig } from 'vite';
export default defineConfig({
  root: 'frontend/src',
  build: { outDir: '../../artifacts/build/web', emptyOutDir: true },
  publicDir: '../public',
});
