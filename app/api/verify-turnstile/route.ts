import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "edge";

const bodySchema = z.object({
  token: z.string().min(1).max(8000).optional(),
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
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  const required = process.env.TURNSTILE_REQUIRED === "true";

  if (!secret) {
    if (required) {
      return NextResponse.json({ ok: false, error: "turnstile_misconfigured" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, skipped: true });
  }

  const token = parsed.data.token;
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 });
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);

  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  let verifyJson: { success?: boolean } = {};
  try {
    verifyJson = await verifyRes.json();
  } catch {
    return NextResponse.json({ ok: false, error: "verify_parse" }, { status: 502 });
  }

  if (!verifyJson.success) {
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
