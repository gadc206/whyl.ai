# While Claude Thinks

A clickable landing page / demo for "While Claude Thinks" — earn AI tokens watching startup ads and stay productive during AI coding agent wait times.

## The concept

While Claude (or Cursor, Copilot, ChatGPT) runs, developers face unpredictable waits — 30 seconds or 10 minutes. Most doomscroll Slack or context-switch into something else.

**While Claude Thinks** solves this two ways:

1. **Earn AI tokens** — Opt in to watch short startup ads during wait times. Each ad = compute tokens you redeem for more AI prompts and fewer rate limits. Startups pay to reach developers who are guaranteed to be staring at a screen.

2. **Stay productive** — Research-backed micro-tasks matched to wait uncertainty: physical resets, context-preserving mental tasks, diffuse thinking, and task hygiene. No attention residue.

## Run locally

This is a static site (HTML/CSS/JS), no build step needed.

Option 1 — just open it:

```
open index.html
```

Option 2 — run a local server (recommended, avoids any browser file:// quirks):

```
npx serve .
```

or

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy

### Vercel

```
npx vercel
```

Follow the prompts — it's a static project, no config needed beyond the included `vercel.json`.

### Netlify

```
npx netlify deploy
```

Set the publish directory to `.` (the project root).

## Files

- `index.html` — page structure, flywheel explainer, wait-time guide
- `style.css` — neo-brutalist dark styling, animations, responsive layout
- `script.js` — demo logic (timer, startup ads, token counter, productivity tasks, waitlist form)
