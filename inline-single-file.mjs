import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const html = readFileSync('dist/index.html', 'utf8');
const cssMatch = html.match(/<link rel="stylesheet" href="([^"]+)"\s*>/);
const jsMatch = html.match(/<script type="module" crossorigin src="([^"]+)"\s*><\/script>/);

let finalHtml = html;

if (cssMatch) {
  const cssPath = path.join('dist', cssMatch[1]);
  const css = readFileSync(cssPath, 'utf8');
  finalHtml = finalHtml.replace(cssMatch[0], `<style>${css}</style>`);
}

if (jsMatch) {
  const jsPath = path.join('dist', jsMatch[1]);
  const js = readFileSync(jsPath, 'utf8');
  finalHtml = finalHtml.replace(jsMatch[0], `<script>${js}</script>`);
}

writeFileSync('invoice-generator-single-file.html', finalHtml);
console.log('Wrote invoice-generator-single-file.html');
