import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Gera um único .html (JS e CSS embutidos) em dist-single/, pra mandar pra alguém.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-single' },
});
