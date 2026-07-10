# WHYL

WHYL turns long AI wait time into earning time. This monorepo contains the marketing website, Chrome extension, API, and dashboard.

## Structure

```text
website/              Marketing site + waitlist (deploy to Vercel)
packages/
  extension/          Chrome Extension MV3 source
  api/                Express API with SQLite for local development
  dashboard/          React dashboard for onboarding, earnings, referrals, and advertisers
scripts/              Icon generation and extension build scripts
```

## Quick Start

### Extension + dashboard (local dev)

```bash
npm install
npm run generate-icons
npm run build:extension
npm run dev
```

Load `packages/extension/dist` from `chrome://extensions` using **Load unpacked**.

### Website (local preview)

```bash
npm run dev:website
```

Then open `http://localhost:3000`.

## Local URLs

- API: `http://localhost:3001`
- Dashboard: `http://localhost:5173`
- Website: `http://localhost:3000`

## Deploy

- **Website:** set the Vercel project root directory to `website/`. The waitlist API lives at `website/api/waitlist.js`.
- **Extension:** build with `npm run build:extension` and publish or sideload `packages/extension/dist`.

## Activation Rule

WHYL does not show ads immediately. A send event creates a hidden candidate session. The sponsored panel appears only when:

1. the AI is visibly thinking, and
2. a wait equation says a full ad still fits in the remaining predicted wait.

Ad length is chosen from 8–30s buckets. If the remaining wait is too short, WHYL stays silent (no blip). The panel hides when thinking ends or remaining predicted time can no longer finish the ad.

## Investor deploy

See [DEPLOY.md](./DEPLOY.md) for Render Web Service + Static Site setup, then rebuild the extension with production URLs.
