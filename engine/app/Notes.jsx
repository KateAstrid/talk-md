// The speaker notes: a small window that floats above every other window
// (Chrome's Document Picture-in-Picture), with a popup as the fallback. It
// shows the notes for the slide on screen and a preview of the next slide.
// The notes are editable, and edits save into talk.md.

import { useEffect, useRef, useState } from "react";
import { CHANNEL, HEIGHT, WIDTH, kickerFor, labelFor, notesFor, saveNotes, slides } from "./talk.js";

const NEXT_W = 224;
const NEXT_SCALE = NEXT_W / WIDTH;

const STATUS = {
  idle: "Click the text to edit",
  editing: "Unsaved · saves when you click away",
  saving: "Saving…",
  saved: "Saved to talk.md",
  failed: "Kept here only; talk.md is unchanged",
  stale: "talk.md changed since this window opened · close it and press N",
};

const CSS = `
  html, body { margin: 0; height: 100%; background: #0c1018; color: #f4f7fb; }
  body { font-family: "Inter", system-ui, sans-serif; }
  .notes-app { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; padding: 0.75rem 1.15rem 0.9rem; }
  .notes-hint { margin: 0 0 0.3rem; font-size: 0.7rem; color: #9aa6b8; }
  .notes-top { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  .notes-kicker { margin: 0 0 0.35rem; font-size: 0.8rem; font-weight: 700; color: #7dd3fc; }
  .notes-status { font-size: 0.7rem; color: #9aa6b8; white-space: nowrap; }
  .notes-status[data-state="failed"], .notes-status[data-state="stale"] { color: #fca5a5; }
  .notes-main { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  .notes-body { margin: 0; flex: 0 1 auto; min-height: 0; overflow: auto; white-space: pre-wrap; font-size: 1rem; line-height: 1.45; }
  .notes-body[contenteditable] { outline: none; border-radius: 6px; padding: 0.15rem 0.35rem; margin-inline: -0.35rem; caret-color: #7dd3fc; }
  .notes-body[contenteditable]:focus { background: rgba(125, 211, 252, 0.06); box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.35); }
  @media (max-height: 360px) and (min-aspect-ratio: 2/1) { .notes-main { flex-direction: row; gap: 1.1rem; } }
  .notes-next { flex: 0 0 auto; align-self: flex-end; display: flex; flex-direction: column; gap: 0.3rem; width: ${NEXT_W}px; }
  .notes-next-label { margin: 0; font-size: 0.7rem; font-weight: 600; color: #9aa6b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notes-next-frame { position: relative; width: ${NEXT_W}px; height: ${(NEXT_W * 9) / 16}px; overflow: hidden; border-radius: 6px; background: #090b10; box-shadow: 0 0 0 1px rgba(255,255,255,0.14); }
  .notes-next-frame iframe { position: absolute; top: 0; left: 0; width: ${WIDTH}px; height: ${HEIGHT}px; border: 0; transform: scale(${NEXT_SCALE}); transform-origin: top left; pointer-events: none; }
  .notes-next-end { display: grid; place-items: center; height: 100%; font-size: 0.75rem; color: #9aa6b8; }
`;

function nextLabel(index) {
  const next = index + 1;
  if (next >= slides.length) return "End of the talk";
  return `Next · ${next + 1} · ${labelFor(next)}`;
}

function thumbUrl(slideNumber) {
  return `${window.location.origin}${window.location.pathname}?thumb=1#${slideNumber}`;
}

/** While the text has focus, only Page Up / Page Down still move the slides. */
export function isTypingInNotes(event) {
  return Boolean(event.target?.isContentEditable) && event.key !== "PageUp" && event.key !== "PageDown";
}

/** Makes one notes body editable. Edits save when the text loses focus. */
function makeEditable(body, slideIndex, setStatus) {
  body.contentEditable = "plaintext-only";
  body.spellcheck = true;
  let dirty = -1;
  const flush = async () => {
    if (dirty < 0) return;
    const index = dirty;
    dirty = -1;
    setStatus("saving");
    setStatus(await saveNotes(index, body.innerText));
  };
  const onInput = () => {
    dirty = slideIndex();
    setStatus("editing");
  };
  const doc = body.ownerDocument;
  const onOutsideClick = (event) => {
    if (doc.activeElement !== body || body.contains(event.target)) return;
    event.preventDefault();
    doc.getSelection()?.removeAllRanges();
    body.blur();
  };
  const win = doc.defaultView;
  body.addEventListener("input", onInput);
  body.addEventListener("blur", flush);
  doc.addEventListener("mousedown", onOutsideClick, true);
  win?.addEventListener("blur", flush);
  win?.addEventListener("pagehide", flush);
  return {
    flush,
    dispose() {
      body.removeEventListener("input", onInput);
      body.removeEventListener("blur", flush);
      doc.removeEventListener("mousedown", onOutsideClick, true);
      win?.removeEventListener("blur", flush);
      win?.removeEventListener("pagehide", flush);
    },
  };
}

