// Drives the talk in a real browser. Run with: npm test
// It edits talk.md along the way and always puts the original back.

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseTalk } from "../talk/format.js";
import { NO_BROWSER, ROOT, launchBrowser, startTalk } from "../scripts/serve.mjs";

const TALK = path.join(ROOT, "talk.md");
const original = await readFile(TALK, "utf8");

const FIXTURE = `---
title: Browser test
theme: paper
---

# Hello
layout: cover

Opening notes.

---

# Three points
reveal: yes
points:
- alpha
- beta
- gamma

List notes.

---

# A statement
layout: statement

Statement notes.
`;

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (error) {
    results.push(`  ✗ ${name}\n    ${String(error.message).split("\n").join("\n    ")}`);
    process.exitCode = 1;
  }
}

const browser = await launchBrowser();
if (!browser) {
  console.log(NO_BROWSER);
  process.exit(1);
}
await writeFile(TALK, FIXTURE);
const server = await startTalk();
const slideNumber = (page) => page.evaluate(() => Number(document.querySelector(".slide")?.dataset.slide));

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const deck = await context.newPage();
  await deck.goto(server.url);
  await deck.waitForFunction(() => window.__talk?.slides.length > 0);

  await step("opens on slide 1 and counts every slide, steps included", async () => {
    assert.equal(await slideNumber(deck), 1);
    assert.equal(await deck.evaluate(() => window.__talk.slides.length), 5);
    assert.match(deck.url(), /#1$/);
  });

  await step("arrow keys, clicks, Home and End move between slides", async () => {
    await deck.keyboard.press("ArrowRight");
    assert.equal(await slideNumber(deck), 2);
    await deck.mouse.click(640, 360);
    assert.equal(await slideNumber(deck), 3);
    await deck.keyboard.press("ArrowLeft");
    assert.equal(await slideNumber(deck), 2);
    await deck.keyboard.press("End");
    assert.equal(await slideNumber(deck), 5);
    await deck.keyboard.press("Home");
    assert.equal(await slideNumber(deck), 1);
    assert.match(deck.url(), /#1$/);
  });

  await step("a revealed list shows one more point per click and keeps the points in place", async () => {
    await deck.goto(`${server.url}#2`);
    await deck.waitForFunction(() => Number(document.querySelector(".slide")?.dataset.slide) === 2);
    const visible = () =>
      deck.evaluate(() => [...document.querySelectorAll(".points li")].map((li) => getComputedStyle(li).visibility === "visible"));
    await deck.evaluate(() => (document.querySelector(".slide").dataset.marker = "same"));
    await deck.waitForTimeout(900);
    const firstTop = await deck.evaluate(() => document.querySelector(".points li").getBoundingClientRect().top);
    assert.deepEqual(await visible(), [true, false, false]);
    await deck.keyboard.press("ArrowRight");
    await deck.waitForTimeout(500);
    assert.deepEqual(await visible(), [true, true, false]);
    assert.equal(await deck.evaluate(() => document.querySelector(".slide").dataset.marker), "same");
    assert.equal(await deck.evaluate(() => document.querySelector(".points li").getBoundingClientRect().top), firstTop);
  });

  await step("the notes page follows the deck and shows each slide's notes", async () => {
    const notes = await context.newPage();
    await notes.goto(`${server.url}?notes=1`);
    await notes.waitForSelector(".notes-body");
    await deck.goto(`${server.url}#1`);
    await notes.waitForFunction(() => document.querySelector(".notes-body").innerText.includes("Opening notes"));
    await deck.keyboard.press("ArrowRight");
    await notes.waitForFunction(() => document.querySelector(".notes-body").innerText.includes("List notes"));
    assert.match(await notes.textContent(".notes-kicker"), /point 1 of 3/);
    await notes.close();
  });

  await step("an edit in the notes saves into talk.md and leaves the deck alone", async () => {
    const notes = await context.newPage();
    await notes.goto(`${server.url}?notes=1`);
    await notes.waitForSelector(".notes-body");
    await deck.goto(`${server.url}#5`);
    await deck.evaluate(() => (window.__stillHere = true));
    await notes.waitForFunction(() => document.querySelector(".notes-body").innerText.includes("Statement notes"));
    await notes.click(".notes-body");
    await notes.keyboard.press("End");
    await notes.keyboard.type(" Added in rehearsal.");
    await notes.mouse.click(5, 5);
    await notes.waitForFunction(() => document.querySelector(".notes-status").textContent.includes("Saved"));
    const saved = parseTalk(await readFile(TALK, "utf8"));
    assert.equal(saved.blocks[2].notes, "Statement notes. Added in rehearsal.");
    assert.equal(saved.blocks.length, 3);
    await deck.waitForTimeout(800);
    assert.equal(await deck.evaluate(() => window.__stillHere === true), true, "the deck reloaded after a notes save");
    await notes.close();
  });

  await step("a save meant for a slide that moved is refused", async () => {
    const before = await readFile(TALK, "utf8");
    const res = await deck.evaluate(async () => {
      const r = await fetch("/__notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block: 1, notes: "wrong place", label: "Hello" }),
      });
      return r.status;
    });
    assert.equal(res, 409);
    assert.equal(await readFile(TALK, "utf8"), before);
  });

  await step("saves from another website are refused", async () => {
    const res = await fetch(`${server.url}__notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ block: 0, notes: "x", label: "Hello" }),
    });
    assert.equal(res.status, 403);
  });

  await step("a problem in talk.md shows a clear message on screen", async () => {
    await writeFile(TALK, FIXTURE.replace("layout: statement", "layout: slideshow"));
    // An outside edit to talk.md (an agent, an editor) reloads the open deck by itself.
    await deck.waitForSelector(".problems", { timeout: 10000 });
    assert.match(await deck.textContent(".problems"), /unknown layout "slideshow"/);
  });

  await context.close();
} finally {
  await browser.close();
  await server.close();
  await writeFile(TALK, original);
}

console.log("browser tests");
console.log(results.join("\n"));
console.log(process.exitCode ? "Some browser tests failed." : "All browser tests passed.");
