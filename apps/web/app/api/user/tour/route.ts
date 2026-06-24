import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_KEYS = ["hasSeenLobbyTour", "hasSeenAuctionTour"] as const;

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let key: string;
  try {
    const body = await req.json();
    key = body.key;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { [key]: true },
  });

  return NextResponse.json({ ok: true });
}
