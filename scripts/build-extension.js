import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const extensionDir = path.join(root, 'packages', 'extension');
const distDir = path.join(extensionDir, 'dist');

const files = [
  'manifest.json',
  'background.js',
  'net-probe.js',
  'content.js',
  'dashboard-sync.js',
  'panel.css',
  'popup.html',
  'popup.js',
  'ad-player.html',
];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, 'icons'), { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(extensionDir, file), path.join(distDir, file));
}

const manifestPath = path.join(distDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.content_scripts.push({
  matches: ['http://localhost:5173/*'],
  js: ['dashboard-sync.js'],
  run_at: 'document_idle',
});
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

for (const size of [16, 48, 128]) {
  const iconPath = path.join(extensionDir, 'icons', `icon${size}.png`);
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Missing icon${size}.png. Run npm run generate-icons first.`);
  }
  fs.copyFileSync(iconPath, path.join(distDir, 'icons', `icon${size}.png`));
}

console.log('Extension built to packages/extension/dist');
