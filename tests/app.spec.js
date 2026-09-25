// Smoke tests for the core loop. Uses the file:// page and a generated WAV (npm run fixture).
// window.__pl exposes { S: state, eng(): active playback engine } for assertions.
import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const PAGE = pathToFileURL(resolve("index.html")).href;
const WAV = resolve("tests/fixtures/tones.wav");
const st = page => page.evaluate(() => ({
  state: __pl.S.state, t: __pl.eng().time(), phrase: __pl.S.phrase,
  markers: __pl.S.markers.slice(), loop: __pl.S.loop, rate: __pl.S.rate, sel: __pl.S.sel,
}));

async function load(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE);
  await page.setInputFiles("#fileIn", WAV);
  await page.waitForFunction(() => window.__pl.S.peaks && window.__pl.S.dur > 0);
  return errors;
}
// x position (CSS px) of a track time in the main waveform, using the page's own window calculation
async function xOf(page, t) {
  return page.evaluate(t => {
    const r = document.getElementById("wf").getBoundingClientRect();
    const b = [0, ...__pl.S.markers, __pl.S.dur], i = __pl.S.phrase, a = b[i], e = b[i + 1], len = e - a;
    const pad = Math.max(0.4, len * 0.08), w0 = Math.max(0, a - pad), w1 = Math.min(__pl.S.dur, e + pad);
    return { x: r.left + (t - w0) / (w1 - w0) * r.width, y: r.top + r.height * 0.6 };
  }, t);
}

test("mark while playing, then loop a phrase with a sing-back gap", async ({ page }) => {
  const errors = await load(page);
  await page.click("#play");
  // Compare against the track clock read just before each tap, not wall time: audio start latency
  // after Play varies by machine (~0.9 s seen locally), which made 4 s multiples a flaky target.
  const tapped = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(4000);
    tapped.push(await page.evaluate(() => __pl.eng().time()));
    await page.click("#mark");
  }
  const s1 = await st(page);
  expect(s1.markers).toHaveLength(3);
  s1.markers.forEach((m, i) => expect(Math.abs(m - (tapped[i] - 0.15))).toBeLessThan(0.35)); // 0.15 = REACTION at 100%

  await page.click("#loop label:first-child");  // loop on
  await page.click("#prev");
  const seen = new Set();
  for (let i = 0; i < 50; i++) { seen.add((await st(page)).state); await page.waitForTimeout(200); }
  expect(seen.has("sing")).toBe(true);
  expect(seen.has("listen")).toBe(true);
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

test("drag, select and delete markers on the waveform", async ({ page }) => {
  await load(page);
  await page.evaluate(() => { __pl.S.markers = [4, 8, 12]; });
  await page.click("#next");                       // phrase 2: 4 s .. 8 s
  const from = await xOf(page, 8), to = await xOf(page, 7.5);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
  let s = await st(page);
  expect(s.markers[1]).toBeCloseTo(7.5, 1);
  expect(s.state).toBe("paused");                  // editing never starts playback
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pl:m:" + __pl.S.track.key)).markers[1])).toBeCloseTo(7.5, 1);

  const away = await xOf(page, 5.5);
  await page.mouse.click(away.x, away.y);          // tap away deselects, does not play
  s = await st(page);
  expect(s.sel).toBe(-1);
  expect(s.state).toBe("paused");

  const start = await xOf(page, 4);
  await page.mouse.click(start.x, start.y);
  await expect(page.locator("#mdel")).toBeVisible();
  await page.click("#mdel");
  s = await st(page);
  expect(s.markers).toHaveLength(2);
  expect(s.markers[0]).toBeCloseTo(7.5, 1);
});

test("track and markers survive a reload", async ({ page }) => {
  await load(page);
  await page.evaluate(() => { __pl.S.markers = [4, 8]; });
  await page.click("#next");
  await page.click("summary");
  await page.click("[data-nudge='start,-0.05']");  // persists via markersChanged()
  await page.reload();
  await page.waitForFunction(() => window.__pl.S.track && window.__pl.S.peaks);
  const s = await st(page);
  expect(s.markers[0]).toBeCloseTo(3.95, 2);
});

test("export downloads a markers file that imports back", async ({ page }) => {
  const errors = await load(page);
  await page.evaluate(() => { __pl.S.markers = [4, 8, 12]; });
  await page.click("#menuBtn");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
  expect(dl.suggestedFilename()).toBe("tones.markers.json");
  const file = await dl.path();
  const j = JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8"));
  expect(j.markers).toEqual([4, 8, 12]);
  expect(j.track.name).toBe("tones.wav");
  await expect(page.locator("#exportText")).toBeHidden();

  await page.evaluate(() => { __pl.S.markers = []; });
  await page.setInputFiles("#jsonIn", file);
  await expect.poll(async () => (await st(page)).markers).toEqual([4, 8, 12]);
  expect(errors).toEqual([]);
});
