// Fügt CSS und JS des Vorschau-Builds in eine einzige HTML-Datei ein (für das claude.ai-Artefakt).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../../dist-preview/', import.meta.url).pathname;
const build = join(dir, 'build');
const assets = join(build, 'assets');
let html = readFileSync(join(build, 'index.html'), 'utf8');
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith('.css'));
const js = files.filter((f) => f.endsWith('.js'));
if (js.length !== 1) throw new Error(`Erwartet genau eine JS-Datei, gefunden: ${js.join(', ')}`);
html = html.replace(/<link rel="stylesheet"[^>]*>/g, '').replace(/<script type="module"[^>]*><\/script>/g, '');
const style = css.map((f) => `<style>${readFileSync(join(assets, f), 'utf8')}</style>`).join('');
const script = `<script type="module">${readFileSync(join(assets, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`;
// Funktion als Ersatz: $-Muster im minifizierten Code dürfen nicht als Ersetzungsmuster gelten
html = html.replace('</head>', () => `${style}</head>`).replace('</body>', () => `${script}</body>`);
const out = join(dir, 'ironman-planner-vorschau.html');
writeFileSync(out, html);
console.log(`${out} (${Math.round(html.length / 1024)} KB)`);
