import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const destDir = path.join(root, "public", "Cursor");

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.MYEO_SUPABASE_URL ||
  "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.MYEO_SUPABASE_ANON_KEY ||
  "";
const turnstileSite =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  process.env.MYEO_TURNSTILE_SITE_KEY ||
  "";

fs.mkdirSync(destDir, { recursive: true });

const supabaseDest = path.join(destDir, "supabase-config.js");
const hasFullSupabaseEnv = Boolean(url && anonKey);
if (hasFullSupabaseEnv) {
  const supabaseOut = `// Generated at build time by scripts/inject-public-config.mjs — do not commit secrets.
window.MYEO_SUPABASE = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
};
`;
  fs.writeFileSync(supabaseDest, supabaseOut, "utf8");
} else if (fs.existsSync(supabaseDest)) {
  console.log("inject-public-config: keeping synced Cursor/supabase-config.js");
} else {
  fs.writeFileSync(
    supabaseDest,
    `window.MYEO_SUPABASE = { url: "", anonKey: "" };\n`,
    "utf8"
  );
}

const turnstileOut = `// Generated at build time by scripts/inject-public-config.mjs
window.MYEO_TURNSTILE_SITE_KEY = ${JSON.stringify(turnstileSite)};
`;
fs.writeFileSync(path.join(destDir, "turnstile-runtime.js"), turnstileOut, "utf8");

console.log("inject-public-config: supabase + turnstile runtime written under public/Cursor/");
