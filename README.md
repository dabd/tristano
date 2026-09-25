# Phrase Loop (working name)

Learn jazz solos by ear: loop one phrase at a time, sing it back in a timed gap, slow it down without changing pitch.

Single static page (`index.html`), no build step, no backend. Audio files stay on the device.

- Run locally: `npm run serve`, then open http://localhost:8080 (or just open `index.html`).
- Test: `npm install && npx playwright install chromium && npm test`
- Deploy: GitHub Pages from the repo root (Settings → Pages → Deploy from branch → `main` / root).

See `HANDOFF.md` for the full design history and backlog, `CLAUDE.md` for working conventions.
