// npm run check
// 1. Reads talk.md: layouts, required fields, missing pictures, long titles.
// 2. Opens every slide in a browser and finds anything that overlaps, runs
//    under the footer, or leaves the slide.
// Problems marked ✗ need a fix. Tips marked · are worth a look.

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { contentProblems, parseTalk, rhythmProblems } from "../talk/format.js";
import { NO_BROWSER, ROOT, launchBrowser, openStill, showSlide, startTalk } from "./serve.mjs";

const talk = parseTalk(await readFile(path.join(ROOT, "talk.md"), "utf8"));
const errors = [...talk.problems];
const tips = [...rhythmProblems(talk), ...contentProblems(talk)];

for (const block of talk.blocks) {
  for (const key of ["image", "video"]) {
    const file = block.fields[key];
    if (!file || /^(https?:)?\/\//.test(file)) continue;
    const local = path.join(ROOT, "media", file.replace(/^\.?\/?/, "").replace(/^media\//, ""));
    try {
      await access(local);
    } catch {
      errors.push(`slide ${block.index + 1}: ${key} "${file}" is missing. Put the file in the media/ folder.`);
    }
  }
}

console.log(`talk.md · ${talk.blocks.length} slides · theme ${talk.settings.theme}`);

/** Runs in the page: boxes for every line of text and every picture on the slide. */
function measure() {
  const slide = document.querySelector(".slide");
  const stage = document.querySelector(".deck-stage").getBoundingClientRect();
  const footer = slide.querySelector(".footer");
  const footerTop = footer ? footer.getBoundingClientRect().top - stage.top : Infinity;
  const hidden = (el) => {
    for (let node = el; node && node !== slide; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.05) return true;
    }
    return false;
  };
  const blockOf = (el) => el.closest("h1, p, li, pre, blockquote, figcaption, span.card-body, span.card-label, span.chart-label, b") ?? el;
  const rel = (r) => ({ left: r.left - stage.left, top: r.top - stage.top, right: r.right - stage.left, bottom: r.bottom - stage.top });
  const boxes = [];
  const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (!text || hidden(node.parentElement)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      boxes.push({ text: text.slice(0, 40), block: blockOf(node.parentElement), footer: Boolean(node.parentElement.closest(".footer")), r: rel(r) });
    }
  }
  const media = [...slide.querySelectorAll(".picture, .window, .chart, .card")].map((el) => ({ el, r: rel(el.getBoundingClientRect()) }));
  const problems = [];
  const fullBleed = ["image", "video"].includes(slide.dataset.layout);
  for (const [i, a] of boxes.entries()) {
    const r = a.r;
    if (r.left < -1 || r.top < -1 || r.right > stage.width + 1 || r.bottom > stage.height + 1) problems.push(`text leaves the slide · "${a.text}"`);
    if (!a.footer && r.bottom > footerTop + 1) problems.push(`text runs under the footer · "${a.text}"`);
    for (const b of boxes.slice(i + 1)) {
      if (a.block === b.block || a.block.contains(b.block) || b.block.contains(a.block)) continue;
      const w = Math.min(r.right, b.r.right) - Math.max(r.left, b.r.left);
      const h = Math.min(r.bottom, b.r.bottom) - Math.max(r.top, b.r.top);
      if (w > 3 && h > 3) problems.push(`text overlaps text · "${a.text}" and "${b.text}"`);
    }
  }
  if (!fullBleed) {
    for (const m of media) {
      const r = m.r;
      if (r.bottom > footerTop + 1) problems.push(`a ${m.el.className.split(" ")[0]} runs under the footer`);
      if (r.left < -1 || r.right > stage.width + 1 || r.top < -1) problems.push(`a ${m.el.className.split(" ")[0]} leaves the slide`);
    }
  }
  return [...new Set(problems)];
}

const talkServer = await startTalk();
const browser = await launchBrowser();
try {
  if (!browser) {
    tips.push(NO_BROWSER);
  } else {
    const page = await openStill(browser, talkServer.url);
    const total = await page.evaluate(() => window.__talk.slides.length);
    for (let n = 1; n <= total; n++) {
      await showSlide(page, n);
      for (const problem of await page.evaluate(measure)) errors.push(`slide ${n}: ${problem}`);
    }
    console.log(`layout · looked at ${total} slides in the browser`);
  }
} finally {
  await browser?.close();
  await talkServer.close();
}

for (const e of errors) console.log(`  ✗ ${e}`);
for (const t of tips) console.log(`  · ${t}`);
if (errors.length) {
  console.log(`${errors.length} to fix. Fix the ✗ lines, then run npm run check again.`);
  process.exitCode = 1;
} else {
  console.log(tips.length ? `Ready to present. ${tips.length} tips above are worth a look.` : "Ready to present.");
}
