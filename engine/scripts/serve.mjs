// Shared by the check and the PDF export: start the talk, open a browser, show a slide.

import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const WIDTH = 1280;
export const HEIGHT = 720;

export async function startTalk() {
  if (process.env.TALK_URL) return { url: process.env.TALK_URL.replace(/\/?$/, "/"), close: async () => {} };
  const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 5181, strictPort: false, open: false } });
  await server.listen();
  return { url: server.resolvedUrls?.local[0] ?? "http://localhost:5181/", close: () => server.close() };
}

/** Uses the Chrome on this computer, or Playwright's own Chromium. */
export async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return null;
  }
  for (const options of [{ channel: "chrome" }, {}]) {
    try {
      return await chromium.launch(options);
    } catch {
      /* try the next one */
    }
  }
  return null;
}

export const NO_BROWSER =
  "No browser for the check. Install Google Chrome, or run: npx playwright install chromium";

/** Opens the talk as still frames: every animation finished, every slide reachable by its number. */
export async function openStill(browser, url) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2 });
  await page.goto(`${url}?thumb=1#1`, { waitUntil: "load" });
  await page.waitForFunction(() => (window.__talk?.slides?.length ?? 0) > 0, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

export async function showSlide(page, n) {
  await page.evaluate((i) => {
    window.location.hash = `#${i}`;
  }, n);
  await page.waitForFunction((i) => Number(document.querySelector(".slide")?.dataset.slide) === i, n);
  // Pictures and videos need a moment to load before they are measured or printed.
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll(".slide img")].map((img) =>
        img.complete ? null : new Promise((r) => img.addEventListener("load", r, { once: true }) || setTimeout(r, 3000)),
      ),
    ),
  );
  await page.waitForTimeout(120);
}
