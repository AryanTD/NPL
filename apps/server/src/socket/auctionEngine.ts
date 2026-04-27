import { Server, Socket } from 'socket.io';
import { AuctionPhase, SlotType } from '@prisma/client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  AuctionState,
  LobbySeat,
  Player,
  PlayerCategory,
} from '@npl-auction/types';
import prisma from '../lib/prisma';

// ─── Type aliases ─────────────────────────────────────────────────────────────

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ─── Constants ────────────────────────────────────────────────────────────────

export const BASE_PRICE = { A: 1_000_000, B: 500_000, C: 200_000 } as const;
export const MAX_PRICE  = { A: 1_500_000, B: 1_000_000, C: 500_000 } as const;
export const QUOTA      = { A: 3, B: 4, C: 3 } as const;

const BID_INCREMENT  = 25_000;
const TIMER_SECONDS  = 10;
const LUCKY_DRAW_MS  = 3_000;
const MARQUEE_GAP_MS = 500;

// ─── In-memory state ──────────────────────────────────────────────────────────

interface LiveAuctionState extends AuctionState {
  timerId:       NodeJS.Timeout | null;
  botController: AbortController | null;
}

const auctionStates = new Map<string, LiveAuctionState>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatSeatFromDb(
  seat: {
    id: string;
    seatType: string;
    userId: string | null;
    displayName: string | null;
    botPersonality: string | null;
    purseRemaining: number;
    countA: number;
    countB: number;
    countC: number;
    franchise: { id: string; name: string; shortName: string };
  },
): LobbySeat {
  return {
    seatId:         seat.id,
    seatType:       seat.seatType as LobbySeat['seatType'],
    franchiseId:    seat.franchise.id,
    franchiseName:  seat.franchise.name,
    userId:         seat.userId ?? undefined,
    displayName:    seat.displayName ?? undefined,
    botPersonality: seat.botPersonality as LobbySeat['botPersonality'] ?? undefined,
    purseRemaining: seat.purseRemaining,
    squad:          [],
    categoryCount:  { A: seat.countA, B: seat.countB, C: seat.countC },
  };
}

// ─── Register handlers ────────────────────────────────────────────────────────

