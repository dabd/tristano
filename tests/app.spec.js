// Smoke tests for the core loop. Uses the file:// page and a generated WAV (npm run fixture).
// window.__pl exposes { S: state, eng(): playback engine, win(): waveform window, setPhrases(arr) } for assertions.
import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const PAGE = pathToFileURL(resolve("index.html")).href;
const WAV = resolve("tests/fixtures/tones.wav");
const st = page => page.evaluate(() => ({
  state: __pl.S.state, t: __pl.eng().time(), phrase: __pl.S.phrase, pending: __pl.S.pending,
  phrases: __pl.S.phrases.map(p => ({ ...p })), loop: __pl.S.loop, rate: __pl.S.rate, sel: __pl.S.sel,
}));
const spans = s => s.phrases.map(p => [p.start, p.end]);

async function load(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE);
  await page.setInputFiles("#fileIn", WAV);
  await page.waitForFunction(() => window.__pl.S.peaks && window.__pl.S.dur > 0);
  return errors;
}
// Screen position of a phrase edge handle. Start handles sit 4 px right of the edge line, end handles 4 px left.
async function handleAt(page, t, edge) {
  return page.evaluate(([t, edge]) => {
    const r = document.getElementById("wf").getBoundingClientRect(), [w0, w1] = __pl.win();
    return { x: r.left + (t - w0) / (w1 - w0) * r.width + (edge === "s" ? 4 : -4), y: r.top + r.height * 0.6 };
  }, [t, edge]);
}
async function drag(page, from, toX) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move((from.x + toX) / 2, from.y); await page.mouse.move(toX, from.y); await page.mouse.up();
}
// Mark while paused: no tap-lag compensation, so the mark lands exactly at t.
async function markAt(page, t) {
  await page.evaluate(t => __pl.eng().seek(t), t);
  await page.click("#mark");
}

test("mark start and end while playing, then loop a phrase with a sing-back gap", async ({ page }) => {
  const errors = await load(page);
  await page.click("#play");
  // Compare against the track clock read just before each tap, not wall time: audio start latency
  // after Play varies by machine (~0.9 s seen locally).
  const tapped = [];
  for (const wait of [1000, 2500, 1500, 2000]) {
    await page.waitForTimeout(wait);
    tapped.push(await page.evaluate(() => __pl.eng().time()));
    await page.click("#mark");
    if (tapped.length % 2) await expect(page.locator("#markLab")).toHaveText("End");
  }
  await expect(page.locator("#markLab")).toHaveText("Mark");
  const s1 = await st(page);
  expect(s1.phrases).toHaveLength(2);
  spans(s1).flat().forEach((m, i) => expect(Math.abs(m - (tapped[i] - 0.15))).toBeLessThan(0.35)); // 0.15 = REACTION at 100%
  expect(s1.phrases[0].color).not.toBe(s1.phrases[1].color);

  await page.click("#loop label:first-child");  // loop on
  await page.click("#prev");
  const seen = new Set();
  for (let i = 0; i < 40; i++) { seen.add((await st(page)).state); await page.waitForTimeout(200); }
  expect(seen.has("sing")).toBe(true);
  expect(seen.has("listen")).toBe(true);
  expect(errors).toEqual([]);
});

