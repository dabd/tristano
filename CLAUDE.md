# CLAUDE.md

## What this is
A web app (single `index.html`, vanilla JS, no build) for learning jazz solos by ear on iPhone Safari and Mac Safari. Read `HANDOFF.md` once at the start of a session for context and backlog.

## About the owner
- Dario, senior software engineer (~30 years, distributed systems, Scala). Not an iOS developer yet.
- Terse communication; match it. Honest critique over validation. Review your own claims adversarially and flag what is unverified, especially anything about iOS Safari behaviour.

## Constraints
- Primary target: iOS Safari (also installed via Add to Home Screen). Secondary: Mac Safari. Chromium is only the test runner, so passing tests do not prove iOS works; say so when it matters.
- Keep it one self-contained file unless there is a clear reason to split. No framework, no bundler.
- Playback goes through the `<audio>` element (pitch-preserving `playbackRate`, not muted by the iOS silent switch). Web Audio is used only to decode the waveform. Moving playback to Web Audio is a deliberate, planned change (see backlog), not a casual refactor.
- Audio never leaves the device. Files are cached in IndexedDB; phrases and settings in localStorage (`pl:p:<trackKey>`, `pl:settings`).
- No DRM circumvention and no YouTube/stream ripping features. Local files the user owns, or public-domain sources.
- Hosted on GitHub Pages. No `window.claude.*` code. Phrases sync between devices through a secret GitHub Gist (`syncNow()`, token in localStorage `pl:sync`), and can also move by JSON export (Blob download) and import.
- Sync talks only to `api.github.com` and carries phrases only; audio never syncs.

## Code map (index.html)
- `S` global state; `store` IndexedDB wrapper; `elEngine` (`<audio>`) and `waEngine` (Web Audio fallback) share `time/seek/play/pause/setRate/ended`.
- `S.phrases`: `[{start,end,color,note}]` sorted by start, never overlapping; neighbours may touch. A touching edge pushes its neighbour but never pulls it (`moveEdge`): moved into its own phrase it opens a gap, moved into the neighbour it moves both. Phrase navigation skips the gaps between phrases. `color` is an index into `PAL`. Old v1 split-point markers (`pl:m:<key>`) are converted on first read by `readPhrases()` and kept as a backup.
- `frame()` rAF loop drives loop → sing gap → loop, and all drawing. `setInterval` keeps it alive when hidden.
- `phrasesChanged()` is the single write path for phrases (localStorage, then a debounced gist sync). Use it.
- Sync: one gist file `tristano.json` = `{tracks:{<key>:{name,size,duration,phrases,updatedAt}}}`; per track, the newer `updatedAt` wins. Runs on track load, app start, returning to the app, coming online, and 1.5 s after an edit. `tests/sync.spec.js` fakes the GitHub API.
- `window.__pl` exposes state for tests and the console.

## Workflow
- Run `npm test` after every change; add a test for every new behaviour. Tests use a generated WAV (`tools/make-fixture.mjs`) with tones at 4 s intervals.
- Small commits, one feature each.
- Before claiming iOS behaviour, say "unverified on iOS" or ask Dario to check on the phone.
