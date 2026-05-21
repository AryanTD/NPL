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
  quality?: number;
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

function calcQuality(stats: PlayerStats, role: string): number {
  // Reference values calibrated for a single ~10-match T20 tournament:
  // batting_avg 25 = excellent (vs career 35), 15 wickets = excellent (vs career 70)
  const avgScore  = Math.min(100, ((stats.batting_avg  ?? 0) / 25) * 100);
  const srScore   = Math.min(100, Math.max(0, ((stats.strike_rate ?? 0) - 70) / 90 * 100));
  const batQuality = avgScore * 0.55 + srScore * 0.45;

  const wktScore  = Math.min(100, (stats.wickets / 15) * 100);
  const ecoScore  = stats.economy != null
    ? Math.min(100, Math.max(0, (13.0 - stats.economy) / 5.6 * 100))
    : 30;
  const bowlQuality = wktScore * 0.6 + ecoScore * 0.4;

  const weights: Record<string, [number, number]> = {
    BAT: [0.85, 0.15], WK: [0.80, 0.20], AR: [0.50, 0.50], BOWL: [0.15, 0.85],
  };
  const [bw, pw] = weights[role] ?? [0.50, 0.50];

  return Math.min(100, Math.max(25, Math.round(batQuality * bw + bowlQuality * pw)));
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
    quality:   p.quality ?? calcQuality(p.stats, p.role),
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

  // 3. Locate data file (process.cwd() = apps/server when run via `prisma db seed`)
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const data2024 = readPlayerFile(path.join(repoRoot, 'data', 'players', 'npl-2024.json'));

  // 4. Insert all players from the 2024 season file.
  await prisma.player.createMany({ data: data2024.players.map(p => toRow(p, data2024.season)) });

  console.log(`Seeded ${data2024.players.length} players (season ${data2024.season})`);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
