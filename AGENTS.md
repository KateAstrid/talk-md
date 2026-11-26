# Instructions for AI agents

This folder turns one Markdown file, `talk.md`, into a presentation that runs in the browser. It has speaker notes, clicker support, and a PDF export. The person you are helping may not code. Your job is to write `talk.md` from what they give you, check it, and open it in the browser for them.

## 0. How to behave in this folder

The person will never mention this file. They just say what they want, in plain words: "make a talk about our new feature", "turn these notes into slides", "I'm speaking at a meetup on Friday", or they paste an outline. Treat any message like that as the start of the workflow in section 2, and run it from start to finish without waiting for more instructions.

- **Do every technical step yourself.** Install, check and start the talk on your own. Never ask the person to type a command, open a terminal, or edit a file.
- **Keep the talk open and live.** Start it once in the background (`npm start`), and leave it running. Every later change to `talk.md` shows up in the open browser tab by itself, so the person watches the talk take shape as you work.
- **Talk about the talk, not the tooling.** Say what you changed on which slide ("Slide 4 now has the chart"), and skip file names and commands unless they ask.
- **Handle PDF and website requests the same way.** "Can I get a PDF?", "the organisers want the slides", "send me the deck as a file": run `npm run pdf` yourself and tell them where the file is (`export/talk.pdf`). "Put it online" or "make a website": run `npm run build` and explain how to upload `dist/`.
- **If the first message is only a greeting or unclear,** answer in one or two friendly sentences: *"Hi! Tell me what your talk is about, who it's for, and how long it should be. Paste any notes you have, and I'll turn them into slides and open them for you."*

**The only files you normally touch:** `talk.md`, and pictures or videos in `media/`. Leave `engine/` alone unless the person asks for a change to the engine itself.

## 1. Set up (do it yourself, quietly)

If the person shared the talk-md link and you are not inside this folder yet, run `git clone https://github.com/KateAstrid/talk-md`, move into the new `talk-md` folder, and do everything there. Their first message already says what talk they want, so go on with it.

1. Run `node -v`. It must print v18 or newer. Only if Node is missing, ask the person to install the LTS version from https://nodejs.org (one click on their side), then continue.
2. Run `npm install` if `node_modules/` is missing. `npm start`, `npm run check` and `npm run pdf` also install anything missing on their own.

## 2. Make a talk

When the person asks for a presentation:

1. **Collect what you need.** Use what they already gave you: text, notes, an outline, links, pictures. Ask at most three short questions, and only for things you cannot guess: who the audience is, how long the talk is, and the one idea people should remember. When something is missing, pick a sensible default and say which one you picked.
2. **Learn their voice.** If there is a `STYLE.md`, read it and follow it. If there is none, ask once, in the same message as your other questions: *"How do you like to sound on stage? Describe it in a sentence, or paste something you wrote, and I'll save it as your style so every talk sounds like you. Or say 'skip'."* Turn the answer into a few short rules in `STYLE.md` (start from `STYLE.example.md`), show them to the person, and keep going. If they skip, use plain, spoken sentences.
3. **Plan the talk.** Allow about one slide per 30 to 45 seconds of speaking. A 10-minute talk has roughly 15 to 20 slides. Give it a shape: an opening, a few main ideas with one slide each, and a close.
4. **Write `talk.md`.** Follow the format in section 4 and the rules in section 3. Replace the whole example file. A copy of the example stays in `engine/example-talk.md` for reference.
5. **Put pictures in `media/`.** Use the person's own files. Refer to them by file name, for example `image: team-photo.jpg`. Never invent file names; a slide with a missing picture fails the check.
6. **Run `npm run check`.** Fix every line marked ✗ and run it again until it says "Ready to present". Lines marked · are tips: follow them when they make sense.
7. **Start the talk.** Run `npm start` in the background, so it keeps running while you work. It opens the talk in the person's browser. Tell them it's open and how to present (section 6). If it is already running from earlier, leave it: the open tab updates by itself.
8. **Change things on request.** Edit `talk.md` and run `npm run check`. The open browser tab reloads by itself, so the person sees each change at once.
9. **Remember how they like to sound.** When the person corrects your wording ("I'd never say it like that", "too formal", "don't use that word"), fix the line, then add the preference to `STYLE.md` as one short rule, and tell them you saved it. That way every later slide and every later talk sounds more like them.

## 3. Rules for good slides

These are general guidelines for slides that are easy to follow. Follow them unless the person asks otherwise.

