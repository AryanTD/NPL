import { NextResponse } from "next/server";

export async function GET() {
  const serverUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${serverUrl}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json({ ok: true, server: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