/** Grows or shrinks the notes window to its text, up to the screen height. */
function fitWindow(win) {
  win.requestAnimationFrame(() => {
    const doc = win.document;
    const app = doc.querySelector(".notes-app");
    const main = doc.querySelector(".notes-main");
    const body = doc.querySelector(".notes-body");
    const next = doc.querySelector(".notes-next");
    if (!app || !main || !body || !next) return;
    if (win.getComputedStyle(main).flexDirection === "row") return;
    const gap = parseFloat(win.getComputedStyle(main).rowGap) || 0;
    const pad = parseFloat(win.getComputedStyle(app).paddingBottom) || 0;
    const content = main.getBoundingClientRect().top + body.scrollHeight + gap + next.offsetHeight + pad;
    const chrome = win.outerHeight - win.innerHeight;
    const target = Math.round(Math.min(Math.max(content + chrome, 240), win.screen.availHeight - 40));
    if (Math.abs(target - win.outerHeight) < 4) return;
    try {
      win.resizeTo(win.outerWidth, target);
    } catch {
      /* Some windows only resize after a click inside them. */
    }
  });
}

function writeNext(doc, index) {
  const label = doc.querySelector(".notes-next-label");
  const frame = doc.querySelector(".notes-next-frame");
  if (label) label.textContent = nextLabel(index);
  if (!frame) return;
  const next = index + 2;
  if (next > slides.length) {
    frame.innerHTML = `<div class="notes-next-end">That was the last slide.</div>`;
    return;
  }
  let iframe = frame.querySelector("iframe");
  if (!iframe) {
    frame.innerHTML = "";
    iframe = doc.createElement("iframe");
    iframe.title = "Next slide";
    iframe.tabIndex = -1;
    iframe.src = thumbUrl(next);
    frame.appendChild(iframe);
    return;
  }
  try {
    iframe.contentWindow.location.hash = `#${next}`;
  } catch {
    iframe.src = thumbUrl(next);
  }
}

const flushers = new WeakMap();

/** Fills a floating notes window that the deck opened. */
export function paintNotes(win) {
  const doc = win.document;
  doc.documentElement.dataset.notes = "1";
  doc.head.innerHTML = `<style>${CSS}</style>`;
  doc.body.innerHTML = `
    <div class="notes-app">
      <p class="notes-hint">Drag this under the camera, and share only the deck tab.</p>
      <div class="notes-top"><p class="notes-kicker"></p><span class="notes-status">${STATUS.idle}</span></div>
      <div class="notes-main">
        <div class="notes-body"></div>
        <div class="notes-next"><p class="notes-next-label"></p><div class="notes-next-frame"></div></div>
      </div>
    </div>`;
  const body = doc.querySelector(".notes-body");
  const status = doc.querySelector(".notes-status");
  const { flush } = makeEditable(body, () => Number(body.dataset.slide), (state) => {
    status.dataset.state = state;
    status.textContent = STATUS[state];
  });
  flushers.set(win, flush);
}

export function writeNotes(win, index) {
  if (win.document.documentElement.dataset.notes !== "1") return;
  if (!flushers.has(win)) paintNotes(win);
  const kicker = win.document.querySelector(".notes-kicker");
  const body = win.document.querySelector(".notes-body");
  if (kicker) kicker.textContent = kickerFor(index);
  if (body && body.dataset.slide !== String(index)) {
    void flushers.get(win)?.();
    body.dataset.slide = String(index);
    body.textContent = notesFor(index);
    body.scrollTop = 0;
  }
  writeNext(win.document, index);
  fitWindow(win);
}

/** The popup version (?notes=1), for browsers without floating windows. */
export function NotesPage() {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("idle");
  const bodyRef = useRef(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const flushRef = useRef(async () => {});

  useEffect(() => {
    const editor = makeEditable(bodyRef.current, () => indexRef.current, setStatus);
    flushRef.current = editor.flush;
    return () => editor.dispose();
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    body.textContent = notesFor(index);
    body.scrollTop = 0;
    fitWindow(window);
  }, [index]);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: "hello" });
    const onKey = (event) => {
      if (event.key === "Tab" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingInNotes(event)) return;
      event.preventDefault();
      channel.postMessage({ type: "key", key: event.key });
    };
    window.addEventListener("keydown", onKey);
    channel.onmessage = (event) => {
      const next = event.data?.index;
      if (typeof next === "number" && next >= 0 && next < slides.length && next !== indexRef.current) {
        void flushRef.current();
        setIndex(next);
      }
    };
    return () => {
      window.removeEventListener("keydown", onKey);
      channel.close();
    };
  }, []);

  return (
    <div className="notes-app">
      <style>{CSS}</style>
      <div className="notes-top">
        <p className="notes-kicker">{kickerFor(index)}</p>
        <span className="notes-status" data-state={status}>
          {STATUS[status]}
        </span>
      </div>
      <div className="notes-main">
        <div className="notes-body" ref={bodyRef} />
        <div className="notes-next">
          <p className="notes-next-label">{nextLabel(index)}</p>
          <div className="notes-next-frame">
            {index + 2 <= slides.length ? (
              <iframe
                ref={(el) => {
                  if (el?.contentWindow && el.src) el.contentWindow.location.hash = `#${index + 2}`;
                }}
                title="Next slide"
                tabIndex={-1}
                src={thumbUrl(index + 2)}
              />
            ) : (
              <div className="notes-next-end">That was the last slide.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
