import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { buildResources } from './scripts/build-resources.js';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  plugins: [
    react(),
    {
      name: 'resource-builder',
      apply: 'build',
      async closeBundle() {
        console.log('\nBuilding resources...');
        buildResources();
      }
    }
  ],
  base: '/',
  build: {
    outDir: 'docs'
  }
});
