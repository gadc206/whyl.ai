# While Claude Thinks

A clickable landing page / demo for "While Claude Thinks" — a funny productivity tool concept for developers waiting on AI coding agents.

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

- `index.html` — page structure
- `style.css` — dark mode styling, animations, responsive layout
- `script.js` — interactive demo logic (timer, random tasks, loading messages, waitlist form)
