// Loads talk.md once, turns it into slides, and saves edits from the notes window.

import source from "/talk.md?raw";
import { blockLabel, buildSlides, parseTalk, rhythmProblems } from "../talk/format.js";

export const talk = parseTalk(source);
export const slides = buildSlides(talk);
export const settings = talk.settings;
export const problems = [...talk.problems, ...rhythmProblems(talk)];

/** One name per talk, so two open talks never steer each other's notes. */
export const CHANNEL = `talk-notes-${settings.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** Every slide is designed at this size; the browser scales the stage to fit. */
export const WIDTH = 1280;
export const HEIGHT = 720;

const notes = new Map(talk.blocks.map((b) => [b.index, b.notes]));
const unsaved = new Set();

export function notesFor(index) {
  const slide = slides[index];
  return slide ? notes.get(slide.block) ?? "" : "";
}

export function labelFor(index) {
  const slide = slides[index];
  return slide ? blockLabel(talk.blocks[slide.block]) : "";
}

/** "Slide 4 of 18 · Title" with the step for a slide that reveals points. */
export function kickerFor(index) {
  const slide = slides[index];
  if (!slide) return "";
  const step = slide.steps > 1 ? ` · point ${slide.through} of ${slide.steps}` : "";
  return `Slide ${index + 1} of ${slides.length} · ${labelFor(index)}${step}`;
}

/**
 * Saves edited notes into talk.md through the dev server. The text changes in
 * this window at once; a failed save stays here and goes out again next time.
 * Returns "saved", "failed", or "stale" (talk.md changed since this page loaded).
 */
export async function saveNotes(index, text) {
  const slide = slides[index];
  if (!slide) return "failed";
  const block = slide.block;
  if (notes.get(block) === text && !unsaved.has(block)) return "saved";
  notes.set(block, text);
  unsaved.add(block);
  try {
    const res = await fetch("/__notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ block, notes: text, label: blockLabel(talk.blocks[block]) }),
      keepalive: true,
    });
    if (res.status === 409) return "stale";
    if (!res.ok) return "failed";
    if (notes.get(block) === text) unsaved.delete(block);
    return "saved";
  } catch {
    return "failed";
  }
}
