// Tests for reading and writing talk.md. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSlides, contentProblems, inferLayout, mediaUrl, parseBar, parseCard, parseTalk, replaceNotes, rhythmProblems } from "../talk/format.js";

const SAMPLE = `---
title: Test talk
theme: night
accent: "#ff0066"
---

# First slide
layout: cover
subtitle: Hello

Notes for the first slide.

They can have two paragraphs.

---

# A list
reveal: yes
points:
- one
- two
- three

List notes.

---

# Code
code:
\`\`\`js
const a = 1;
---
const b = 2;
\`\`\`

Code notes.

---

# Last
layout: statement
`;

test("reads settings, blocks, fields and notes", () => {
  const talk = parseTalk(SAMPLE);
  assert.equal(talk.settings.title, "Test talk");
  assert.equal(talk.settings.theme, "night");
  assert.equal(talk.settings.accent, "#ff0066");
  assert.equal(talk.blocks.length, 4);
  assert.equal(talk.blocks[0].layout, "cover");
  assert.equal(talk.blocks[0].fields.subtitle, "Hello");
  assert.equal(talk.blocks[0].notes, "Notes for the first slide.\n\nThey can have two paragraphs.");
  assert.deepEqual(talk.blocks[1].fields.points, ["one", "two", "three"]);
  assert.equal(talk.blocks[1].layout, "list");
  assert.equal(talk.blocks[3].notes, "");
  assert.deepEqual(talk.problems, []);
});

test("a --- inside a code fence stays part of the code", () => {
  const talk = parseTalk(SAMPLE);
  assert.equal(talk.blocks[2].layout, "code");
  assert.equal(talk.blocks[2].fields.code, "const a = 1;\n---\nconst b = 2;");
  assert.equal(talk.blocks[2].fields.lang, "js");
  assert.equal(talk.blocks[2].notes, "Code notes.");
});

test("reveal turns a list into one slide per point", () => {
  const slides = buildSlides(parseTalk(SAMPLE));
  assert.equal(slides.length, 6);
  assert.deepEqual(
    slides.filter((s) => s.block === 1).map((s) => s.through),
    [1, 2, 3],
  );
});

test("replaceNotes changes only the notes of one block", () => {
  const result = replaceNotes(SAMPLE, 1, "New list notes.", "A list");
  assert.equal(result.ok, true);
  const talk = parseTalk(result.text);
  assert.equal(talk.blocks[1].notes, "New list notes.");
  assert.deepEqual(talk.blocks[1].fields.points, ["one", "two", "three"]);
  assert.equal(talk.blocks[0].notes, parseTalk(SAMPLE).blocks[0].notes);
  assert.equal(talk.blocks[2].fields.code, "const a = 1;\n---\nconst b = 2;");
  assert.equal(talk.blocks.length, 4);
});

test("replaceNotes adds notes to a block that had none, including the last one", () => {
  const result = replaceNotes(SAMPLE, 3, "Closing words.", "Last");
  assert.equal(result.ok, true);
  assert.equal(parseTalk(result.text).blocks[3].notes, "Closing words.");
  const again = replaceNotes(result.text, 3, "Closing words, edited.", "Last");
  assert.equal(parseTalk(again.text).blocks[3].notes, "Closing words, edited.");
});

test("replaceNotes refuses a save meant for another slide", () => {
  const result = replaceNotes(SAMPLE, 1, "Oops", "First slide");
  assert.deepEqual(result, { ok: false, reason: "stale" });
});

test("many saves in a row keep the file stable", () => {
  let text = SAMPLE;
  for (let i = 0; i < 5; i++) text = replaceNotes(text, i % 4, `Round ${i}`, parseTalk(text).blocks[i % 4].title).text;
  const talk = parseTalk(text);
  assert.equal(talk.blocks.length, 4);
  assert.equal(talk.blocks[0].notes, "Round 4");
  assert.equal(talk.blocks[3].notes, "Round 3");
  assert.equal(replaceNotes(text, 0, "Round 4", "First slide").text, text);
});

test("missing fields and unknown layouts are reported", () => {
  const talk = parseTalk(`# A\nlayout: image\n\n---\n\n# B\nlayout: slideshow\n`);
  assert.equal(talk.problems.length, 2);
  assert.match(talk.problems[0], /needs "image:"/);
  assert.match(talk.problems[1], /unknown layout "slideshow"/);
});

test("a file without settings still works", () => {
  const talk = parseTalk(`# Only slide\ntext: hi\n`);
  assert.equal(talk.settings.title, "Untitled talk");
  assert.equal(talk.blocks.length, 1);
  assert.equal(talk.blocks[0].layout, "text");
});

test("layouts are inferred when talk.md leaves them out", () => {
  assert.equal(inferLayout("T", { image: "a.png" }), "split");
  assert.equal(inferLayout("", { image: "a.png" }), "image");
  assert.equal(inferLayout("T", { points: ["a"] }), "list");
  assert.equal(inferLayout("T", {}), "statement");
  assert.equal(inferLayout("", { left: "a", right: "b" }), "compare");
});

test("rhythm and content tips", () => {
  const talk = parseTalk(`# One\nlayout: statement\n\n---\n\n# Two\nlayout: statement\n\nNotes.\n`);
  assert.equal(rhythmProblems(talk).length, 1);
  assert.match(contentProblems(talk).join("\n"), /slide 1: no speaker notes/);
});

test("small helpers", () => {
  assert.deepEqual(parseBar("Visitors: 42%"), { label: "Visitors", value: 42, unit: "%" });
  assert.deepEqual(parseCard("Before — messy"), { label: "Before", body: "messy" });
  assert.equal(mediaUrl("media/photo.png"), "/photo.png");
  assert.equal(mediaUrl("photo.png"), "/photo.png");
  assert.equal(mediaUrl("https://x.dev/a.png"), "https://x.dev/a.png");
});
