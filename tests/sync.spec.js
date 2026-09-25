// Gist sync against an in-memory fake of the GitHub API. Each browser context is one device;
// contexts share the fake, the way a Mac and an iPhone share one gist.
import { test, expect, devices } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const PAGE = pathToFileURL(resolve("index.html")).href;
const WAV = resolve("tests/fixtures/tones.wav");
const FILE = "tristano.json";

function fakeGitHub() {
  return { token: "tok", scopes: "gist", down: false, gists: new Map(), calls: [] };
}
async function device(browser, gh) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH", "Access-Control-Expose-Headers": "X-OAuth-Scopes" };
  await ctx.route("https://api.github.com/**", async route => {
    const req = route.request(), url = new URL(req.url()), m = req.method();
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (gh.down) return route.abort("internetdisconnected");
    gh.calls.push(m + " " + url.pathname);
    const json = (status, body) => route.fulfill({ status, headers: { ...cors, "Content-Type": "application/json", "X-OAuth-Scopes": gh.scopes }, body: JSON.stringify(body) });
    if (req.headers().authorization !== "Bearer " + gh.token) return json(401, { message: "Bad credentials" });
    if (m === "GET" && url.pathname === "/gists") return json(200, [...gh.gists.values()]);
    if (m === "POST" && url.pathname === "/gists") {
      const b = req.postDataJSON(), id = "g" + (gh.gists.size + 1);
      gh.gists.set(id, { id, description: b.description, public: b.public, files: { [FILE]: { content: b.files[FILE].content } } });
      return json(201, gh.gists.get(id));
    }
    const g = gh.gists.get(url.pathname.split("/")[2]);
    if (!g) return json(404, { message: "Not Found" });
    if (m === "GET") return json(200, g);
    if (m === "PATCH") { g.files[FILE] = { content: req.postDataJSON().files[FILE].content }; return json(200, g); }
    return json(405, {});
  });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE);
  await page.setInputFiles("#fileIn", WAV);
  await page.waitForFunction(() => window.__pl.S.peaks && window.__pl.S.dur > 0);
  page.errors = errors;
  return page;
}
async function connect(page, token = "tok") {
  if (!(await page.evaluate(() => document.getElementById("sheet").open))) await page.click("#menuBtn");
  await page.fill("#tokenIn", token);
  await page.click("#connectBtn");
}
const remote = (gh, key) => { const g = [...gh.gists.values()][0]; return g && JSON.parse(g.files[FILE].content).tracks[key]; };
const phrasesOf = page => page.evaluate(() => __pl.S.phrases.map(p => ({ ...p })));
const trackKey = page => page.evaluate(() => __pl.S.track.key);

test("connecting makes one secret gist; a second device finds it and gets the phrases", async ({ browser }) => {
  const gh = fakeGitHub();
  const mac = await device(browser, gh);
  await mac.evaluate(() => __pl.setPhrases([{ start: 4, end: 8, color: 2, note: "pickup" }, { start: 8, end: 12 }]));
  await connect(mac);
  await expect(mac.locator("#syncStatus")).toContainText("Synced");
  await expect(mac.locator("#syncOn")).toBeVisible();
  expect(gh.gists.size).toBe(1);
  expect([...gh.gists.values()][0].public).toBe(false);
  const key = await trackKey(mac);
  expect(remote(gh, key).phrases).toEqual(await phrasesOf(mac));
  expect(remote(gh, key).name).toBe("tones.wav");

  const phone = await device(browser, gh);
  expect(await phrasesOf(phone)).toEqual([]);
  await connect(phone);
  await expect(phone.locator("#syncStatus")).toContainText("Synced");
  expect(gh.calls.filter(c => c === "POST /gists")).toHaveLength(1);   // found, not duplicated
  await expect.poll(() => phrasesOf(phone)).toEqual(await phrasesOf(mac));
  expect([...mac.errors, ...phone.errors]).toEqual([]);
});

test("the newer edit wins on the other device; edits made offline sync once GitHub is back", async ({ browser }) => {
  const gh = fakeGitHub();
  const mac = await device(browser, gh), phone = await device(browser, gh);
  await mac.evaluate(() => __pl.setPhrases([{ start: 4, end: 8 }]));
  await connect(mac); await expect(mac.locator("#syncStatus")).toContainText("Synced");
  await connect(phone); await expect(phone.locator("#syncStatus")).toContainText("Synced");
  const key = await trackKey(mac);

  // phone edits; the debounced push reaches the gist; the Mac pulls it (as on returning to the app)
  await phone.evaluate(() => __pl.setPhrases([{ start: 4, end: 7.5, color: 4, note: "shorter" }]));
  await expect.poll(() => remote(gh, key).phrases[0].note).toBe("shorter");
  await mac.evaluate(() => __pl.syncNow());
  await expect.poll(() => phrasesOf(mac)).toEqual([{ start: 4, end: 7.5, color: 4, note: "shorter" }]);

  // Mac edits while offline: kept locally, status says so, pushed on the next sync
  gh.down = true;
  await mac.evaluate(() => __pl.setPhrases([{ start: 4, end: 7.5, color: 4, note: "offline edit" }]));
  await expect(mac.locator("#syncStatus")).toContainText("Changes are kept here", { timeout: 5000 });
  expect(await mac.evaluate(() => JSON.parse(localStorage.getItem("pl:sync")).dirty)).toBe(true);
  gh.down = false;
  await mac.evaluate(() => __pl.syncNow());
  await expect.poll(() => remote(gh, key).phrases[0].note).toBe("offline edit");
  expect(await mac.evaluate(() => JSON.parse(localStorage.getItem("pl:sync")).dirty)).toBe(false);
});

test("a rejected token and a broad token are reported", async ({ browser }) => {
  const gh = fakeGitHub();
  const page = await device(browser, gh);
  await connect(page, "wrong");
  await expect(page.locator("#syncStatus")).toContainText("rejected");
  await expect(page.locator("#syncSetup")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pl:sync"))).toBeNull();

  gh.scopes = "gist, repo";
  await connect(page);
  await expect(page.locator("#syncStatus")).toContainText("also has repo");
  await page.click("#disconnectBtn");
  await expect(page.locator("#syncSetup")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pl:sync")).token)).toBeUndefined();
});
