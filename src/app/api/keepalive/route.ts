import { NextResponse } from "next/server";

// Free-tier Supabase projects pause after ~7 days without activity. A daily
// Vercel Cron (see vercel.json) pings this route, which makes one lightweight
// request to the project so it never looks idle. Nothing here needs a signed-in
// user — the request itself is what keeps the project awake.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars not set" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${url}/rest/v1/books?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok, status: res.status, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 502 }
    );
  }
}
