import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "edge";

const passwordSchema = z
  .string()
  .min(12, "min_length")
  .max(256, "max_length")
  .regex(/[a-z]/, "lowercase")
  .regex(/[A-Z]/, "uppercase")
  .regex(/[0-9]/, "digit")
  .regex(/[^A-Za-z0-9]/, "symbol");

const bodySchema = z.object({
  password: z.string().min(1).max(512),
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
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const r = passwordSchema.safeParse(parsed.data.password);
  if (!r.success) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
