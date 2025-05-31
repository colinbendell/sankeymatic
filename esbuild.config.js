import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

esbuild.build({
  entryPoints: [resolve(__dirname, 'src/index.js')],
  bundle: true,
  outfile: 'build/sankeymatic.js',
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
  },
  external: ['d3'], // D3 will be loaded from CDN
}).catch(() => process.exit(1));
