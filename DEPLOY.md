# Deploy WHYL for investor access (Render)

Goal: public API + dashboard so the Chrome extension works on someone else's machine.

## On the Render "Create a new Service" screen

1. Click **Web Services** (not Static Sites) for the API.
2. Connect the GitHub repo `gadc206/whyl.ai`.
3. Configure:

| Field | Value |
| --- | --- |
| Name | `whyl-api` |
| Language | Node |
| Root Directory | `packages/api` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance | Free |

4. Environment variables:

| Key | Value |
| --- | --- |
| `JWT_SECRET` | long random string |
| `DASHBOARD_URL` | your dashboard URL (set after step 2), e.g. `https://whyl-dashboard.onrender.com` |
| `ALLOWED_ORIGINS` | same dashboard origin, e.g. `https://whyl-dashboard.onrender.com` |

5. Deploy. Wait until `https://<api>.onrender.com/api/health` returns `{ "status": "ok" }`.

## Dashboard (second service)

1. New → **Static Sites**
2. Same repo
3. Configure:

| Field | Value |
| --- | --- |
| Name | `whyl-dashboard` |
| Root Directory | `packages/dashboard` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

4. Env var at build time:

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://<api>.onrender.com/api` |

5. Deploy. Open the site and create an account.

## Point the extension at production

```bash
WHYL_API_URL=https://<api>.onrender.com/api \
WHYL_DASHBOARD_URL=https://<dashboard>.onrender.com \
npm run build:extension
```

Zip `packages/extension/dist` and send that folder/zip to the investor with the install steps.

## Notes

- Free Render services sleep after idle; first request can take ~30–60s. Hit `/api/health` once before the investor tries login.
- Without a paid disk, SQLite resets when the API redeploys. Fine for a private beta tryout; not for production money.
