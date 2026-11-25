// The deck: a fixed 1280 × 720 stage that the browser scales to any window.
// One click, one slide. The address bar names the slide, so links, reloads
// and the back button all land on the right one.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isTypingInNotes, paintNotes, writeNotes } from "./Notes.jsx";
import { SlideBody } from "./Slide.jsx";
import { CHANNEL, HEIGHT, WIDTH, problems, settings, slides } from "./talk.js";

const THUMB = new URLSearchParams(window.location.search).has("thumb");

/** Clicks on these stay on the slide, so a live demo can take a click. */
const INTERACTIVE = "button, a, input, select, textarea, label, video, [data-interactive]";

function readIndex() {
  const n = Number(window.location.hash.replace("#", ""));
  return Number.isInteger(n) && n >= 1 && n <= slides.length ? n - 1 : 0;
}

/** Replays a key pressed in the notes window on the deck window. */
function forwardKey(key) {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function useFit() {
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const measure = () => setFit(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return fit;
}

function Problems() {
  const [open, setOpen] = useState(true);
  if (!import.meta.env.DEV || THUMB || !problems.length || !open) return null;
  return (
    <div className="problems" data-interactive onClick={(e) => e.stopPropagation()}>
      <strong>talk.md needs a look</strong>
      <ul>
        {problems.slice(0, 6).map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <button type="button" onClick={() => setOpen(false)}>
        Hide
      </button>
    </div>
  );
}

export function Deck() {
  const [index, setIndex] = useState(readIndex);
  const fit = useFit();
  const notesRef = useRef(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const slide = slides[index];

  const goTo = useCallback((next) => setIndex(Math.max(0, Math.min(slides.length - 1, next))), []);

  const opening = useRef(false);
  const openNotes = useCallback(async () => {
    const existing = notesRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }
    if (opening.current) return;
    opening.current = true;
    try {
      const pip = window.documentPictureInPicture;
      if (pip) {
        const win = await pip.requestWindow({ width: Math.min(1100, window.screen.availWidth - 48), height: 300 });
        notesRef.current = win;
        paintNotes(win);
        writeNotes(win, indexRef.current);
        win.addEventListener("keydown", (event) => {
          if (isTypingInNotes(event)) return;
          if (forwardKey(event.key)) event.preventDefault();
        });
        win.addEventListener("pagehide", () => {
          if (notesRef.current === win) notesRef.current = null;
        });
        return;
      }
    } catch {
      /* No floating window here; open a normal one below. */
    } finally {
      opening.current = false;
    }
    const url = `${window.location.origin}${window.location.pathname}?notes=1`;
    notesRef.current = window.open(url, CHANNEL, "popup=yes,width=1100,height=300");
  }, []);

  // The notes follow the deck.
  useEffect(() => {
    if (THUMB) return;
    const win = notesRef.current;
    if (win && !win.closed) writeNotes(win, index);
    const channel = new BroadcastChannel(CHANNEL);
    const post = () => channel.postMessage({ index });
    post();
    channel.onmessage = (event) => {
      if (event.data?.type === "hello") post();
      if (event.data?.type === "key") forwardKey(event.data.key);
    };
    return () => channel.close();
  }, [index]);

  // Keyboard and presenter clickers.
  useEffect(() => {
    if (THUMB) return;
    const onKey = (event) => {
      const target = event.target;
      const inControl = Boolean(target?.closest?.(INTERACTIVE));
      const inField = Boolean(target?.closest?.("textarea, input, select"));
      const key = event.key;
      if (inField && key !== "PageUp" && key !== "PageDown") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (key === "n" || key === "N") {
        event.preventDefault();
        void openNotes();
        return;
      }
      if (key === "f" || key === "F") {
        event.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen?.();
        else void document.documentElement.requestFullscreen?.();
        return;
      }
      const forward =
        key === "ArrowRight" || key === "ArrowDown" || key === "PageDown" || key === "MediaTrackNext" || ((key === " " || key === "Enter") && !inControl);
      const back = key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp" || key === "MediaTrackPrevious" || key === "Backspace";
      if (forward) {
        event.preventDefault();
        goTo(indexRef.current + 1);
      } else if (back) {
        event.preventDefault();
        goTo(indexRef.current - 1);
      } else if (key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (key === "End") {
        event.preventDefault();
        goTo(slides.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, openNotes]);

  useEffect(() => {
    const sync = () => setIndex(readIndex());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const hash = `#${index + 1}`;
    if (THUMB || window.location.hash === hash) return;
    if (!window.location.hash) window.history.replaceState(null, "", hash);
    else window.history.pushState(null, "", hash);
  }, [index]);

  // For the check and PDF scripts.
  useEffect(() => {
    window.__talk = { slides: slides.map((s) => ({ id: s.id, layout: s.layout, block: s.block })), problems };
  }, []);

  useEffect(() => {
    document.title = `${index + 1} · ${settings.title}`;
  }, [index]);

  if (!slide) {
    return (
      <div className="deck empty">
        <p>talk.md has no slides yet. Add a block that starts with "# A title".</p>
      </div>
    );
  }

  const showFooter = slide.layout !== "cover" && slide.layout !== "image" && slide.layout !== "video";
  return (
    <div className="deck" data-thumb={THUMB || undefined} data-theme={settings.theme} style={settings.accent ? { "--accent": settings.accent } : undefined}>
      <div
        className="deck-stage"
        style={{ width: WIDTH, height: HEIGHT, "--fit": fit }}
        onClick={(event) => {
          if (THUMB || event.target.closest(INTERACTIVE)) return;
          goTo(index + 1);
        }}
      >
        <article
          // A slide that reveals points keeps one element, so the points on screen stay put.
          key={slide.steps > 1 ? `block-${slide.block}` : slide.id}
          className="slide"
          data-layout={slide.layout}
          data-slide={index + 1}
          aria-label={slide.title || slide.fields.text || slide.layout}
        >
          {slide.fields.section ? <p className="section">{slide.fields.section}</p> : null}
          <SlideBody slide={slide} />
          {showFooter ? (
            <footer className="footer">
              <span>{settings.footer || settings.speaker}</span>
              <span className="footer-title">{settings.title}</span>
              <span className="footer-num">
                {index + 1} / {slides.length}
              </span>
            </footer>
          ) : null}
        </article>
      </div>
      <Problems />
    </div>
  );
}
