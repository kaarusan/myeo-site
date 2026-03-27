import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "edge";

const eventSchema = z.object({
  type: z.enum([
    "login_failed",
    "two_factor_failed",
    "signup_failed",
    "rate_limited_client",
    "honeypot_trip",
    "turnstile_failed",
  ]),
});

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return true;
  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event: "security",
    type: parsed.data.type,
  });
  console.info(line);

  return NextResponse.json({ ok: true });
}
