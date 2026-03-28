import { NextResponse } from "next/server";

/** Use GET https://myeo.io/api/health — if this 404s, the domain is not mapped to this Next.js project. */
export function GET() {
  return NextResponse.json({ ok: true, app: "myeo", ts: Date.now() });
}
