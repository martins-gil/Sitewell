import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchAll } from "@/lib/search";

// The top-bar search box. The middleware doesn't cover /api, so the session is
// checked here; the queries themselves run inside the caller's tenant context.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const results = await searchAll(q.slice(0, 200), 5);
    return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
