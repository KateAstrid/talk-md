import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { replaceNotes } from "./engine/talk/format.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TALK = path.join(ROOT, "talk.md");

/** Only the deck itself may save: JSON only, and never from another site. */
function fromThisDeck(req) {
  const type = req.headers["content-type"] ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/**
 * Edits from the notes window save into talk.md while the talk runs with
 * `npm start`. A save leaves the open deck alone, so nothing jumps mid-talk;
 * any other change to talk.md reloads the deck.
 */
function notesEdits() {
  // The exact text this server last wrote. Any other change to talk.md, even
  // a second later, reloads the deck as usual.
  let ownText = null;
  let queue = Promise.resolve();
  return {
    name: "talk-notes",
    configureServer(server) {
      server.middlewares.use("/__notes", async (req, res) => {
        if (req.method !== "POST") return void ((res.statusCode = 405), res.end());
        if (!fromThisDeck(req)) return void ((res.statusCode = 403), res.end());
        try {
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const { block, notes, label } = JSON.parse(raw);
          if (!Number.isInteger(block) || block < 0 || typeof notes !== "string") throw new Error("Expected { block, notes, label }");
          let result;
          const save = queue.then(async () => {
            result = replaceNotes(await readFile(TALK, "utf8"), block, notes, typeof label === "string" ? label : undefined);
            if (!result.ok) return;
            ownText = result.text;
            await writeFile(TALK, result.text);
          });
          queue = save.catch(() => {});
          await save;
          res.statusCode = result.ok ? 204 : result.reason === "stale" ? 409 : 404;
          res.end();
        } catch (error) {
          res.statusCode = 400;
          res.end(String(error));
        }
      });
    },
    async handleHotUpdate({ file, modules, server, read }) {
      if (file !== TALK || ownText == null) return;
      const text = await read();
      if (text !== ownText) return;
      ownText = null;
      modules.forEach((mod) => server.moduleGraph.invalidateModule(mod));
      return [];
    },
  };
}

export default defineConfig({
  plugins: [react(), notesEdits()],
  publicDir: "media",
  server: { port: 5180 },
  preview: { port: 5180 },
});
