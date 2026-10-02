import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env", quiet: true });
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: process.env.BASE_URL ? undefined : {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
