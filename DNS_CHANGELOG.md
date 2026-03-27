## DNS Operations Log

Date: 2026-03-27
Domain: `myeo.io`

### What was changed

- Cloudflare DNS `A` record for `@` set to `76.76.21.21` with proxy disabled.
- Cloudflare DNS record for `www` set to `A 76.76.21.21` with proxy disabled.
- Existing `www` record(s) were removed before creating the final `A` record to avoid conflicts.

### Verification snapshots

- `nslookup myeo.io 1.1.1.1` resolves to `76.76.21.21`
- `nslookup www.myeo.io 1.1.1.1` resolves to `76.76.21.21`
- `curl -I https://myeo.io` returns `HTTP/1.1 200 OK` from Vercel
- `curl -I https://www.myeo.io` returns `HTTP/1.1 307 Temporary Redirect` to `https://myeo.io/`

### Notes

- Nameservers remain on Cloudflare (`cartman.ns.cloudflare.com`, `tara.ns.cloudflare.com`).
- Vercel continues serving the site successfully at the apex domain.
