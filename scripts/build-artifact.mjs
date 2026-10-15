// Packs the Vite build into one self-contained HTML body for hosting as a
// claude.ai artifact (or any static host that wants a single file).
// Usage: npm run build:artifact [-- <output path>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const out = process.argv[2] || join(dist, 'coverage-cube.artifact.html');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const read = (href) => readFileSync(join(dist, href.replace(/^\//, '')), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => read(m[1]));
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => read(m[1]));
if (!js.length) throw new Error('No module script found in dist/index.html — run `npm run build` first.');

// Inline code must not close its own <script>/<style> tag early.
const safe = (code, tag) => code.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

const page = `<title>Coverage Cube</title>
<meta name="theme-color" content="#0b1020">
<style>
${css.map((c) => safe(c, 'style')).join('\n')}
</style>
<div id="root"></div>
<script type="module">
${js.map((c) => safe(c, 'script')).join('\n')}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
