import { PrismaClient, PlayerCategory, PlayerRole } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ─── Franchise data ──────────────────────────────────────────────────────────

const FRANCHISES = [
  { name: 'Kathmandu Gorkhas',   shortName: 'KTM', city: 'Kathmandu',    colorPrimary: '#1B3A6B', colorSecondary: '#C9A84C' },
  { name: 'Pokhara Avengers',    shortName: 'PKR', city: 'Pokhara',      colorPrimary: '#C0392B', colorSecondary: '#FFFFFF' },
  { name: 'Chitwan Rhinos',      shortName: 'CHT', city: 'Chitwan',      colorPrimary: '#196F3D', colorSecondary: '#F4D03F' },
  { name: 'Biratnagar Kings',    shortName: 'BRT', city: 'Biratnagar',   colorPrimary: '#6C3483', colorSecondary: '#F9E79F' },
  { name: 'Janakpur Bolts',      shortName: 'JNK', city: 'Janakpur',     colorPrimary: '#1A5276', colorSecondary: '#F39C12' },
  { name: 'Lumbini Lions',       shortName: 'LMB', city: 'Lumbini',      colorPrimary: '#922B21', colorSecondary: '#FAD7A0' },
  { name: 'Sudurpaschim Royals', shortName: 'SDR', city: 'Sudurpaschim', colorPrimary: '#0E6655', colorSecondary: '#A9DFBF' },
  { name: 'Karnali Yaks',        shortName: 'KRN', city: 'Karnali',      colorPrimary: '#4A235A', colorSecondary: '#D7BDE2' },
] as const;

// ─── JSON shape ───────────────────────────────────────────────────────────────

interface PlayerStats {
  runs: number;
  wickets: number;
  batting_avg: number | null;
  strike_rate: number | null;
  bowling_avg: number | null;
  economy: number | null;
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
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as PlayerFile;
}

function toRow(p: PlayerJSON, season: number) {
  return {
    id:        p.id,
    name:      p.name,
    category:  p.category as PlayerCategory,
    role:      p.role as PlayerRole,
    basePrice: p.base_price,
    season,
    isMarquee: p.is_marquee,
    runs:       p.stats.runs,
    wickets:    p.stats.wickets,
    battingAvg: p.stats.batting_avg,
    strikeRate: p.stats.strike_rate,
    bowlingAvg: p.stats.bowling_avg,
    economy:    p.stats.economy,
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

  // 2. Seed franchises — single bulk insert
  await prisma.franchise.createMany({ data: [...FRANCHISES] });
  console.log(`Seeded ${FRANCHISES.length} franchises`);

  // 3. Locate data files (process.cwd() = apps/server when run via `prisma db seed`)
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const data2024 = readPlayerFile(path.join(repoRoot, 'data', 'players', 'npl-2024.json'));
  const data2025 = readPlayerFile(path.join(repoRoot, 'data', 'players', 'npl-2025.json'));

  // 4. Merge both seasons into a Map so 2025 stats win for shared marquee IDs.
  //    DB is empty at this point (deleted above), so a single createMany suffices —
  //    no upsert needed.
  const playerMap = new Map<string, ReturnType<typeof toRow>>();
  for (const p of data2024.players) playerMap.set(p.id, toRow(p, data2024.season));
  for (const p of data2025.players) playerMap.set(p.id, toRow(p, data2025.season));

  await prisma.player.createMany({ data: [...playerMap.values()] });

  console.log(
    `Seeded ${playerMap.size} players (2024: ${data2024.players.length}, 2025: ${data2025.players.length})`,
  );
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
