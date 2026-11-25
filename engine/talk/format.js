/**
 * The talk.md format. Shared by the browser (the deck and the notes window)
 * and Node (the dev server, the checks and the tests), so it stays plain
 * JavaScript with no DOM and no Node APIs.
 *
 * talk.md looks like this:
 *
 *   ---
 *   title: My talk
 *   event: Some conference
 *   theme: paper
 *   ---
 *
 *   # The slide title
 *   layout: list
 *   points:
 *   - first point
 *   - second point
 *
 *   Everything after the first empty line is what the speaker says.
 *
 *   ---
 *
 *   # The next slide
 *   ...
 */

/** Every layout the engine can draw. */
export const LAYOUTS = [
  "cover",
  "statement",
  "text",
  "list",
  "split",
  "image",
  "quote",
  "compare",
  "code",
  "video",
  "chart",
  "number",
  "closing",
];

/** Fields a slide may set, in the order the docs list them. */
export const FIELDS = [
  "layout",
  "section",
  "subtitle",
  "text",
  "points",
  "reveal",
  "image",
  "side",
  "caption",
  "quote",
  "by",
  "left",
  "right",
  "code",
  "lang",
  "video",
  "bars",
  "number",
  "label",
  "link",
];

/** Fields that hold a list of "- item" lines. */
const LIST_FIELDS = new Set(["points", "bars"]);

/** What each layout needs before it can draw anything useful. */
export const REQUIRED = {
  image: ["image"],
  quote: ["quote"],
  compare: ["left", "right"],
  code: ["code"],
  video: ["video"],
  chart: ["bars"],
  number: ["number"],
};

/** Deck settings with their defaults. */
export const DEFAULT_SETTINGS = {
  title: "Untitled talk",
  speaker: "",
  event: "",
  theme: "paper",
  accent: "",
  footer: "",
};

export const THEMES = ["paper", "night", "clean"];

