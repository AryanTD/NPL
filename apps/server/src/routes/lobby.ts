import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, BotPersonality, SeatType } from '@prisma/client';
import prisma from '../lib/prisma';

const router = Router();

const PURSE_START = 9_000_000; // NPR 90 lakhs

const BOT_PERSONALITIES: BotPersonality[] = [
  'AGGRESSIVE',
  'CONSERVATIVE',
  'ROLE_HUNTER',
  'BUDGET_SNIPER',
  'BALANCED',
];

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomPersonality(): BotPersonality {
  return BOT_PERSONALITIES[Math.floor(Math.random() * BOT_PERSONALITIES.length)];
}

// ─── Franchise cache ──────────────────────────────────────────────────────────
// Franchises are seeded once and never change at runtime.
// Cache the Promise so concurrent requests share the same in-flight query.

let franchiseCachePromise: Promise<Awaited<ReturnType<typeof prisma.franchise.findMany>>> | null = null;

function getFranchises() {
  if (!franchiseCachePromise) {
    franchiseCachePromise = prisma.franchise
      .findMany({ orderBy: { name: 'asc' } })
      .catch((err) => {
        franchiseCachePromise = null;
        return Promise.reject(err);
      });
  }
  return franchiseCachePromise;
}

// ─── POST /lobby/create ───────────────────────────────────────────────────────

const CreateSchema = z.object({
  userId:             z.string().min(1),
  displayName:        z.string().min(1),
  season:             z.number().int().min(2024).max(2025).default(2024),
  franchiseShortName: z.string().optional(),
});

router.post('/create', async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, displayName, season, franchiseShortName } = parsed.data;

  const franchises = await getFranchises();
  if (franchises.length !== 8) {
    res.status(500).json({ error: 'Franchises not seeded — run prisma db seed first' });
    return;
  }

  // Block if user already has an active seat in any lobby
  const activeSeat = await prisma.lobbySeat.findFirst({
    where: { userId, lobby: { status: { not: 'COMPLETE' } } },
    include: { lobby: true },
  });
  if (activeSeat) {
    res.status(409).json({
      error: 'You are already in an active game',
      activeGame: {
        lobbyId: activeSeat.lobbyId,
        seatId:  activeSeat.id,
        code:    activeSeat.lobby.code,
        status:  activeSeat.lobby.status,
      },
    });
    return;
  }

  // Determine which franchise index is the creator's seat
  const creatorIdx = franchiseShortName
    ? Math.max(0, franchises.findIndex(f => f.shortName === franchiseShortName))
    : 0;

  // Retry loop: generate a code and insert; on unique-constraint collision, try again.
  // This is safe under concurrency unlike the check-then-act pattern.
  let lobby: Awaited<ReturnType<typeof prisma.lobby.create>> & {
    seats: (Awaited<ReturnType<typeof prisma.lobbySeat.findMany>>[number] & {
      franchise: typeof franchises[number];
    })[];
  };

  for (;;) {
    const code = randomCode();
    try {
      lobby = await prisma.lobby.create({
        data: {
          code,
          season,
          hostUserId: userId,
          seats: {
            create: franchises.map((franchise, i) => {
              const isCreator = i === creatorIdx;
              return {
                franchiseId:    franchise.id,
                seatType:       isCreator ? SeatType.HUMAN : SeatType.BOT,
                userId:         isCreator ? userId : null,
                displayName:    isCreator ? displayName : null,
                botPersonality: isCreator ? null : randomPersonality(),
                purseRemaining: PURSE_START,
              };
            }),
          },
        },
        include: {
          seats: {
            include: { franchise: true },
            orderBy: { franchise: { name: 'asc' } },
          },
        },
      });
      break; // success
    } catch (err) {
      // P2002 = unique constraint violation — code collision, retry
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        continue;
      }
      console.error('[lobby] create failed:', err);
      res.status(500).json({ error: 'Failed to create lobby', detail: String(err) });
      return;
    }
  }

  const creatorSeat = lobby.seats.find((s) => s.userId === userId)!;

  res.status(201).json({
    lobbyId:       lobby.id,
    code:          lobby.code,
    seatId:        creatorSeat.id,
    franchiseName: creatorSeat.franchise.name,
    seats:         lobby.seats.map(formatSeat),
  });
});

// ─── POST /lobby/join/:code ───────────────────────────────────────────────────

const JoinSchema = z.object({
  userId:      z.string().min(1),
  displayName: z.string().min(1),
});

