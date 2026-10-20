import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { buildResources } from './scripts/build-resources.js';
import { authenticate, printReport } from './scripts/authenticate/index.js';
import { writeBuildFiles } from './scripts/release/build-info.js';

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
        // Every text on the site must be its source's, verbatim: stop the build if not.
        console.log('\nAuthenticating content against sources/...');
        const result = authenticate({ site: path.resolve(__dirname, 'docs/resources') });
        printReport(result);
        if (!result.ok) throw new Error('Authentication failed; see above.');
        const info = writeBuildFiles(path.resolve(__dirname, 'docs'));
        console.log(`Build info: ${info.channel}, ${info.app.describe ?? info.app.version}, content ${info.content.fingerprint}${info.live ? `, changes since ${info.live.ref}` : ''}`);
      }
    }
  ],
  // "/" for the live site; the preview is built with BASE_PATH=/preview/.
  base: process.env.BASE_PATH ?? '/',
  build: {
    outDir: 'docs'
  }
});
