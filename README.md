# Tristano

Learn jazz solos by ear: loop one phrase at a time, sing it back in a timed gap, slow it down without changing pitch.

Single static page (`index.html`), no build step, no backend. Audio files stay on the device.

- Run locally: `npm run serve`, then open http://localhost:8080 (or just open `index.html`).
- Test: `npm install && npx playwright install chromium && npm test`
- Live: https://dabd.github.io/tristano/ (GitHub Pages from `main` root).

See `HANDOFF.md` for the full design history and backlog, `CLAUDE.md` for working conventions.

Named after Lennie Tristano, who had students sing classic solos note for note before playing them.
