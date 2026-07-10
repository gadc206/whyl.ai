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
WHYL_API_URL=https://whyl-api.onrender.com/api \
WHYL_DASHBOARD_URL=https://whyl-api-dashboard.onrender.com \
npm run build:extension
```

This writes a production build to `packages/extension/dist`. Then package the investor zip locally (not committed — GitHub 100MB limit):

```bash
rm -rf /tmp/whyl-extension && mkdir -p /tmp/whyl-extension
cp -R packages/extension/dist/* /tmp/whyl-extension/
(cd /tmp && zip -r whyl-extension-beta.zip whyl-extension)
cp /tmp/whyl-extension-beta.zip packages/extension/
cp /tmp/whyl-extension-beta.zip website/
```

## Investor install (Load unpacked)

1. Download `whyl-extension-beta.zip`
2. Unzip it — you should get a folder named `whyl-extension` that contains `manifest.json`
3. Open Chrome → `chrome://extensions`
4. Turn on **Developer mode**
5. Click **Load unpacked** → select the unzipped `whyl-extension` folder
6. Open [chatgpt.com](https://chatgpt.com), send a prompt, and watch for the ad during the wait

Do **not** point Load unpacked at `Projects/whyl.ai/packages/extension/dist` on your machine — use the unzipped folder from the zip.

Optional: open `website/setup.html` in a browser (or host the `website/` folder) and send that link — it walks through the same four steps with a download button for the zip.

## Notes

- Free Render services sleep after idle; first request can take ~30–60s. Hit `/api/health` once before the investor tries login.
- Without a paid disk, SQLite resets when the API redeploys. Fine for a private beta tryout; not for production money.