const FIELD_LINE = new RegExp(`^(${FIELDS.join("|")}):[ \\t]*(.*)$`);
const SEPARATOR = /^---[ \t]*$/;
const FENCE = /^(```|~~~)/;

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) return v.slice(1, -1);
  return v;
}

/** Splits text into lines and remembers where each one starts. */
function linesOf(text) {
  const lines = [];
  let at = 0;
  for (const raw of text.split("\n")) {
    lines.push({ text: raw.replace(/\r$/, ""), start: at, end: at + raw.length + 1 });
    at += raw.length + 1;
  }
  return lines;
}

function readSettings(lines) {
  const settings = { ...DEFAULT_SETTINGS };
  if (!lines.length || !SEPARATOR.test(lines[0].text)) return { settings, next: 0 };
  for (let i = 1; i < lines.length; i++) {
    if (SEPARATOR.test(lines[i].text)) return { settings, next: i + 1 };
    const match = lines[i].text.match(/^([a-zA-Z]+):[ \t]*(.*)$/);
    if (match) settings[match[1]] = unquote(match[2]);
  }
  // No closing line: treat the whole file as slides.
  return { settings: { ...DEFAULT_SETTINGS }, next: 0 };
}

/** Reads one slide block: an optional "# Title", field lines, then the notes. */
function readBlock(blockLines, number) {
  const fields = {};
  const problems = [];
  let title = "";
  let i = 0;
  while (i < blockLines.length && !blockLines[i].text.trim()) i++;
  if (i < blockLines.length && /^#\s+/.test(blockLines[i].text)) {
    title = blockLines[i].text.replace(/^#\s+/, "").trim();
    i++;
  }
  let lastList = null;
  for (; i < blockLines.length; i++) {
    const text = blockLines[i].text;
    if (!text.trim()) break;
    const item = text.match(/^\s*-\s+(.*)$/);
    if (item && lastList) {
      fields[lastList].push(unquote(item[1]));
      continue;
    }
    const field = text.match(FIELD_LINE);
    if (!field) break;
    const [, key, value] = field;
    lastList = null;
    if (LIST_FIELDS.has(key)) {
      fields[key] = value.trim() ? [unquote(value)] : [];
      lastList = key;
    } else if (key === "code" && !value.trim() && FENCE.test(blockLines[i + 1]?.text ?? "")) {
      const fence = blockLines[i + 1].text.match(FENCE)[1];
      const lang = blockLines[i + 1].text.slice(fence.length).trim();
      const body = [];
      let j = i + 2;
      for (; j < blockLines.length && !blockLines[j].text.startsWith(fence); j++) body.push(blockLines[j].text);
      fields.code = body.join("\n");
      if (lang && !fields.lang) fields.lang = lang;
      i = j;
    } else {
      fields[key] = unquote(value);
    }
  }
  const headEnd = i < blockLines.length ? blockLines[i].start : blockLines.length ? blockLines.at(-1).end : 0;
  const notes = blockLines
    .slice(i)
    .map((l) => l.text)
    .join("\n")
    .trim();

  const layout = fields.layout || inferLayout(title, fields);
  if (fields.layout && !LAYOUTS.includes(fields.layout)) {
    problems.push(`slide ${number}: unknown layout "${fields.layout}". Use one of: ${LAYOUTS.join(", ")}.`);
  }
  for (const need of REQUIRED[layout] ?? []) {
    if (!fields[need] || (Array.isArray(fields[need]) && !fields[need].length)) {
      problems.push(`slide ${number}: the ${layout} layout needs "${need}:".`);
    }
  }
  return { title, fields, layout, notes, headEnd, problems };
}

/** A sensible layout when talk.md leaves it out. */
export function inferLayout(title, fields) {
  if (fields.video) return "video";
  if (fields.code) return "code";
  if (fields.quote) return "quote";
  if (fields.bars?.length) return "chart";
  if (fields.number) return "number";
  if (fields.left && fields.right) return "compare";
  if (fields.image) return title || fields.text || fields.points?.length ? "split" : "image";
  if (fields.points?.length) return "list";
  if (fields.text) return "text";
  return "statement";
}

/**
 * Reads talk.md. Each block remembers where its notes sit in the file, so an
 * edit from the notes window can replace exactly those lines.
 */
export function parseTalk(source) {
  const text = source.replace(/\r\n/g, "\n");
  const lines = linesOf(text);
  const { settings, next } = readSettings(lines);
  if (!THEMES.includes(settings.theme)) settings.theme = "paper";

  const blocks = [];
  let current = [];
  let inFence = false;
  const flush = () => {
    if (!current.length) return;
    const hasContent = current.some((l) => l.text.trim());
    if (hasContent) {
      const block = readBlock(current, blocks.length + 1);
      blocks.push({
        ...block,
        index: blocks.length,
        start: current[0].start,
        end: current.at(-1).end,
      });
    }
    current = [];
  };
  for (let i = next; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line.text)) inFence = !inFence;
    if (!inFence && SEPARATOR.test(line.text)) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return { settings, blocks, problems: blocks.flatMap((b) => b.problems) };
}

/**
 * Turns blocks into slides. A list with "reveal: yes" becomes one slide per
 * point, so each click shows one more point and every point gets its own beat.
 */
export function buildSlides(talk) {
  const slides = [];
  for (const block of talk.blocks) {
    const reveal = /^(yes|true|one by one|on)$/i.test(block.fields.reveal ?? "");
    const points = block.fields.points ?? [];
    const steps = reveal && points.length > 1 ? points.length : 1;
    for (let step = 1; step <= steps; step++) {
      slides.push({
        block: block.index,
        id: `${block.index + 1}${steps > 1 ? `.${step}` : ""}`,
        title: block.title,
        layout: block.layout,
        fields: block.fields,
        notes: block.notes,
        through: steps > 1 ? step : null,
        steps,
      });
    }
  }
  return slides;
}

/** The title the notes window shows, and the save check compares. */
export function blockLabel(block) {
  return block.title || block.fields.quote || block.fields.number || `Slide ${block.index + 1}`;
}

/**
 * Replaces the notes of one block and leaves everything else in talk.md as it
 * was. `expected` is the label the notes window saw; when the block at that
 * place has another label, talk.md changed since the window opened, so the
 * edit is refused instead of landing on the wrong slide.
 */
export function replaceNotes(source, blockIndex, notes, expected) {
  const text = source.replace(/\r\n/g, "\n");
  const talk = parseTalk(text);
  const block = talk.blocks[blockIndex];
  if (!block) return { ok: false, reason: "missing" };
  if (expected != null && blockLabel(block) !== expected) return { ok: false, reason: "stale" };
  const clean = notes.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const isLast = blockIndex === talk.blocks.length - 1;
  const tail = clean ? `\n${clean}\n${isLast ? "" : "\n"}` : isLast ? "" : "\n";
  // Lines after the notes up to the separator (blank lines) are rewritten too.
  const before = text.slice(0, block.headEnd).replace(/\n*$/, "\n");
  return { ok: true, text: before + tail + text.slice(block.end) };
}

/** Neighbouring blocks with the same layout feel repetitive to an audience. */
export function rhythmProblems(talk) {
  const problems = [];
  for (let i = 1; i < talk.blocks.length; i++) {
    const a = talk.blocks[i - 1];
    const b = talk.blocks[i];
    if (a.layout === b.layout && !["image", "video"].includes(a.layout)) {
      problems.push(`slides ${i} and ${i + 1} both use the ${a.layout} layout. Give one of them another layout.`);
    }
  }
  return problems;
}

/** Gentle content checks: the things that make a slide hard to read. */
export function contentProblems(talk) {
  const problems = [];
  for (const block of talk.blocks) {
    const n = block.index + 1;
    if (block.title.length > 70) problems.push(`slide ${n}: the title has ${block.title.length} characters. Keep it under 70.`);
    const points = block.fields.points ?? [];
    if (points.length > 5) problems.push(`slide ${n}: ${points.length} points. Keep it to 5 or fewer, or split the slide.`);
    for (const p of points) {
      if (p.length > 90) problems.push(`slide ${n}: a point has ${p.length} characters. Keep points under 90.`);
    }
    if ((block.fields.text ?? "").length > 160) problems.push(`slide ${n}: the text line is long. Say the rest in the notes.`);
    if (!block.notes) problems.push(`slide ${n}: no speaker notes yet.`);
  }
  return problems;
}

/** "Label: 42" → { label, value }. */
export function parseBar(line) {
  const match = line.match(/^(.*?):\s*(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { label: line, value: 0, unit: "" };
  return { label: match[1].trim(), value: Number(match[2]), unit: match[3].trim() };
}

/** "Label — text" (or "Label - text", "Label: text") → { label, body }. */
export function parseCard(line) {
  const match = (line ?? "").match(/^(.+?)\s+[—–-]\s+(.+)$/) ?? (line ?? "").match(/^([^:]{1,30}):\s+(.+)$/);
  return match ? { label: match[1].trim(), body: match[2].trim() } : { label: "", body: line ?? "" };
}

/** A media path from talk.md as a URL. Files in media/ are served from the site root. */
export function mediaUrl(path) {
  if (!path) return "";
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:")) return path;
  return "/" + path.replace(/^\.?\/?/, "").replace(/^media\//, "");
}
