// Builds the single-file game: node build.mjs  →  escape-from-joury.html
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(root, 'escape-from-joury.html');
const read = (p) => readFileSync(join(root, p), 'utf8');
const js = readdirSync(join(root, 'src/js')).filter((f) => f.endsWith('.js')).sort().map((f) => read('src/js/' + f)).join('\n');
const game = "/* Escape from Joury — all game code. Three.js (MIT license, threejs.org) is inlined in the next script tag. */\ndocument.addEventListener('DOMContentLoaded', function () {\n'use strict';\n" + js + '\n});';
const three = read('vendor/three.iife.min.js');
for (const [name, text] of [['three', three], ['game', game]]) if (text.includes('</script')) throw new Error(name + ' contains </script');
const html = read('src/shell.html').replace('/*CSS*/', () => read('src/style.css')).replace('/*GAME*/', () => game)
  .replace('/*THREE*/', () => '/* three.js r170 — MIT License — Copyright © 2010-2024 three.js authors */\n' + three);
writeFileSync(out, html);
console.log('wrote', out, Math.round(html.length / 1024) + ' KB');
