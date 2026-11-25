// Runs before npm start, check and pdf: installs anything missing, so one command is enough.

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const major = Number(process.versions.node.split(".")[0]);
if (major < 18) {
  console.error(`talk-md needs Node.js 18 or newer, and this computer has ${process.versions.node}. Install the LTS version from https://nodejs.org`);
  process.exit(1);
}
const needed = ["vite", "react", "@vitejs/plugin-react", "playwright", "pdf-lib"];
if (needed.some((name) => !existsSync(path.join(ROOT, "node_modules", name)))) {
  console.log("Installing what talk-md needs (once) …");
  execSync("npm install --no-audit --no-fund", { cwd: ROOT, stdio: "inherit" });
}
