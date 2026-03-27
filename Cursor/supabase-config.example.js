// Local dev: copy to `supabase-config.js` (gitignored) or set env vars for builds.
// Production (Vercel): set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY;
// `npm run build` generates public/Cursor/supabase-config.js via scripts/inject-public-config.mjs.
window.MYEO_SUPABASE = {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};
