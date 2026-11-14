// Builds the single-file game: node build.mjs  →  escape-from-joury.html
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(root, 'escape-from-joury.html');
const read = (p) => readFileSync(join(root, p), 'utf8');
const js = readdirSync(join(root, 'src/js')).filter((f) => f.endsWith('.js')).sort().map((f) => read('src/js/' + f)).join('\n');
const game = "/* Escape from Joury — all game code. Three.js (threejs.org) and PeerJS (peerjs.com), both MIT licensed, are inlined in the next script tags. */\ndocument.addEventListener('DOMContentLoaded', function () {\n'use strict';\n" + js + '\n});';
const three = read('vendor/three.iife.min.js');
const peer = read('vendor/peerjs.min.js');
const font = (family, file, weight) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${readFileSync(join(root, 'vendor/fonts', file)).toString('base64')}) format('woff2')}`;
const fonts = [font('Inter', 'inter-latin-400-normal.woff2', 400), font('Inter', 'inter-latin-600-normal.woff2', 600), font('IM Fell English SC', 'im-fell-english-sc-latin-400-normal.woff2', 400), font('Special Elite', 'special-elite-latin-400-normal.woff2', 400)].join('\n');
for (const [name, text] of [['three', three], ['peer', peer], ['game', game]]) if (text.includes('</script')) throw new Error(name + ' contains </script');
const html = read('src/shell.html').replace('/*CSS*/', () => fonts + '\n' + read('src/style.css')).replace('/*GAME*/', () => game)
  .replace('/*THREE*/', () => '/* three.js r170 — MIT License — Copyright © 2010-2024 three.js authors */\n' + three)
  .replace('/*PEER*/', () => '/* PeerJS 1.5.4 — MIT License — Copyright (c) 2015 Michelle Bu and Eric Zhang, peerjs.com */\n' + peer);
writeFileSync(out, html);
console.log('wrote', out, Math.round(html.length / 1024) + ' KB');
