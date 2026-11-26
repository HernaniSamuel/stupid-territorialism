import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Generates a single .html (JS and CSS inlined) in dist-single/, to send to someone.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-single' },
});
