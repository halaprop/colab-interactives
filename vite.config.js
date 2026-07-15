import { defineConfig } from 'vite';

// Root stays the repo root (not harness/) so lib/ and apps/ are servable
// at their real paths, matching how the Colab shim references them.
export default defineConfig({
  root: '.',
  server: {
    open: '/harness/index.html',
  },
});