export function registerAuctionHandlers(io: IoServer, socket: IoSocket): void {
  // ── lobby:join ──────────────────────────────────────────────────────────────
  socket.on('lobby:join', async ({ lobbyId, userId, seatId }) => {
    socket.data.userId  = userId;
    socket.data.lobbyId = lobbyId;
    socket.data.seatId  = seatId;
    await socket.join(lobbyId);

    try {
      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: {
          seats: {
            include: { franchise: true },
            orderBy: { franchise: { name: 'asc' } },
          },
        },
      });

      if (!lobby) {
        socket.emit('lobby:error', { message: 'Lobby not found', code: 'NOT_FOUND' });
        return;
      }

      socket.emit('lobby:state', {
        id:        lobby.id,
        code:      lobby.code,
        status:    lobby.status as import('@npl-auction/types').LobbyStatus,
        season:    lobby.season,
        seats:     lobby.seats.map(formatSeatFromDb),
        createdAt: lobby.createdAt.toISOString(),
      });
    } catch (err) {
      console.error('[auction] lobby:join error', err);
      socket.emit('lobby:error', { message: 'Failed to join lobby' });
    }
  });

  // ── lobby:start ─────────────────────────────────────────────────────────────
  socket.on('lobby:start', async ({ lobbyId }) => {
    try {
      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: { seats: { include: { franchise: true } } },
      });

      if (!lobby) {
        socket.emit('lobby:error', { message: 'Lobby not found', code: 'NOT_FOUND' });
        return;
      }
      if (lobby.status !== 'WAITING') {
        socket.emit('lobby:error', { message: 'Auction already started', code: 'ALREADY_STARTED' });
        return;
      }

      const requestingSeat = lobby.seats.find((s) => s.userId === socket.data.userId);
      if (!requestingSeat || requestingSeat.seatType !== 'HUMAN') {
        socket.emit('lobby:error', { message: 'Only a human seat can start the auction', code: 'UNAUTHORIZED' });
        return;
      }

      await startAuction(io, lobbyId, lobby.season);
    } catch (err) {
      console.error('[auction] lobby:start error', err);
      socket.emit('lobby:error', { message: 'Failed to start auction' });
    }
  });

  // ── lobby:place_bid ─────────────────────────────────────────────────────────
  socket.on('lobby:place_bid', (data) => {
    console.log(`[auction] lobby:place_bid — lobbyId ${data.lobbyId} amount ${data.amount}`);
  });

  // ── lobby:pass ──────────────────────────────────────────────────────────────
  socket.on('lobby:pass', (data) => {
    console.log(`[auction] lobby:pass — lobbyId ${data.lobbyId}`);
  });

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[auction] disconnect — socket ${socket.id} reason ${reason}`);
  });
}

// ─── startAuction ─────────────────────────────────────────────────────────────

async function startAuction(io: IoServer, lobbyId: string, season: number): Promise<void> {
  // Load seats with franchises
  const seats = await prisma.lobbySeat.findMany({
    where: { lobbyId },
    include: { franchise: true },
    orderBy: { franchise: { name: 'asc' } },
  });

  // Flip lobby status to AUCTION
  await prisma.lobby.update({ where: { id: lobbyId }, data: { status: 'AUCTION' } });

  // Fetch all non-marquee players for this season, split by category
  const players = await prisma.player.findMany({
    where: { season, isMarquee: false },
  });

  const byCategory = {
    A: fisherYates(players.filter((p) => p.category === 'A')),
    B: fisherYates(players.filter((p) => p.category === 'B')),
    C: fisherYates(players.filter((p) => p.category === 'C')),
  };

  // Bulk-insert AuctionQueue rows
  await prisma.auctionQueue.createMany({
    data: [
      ...byCategory.A.map((p, i) => ({ lobbyId, playerId: p.id, phase: AuctionPhase.CATEGORY_A, position: i })),
      ...byCategory.B.map((p, i) => ({ lobbyId, playerId: p.id, phase: AuctionPhase.CATEGORY_B, position: i })),
      ...byCategory.C.map((p, i) => ({ lobbyId, playerId: p.id, phase: AuctionPhase.CATEGORY_C, position: i })),
    ],
  });

  // Initialise in-memory state
  const liveSeats: LobbySeat[] = seats.map(formatSeatFromDb);

  const state: LiveAuctionState = {
    lobbyId,
    phase:               'MARQUEE_DRAW',
    currentPlayer:       null,
    currentBid:          null,
    timerSeconds:        TIMER_SECONDS,
    seats:               liveSeats,
    unsoldPool:          [],
    luckyDrawActive:     false,
    luckyDrawContenders: [],
    timerId:             null,
    botController:       null,
  };
  auctionStates.set(lobbyId, state);

  console.log(`[auction] started lobbyId=${lobbyId} season=${season}`);
  await runMarqueeDraw(io, lobbyId, season);
}

// ─── runMarqueeDraw ───────────────────────────────────────────────────────────

async function runMarqueeDraw(io: IoServer, lobbyId: string, season: number): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  const marquees = await prisma.player.findMany({
    where: { season, isMarquee: true },
  });

  const shuffled = fisherYates(marquees);

  for (let i = 0; i < state.seats.length; i++) {
    const seat   = state.seats[i];
    const player = shuffled[i % shuffled.length]; // wrap in case of mismatch

    await prisma.squadSlot.create({
      data: {
        lobbyId,
        franchiseId: seat.franchiseId,
        playerId:    player.id,
        slotType:    SlotType.MARQUEE,
        pricePaid:   0,
      },
    });

    // Update in-memory squad
    state.seats[i].squad.push({
      franchiseId: seat.franchiseId,
      playerId:    player.id,
      player: {
        id:         player.id,
        name:       player.name,
        category:   player.category as PlayerCategory,
        role:       player.role as import('@npl-auction/types').PlayerRole,
        base_price: player.basePrice,
        season:     player.season,
        is_marquee: player.isMarquee,
        stats: {
          runs:        player.runs,
          wickets:     player.wickets,
          batting_avg: player.battingAvg,
          strike_rate: player.strikeRate,
          bowling_avg: player.bowlingAvg,
          economy:     player.economy,
        },
      },
      slotType:  'MARQUEE',
      pricePaid: 0,
    });

    io.to(lobbyId).emit('lobby:marquee_assigned', {
      playerId:      player.id,
      playerName:    player.name,
      franchiseId:   seat.franchiseId,
      franchiseName: seat.franchiseName,
    });

    await delay(MARQUEE_GAP_MS);
  }

  state.phase = 'CATEGORY_A';
  console.log(`[auction] marquee draw complete lobbyId=${lobbyId} — advancing to CATEGORY_A`);
  // revealNextPlayer will be implemented in commit 3
}
