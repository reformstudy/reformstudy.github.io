import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildResources } from './scripts/build-resources.js';

export default defineConfig({
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
