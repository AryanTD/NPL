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
import { triggerBotDecision } from '../bots/botManager';

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
  socket.on('lobby:place_bid', ({ lobbyId, amount }) => {
    const seatId = socket.data.seatId;
    if (!seatId) {
      socket.emit('lobby:error', { message: 'Not joined to a lobby', code: 'NOT_JOINED' });
      return;
    }
    handleBid(io, socket, lobbyId, seatId, amount);
  });

  // ── lobby:pass ──────────────────────────────────────────────────────────────
  socket.on('lobby:pass', (data) => {
    console.log(`[auction] lobby:pass — lobbyId ${data.lobbyId} seat ${socket.data.seatId}`);
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
  await revealNextPlayer(io, lobbyId);
}

// ─── revealNextPlayer ─────────────────────────────────────────────────────────

async function revealNextPlayer(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  const next = await prisma.auctionQueue.findFirst({
    where: { lobbyId, phase: state.phase as import('@prisma/client').AuctionPhase, isDone: false },
    orderBy: { position: 'asc' },
    include: { player: true },
  });

  if (!next) {
    await advancePhase(io, lobbyId);
    return;
  }

  const p = next.player;
  const player: Player = {
    id:         p.id,
    name:       p.name,
    category:   p.category as PlayerCategory,
    role:       p.role as import('@npl-auction/types').PlayerRole,
    base_price: p.basePrice,
    season:     p.season,
    is_marquee: p.isMarquee,
    stats: {
      runs:        p.runs,
      wickets:     p.wickets,
      batting_avg: p.battingAvg,
      strike_rate: p.strikeRate,
      bowling_avg: p.bowlingAvg,
      economy:     p.economy,
    },
  };

  const category = player.category;

  state.currentPlayer = player;
  state.currentBid    = null;
  state.timerSeconds  = TIMER_SECONDS;

  // One AbortController per player — cancelled in resolveCurrentPlayer
  const controller = new AbortController();
  state.botController = controller;

  io.to(lobbyId).emit('lobby:player_revealed', player);
  startPlayerTimer(io, lobbyId);

  // Trigger all bot seats (fire-and-forget)
  for (const seat of state.seats) {
    if (seat.seatType !== 'BOT' || !seat.botPersonality) continue;

    const currentBidAmount = null; // no bids yet at reveal time
    const buffer = minPurseBuffer(seat, category);

    triggerBotDecision(
      io,
      lobbyId,
      {
        seatId:         seat.seatId,
        franchiseName:  seat.franchiseName,
        personality:    seat.botPersonality as import('@prisma/client').BotPersonality,
        purseRemaining: seat.purseRemaining,
        minPurseBuffer: buffer,
      },
      currentBidAmount,
      BASE_PRICE[category],
      MAX_PRICE[category],
      category as import('@prisma/client').PlayerCategory,
      controller.signal,
      (bidSeatId, amount) => {
        // Route bot bid through the same validation path as human bids
        const fakeBidSocket = { emit: () => {} } as unknown as IoSocket;
        handleBid(io, fakeBidSocket, lobbyId, bidSeatId, amount);
      },
    ).catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[auction] bot decision error', err);
    });
  }
}

// ─── startPlayerTimer ─────────────────────────────────────────────────────────

function startPlayerTimer(io: IoServer, lobbyId: string): void {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  if (state.timerId) clearInterval(state.timerId);

  state.timerId = setInterval(() => {
    const s = auctionStates.get(lobbyId);
    if (!s) return;

    s.timerSeconds--;
    io.to(lobbyId).emit('lobby:timer_tick', { secondsLeft: s.timerSeconds });

    if (s.timerSeconds <= 0) {
      clearInterval(s.timerId!);
      s.timerId = null;
      resolveCurrentPlayer(io, lobbyId).catch((err) => {
        console.error('[auction] resolveCurrentPlayer error', err);
      });
    }
  }, 1_000);
}

// ─── minPurseBuffer ───────────────────────────────────────────────────────────

function minPurseBuffer(seat: LobbySeat, category: PlayerCategory): number {
  const aAfter = seat.categoryCount.A + (category === 'A' ? 1 : 0);
  const bAfter = seat.categoryCount.B + (category === 'B' ? 1 : 0);
  const cAfter = seat.categoryCount.C + (category === 'C' ? 1 : 0);
  return (
    Math.max(0, QUOTA.A - aAfter) * BASE_PRICE.A +
    Math.max(0, QUOTA.B - bAfter) * BASE_PRICE.B +
    Math.max(0, QUOTA.C - cAfter) * BASE_PRICE.C
  );
}

// ─── handleBid ────────────────────────────────────────────────────────────────

