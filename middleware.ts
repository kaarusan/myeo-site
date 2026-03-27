import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RL_WINDOW_MS = 60_000;
const RL_API_MAX = 120;
const RL_LOGIN_MAX = 40;
const RL_GENERAL_MAX = 300;

type Bucket = { hits: number[] };

type GlobalRl = typeof globalThis & { __myeoRlBuckets?: Map<string, Bucket> };

function getStore(): Map<string, Bucket> {
  const g = globalThis as GlobalRl;
  if (!g.__myeoRlBuckets) {
    g.__myeoRlBuckets = new Map();
  }
  return g.__myeoRlBuckets;
}

function clientIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function rateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const store = getStore();
  let b = store.get(key);
  if (!b) {
    b = { hits: [] };
    store.set(key, b);
  }
  b.hits = b.hits.filter((t) => now - t < RL_WINDOW_MS);
  b.hits.push(now);
  if (b.hits.length > max * 2) {
    b.hits = b.hits.slice(-max);
  }
  return b.hits.length <= max;
}

const SUSPICIOUS_UA =
  /\b(curl|wget|python-requests|aiohttp|scrapy|httpclient|java\/|go-http|libwww|okhttp)\b/i;

const HEADLESS_HINT =
  /\b(headlesschrome|phantomjs|selenium|puppeteer|playwright)\b/i;

function isSensitivePath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return (
    p.startsWith("/api/") ||
    p.includes("/login") ||
    p.includes("auth") ||
    p.includes("/admin")
  );
}

function isLoginPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return p.endsWith("/login.html") || p.endsWith("/cursor/login.html") || p === "/login";
}

export function middleware(req: NextRequest) {
  const ip = clientIp(req);
  const pathname = req.nextUrl.pathname;
  const ua = req.headers.get("user-agent") || "";

  if (HEADLESS_HINT.test(ua) && isSensitivePath(pathname)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (SUSPICIOUS_UA.test(ua) && (pathname.startsWith("/api/") || isLoginPath(pathname))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let max = RL_GENERAL_MAX;
  if (pathname.startsWith("/api/")) max = RL_API_MAX;
  else if (isLoginPath(pathname)) max = RL_LOGIN_MAX;

  const key = `${ip}:${pathname.startsWith("/api/") ? "api" : pathname}`;
  if (!rateLimit(key, max)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "60",
        "Cache-Control": "no-store",
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/Cursor/login.html",
    "/login",
    "/Cursor/admin.html",
    "/admin.html",
  ],
};