router.post('/join/:code', async (req: Request, res: Response): Promise<void> => {
  const parsed = JoinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, displayName } = parsed.data;
  const code = req.params.code.toUpperCase();

  try {
    const lobby = await prisma.lobby.findUnique({
      where: { code },
      include: {
        seats: { include: { franchise: true }, orderBy: { franchise: { name: 'asc' } } },
      },
    });

    if (!lobby) {
      res.status(404).json({ error: 'Lobby not found' });
      return;
    }
    if (lobby.status !== 'WAITING') {
      res.status(409).json({ error: 'Auction has already started' });
      return;
    }

    // If user already has a seat in THIS lobby, return it (idempotent rejoin)
    const existing = lobby.seats.find((s) => s.userId === userId);
    if (existing) {
      res.json({
        lobbyId:       lobby.id,
        code:          lobby.code,
        seatId:        existing.id,
        franchiseName: existing.franchise.name,
        seats:         lobby.seats.map(formatSeat),
      });
      return;
    }

    // Block if user already has an active seat in a different lobby
    const activeSeat = await prisma.lobbySeat.findFirst({
      where: { userId, lobbyId: { not: lobby.id }, lobby: { status: { not: 'COMPLETE' } } },
      include: { lobby: true },
    });
    if (activeSeat) {
      res.status(409).json({
        error: 'You are already in an active game',
        activeGame: {
          lobbyId: activeSeat.lobbyId,
          seatId:  activeSeat.id,
          code:    activeSeat.lobby.code,
          status:  activeSeat.lobby.status,
        },
      });
      return;
    }

    // Claim the first available BOT seat
    const botSeat = lobby.seats.find((s) => s.seatType === SeatType.BOT);
    if (!botSeat) {
      res.status(409).json({ error: 'Lobby is full' });
      return;
    }

    // Optimistic lock: only succeed if the seat is still a BOT seat.
    // Guards against two simultaneous join requests claiming the same seat.
    const claimResult = await prisma.lobbySeat.updateMany({
      where: { id: botSeat.id, seatType: SeatType.BOT },
      data: { seatType: SeatType.HUMAN, userId, displayName, botPersonality: null },
    });

    if (claimResult.count === 0) {
      res.status(409).json({ error: 'Seat just taken, please retry' });
      return;
    }

    const updated = await prisma.lobbySeat.findUnique({
      where: { id: botSeat.id },
      include: { franchise: true },
    });

    if (!updated) {
      res.status(500).json({ error: 'Failed to claim seat' });
      return;
    }

    // Patch the in-memory seat list — avoids an extra full-lobby fetch
    const allSeats = lobby.seats.map((s) =>
      s.id === botSeat.id ? { ...s, ...updated } : s,
    );

    res.json({
      lobbyId:       lobby.id,
      code:          lobby.code,
      seatId:        updated.id,
      franchiseName: updated.franchise.name,
      seats:         allSeats.map(formatSeat),
    });
  } catch {
    res.status(500).json({ error: 'Failed to join lobby' });
  }
});

// ─── POST /lobby/leave ────────────────────────────────────────────────────────
// Releases the user's seat in any non-COMPLETE lobby so they can start a new game.

router.post('/leave', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'Missing userId' });
    return;
  }
  try {
    const seat = await prisma.lobbySeat.findFirst({
      where: { userId, lobby: { status: { not: 'COMPLETE' } } },
    });
    if (seat) {
      await prisma.lobbySeat.update({
        where: { id: seat.id },
        data: { userId: null, displayName: null },
      });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to leave lobby' });
  }
});

// ─── GET /lobby/stats ─────────────────────────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const totalGamesPlayed = await prisma.lobby.count({
      where: { status: 'COMPLETE' },
    });
    res.json({ totalGamesPlayed });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /lobby/:id ───────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const lobby = await prisma.lobby.findUnique({
      where: { id: req.params.id },
      include: {
        seats: {
          include: { franchise: true },
          orderBy: { franchise: { name: 'asc' } },
        },
      },
    });

    if (!lobby) {
      res.status(404).json({ error: 'Lobby not found' });
      return;
    }

    res.json({
      id:        lobby.id,
      code:      lobby.code,
      status:    lobby.status,
      season:    lobby.season,
      createdAt: lobby.createdAt,
      seats:     lobby.seats.map(formatSeat),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch lobby' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeat(seat: {
  id: string;
  seatType: SeatType;
  userId: string | null;
  displayName: string | null;
  botPersonality: BotPersonality | null;
  purseRemaining: number;
  countA: number;
  countB: number;
  countC: number;
  franchise: { id: string; name: string; shortName: string; colorPrimary: string; colorSecondary: string };
}) {
  return {
    seatId:         seat.id,
    seatType:       seat.seatType,
    franchiseId:    seat.franchise.id,
    franchiseName:  seat.franchise.name,
    shortName:      seat.franchise.shortName,
    colorPrimary:   seat.franchise.colorPrimary,
    colorSecondary: seat.franchise.colorSecondary,
    userId:         seat.userId ?? undefined,
    displayName:    seat.displayName ?? undefined,
    botPersonality: seat.botPersonality ?? undefined,
    purseRemaining: seat.purseRemaining,
    categoryCount:  { A: seat.countA, B: seat.countB, C: seat.countC },
  };
}

export default router;
