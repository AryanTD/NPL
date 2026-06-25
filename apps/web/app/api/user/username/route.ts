import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let username: string;
  try {
    const body = await req.json();
    username = body.username;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (
    !username ||
    typeof username !== "string" ||
    !username.trim() ||
    username.trim().length > 24
  ) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { username: username.trim() },
  });

  return NextResponse.json({ ok: true });
}
