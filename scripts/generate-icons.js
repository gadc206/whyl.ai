import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'packages', 'extension', 'icons');

fs.mkdirSync(iconsDir, { recursive: true });

// Valid minimal PNG. Chrome accepts it for local development; replace with branded assets before store submission.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR42mP8z8Dwn4ECwESJ5lEDRgYAgqgCHdvWoxwAAAAASUVORK5CYII=',
  'base64',
);

for (const size of [16, 48, 128]) {
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png`);
}
