// Renders public/icons/app-icon.svg to the PNG icons iPad/Android need. Runs automatically before `npm run build`.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const src = new URL('../public/icons/app-icon.svg', import.meta.url);
const svg = readFileSync(src);
for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), png);
}
console.log('icons written');