function handleBid(
  io: IoServer,
  socket: IoSocket,
  lobbyId: string,
  seatId: string,
  amount: number,
): void {
  const state = auctionStates.get(lobbyId);

  // 1. State exists + player on block
  if (!state || !state.currentPlayer) {
    socket.emit('lobby:error', { message: 'No player currently on the block', code: 'NO_PLAYER' });
    return;
  }

  // 2. Valid seat in this lobby
  const seat = state.seats.find((s) => s.seatId === seatId);
  if (!seat) {
    socket.emit('lobby:error', { message: 'Seat not found in this lobby', code: 'INVALID_SEAT' });
    return;
  }

  const category = state.currentPlayer.category;
  const minBid   = (state.currentBid?.amount ?? 0) + BID_INCREMENT;

  // 3. Minimum increment
  if (amount < minBid) {
    socket.emit('lobby:error', {
      message: `Bid must be at least ${minBid} (current + ${BID_INCREMENT})`,
      code: 'BID_TOO_LOW',
    });
    return;
  }

  // 4. Does not exceed max price
  const maxAllowed = MAX_PRICE[category];
  if (amount > maxAllowed) {
    socket.emit('lobby:error', {
      message: `Bid exceeds max price of ${maxAllowed} for category ${category}`,
      code: 'BID_TOO_HIGH',
    });
    return;
  }

  // 5. Seat can afford this bid
  if (seat.purseRemaining < amount) {
    socket.emit('lobby:error', { message: 'Insufficient purse', code: 'INSUFFICIENT_PURSE' });
    return;
  }

  // 6. Afford check: enough left to fill remaining required slots
  const buffer = minPurseBuffer(seat, category);
  if (seat.purseRemaining - amount < buffer) {
    socket.emit('lobby:error', {
      message: 'Bid would leave insufficient funds to fill remaining required slots',
      code: 'PURSE_BUFFER_BREACH',
    });
    return;
  }

  // 7. Category quota not yet filled
  const count = seat.categoryCount[category];
  if (count >= QUOTA[category]) {
    socket.emit('lobby:error', {
      message: `Category ${category} quota already filled`,
      code: 'QUOTA_FILLED',
    });
    return;
  }

  // ── Valid bid ────────────────────────────────────────────────────────────────
  state.currentBid   = { seatId, franchiseName: seat.franchiseName, amount };
  state.timerSeconds = TIMER_SECONDS; // timer setInterval reads this on next tick

  const bidEvent = {
    seatId,
    franchiseName: seat.franchiseName,
    amount,
    timestamp: new Date().toISOString(),
  };
  io.to(lobbyId).emit('lobby:bid_placed', bidEvent);

  // Persist bid row (fire-and-forget)
  prisma.bid.create({
    data: {
      lobbyId,
      seatId,
      playerId:    state.currentPlayer.id,
      franchiseId: seat.franchiseId,
      amount,
    },
  }).catch((err) => console.error('[auction] bid persist error', err));
}

// ─── resolveCurrentPlayer ─────────────────────────────────────────────────────

async function resolveCurrentPlayer(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state || !state.currentPlayer) return;

  // Abort any in-flight bot decisions (wired in commit 4)
  state.botController?.abort();

  // Clear any residual timer
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  const player   = state.currentPlayer;
  const category = player.category;

  // Mark queue entry done
  await prisma.auctionQueue.updateMany({
    where: { lobbyId, playerId: player.id, isDone: false },
    data:  { isDone: true },
  });

  if (!state.currentBid) {
    // ── Unsold ───────────────────────────────────────────────────────────────
    await prisma.auctionQueue.updateMany({
      where: { lobbyId, playerId: player.id },
      data:  { isUnsold: true },
    });
    state.unsoldPool.push(player);
    io.to(lobbyId).emit('lobby:player_unsold', { playerId: player.id, playerName: player.name });
    state.currentPlayer = null;
    await revealNextPlayer(io, lobbyId);
    return;
  }

  // ── Sold path ────────────────────────────────────────────────────────────────
  const winningAmount = state.currentBid.amount;

  if (winningAmount === MAX_PRICE[category]) {
    // Collect all seats that hit max price in DB bids for this player
    const maxBids = await prisma.bid.findMany({
      where: { lobbyId, playerId: player.id, amount: MAX_PRICE[category] },
      distinct: ['seatId'],
    });
    const contenders = maxBids.map((b) => b.seatId);

    if (contenders.length > 1) {
      await runLuckyDraw(io, lobbyId, contenders);
      return;
    }
  }

  await sellPlayer(io, lobbyId, state.currentBid.seatId, winningAmount, false);
}

// ─── sellPlayer ───────────────────────────────────────────────────────────────

