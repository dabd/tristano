import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  use: {
    ...devices["iPhone 13"],          // phone-sized viewport + touch; still Chromium unless you add a webkit project
    browserName: "chromium",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
});
