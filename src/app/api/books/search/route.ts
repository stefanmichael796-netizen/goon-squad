import { NextRequest, NextResponse } from "next/server";
import { searchBooks } from "@/lib/google-books";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const result = await searchBooks(q);
  if (!result.ok) {
    return NextResponse.json({ items: [], error: result.error }, { status: 200 });
  }
  return NextResponse.json({ items: result.items });
}
