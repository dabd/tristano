# Handoff: jazz solo ear-learning app

## Bootstrap (for Claude Code: do this first, end to end)
You were pointed at this file with `phrase-loop-repo.zip` next to it. Set the project up without Dario doing any manual git or file work. Ask him only where a step truly needs him (marked **ASK**).

1. **ASK** once, up front: the app name (candidates are in "Name" below; default `phrase-loop`), and whether the GitHub repo may be public. Free GitHub Pages needs a public repo; private needs a paid plan.
2. Find `phrase-loop-repo.zip` in the same folder as this file (search ~/Downloads if not). Unzip it into `~/code/<name>/`. Refuse to overwrite an existing non-empty folder; ask instead.
3. `git init -b main`, then commit everything as "Initial import from Claude.ai prototype".
4. `npm install && npx playwright install chromium && npm test`. All 4 tests must pass before going on. If they fail, stop and report.
5. GitHub CLI: if `gh` is missing, install it (`brew install gh`). If `gh auth status` fails, **ASK** Dario to run `gh auth login` in a terminal (it's interactive), then continue.
6. `gh repo create <name> --public --source . --push` (or `--private` per step 1).
7. Enable Pages from `main` root: `gh api -X POST repos/{owner}/<name>/pages -f 'source[branch]=main' -f 'source[path]=/'`. Poll `gh api repos/{owner}/<name>/pages` until status is `built`, then open the URL (`https://<owner>.github.io/<name>/`) to confirm it loads.
8. Do backlog items 1 and 2 below (remove/replace the `window.claude` code; apply the name). One commit each, add or adjust tests, `npm test` green, push. Keep the storage keys (`pl:*`, IndexedDB `phrase-loop`) unchanged so nothing Dario saved is lost; note that in the commit.
9. Report back tersely: repo URL, Pages URL, what changed, and a short checklist for Dario to test on his iPhone (open the Pages URL in Safari → Add to Home Screen → open an audio file from Files → mark, loop, sing gap, speed 25%, drag and delete a marker).

From then on, follow `CLAUDE.md` in the repo.

Status as of 2026-09-25. Everything decided in the original Claude.ai project chat is below; that chat is closed.

## Goal
Learn jazz solos (trumpet first) by ear: hear a short phrase, sing it back, repeat until memorised. Like a music player, but navigation is by phrase, with a silence after each pass for singing. First target: Don Ferrara's trumpet solo on "Sunflower" (Lee Konitz, *Very Cool*, Verve 1957; Ferrara tp, Konitz as, Sal Mosca p, Peter Ind b, Shadow Wilson d). Test file in use meanwhile: Louis Armstrong, "West End Blues" (1928), public domain, from archive.org/details/west-end-blues.

## Key decisions (and why)
1. **Web app before native iOS.** Native needs Xcode on the Mac for every build, Swift/AVAudioEngine learning, and 7-day installs on a free account (£79/yr otherwise). None of that tests whether the practice loop is right. The web app may stay the product; go native only if one of these bites: Music-library access, time-stretch quality, background audio, on-device stem separation.
2. **Local files only.** Spotify, Apple Music and Amazon Prime/Unlimited streams are DRM'd, so there's no PCM and no slowdown. Ripping breaches ToS and UK anti-circumvention law. YouTube ripping rejected for the same reasons plus poor quality under slowdown.
3. **Manual markers first**, auto phrase detection later. Tap Mark at each breath; about 80% of the value for none of the ML.
4. **Sing-back gap is the core mechanic**, sized relative to phrase length (off, ½×, 1×, 1½×, 2×).
5. **No notation/transcription.** Singing is the goal; writing it out by ear is part of the learning, and auto-transcription of swing is poor anyway. A pitch contour (piano-roll line) is acceptable later; MIDI export if a score is ever wanted.
6. **Moved from Claude.ai artifact to repo + Claude Code** for version control, persistent tests and cheaper sessions.

## Getting audio in
- The browser can't read the iOS Music library. The iTunes purchase of Sunflower (79p, Gambit edition "Very Cool + Tranquillity", ℗ 2008 Gambit, a grey-market reissue) needs the Mac: Music app → download → Show in Finder → `01 Sunflower.m4a` → iCloud Drive/AirDrop → Files → Open audio file in the app.
- Buying in Safari from a store that downloads straight to Files (Qobuz, Bandcamp) skips the Mac. Qobuz login failed for Dario; Amazon MP3 store is flaky on mobile.
- UK: recordings released before 1963 are likely out of copyright (compositions are not). Useful for archive.org sources; verify per case.
- Claude Cowork (Mac desktop) could automate the copy from `~/Music/Music/Media/Music/` once the track is downloaded in Music. Unverified whether it can be granted that protected folder.

## Current app (index.html, working name "Phrase Loop")
Done and covered by tests (Chromium only):
- Open a file (Files picker / Finder / drag-drop); cached in IndexedDB so each track is picked once; track list with remove.
- Waveform of the current phrase plus a whole-track overview strip (tap/drag to seek).
- Mark button (compensates ~150 ms tap lag, scaled by speed). Markers are editable directly on the waveform: drag the handle to move, tap to select → Delete marker, tap away to deselect (never starts playback). Fine-tune drawer: ±50 ms start/end, remove start/end, clear all (double tap to confirm; previous set backed up to `pl:m:bak:<key>`).
- Loop phrase on/off; sing-back gap turns the stage green with a draining bar.
- Speed stepper 25 to 100% in 5% steps, pitch preserved (`preservesPitch`).
- Gestures: tap play/pause, double tap restart phrase, swipe for previous/next phrase, back 3 s button. Mac keys: Space, ←/→, R, M, B, L, −/=, Delete, Esc.
- Markers JSON export/import (`{app, version:1, track:{name,size,duration}, markers:[s,…]}`); track identity = FNV hash of name|size.
- Wake lock while playing; Media Session handlers (lock-screen prev/next = phrase).
- Light/dark theme.

The artifact-only `window.claude` code (marker sync, `downloads`) was removed for Pages. Export is a Blob download of the JSON file (copyable textarea if that throws); move markers between devices by export/import.

## Verified vs not
- Verified in headless Chromium: all of the above.
- Reported by Dario on iPhone: the app runs in the Claude viewer and a file opened (the marker-deletion complaint came from real use). Everything else on iOS is unverified: AAC decode of the Sunflower m4a, pitch-preserved playback below 50% (Safari's stretcher gets watery; may degrade badly at 25%), memory decoding an 8-minute track (~80 MB PCM), looping with the screen locked, touch accuracy of the 24 px marker hit zone, IndexedDB eviction (home-screen web apps believed exempt; unverified).

## Backlog (suggested order)
1. **Deploy to GitHub Pages**; remove or replace `window.claude` code (sync → JSON export/import for now; export → Blob download link).
2. **Rename** (see names below). Update title, heading and storage prefix. Storage keys are `pl:*` plus IndexedDB `phrase-loop`, so migrate or keep them.
3. **Mic meter in the sing gap.** Mic input → YIN/autocorrelation pitch tracker (monophonic voice, real time, a few cents' accuracy) → note name plus cents needle. Needs headphones. Shows your pitch, not the answer. About half a day. Needs mic permission (Pages fine; the artifact viewer was unverified).
4. **Web Audio playback engine** with a proper stretcher (SoundTouchJS, or Rubber Band WASM, GPL/commercial): better slowdown below 50% and transpose in semitones. Costs: rebuild playback, silent-switch muting, gesture unlock, weaker background play. 1 to 2 days. Transpose is otherwise low priority; singing an octave down covers most of it.
5. **Track melody contour** (optional; risks replacing listening with reading). Basic Pitch (TF.js) at import, cached, drawn as a line synced to playback. Expect octave errors and piano bleed. Better quality: Demucs + Basic Pitch offline on the Mac, import a notes JSON.
6. **Auto phrase detection**: stem separation → gap detection on the horn stem, offline on the Mac → markers JSON (import already exists). Caveat for Sunflower: mono mix, trumpet and alto in a similar register, so separation will struggle.
7. Later: record your sung response and overlay contours; beat snapping; Spotify Web API playlist → owned/not-owned list (metadata only, no DRM issue).
8. Native iOS (Swift, AVAudioEngine + AVAudioUnitTimePitch, MPMediaItem.assetURL → AVAssetExportSession to sandbox) only if the web version hits a wall.

## Known issues / risks
- Loop timing is rAF-polled, not sample-accurate (the gap hides it). With gap Off, the wrap can click or lag.
- Markers can be dragged only within the current phrase's window; very close markers are hard to grab.
- Export uses `<a download>` on a Blob URL. Where the file lands on iOS Safari (Files prompt expected) is unverified.
- Hidden-tab `setInterval` fallback may be throttled; looping with the phone locked is unreliable.

## Name
Undecided. Candidates: Tristano (Lennie Tristano had students sing classic solos note for note before playing them, which is exactly this app's method; Konitz was his student), Ferrara (homage to Don Ferrara), Sunflower, Very Cool, Cool School, Woodshed, Call & Response, Sing the Line. Check App Store/trademark clashes before committing; real names of people carry some estate/trademark risk for a public release, not for personal use.

## Prior-art check still to do
Amazing Slow Downer, Transcribe!, Anytune, Moises cover slow-down/looping (Moises has separation). The gap this app targets, phrase-centric navigation plus a timed sing-back silence, wasn't confirmed as missing from them.
