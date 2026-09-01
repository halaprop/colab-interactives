import { defineConfig } from 'vite';

// Root is the repo root so lib/ and apps/ are servable at their real
// paths, matching how the Colab shim references them.
export default defineConfig({
  root: '.',
});
