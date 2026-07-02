import { PrismaClient, PlayerCategory, PlayerRole } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ─── Franchise data ──────────────────────────────────────────────────────────

const FRANCHISES = [
  {
    id: "franchise-ktm",
    name: "Kathmandu Gorkhas",
    shortName: "KTM",
    city: "Kathmandu",
    colorPrimary: "#1B3A6B",
    colorSecondary: "#C9A84C",
  },
  {
    id: "franchise-pkr",
    name: "Pokhara Avengers",
    shortName: "PKR",
    city: "Pokhara",
    colorPrimary: "#C0392B",
    colorSecondary: "#FFFFFF",
  },
  {
    id: "franchise-cht",
    name: "Chitwan Rhinos",
    shortName: "CHT",
    city: "Chitwan",
    colorPrimary: "#196F3D",
    colorSecondary: "#F4D03F",
  },
  {
    id: "franchise-brt",
    name: "Biratnagar Kings",
    shortName: "BRT",
    city: "Biratnagar",
    colorPrimary: "#6C3483",
    colorSecondary: "#F9E79F",
  },
  {
    id: "franchise-jnk",
    name: "Janakpur Bolts",
    shortName: "JNK",
    city: "Janakpur",
    colorPrimary: "#1A5276",
    colorSecondary: "#F39C12",
  },
  {
    id: "franchise-lmb",
    name: "Lumbini Lions",
    shortName: "LMB",
    city: "Lumbini",
    colorPrimary: "#922B21",
    colorSecondary: "#FAD7A0",
  },
  {
    id: "franchise-sdr",
    name: "Sudurpaschim Royals",
    shortName: "SDR",
    city: "Sudurpaschim",
    colorPrimary: "#0E6655",
    colorSecondary: "#A9DFBF",
  },
  {
    id: "franchise-krn",
    name: "Karnali Yaks",
    shortName: "KRN",
    city: "Karnali",
    colorPrimary: "#4A235A",
    colorSecondary: "#D7BDE2",
  },
] as const;

// ─── JSON shape ───────────────────────────────────────────────────────────────

interface PlayerStats {
  runs: number;
  wickets: number;
  batting_avg: number | null;
  strike_rate: number | null;
  bowling_avg: number | null;
  economy: number | null;
  matches: number;
  hs?: string | null;
  bbi?: string | null;
}

interface PlayerJSON {
  id: string;
  name: string;
  category: string;
  role: string;
  base_price: number;
  is_marquee: boolean;
  stats: PlayerStats;
}

interface PlayerFile {
  season: number;
  players: PlayerJSON[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readPlayerFile(filePath: string): PlayerFile {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as PlayerFile;
}

const CAT_FLOOR: Record<string, number> = { A: 65, B: 55, C: 45 };
const LIFT_GAMMA = 0.75; // concave curve: lifts mid/low values, barely moves top-end

function calcBatQuality(stats: PlayerStats): number {
  // batting_avg: 22 = excellent for a short T20 tournament
  const avgScore = Math.min(100, ((stats.batting_avg ?? 0) / 22) * 100);
  // strike_rate: floor 60, ceiling 160 (range = 100)
  const srScore = Math.min(
    100,
    Math.max(0, (((stats.strike_rate ?? 0) - 60) / 100) * 100),
  );
  return avgScore * 0.6 + srScore * 0.4;
}

function calcBowlQuality(stats: PlayerStats): number {
  // wickets: ref 18 (old 15 was too easy — 9 of 23 bowlers capped it)
  const wktScore = Math.min(100, (stats.wickets / 18) * 100);
  // economy: eco 5.5 → 100, eco 13.0 → 0
  const ecoScore =
    stats.economy != null
      ? Math.min(100, Math.max(0, ((13.0 - stats.economy) / 7.5) * 100))
      : 30;
  // bowling_avg: gated on ≥4 wickets to prevent single-game flukes inflating score
  const ba = stats.bowling_avg;
  const baScore =
    ba != null && stats.wickets >= 4
      ? Math.min(100, Math.max(0, ((30 - ba) / 18) * 100))
      : 40;
  return wktScore * 0.5 + ecoScore * 0.3 + baScore * 0.2;
}

function calcQuality(stats: PlayerStats, role: string): number {
  // BAT/WK: pure batting stats; BOWL: pure bowling stats
  // AR: (bat + bowl) / 1.85 — rewards genuine two-way contributors (max ≈ 108, capped at 100)
  let raw: number;
  if (role === "BAT" || role === "WK") {
    raw = calcBatQuality(stats);
  } else if (role === "BOWL") {
    raw = calcBowlQuality(stats);
  } else {
    raw = Math.min(
      100,
      (calcBatQuality(stats) + calcBowlQuality(stats)) / 1.75,
    );
  }

  // Matches as a direct quality signal (20% weight): selector confidence that a player
  // belongs in the playing XI. A full NPL season = 16 matches.
  const REF_MATCHES = 16;
  const matchScore = Math.min(100, ((stats.matches ?? 0) / REF_MATCHES) * 100);
  const adjusted = raw * 0.8 + matchScore * 0.2;

  // Gamma lift: raw 30→41, raw 50→60, raw 70→77, raw 90→92
  const lifted = adjusted > 0 ? 100 * Math.pow(adjusted / 100, LIFT_GAMMA) : 0;

  return Math.min(100, Math.max(25, Math.round(lifted)));
}

function toRow(p: PlayerJSON, season: number) {
  return {
    id: p.id,
    name: p.name,
    category: p.category as PlayerCategory,
    role: p.role as PlayerRole,
    basePrice: p.base_price,
    season,
    isMarquee: p.is_marquee,
    quality: Math.max(calcQuality(p.stats, p.role), CAT_FLOOR[p.category] ?? 25),
    matches: p.stats.matches,
    runs: p.stats.runs,
    wickets: p.stats.wickets,
    battingAvg: p.stats.batting_avg,
    strikeRate: p.stats.strike_rate,
    bowlingAvg: p.stats.bowling_avg,
    economy: p.stats.economy,
    hs: p.stats.hs ?? null,
    bbi: p.stats.bbi ?? null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Clear existing data in FK-safe order.
  //    Independent leaf tables run in parallel; parent tables run after.
  await Promise.all([
    prisma.squadSlot.deleteMany(),
    prisma.auctionResult.deleteMany(),
    prisma.bid.deleteMany(),
    prisma.auctionQueue.deleteMany(),
  ]);
  await prisma.lobbySeat.deleteMany();
  await prisma.lobby.deleteMany();
  await prisma.player.deleteMany();
  await prisma.franchise.deleteMany();

  // 2. Seed franchises — upsert so stable IDs are preserved across re-seeds,
  //    which prevents the in-memory franchise cache in lobby.ts from going stale.
  await Promise.all(
    FRANCHISES.map((f) =>
      prisma.franchise.upsert({ where: { id: f.id }, update: f, create: f }),
    ),
  );
  console.log(`Seeded ${FRANCHISES.length} franchises`);

  // 3. Locate data file (process.cwd() = apps/server when run via `prisma db seed`)
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const data2024 = readPlayerFile(
    path.join(repoRoot, "data", "players", "npl-2024.json"),
  );

  // 4. Insert all players from the 2024 season file.
  await prisma.player.createMany({
    data: data2024.players.map((p) => toRow(p, data2024.season)),
  });

  console.log(
    `Seeded ${data2024.players.length} players (season ${data2024.season})`,
  );
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
