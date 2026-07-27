// Optional alternative to `vite build`. Vite (via package.json) is the
// primary, documented way to develop and build this project - this script
// exists for anyone who wants a from-scratch static build without pulling
// in the full Vite toolchain. It does the same job (bundle src/main.jsx +
// its CSS import, copy public/ assets) using esbuild directly.
//
// Usage: node build.mjs

import { build } from 'esbuild';
import { mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const outDir = 'dist';

async function main() {
  if (existsSync(outDir)) await rm(outDir, { recursive: true });
  await mkdir(`${outDir}/assets`, { recursive: true });

  await build({
    entryPoints: ['src/main.jsx'],
    bundle: true,
    format: 'esm',
    jsx: 'automatic',
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    outfile: `${outDir}/assets/main.js`,
    loader: { '.css': 'css' },
    logLevel: 'info',
  });

  await cp('public', outDir, { recursive: true });

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Scrabble</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Karla:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./assets/main.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/main.js"></script>
  </body>
</html>
`;
  await import('node:fs/promises').then((fs) => fs.writeFile(`${outDir}/index.html`, html));

  console.log(`\nBuilt ${outDir}/ - serve it with any static file server, e.g.:\n  npx serve ${outDir}\n  python3 -m http.server -d ${outDir}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