- **One idea per slide.** People can hold only a few things in mind at once. Split a slide that tries to say two things.
- **Short words on the slide, the rest out loud.** People learn more when the speaker says the words than when they read them on screen. The title says the point in under 70 characters. Everything else goes into the notes.
- **At most five points on a list.** Use `reveal: yes` when the points should appear one by one.
- **Vary the layouts.** Two slides in a row with the same layout feel repetitive. The check flags this.
- **Write notes in the speaker's own voice.** The speaker reads them aloud, so they should sound like that person talking. Learn the voice from the person's own writing or from `STYLE.md` (below). Without either, use plain, spoken sentences.
- **Use only real facts.** Take numbers, quotes, names and stories from the person's material. Never invent them. If a slide needs a fact you do not have, ask, or leave the slide out.
- **Motion and pictures serve the point.** Add an image, a chart or a video when it shows something the words cannot.

### The speaker's own style

If this folder has a `STYLE.md`, follow it for every word in `talk.md`: the slides and the notes. It holds the person's own preferences, such as tone, words to use or avoid, and how formal to be. Its rules win over the guidelines above. To start one, copy `STYLE.example.md` to `STYLE.md` and fill it in with the person.

## 4. The talk.md format

The file starts with settings between two `---` lines. Then come the slides, separated by lines that hold only `---`.

```markdown
---
title: The talk's title
speaker: The speaker's name
event: Where the talk happens
theme: paper
---

# The slide title
layout: list
points:
- First point
- Second point

Everything after the first empty line is the speaker notes.
They can run over several paragraphs.

---

# The next slide
layout: statement

More notes.
```

Each slide is:

1. An optional title line that starts with `# `.
2. Field lines, `name: value`, one per line, with no empty line between them. List fields (`points`, `bars`) take `- item` lines below them.
3. An empty line, then the speaker notes.

### Settings

| Setting | What it does |
| --- | --- |
| `title` | The talk's title, shown in the footer and the browser tab. |
| `speaker` | The speaker's name, shown on the cover and in the footer. |
| `event` | A small label on the cover, such as the conference name. |
| `theme` | `paper` (warm, playful), `night` (dark), or `clean` (white, minimal). |
| `accent` | Optional accent colour, such as `"#e4572e"`. |
| `footer` | Optional text for the footer's left corner, in place of the speaker's name. |

### Layouts and their fields

| Layout | Use it for | Fields |
| --- | --- | --- |
| `cover` | The first slide | title, `subtitle`, optional `image` |
| `statement` | One sentence to remember | title, optional `text` |
| `text` | A title with one short line, optional points | title, `text`, `points` |
| `list` | Numbered points | title, `points`, `reveal: yes` to show one point per click |
| `split` | A picture, video or code next to words | title, `text`, `points`, and one of `image` / `video` / `code`; `side: right` puts the picture on the right |
| `image` | A picture that fills the slide | `image`, optional title and `caption` |
| `quote` | A quote | `quote`, `by` |
| `compare` | Two things side by side | title, `left`, `right`, each written as `Label — text` |
| `code` | A code example | title, optional `text`, `lang`, `code` (see below) |
| `video` | A video that fills the slide, muted and looping | `video`, optional title as a caption |
| `chart` | Bars from numbers | title, optional `text`, `bars` as `- Label: number` lines, optional `caption` |
| `number` | One big number | `number`, `label`, optional `text` |
| `closing` | The last slide | title (defaults to "Thank you"), `text`, `link`, optional `image` such as a QR code |

Any slide can also have `section: Part name`, which shows a small label in the corner.

Leave out `layout:` and the engine picks one: a slide with `points` becomes a list, a slide with `image` and a title becomes a split, and so on. Writing it explicitly is clearer.

Code goes in a fenced block right after `code:`:

````markdown
# Calling the API
layout: code
lang: javascript
code:
```
const res = await fetch("/api/users");
```

Notes for this slide.
````

## 5. Commands

| Command | What it does |
| --- | --- |
| `npm start` | Opens the talk in the browser. Edits to `talk.md` show up at once. |
| `npm run check` | Checks `talk.md` and every slide in a browser. Run it after every change. |
| `npm run pdf` | Saves `export/talk.pdf`, one page per slide. |
| `npm run build` | Builds a static website in `dist/` that any host can serve. |
| `npm test` | Tests the engine itself. Run it after changing anything in `engine/`. |

`npm run check` and `npm run pdf` need Google Chrome. Without it, run `npx playwright install chromium` once.

## 6. Tell the person how to present

- **Next slide:** the right arrow, the space bar, a click on the slide, or a presentation clicker.
- **Previous slide:** the left arrow.
- **Speaker notes:** press **N**. In Chrome, the notes open in a small window that stays on top of everything, so it can sit right under the camera on a video call. They show the notes for this slide and a preview of the next one. The notes are editable: a change saves straight into `talk.md`.
- **Full screen:** press **F**.
- **A link to any slide:** the number after `#` in the address bar is the slide number.
- **Online talks:** share only the browser tab with the slides, and keep the notes window for yourself.
