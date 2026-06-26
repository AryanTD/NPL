# Task: Keep Render Server Warm with Vercel Cron

## Problem
Render free tier spins down after 15 min inactivity → 30–60s cold start → breaks real-time auction experience.

## Solution
Vercel Cron Job pings the server every 10 minutes. Free, no extra services.

The server already has `GET /health` at `apps/server/src/index.ts:52`.

## Files to create

### `apps/web/app/api/ping/route.ts`
```ts
import { NextResponse } from "next/server";

export async function GET() {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${serverUrl}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json({ ok: true, server: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

### `apps/web/vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/ping",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

## Verification
1. Deploy to Vercel
2. Vercel dashboard → project → **Cron Jobs** tab — `/api/ping` should appear
3. Click "Run" to manually trigger — should return `{ ok: true, server: { ok: true, ts: "..." } }`
4. Wait 20+ min without using the app, then create a lobby — no cold start delay
