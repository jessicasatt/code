import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The demo backend is a single in-memory, single-user store shared by
  // every request to the one running server (by design — this is a
  // private single-user app, not a multi-tenant one). Tests must run
  // serially against it or they'll stomp on each other's state.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "iphone-13",
      // Chromium is the only browser available in this environment; keep the
      // iPhone 13 viewport/UA/touch emulation but force the Chromium engine
      // instead of the device preset's default (WebKit), and point directly
      // at the preinstalled full Chromium binary (not the headless_shell
      // variant, which isn't installed here).
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