test("marking rules: no start inside a phrase, snap to a previous end, clip at the next start, cancel", async ({ page }) => {
  const errors = await load(page);
  await page.evaluate(() => __pl.setPhrases([{ start: 1, end: 4 }]));
  await markAt(page, 2);
  expect((await st(page)).pending).toBeNull();
  await expect(page.locator("#notice")).toContainText("inside phrase 1");

  await markAt(page, 4.1);                                   // within 0.25 s of phrase 1's end: snaps
  expect((await st(page)).pending).toBe(4);
  await markAt(page, 6);
  let s = await st(page);
  expect(spans(s)).toEqual([[1, 4], [4, 6]]);
  expect(s.phrases[1].color).not.toBe(s.phrases[0].color);

  await markAt(page, 0.3); await markAt(page, 5);             // runs into phrase 1: clipped at its start
  expect(spans(await st(page))).toEqual([[0.3, 1], [1, 4], [4, 6]]);

  await markAt(page, 8); await markAt(page, 7);               // tapping before the pending start restarts it
  expect((await st(page)).pending).toBe(7);
  await page.keyboard.press("Escape");
  expect((await st(page)).pending).toBeNull();
  expect((await st(page)).phrases).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("speed stepper goes down to 25% and plays", async ({ page }) => {
  await load(page);
  for (let i = 0; i < 20; i++) if (!(await page.isDisabled("#spDown"))) await page.click("#spDown");
  await expect(page.locator("#spVal")).toHaveText("25%");
  await page.click("#play");
  await page.waitForTimeout(1200);
  const s = await st(page);
  expect(s.rate).toBe(0.25);
  expect(s.t).toBeGreaterThan(0.1);
  expect(s.t).toBeLessThan(0.6);
});

test("drag phrase edges (a shared edge moves both phrases), select and delete a phrase", async ({ page }) => {
  await load(page);
  await page.evaluate(() => __pl.setPhrases([{ start: 0.5, end: 3.5 }, { start: 3.5, end: 7.5 }, { start: 9, end: 12 }]));
  await page.click("#next");                        // phrase 2: 3.5 s .. 7.5 s
  let s = await st(page);
  expect(s.phrase).toBe(1);

  let h = await handleAt(page, 7.5, "e");
  await drag(page, h, (await handleAt(page, 7.0, "e")).x);
  s = await st(page);
  expect(s.phrases[1].end).toBeCloseTo(7.0, 1);
  expect(s.phrases[2].start).toBe(9);              // not touching, so untouched
  expect(s.state).toBe("paused");

  h = await handleAt(page, 3.5, "s");
  await drag(page, h, (await handleAt(page, 3.8, "s")).x);
  s = await st(page);
  expect(s.phrases[1].start).toBeCloseTo(3.8, 1);
  expect(s.phrases[0].end).toBe(s.phrases[1].start);  // shared edge moved together

  h = await handleAt(page, s.phrases[1].end, "e");
  await page.mouse.click(h.x, h.y);
  await expect(page.locator("#mdel")).toHaveText("Delete phrase");
  await expect(page.locator("#mdel")).toBeVisible();
  await page.click("#mdel");
  s = await st(page);
  expect(spans(s).map(([a]) => a)).toEqual([0.5, 9]);
  expect(s.state).toBe("paused");
});

test("colour and note edit the current phrase and survive a reload", async ({ page }) => {
  await load(page);
  await page.evaluate(() => __pl.setPhrases([{ start: 4, end: 8 }, { start: 8, end: 12 }]));
  await page.click("#next");
  await page.click("summary");
  await page.click("#swatches button:nth-child(4)");            // colour index 3
  await page.fill("#noteIn", "bebop lick into the bridge");
  await expect(page.locator("#pnote")).toHaveText("bebop lick into the bridge");
  await page.click("[data-nudge='end,-0.05']");                  // blurs the note (saves) and nudges
  await page.reload();
  await page.waitForFunction(() => window.__pl.S.track && window.__pl.S.peaks);
  const s = await st(page);
  expect(s.phrases[1]).toEqual({ start: 8, end: 11.95, color: 3, note: "bebop lick into the bridge" });
  expect(s.phrases[0].note).toBe("");
});

test("export downloads a phrases file that imports back", async ({ page }) => {
  const errors = await load(page);
  await page.evaluate(() => __pl.setPhrases([{ start: 4, end: 8, color: 5, note: "first" }, { start: 12, end: 16 }]));
  await page.click("#menuBtn");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
  expect(dl.suggestedFilename()).toBe("tones.phrases.json");
  const file = await dl.path();
  const j = JSON.parse(await readFile(file, "utf8"));
  expect(j).toMatchObject({ app: "tristano", version: 2, track: { name: "tones.wav" } });
  expect(j.phrases[0]).toEqual({ start: 4, end: 8, color: 5, note: "first" });
  await expect(page.locator("#exportText")).toBeHidden();

  await page.evaluate(() => __pl.setPhrases([]));
  await page.setInputFiles("#jsonIn", file);
  await expect.poll(async () => (await st(page)).phrases).toEqual(j.phrases);
  expect(errors).toEqual([]);
});

test("imports a v1 markers file as back-to-back phrases", async ({ page }, info) => {
  await load(page);
  const file = info.outputPath("v1.markers.json");
  await writeFile(file, JSON.stringify({ app: "phrase-loop", version: 1, markers: [10, 20] }));
  await page.setInputFiles("#jsonIn", file);
  await expect.poll(async () => spans(await st(page))).toEqual([[0, 10], [10, 20], [20, 40]]);
});

test("renamed app converts markers saved by Phrase Loop into phrases", async ({ page }) => {
  await load(page);
  await expect(page).toHaveTitle("Tristano");
  // Write markers the way a pre-rename install did: literal pl:m:<key> in localStorage, no pl:p record.
  const key = await page.evaluate(() => {
    const k = __pl.S.track.key; localStorage.removeItem("pl:p:" + k);
    localStorage.setItem("pl:m:" + k, JSON.stringify({ markers: [5, 10], updatedAt: 1 })); return k;
  });
  await page.reload();  // track itself comes back from IndexedDB "phrase-loop"
  await page.waitForFunction(() => window.__pl.S.track && window.__pl.S.peaks);
  const s = await st(page);
  expect(spans(s)).toEqual([[0, 5], [5, 10], [10, 40]]);
  expect(new Set(s.phrases.map(p => p.color)).size).toBe(3);
  const ls = await page.evaluate(k => [localStorage.getItem("pl:m:" + k), JSON.parse(localStorage.getItem("pl:p:" + k))], key);
  expect(ls[0]).not.toBeNull();                     // v1 data kept as a backup
  expect(ls[1].phrases).toHaveLength(3);
});

test("asks the browser to keep storage and reports the answer", async ({ page }) => {
  await page.addInitScript(() => {
    window.__persistCalls = 0;
    navigator.storage.persisted = async () => false;
    navigator.storage.persist = async () => { window.__persistCalls++; return true; };
  });
  await load(page);
  expect(await page.evaluate(() => window.__persistCalls)).toBeGreaterThan(0);
  await page.click("#menuBtn");
  await expect(page.locator("#storeNote")).toContainText("kept");
});
