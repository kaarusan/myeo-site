import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pub = path.join(root, "public");
const cursorSrc = path.join(root, "Cursor");
const cursorDest = path.join(pub, "Cursor");

fs.mkdirSync(pub, { recursive: true });

if (fs.existsSync(cursorDest)) {
  fs.rmSync(cursorDest, { recursive: true, force: true });
}
fs.cpSync(cursorSrc, cursorDest, { recursive: true });

const staleRootIndex = path.join(pub, "index.html");
if (fs.existsSync(staleRootIndex)) {
  fs.rmSync(staleRootIndex, { force: true });
}

// Do NOT copy index.html into public/: it shadows Next.js app/page.tsx on Vercel and
// serves a stale static document instead of /Cursor/* (see vercel.json + app/page.tsx).
const rootStatic = ["admin.html", "customize.html", ".nojekyll"];
for (const name of rootStatic) {
  const from = path.join(root, name);
  const to = path.join(pub, name);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
  }
}

const overloadTpl = path.join(root, "security-templates", "overload.html");
const overloadOut = path.join(pub, "overload.html");
if (fs.existsSync(overloadTpl)) {
  fs.copyFileSync(overloadTpl, overloadOut);
}

console.log("sync-public: public/ updated from Cursor/ and root static files.");
