// npm run pdf → export/talk.pdf, one page per slide, from the same pages you present.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { HEIGHT, NO_BROWSER, ROOT, WIDTH, launchBrowser, openStill, showSlide, startTalk } from "./serve.mjs";

const OUT = path.join(ROOT, "export");
await mkdir(OUT, { recursive: true });

const browser = await launchBrowser();
if (!browser) {
  console.log(NO_BROWSER);
  process.exit(1);
}
const talkServer = await startTalk();
try {
  const page = await openStill(browser, talkServer.url);
  const total = await page.evaluate(() => window.__talk.slides.length);
  console.log(`Saving ${total} slides …`);
  const pdf = await PDFDocument.create();
  for (let n = 1; n <= total; n++) {
    await showSlide(page, n);
    const file = path.join(OUT, `slide-${String(n).padStart(2, "0")}.png`);
    await page.locator(".deck-stage").screenshot({ path: file });
    const png = await pdf.embedPng(await readFile(file));
    pdf.addPage([WIDTH * 0.75, HEIGHT * 0.75]).drawImage(png, { x: 0, y: 0, width: WIDTH * 0.75, height: HEIGHT * 0.75 });
  }
  const out = path.join(OUT, "talk.pdf");
  await writeFile(out, await pdf.save());
  console.log(`Done: ${path.relative(ROOT, out)}`);
} finally {
  await browser.close();
  await talkServer.close();
}