async function sellPlayer(
  io: IoServer,
  lobbyId: string,
  winningSeatId: string,
  finalPrice: number,
  wasLuckyDraw: boolean,
): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state || !state.currentPlayer) return;

  const player   = state.currentPlayer;
  const category = player.category;
  const seat     = state.seats.find((s) => s.seatId === winningSeatId);
  if (!seat) return;

  // DB transaction: deduct purse, increment count, create SquadSlot + AuctionResult
  const countField = `count${category}` as 'countA' | 'countB' | 'countC';
  await prisma.$transaction([
    prisma.lobbySeat.update({
      where: { id: winningSeatId },
      data: {
        purseRemaining: { decrement: finalPrice },
        [countField]:   { increment: 1 },
      },
    }),
    prisma.squadSlot.create({
      data: {
        lobbyId,
        franchiseId: seat.franchiseId,
        playerId:    player.id,
        slotType:    SlotType.AUCTION,
        pricePaid:   finalPrice,
      },
    }),
    prisma.auctionResult.create({
      data: {
        lobbyId,
        playerId:    player.id,
        franchiseId: seat.franchiseId,
        finalPrice,
        wasLuckyDraw,
      },
    }),
  ]);

  // Update in-memory seat
  seat.purseRemaining       -= finalPrice;
  seat.categoryCount[category] += 1;
  seat.squad.push({
    franchiseId: seat.franchiseId,
    playerId:    player.id,
    player,
    slotType:    'AUCTION',
    pricePaid:   finalPrice,
  });

  io.to(lobbyId).emit('lobby:player_sold', {
    playerId:      player.id,
    seatId:        winningSeatId,
    franchiseName: seat.franchiseName,
    finalPrice,
  });

  state.currentPlayer = null;
  state.currentBid    = null;
  await revealNextPlayer(io, lobbyId);
}

// ─── runLuckyDraw ─────────────────────────────────────────────────────────────

async function runLuckyDraw(
  io: IoServer,
  lobbyId: string,
  contenderSeatIds: string[],
): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state || !state.currentPlayer) return;

  state.luckyDrawActive     = true;
  state.luckyDrawContenders = contenderSeatIds;

  io.to(lobbyId).emit('lobby:lucky_draw', {
    playerId:         state.currentPlayer.id,
    contenderSeatIds,
  });

  await delay(LUCKY_DRAW_MS);

  state.luckyDrawActive     = false;
  state.luckyDrawContenders = [];

  const winner = contenderSeatIds[Math.floor(Math.random() * contenderSeatIds.length)];
  const category = state.currentPlayer.category;
  await sellPlayer(io, lobbyId, winner, MAX_PRICE[category], true);
}

// ─── advancePhase ─────────────────────────────────────────────────────────────

async function advancePhase(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  const order: AuctionState['phase'][] = [
    'MARQUEE_DRAW',
    'CATEGORY_A',
    'CATEGORY_B',
    'CATEGORY_C',
    'UNSOLD_ROUND',
    'COMPLETE',
  ];
  const idx  = order.indexOf(state.phase);
  const next = order[idx + 1] ?? 'COMPLETE';

  console.log(`[auction] advancePhase ${state.phase} → ${next} lobbyId=${lobbyId}`);
  state.phase = next;

  if (next === 'UNSOLD_ROUND') {
    await setupUnsoldRound(io, lobbyId);
    return;
  }

  if (next === 'COMPLETE') {
    await completeAuction(io, lobbyId);
    return;
  }

  await revealNextPlayer(io, lobbyId);
}

// ─── setupUnsoldRound ─────────────────────────────────────────────────────────

async function setupUnsoldRound(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  // Determine which seats still need players in each category
  const seatsNeedingA = state.seats.filter((s) => s.categoryCount.A < QUOTA.A);
  const seatsNeedingB = state.seats.filter((s) => s.categoryCount.B < QUOTA.B);
  const seatsNeedingC = state.seats.filter((s) => s.categoryCount.C < QUOTA.C);

  if (seatsNeedingA.length === 0 && seatsNeedingB.length === 0 && seatsNeedingC.length === 0) {
    // All teams are full — skip straight to complete
    state.phase = 'COMPLETE';
    await completeAuction(io, lobbyId);
    return;
  }

  // Fetch all unsold queue entries for this lobby
  const unsoldRows = await prisma.auctionQueue.findMany({
    where: { lobbyId, isUnsold: true },
    include: { player: true },
    orderBy: { position: 'asc' },
  });

  // Filter to only players that are still actually needed by at least one team
  const needed = unsoldRows.filter((row) => {
    const cat = row.player.category;
    if (cat === 'A') return seatsNeedingA.length > 0;
    if (cat === 'B') return seatsNeedingB.length > 0;
    if (cat === 'C') return seatsNeedingC.length > 0;
    return false;
  });

  if (needed.length === 0) {
    state.phase = 'COMPLETE';
    await completeAuction(io, lobbyId);
    return;
  }

  // Re-insert into AuctionQueue under UNSOLD_ROUND phase
  await prisma.auctionQueue.createMany({
    data: needed.map((row, i) => ({
      lobbyId,
      playerId: row.playerId,
      phase:    AuctionPhase.UNSOLD_ROUND,
      position: i,
    })),
    skipDuplicates: true,
  });

  // Clear in-memory unsold pool now that we've re-queued
  state.unsoldPool = [];

  console.log(`[auction] unsold round queued ${needed.length} players lobbyId=${lobbyId}`);
  await revealNextPlayer(io, lobbyId);
}

// ─── completeAuction ──────────────────────────────────────────────────────────

async function completeAuction(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  state.botController?.abort();
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  await prisma.lobby.update({ where: { id: lobbyId }, data: { status: 'COMPLETE' } });

  io.to(lobbyId).emit('lobby:auction_complete', { seats: state.seats });

  auctionStates.delete(lobbyId);
  console.log(`[auction] complete lobbyId=${lobbyId}`);
}
