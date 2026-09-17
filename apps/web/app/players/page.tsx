import { prisma } from "@/lib/prisma";
import PlayersClient from "./PlayersClient";

export default async function PlayersPage() {
  const players = await prisma.player.findMany({
    where: { season: 2024 },
    orderBy: { quality: "desc" },
    select: {
      id: true,
      name: true,
      category: true,
      role: true,
      quality: true,
      basePrice: true,
      isMarquee: true,
      matches: true,
      runs: true,
      wickets: true,
      battingAvg: true,
      strikeRate: true,
      bowlingAvg: true,
      economy: true,
      hs: true,
      bbi: true,
    },
  });

  return <PlayersClient players={players} />;
}
