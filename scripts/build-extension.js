import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const extensionDir = path.join(root, 'packages', 'extension');
const distDir = path.join(extensionDir, 'dist');

const API_URL = process.env.WHYL_API_URL || 'http://localhost:3001/api';
const DASHBOARD_URL = process.env.WHYL_DASHBOARD_URL || 'http://localhost:5173';

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
fs.mkdirSync(path.join(distDir, 'media'), { recursive: true });

for (const file of files) {
  let contents = fs.readFileSync(path.join(extensionDir, file), 'utf8');
  if (file === 'background.js') {
    contents = contents
      .replaceAll('__WHYL_API_URL__', API_URL)
      .replaceAll('__WHYL_DASHBOARD_URL__', DASHBOARD_URL);
  }
  fs.writeFileSync(path.join(distDir, file), contents);
}

const mediaDir = path.join(extensionDir, 'media');
if (fs.existsSync(mediaDir)) {
  for (const name of fs.readdirSync(mediaDir)) {
    if (!name.endsWith('.mp4')) continue;
    fs.copyFileSync(path.join(mediaDir, name), path.join(distDir, 'media', name));
  }
}

const manifestPath = path.join(distDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const dashboardOrigin = new URL(DASHBOARD_URL).origin;
const apiOrigin = new URL(API_URL).origin;

manifest.host_permissions = [
  ...new Set([
    ...(manifest.host_permissions || []).filter((entry) => !entry.includes('localhost')),
    `${apiOrigin}/*`,
    `${dashboardOrigin}/*`,
  ]),
];

manifest.content_scripts = manifest.content_scripts || [];
manifest.content_scripts.push({
  matches: [`${dashboardOrigin}/*`],
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

console.log(`Extension built to packages/extension/dist`);
console.log(`  API:       ${API_URL}`);
console.log(`  Dashboard: ${DASHBOARD_URL}`);
