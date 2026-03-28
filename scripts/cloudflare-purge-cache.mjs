/**
 * Purge Cloudflare cache for myeo.io (optional CI step).
 * Set CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN (Cache Purge: Edit) in GitHub Actions secrets.
 * If unset, exits 0 without doing anything.
 */
import process from "node:process";

const zone = process.env.CLOUDFLARE_ZONE_ID?.trim();
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const urls = (process.env.MYEO_PURGE_URLS ||
  "https://myeo.io/,https://www.myeo.io/,https://myeo.io/Cursor/index.html,https://www.myeo.io/Cursor/index.html")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!zone || !token) {
  console.log("cloudflare-purge-cache: skipped (no CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN)");
  process.exit(0);
}

const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ files: urls }),
});

const body = await res.json().catch(() => ({}));
if (!res.ok || body.success === false) {
  console.error("cloudflare-purge-cache: failed", res.status, JSON.stringify(body));
  process.exit(1);
}

console.log("cloudflare-purge-cache: ok", urls.length, "URLs");
