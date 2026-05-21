import { Server, Socket } from "socket.io";
import { Prisma, AuctionPhase, SlotType, PlayerRole } from "@prisma/client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  AuctionState,
  LobbySeat,
  Player,
  PlayerCategory,
} from "@npl-auction/types";
import prisma from "../lib/prisma";
import {
  BotSession,
  PlayerInfo,
  revealPlayerToBots,
  onBidPlaced,
  cancelAllBots,
  updateRosterOnSold,
} from "../bots/botManager";
import { PERSONALITIES } from "../bots/botPersonalities";

// ─── Type aliases ─────────────────────────────────────────────────────────────

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ─── Constants ────────────────────────────────────────────────────────────────

export const BASE_PRICE = { A: 1_000_000, B: 500_000, C: 200_000 } as const;
export const MAX_PRICE = { A: 1_500_000, B: 1_000_000, C: 500_000 } as const;

export const QUOTA = { A: 3, B: 4, C: 3 } as const;
const TEST_PLAYERS_PER_CAT = 10;

const BID_INCREMENT = 25_000;
const TIMER_SECONDS = 10;
const UNSOLD_TIMER_SECONDS = 5;
const UNSOLD_CAP_PER_CAT = 2;
const LUCKY_DRAW_MS = 3_000;
const MARQUEE_GAP_MS = 500;

const PHASE_ORDER: AuctionState["phase"][] = [
  "MARQUEE_DRAW",
  "CATEGORY_A",
  "CATEGORY_B",
  "CATEGORY_C",
  "UNSOLD_ROUND",
  "COMPLETE",
];

// ─── In-memory state ──────────────────────────────────────────────────────────

interface QueueEntry {
  player: Player;
  playerInfo: PlayerInfo;
}

interface LiveAuctionState extends AuctionState {
  timerId: NodeJS.Timeout | null;
  botSessions: Map<string, BotSession>;
  maxPriceBidders: Set<string>;
  phaseQueueCache: QueueEntry[] | null;
  seatsMap: Map<string, LobbySeat>;
  humanSeatIds: Set<string>;
  currentPlayerDb: PlayerInfo | null;
  quota: { A: number; B: number; C: number };
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

function parsePayload<T>(data: T | string): T {
  return typeof data === "string" ? JSON.parse(data) : data;
}

type DbPlayer = {
  id: string; name: string; basePrice: number; quality: number; category: string; role: string;
  season: number; isMarquee: boolean; runs: number; wickets: number;
  battingAvg: number | null; strikeRate: number | null; bowlingAvg: number | null; economy: number | null;
};

function dbPlayerToPlayer(p: DbPlayer): Player {
  return {
    id: p.id,
    name: p.name,
    category: p.category as PlayerCategory,
    role: p.role as import("@npl-auction/types").PlayerRole,
    base_price: p.basePrice,
    season: p.season,
    is_marquee: p.isMarquee,
    stats: {
      runs: p.runs,
      wickets: p.wickets,
      batting_avg: p.battingAvg,
      strike_rate: p.strikeRate,
      bowling_avg: p.bowlingAvg,
      economy: p.economy,
    },
  };
}

function dbPlayerToPlayerInfo(p: DbPlayer): PlayerInfo {
  return {
    id: p.id,
    basePrice: p.basePrice,
    quality: p.quality,
    role: p.role as PlayerRole,
    category: p.category as import("@prisma/client").PlayerCategory,
  };
}

function formatSeatFromDb(seat: {
  id: string;
  seatType: string;
  userId: string | null;
  displayName: string | null;
  botPersonality: string | null;
  purseRemaining: number;
  countA: number;
  countB: number;
  countC: number;
  franchise: {
    id: string;
    name: string;
    shortName: string;
    city: string;
    colorPrimary: string;
    colorSecondary: string;
    createdAt: Date;
  };
  squadSlots?: Array<{
    playerId: string;
    player: {
      id: string;
      name: string;
      category: string;
      role: string;
      basePrice: number;
      season: number;
      isMarquee: boolean;
      runs: number;
      wickets: number;
      battingAvg: number | null;
      strikeRate: number | null;
      bowlingAvg: number | null;
      economy: number | null;
    };
    slotType: string;
    pricePaid: number;
  }>;
}): LobbySeat {
  const squad: LobbySeat["squad"] = (seat.squadSlots ?? []).map((slot) => ({
    franchiseId: seat.franchise.id,
    playerId: slot.playerId,
    player: {
      id: slot.player.id,
      name: slot.player.name,
      category: slot.player.category as PlayerCategory,
      role: slot.player.role as PlayerRole,
      base_price: slot.player.basePrice,
      season: slot.player.season,
      is_marquee: slot.player.isMarquee,
      stats: {
        runs: slot.player.runs,
        wickets: slot.player.wickets,
        batting_avg: slot.player.battingAvg,
        strike_rate: slot.player.strikeRate,
        bowling_avg: slot.player.bowlingAvg,
        economy: slot.player.economy,
      },
    },
    slotType: slot.slotType as SlotType,
    pricePaid: slot.pricePaid,
  }));

  return {
    seatId: seat.id,
    seatType: seat.seatType as LobbySeat["seatType"],
    franchiseId: seat.franchise.id,
    franchiseName: seat.franchise.name,
    userId: seat.userId ?? undefined,
    displayName: seat.displayName ?? undefined,
    botPersonality:
      (seat.botPersonality as LobbySeat["botPersonality"]) ?? undefined,
    purseRemaining: seat.purseRemaining,
    squad,
    categoryCount: { A: seat.countA, B: seat.countB, C: seat.countC },
  };
}

// ─── Register handlers ────────────────────────────────────────────────────────

export function registerAuctionHandlers(io: IoServer, socket: IoSocket): void {
  // ── lobby:join ──────────────────────────────────────────────────────────────
  socket.on("lobby:join", async (data) => {
    const { lobbyId, userId, seatId } = parsePayload(data);
    if (!lobbyId || !userId || !seatId) {
      socket.emit("lobby:error", {
        message: "Missing lobbyId, userId, or seatId",
        code: "BAD_PAYLOAD",
      });
      return;
    }

    socket.data.userId = userId;
    socket.data.lobbyId = lobbyId;
    socket.data.seatId = seatId;
    await socket.join(lobbyId);

    try {
      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: {
          seats: {
            include: {
              franchise: true,
              squadSlots: {
                include: { player: true },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { franchise: { name: "asc" } },
          },
        },
      });

      if (!lobby) {
        socket.emit("lobby:error", {
          message: "Lobby not found",
          code: "NOT_FOUND",
        });
        return;
      }

      const auctionState = auctionStates.get(lobbyId);

      if (lobby.status === "AUCTION" && !auctionState) {
        socket.emit("lobby:error", {
          message: "Auction session lost — server was restarted. Please start a new game.",
          code: "SESSION_LOST",
        });
        return;
      }

      socket.emit("lobby:state", {
        id: lobby.id,
        code: lobby.code,
        status: lobby.status as import("@npl-auction/types").LobbyStatus,
        season: lobby.season,
        seats: lobby.seats.map(formatSeatFromDb),
        createdAt: lobby.createdAt.toISOString(),
        hostUserId: lobby.hostUserId ?? undefined,
        quota: auctionState?.quota,
      });
      if (auctionState?.currentPlayer) {
        socket.emit("lobby:player_revealed", auctionState.currentPlayer);
        if (auctionState.currentBid) {
          socket.emit("lobby:bid_placed", {
            seatId: auctionState.currentBid.seatId,
            franchiseName: auctionState.currentBid.franchiseName,
            amount: auctionState.currentBid.amount,
            timestamp: new Date().toISOString(),
          });
        }
        socket.emit("lobby:timer_tick", { secondsLeft: auctionState.timerSeconds });
        const upcoming = (auctionState.phaseQueueCache ?? []).slice(0, 8).map((e) => ({
          playerId: e.player.id,
          playerName: e.player.name,
          category: e.player.category,
          role: e.player.role,
          basePrice: e.player.base_price,
        }));
        socket.emit("lobby:queue_update", { upcoming });
      }
    } catch (err) {
      console.error("[auction] lobby:join error", err);
      socket.emit("lobby:error", { message: "Failed to join lobby" });
    }
  });

  // ── lobby:start ─────────────────────────────────────────────────────────────
  socket.on("lobby:start", async (data) => {
    const { lobbyId, testMode } = parsePayload(data);
    if (!lobbyId) {
      socket.emit("lobby:error", {
        message: "Missing lobbyId",
        code: "BAD_PAYLOAD",
      });
      return;
    }
    try {
      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: { seats: { include: { franchise: true } } },
      });

      if (!lobby) {
        socket.emit("lobby:error", {
          message: "Lobby not found",
          code: "NOT_FOUND",
        });
        return;
      }
      if (lobby.status !== "WAITING") {
        socket.emit("lobby:error", {
          message: "Auction already started",
          code: "ALREADY_STARTED",
        });
        return;
      }

      const requestingSeat = lobby.seats.find(
        (s) => s.userId === socket.data.userId,
      );
      if (!requestingSeat || requestingSeat.seatType !== "HUMAN") {
        socket.emit("lobby:error", {
          message: "Only a human seat can start the auction",
          code: "UNAUTHORIZED",
        });
        return;
      }

      if (lobby.hostUserId && socket.data.userId !== lobby.hostUserId) {
        socket.emit("lobby:error", {
          message: "Only the host can start the auction",
          code: "NOT_HOST",
        });
        return;
      }

      await startAuction(io, lobbyId, lobby.season, lobby.seats, testMode ?? false);
    } catch (err) {
      console.error("[auction] lobby:start error", err);
      socket.emit("lobby:error", { message: "Failed to start auction" });
    }
  });

  // ── lobby:place_bid ─────────────────────────────────────────────────────────
  socket.on("lobby:place_bid", (data) => {
    const { lobbyId, amount } = parsePayload(data);
    if (!lobbyId || amount == null) {
      socket.emit("lobby:error", {
        message: "Missing lobbyId or amount",
        code: "BAD_PAYLOAD",
      });
      return;
    }
    const seatId = socket.data.seatId;
    if (!seatId) {
      socket.emit("lobby:error", {
        message: "Not joined to a lobby",
        code: "NOT_JOINED",
      });
      return;
    }
    handleBid(io, socket, lobbyId, seatId, amount);
  });

  // ── lobby:pass ──────────────────────────────────────────────────────────────
  socket.on("lobby:pass", (data) => {
    const { lobbyId } = parsePayload(data);
    console.log(
      `[auction] lobby:pass — lobbyId ${lobbyId} seat ${socket.data.seatId}`,
    );
  });

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[auction] disconnect — socket ${socket.id} reason ${reason}`);

    const { lobbyId } = socket.data;
    if (!lobbyId) return;

    // After a 30s grace period, clean up the auction state if the room is empty.
    // This prevents a memory leak when all clients disconnect mid-auction.
    setTimeout(() => {
      const state = auctionStates.get(lobbyId);
      if (!state) return;

      const room = io.sockets.adapter.rooms.get(lobbyId);
      const remaining = room ? room.size : 0;

      if (remaining === 0) {
        cancelAllBots(state.botSessions);
        if (state.timerId) {
          clearInterval(state.timerId);
          state.timerId = null;
        }
        auctionStates.delete(lobbyId);
        console.log(`[auction] cleaned up abandoned lobby=${lobbyId}`);
      }
    }, 30_000);
  });
}

// ─── startAuction ─────────────────────────────────────────────────────────────

type DbSeatWithFranchise = Parameters<typeof formatSeatFromDb>[0];

async function startAuction(
  io: IoServer,
  lobbyId: string,
  season: number,
  preloadedSeats?: DbSeatWithFranchise[],
  testMode = false,
): Promise<void> {
  // Reuse seats already loaded by the lobby:start handler if available
  const seats =
    preloadedSeats ??
    (await prisma.lobbySeat.findMany({
      where: { lobbyId },
      include: { franchise: true },
      orderBy: { franchise: { name: "asc" } },
    }));

  // Fetch all non-marquee players for this season, split by category
  const players = await prisma.player.findMany({
    where: { season, isMarquee: false },
  });

  const cap = testMode ? TEST_PLAYERS_PER_CAT : undefined;
  const buckets: Record<"A" | "B" | "C", typeof players> = { A: [], B: [], C: [] };
  for (const p of players) buckets[p.category as "A" | "B" | "C"].push(p);
  const byCategory = {
    A: fisherYates(buckets.A).slice(0, cap),
    B: fisherYates(buckets.B).slice(0, cap),
    C: fisherYates(buckets.C).slice(0, cap),
  };

  const queueData = [
    ...byCategory.A.map((p, i) => ({
      lobbyId,
      playerId: p.id,
      phase: AuctionPhase.CATEGORY_A,
      position: i,
    })),
    ...byCategory.B.map((p, i) => ({
      lobbyId,
      playerId: p.id,
      phase: AuctionPhase.CATEGORY_B,
      position: i,
    })),
    ...byCategory.C.map((p, i) => ({
      lobbyId,
      playerId: p.id,
      phase: AuctionPhase.CATEGORY_C,
      position: i,
    })),
  ];

  // Atomically claim WAITING → AUCTION using the interactive transaction form so we
  // can inspect the updateMany result before proceeding — prevents double-start races.
  let startClaimed = false;
  await prisma.$transaction(async (tx) => {
    const result = await tx.lobby.updateMany({
      where: { id: lobbyId, status: "WAITING" },
      data: { status: "AUCTION" },
    });
    if (result.count === 0) return; // concurrent start already ran
    startClaimed = true;
    await tx.auctionQueue.createMany({ data: queueData });
  });
  if (!startClaimed) return;

  // Initialise in-memory state
  const liveSeats: LobbySeat[] = seats.map(formatSeatFromDb);
  const seatsMap = new Map(liveSeats.map((s) => [s.seatId, s]));

  const humanSeatIds = new Set(liveSeats.filter((s) => s.seatType === "HUMAN").map((s) => s.seatId));

  const quota = testMode ? { A: 1, B: 1, C: 1 } : { A: 3, B: 4, C: 3 };

  const state: LiveAuctionState = {
    lobbyId,
    phase: "MARQUEE_DRAW",
    currentPlayer: null,
    currentBid: null,
    timerSeconds: TIMER_SECONDS,
    seats: liveSeats,
    unsoldPool: [],
    luckyDrawActive: false,
    luckyDrawContenders: [],
    timerId: null,
    botSessions: new Map(),
    maxPriceBidders: new Set(),
    phaseQueueCache: null,
    seatsMap,
    humanSeatIds,
    currentPlayerDb: null,
    quota,
  };
  auctionStates.set(lobbyId, state);

  for (const seat of state.seats) {
    if (seat.seatType !== "BOT" || !seat.botPersonality) continue;
    const personalityType = seat.botPersonality as keyof typeof PERSONALITIES;
    const personality = PERSONALITIES[personalityType];
    const priorityRoles: PlayerRole[] =
      personality.type === "ROLE_HUNTER"
        ? fisherYates([
            PlayerRole.BAT,
            PlayerRole.BOWL,
            PlayerRole.AR,
            PlayerRole.WK,
          ]).slice(0, 2)
        : [];
    state.botSessions.set(seat.seatId, {
      seatId: seat.seatId,
      franchiseId: seat.franchiseId,
      franchiseName: seat.franchiseName,
      personality,
      priorityRoles,
      remainingPurse: 9_000_000,
      batsmanCount: 0,
      bowlerCount: 0,
      marqueeCount: 0,
      aCount: 0,
      bCount: 0,
      cCount: 0,
      categoryOverspend: {},
      abortController: null,
    });
  }

  console.log(`[auction] started lobbyId=${lobbyId} season=${season}`);
  await runMarqueeDraw(io, lobbyId, season);
}

// ─── runMarqueeDraw ───────────────────────────────────────────────────────────

async function runMarqueeDraw(
  io: IoServer,
  lobbyId: string,
  season: number,
): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  const marquees = await prisma.player.findMany({
    where: { season, isMarquee: true },
  });

  const shuffled = fisherYates(marquees);

  await prisma.squadSlot.createMany({
    data: state.seats.map((seat, i) => ({
      lobbyId,
      franchiseId: seat.franchiseId,
      lobbySeatId: seat.seatId,
      playerId: shuffled[i % shuffled.length].id,
      slotType: SlotType.MARQUEE,
      pricePaid: 0,
    })),
  });

  // Update in-memory state + emit per seat (delay between reveals still needed)
  for (let i = 0; i < state.seats.length; i++) {
    const seat = state.seats[i];
    const player = shuffled[i % shuffled.length];

    seat.squad.push({
      franchiseId: seat.franchiseId,
      playerId: player.id,
      player: {
        id: player.id,
        name: player.name,
        category: player.category as PlayerCategory,
        role: player.role as import("@npl-auction/types").PlayerRole,
        base_price: player.basePrice,
        season: player.season,
        is_marquee: player.isMarquee,
        stats: {
          runs: player.runs,
          wickets: player.wickets,
          batting_avg: player.battingAvg,
          strike_rate: player.strikeRate,
          bowling_avg: player.bowlingAvg,
          economy: player.economy,
        },
      },
      slotType: "MARQUEE",
      pricePaid: 0,
    });

    io.to(lobbyId).emit("lobby:marquee_assigned", {
      playerId: player.id,
      playerName: player.name,
      franchiseId: seat.franchiseId,
      franchiseName: seat.franchiseName,
    });

    await delay(MARQUEE_GAP_MS);
  }

  for (const session of state.botSessions.values()) {
    session.marqueeCount = 1;
  }

  state.phase = "CATEGORY_A";
  console.log(
    `[auction] marquee draw complete lobbyId=${lobbyId} — advancing to CATEGORY_A`,
  );
  await revealNextPlayer(io, lobbyId);
}

// ─── revealNextPlayer ─────────────────────────────────────────────────────────

async function revealNextPlayer(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  state.maxPriceBidders = new Set();

  // Load the phase queue from DB once per phase — subsequent calls use the in-memory cache.
  if (state.phaseQueueCache === null) {
    const rows = await prisma.auctionQueue.findMany({
      where: { lobbyId, phase: state.phase as AuctionPhase, isDone: false },
      orderBy: { position: "asc" },
      include: { player: true },
    });
    state.phaseQueueCache = rows.map((row) => ({
      player: dbPlayerToPlayer(row.player),
      playerInfo: dbPlayerToPlayerInfo(row.player),
    }));
  }

  // Shift next player from the in-memory queue
  const entry = state.phaseQueueCache.shift();
  if (!entry) {
    await advancePhase(io, lobbyId);
    return;
  }

  const player = entry.player;

  state.currentPlayer = player;
  state.currentPlayerDb = entry.playerInfo;
  state.currentBid = null;
  state.timerSeconds = state.phase === "UNSOLD_ROUND" ? UNSOLD_TIMER_SECONDS : TIMER_SECONDS;

  io.to(lobbyId).emit("lobby:player_revealed", player);
  // Send initial tick so client timer bar starts at the correct value
  io.to(lobbyId).emit("lobby:timer_tick", { secondsLeft: state.timerSeconds });
  startPlayerTimer(io, lobbyId);

  // Emit upcoming queue so clients can populate the COMING UP panel
  const upcoming = (state.phaseQueueCache ?? []).slice(0, 8).map((e) => ({
    playerId: e.player.id,
    playerName: e.player.name,
    category: e.player.category,
    role: e.player.role,
    basePrice: e.player.base_price,
  }));
  io.to(lobbyId).emit("lobby:queue_update", { upcoming });

  const isUnsoldRound = state.phase === "UNSOLD_ROUND";
  const onBotBid = (bidSeatId: string, amount: number) => {
    const fakeBidSocket = { emit: () => {} } as unknown as IoSocket;
    handleBid(io, fakeBidSocket, lobbyId, bidSeatId, amount);
  };
  revealPlayerToBots(io, lobbyId, entry.playerInfo, state.humanSeatIds, state.botSessions, isUnsoldRound, state.quota, onBotBid);
}

// ─── startPlayerTimer ─────────────────────────────────────────────────────────

function startPlayerTimer(io: IoServer, lobbyId: string): void {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  if (state.timerId) clearInterval(state.timerId);

  state.timerId = setInterval(() => {
    state.timerSeconds--;
    io.to(lobbyId).emit("lobby:timer_tick", {
      secondsLeft: state.timerSeconds,
    });

    if (state.timerSeconds <= 0) {
      clearInterval(state.timerId!);
      state.timerId = null;
      resolveCurrentPlayer(io, lobbyId).catch((err) => {
        console.error("[auction] resolveCurrentPlayer error", err);
      });
    }
  }, 1_000);
}

// ─── minPurseBuffer ───────────────────────────────────────────────────────────

function minPurseBuffer(
  seat: LobbySeat,
  category: PlayerCategory,
  quota: { A: number; B: number; C: number },
): number {
  const aAfter = seat.categoryCount.A + (category === "A" ? 1 : 0);
  const bAfter = seat.categoryCount.B + (category === "B" ? 1 : 0);
  const cAfter = seat.categoryCount.C + (category === "C" ? 1 : 0);
  return (
    Math.max(0, quota.A - aAfter) * BASE_PRICE.A +
    Math.max(0, quota.B - bAfter) * BASE_PRICE.B +
    Math.max(0, quota.C - cAfter) * BASE_PRICE.C
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
    socket.emit("lobby:error", {
      message: "No player currently on the block",
      code: "NO_PLAYER",
    });
    return;
  }

  // 2. Valid seat in this lobby — Change 7: O(1) seatsMap lookup
  const seat = state.seatsMap.get(seatId);
  if (!seat) {
    socket.emit("lobby:error", {
      message: "Seat not found in this lobby",
      code: "INVALID_SEAT",
    });
    return;
  }

  const category = state.currentPlayer.category;
  const maxAllowed = MAX_PRICE[category];
  const currentAmount = state.currentBid?.amount ?? 0;
  const atMaxPrice = currentAmount >= maxAllowed;

  // 3. Minimum increment — at max price others may match (lucky draw entry), otherwise must increment
  const minBid = atMaxPrice ? maxAllowed : currentAmount + BID_INCREMENT;
  if (amount < minBid) {
    socket.emit("lobby:error", {
      message: atMaxPrice
        ? `Bid must be exactly ${maxAllowed} to enter the lucky draw`
        : `Bid must be at least ${minBid} (current + ${BID_INCREMENT})`,
      code: "BID_TOO_LOW",
    });
    return;
  }

  // 4. Does not exceed max price
  if (amount > maxAllowed) {
    socket.emit("lobby:error", {
      message: `Bid exceeds max price of ${maxAllowed} for category ${category}`,
      code: "BID_TOO_HIGH",
    });
    return;
  }

  // 4b. At max price: prevent the current leader from re-bidding; prevent double-entry to draw
  if (atMaxPrice) {
    if (state.currentBid?.seatId === seatId) return; // already leading, silently ignore
    if (state.maxPriceBidders.has(seatId)) return;   // already entered draw
  }

  // 5. Seat can afford this bid
  if (seat.purseRemaining < amount) {
    socket.emit("lobby:error", {
      message: "Insufficient purse",
      code: "INSUFFICIENT_PURSE",
    });
    return;
  }

  // 6. Afford check: enough left to fill remaining required slots
  const buffer = minPurseBuffer(seat, category, state.quota);
  if (seat.purseRemaining - amount < buffer) {
    socket.emit("lobby:error", {
      message:
        "Bid would leave insufficient funds to fill remaining required slots",
      code: "PURSE_BUFFER_BREACH",
    });
    return;
  }

  // 7. Category quota not yet filled
  const count = seat.categoryCount[category];
  if (count >= state.quota[category]) {
    socket.emit("lobby:error", {
      message: `Category ${category} quota already filled`,
      code: "QUOTA_FILLED",
    });
    return;
  }

  // ── Valid bid ────────────────────────────────────────────────────────────────
  state.currentBid = { seatId, franchiseName: seat.franchiseName, amount };
  state.timerSeconds = TIMER_SECONDS; // timer setInterval reads this on next tick

  if (amount === MAX_PRICE[category]) {
    state.maxPriceBidders.add(seatId);
  }

  const bidEvent = {
    seatId,
    franchiseName: seat.franchiseName,
    amount,
    timestamp: new Date().toISOString(),
  };
  io.to(lobbyId).emit("lobby:bid_placed", bidEvent);

  if (state.currentPlayerDb) {
    const isUnsoldRound = state.phase === "UNSOLD_ROUND";
    const fakeBidSocket = { emit: () => {} } as unknown as IoSocket;
    const onBotBid = (bidSeatId: string, amount: number) =>
      handleBid(io, fakeBidSocket, lobbyId, bidSeatId, Math.min(amount, MAX_PRICE[category]));
    onBidPlaced(
      io,
      lobbyId,
      state.currentPlayerDb,
      state.currentBid!.amount,
      seatId,
      state.humanSeatIds,
      state.botSessions,
      isUnsoldRound,
      state.quota,
      onBotBid,
    );
  }

  // Persist bid row (fire-and-forget)
  prisma.bid
    .create({
      data: {
        lobbyId,
        seatId,
        playerId: state.currentPlayer.id,
        franchiseId: seat.franchiseId,
        amount,
      },
    })
    .catch((err) => console.error("[auction] bid persist error", err));
}

// ─── resolveCurrentPlayer ─────────────────────────────────────────────────────

async function resolveCurrentPlayer(
  io: IoServer,
  lobbyId: string,
): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state || !state.currentPlayer) return;

  // Cancel all bots synchronously before any await. Bot timers that fire during
  // subsequent DB operations would otherwise emit spurious lobby:bid_placed events.
  cancelAllBots(state.botSessions);

  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  const player = state.currentPlayer;
  const category = player.category;
  const winningBid = state.currentBid; // snapshot before any async yield

  if (!winningBid) {
    // ── Unsold ───────────────────────────────────────────────────────────────
    await prisma.auctionQueue.updateMany({
      where: { lobbyId, playerId: player.id, isDone: false },
      data: { isDone: true, isUnsold: true },
    });
    state.unsoldPool.push(player);
    io.to(lobbyId).emit("lobby:player_unsold", {
      playerId: player.id,
      playerName: player.name,
    });
    state.currentPlayerDb = null;
    state.currentPlayer = null;
    setImmediate(() => revealNextPlayer(io, lobbyId).catch(console.error));
    return;
  }

  // ── Sold path ────────────────────────────────────────────────────────────────
  await prisma.auctionQueue.updateMany({
    where: { lobbyId, playerId: player.id, isDone: false },
    data: { isDone: true },
  });

  const winningAmount = winningBid.amount;

  if (winningAmount === MAX_PRICE[category]) {
    const contenders = [...state.maxPriceBidders];

    if (contenders.length > 1) {
      await runLuckyDraw(io, lobbyId, contenders);
      return;
    }
  }

  await sellPlayer(io, lobbyId, winningBid.seatId, winningAmount, false);
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

  const player = state.currentPlayer;
  const category = player.category;
  const seat = state.seatsMap.get(winningSeatId);
  if (!seat) return;

  // DB transaction: deduct purse, increment count, create SquadSlot + AuctionResult
  const countField = `count${category}` as "countA" | "countB" | "countC";
  await prisma.$transaction([
    prisma.lobbySeat.update({
      where: { id: winningSeatId },
      data: {
        purseRemaining: { decrement: finalPrice },
        [countField]: { increment: 1 },
      },
    }),
    prisma.squadSlot.create({
      data: {
        lobbyId,
        franchiseId: seat.franchiseId,
        lobbySeatId: seat.seatId,
        playerId: player.id,
        slotType: SlotType.AUCTION,
        pricePaid: finalPrice,
      },
    }),
    prisma.auctionResult.create({
      data: {
        lobbyId,
        playerId: player.id,
        franchiseId: seat.franchiseId,
        finalPrice,
        wasLuckyDraw,
      },
    }),
  ]);

  // Update in-memory seat
  seat.purseRemaining -= finalPrice;
  seat.categoryCount[category] += 1;
  seat.squad.push({
    franchiseId: seat.franchiseId,
    playerId: player.id,
    player,
    slotType: "AUCTION",
    pricePaid: finalPrice,
  });

  io.to(lobbyId).emit("lobby:player_sold", {
    playerId: player.id,
    seatId: winningSeatId,
    franchiseName: seat.franchiseName,
    finalPrice,
  });

  updateRosterOnSold(state.botSessions, winningSeatId, {
    category: player.category as import("@prisma/client").PlayerCategory,
    role: player.role as PlayerRole,
    finalPrice,
  }, state.quota);
  state.currentPlayerDb = null;

  state.currentPlayer = null;
  state.currentBid = null;
  setImmediate(() => revealNextPlayer(io, lobbyId).catch(console.error));
}

// ─── runLuckyDraw ─────────────────────────────────────────────────────────────

async function runLuckyDraw(
  io: IoServer,
  lobbyId: string,
  contenderSeatIds: string[],
): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state || !state.currentPlayer) return;

  state.luckyDrawActive = true;
  state.luckyDrawContenders = contenderSeatIds;

  io.to(lobbyId).emit("lobby:lucky_draw", {
    playerId: state.currentPlayer.id,
    contenderSeatIds,
  });

  await delay(LUCKY_DRAW_MS);

  state.luckyDrawActive = false;
  state.luckyDrawContenders = [];

  const winner =
    contenderSeatIds[Math.floor(Math.random() * contenderSeatIds.length)];
  const category = state.currentPlayer.category;
  await sellPlayer(io, lobbyId, winner, MAX_PRICE[category], true);
}

// ─── advancePhase ─────────────────────────────────────────────────────────────

async function advancePhase(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  const idx = PHASE_ORDER.indexOf(state.phase);
  const nextPhase = PHASE_ORDER[idx + 1] ?? "COMPLETE";

  console.log(
    `[auction] advancePhase ${state.phase} → ${nextPhase} lobbyId=${lobbyId}`,
  );
  state.phase = nextPhase;
  state.phaseQueueCache = null;

  if (nextPhase === "UNSOLD_ROUND") {
    await setupUnsoldRound(io, lobbyId);
    return;
  }

  if (nextPhase === "COMPLETE") {
    await completeAuction(io, lobbyId);
    return;
  }

  await revealNextPlayer(io, lobbyId);
}

// ─── setupUnsoldRound ─────────────────────────────────────────────────────────

async function setupUnsoldRound(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  // Fetch all unsold queue entries for this lobby
  const unsoldRows = await prisma.auctionQueue.findMany({
    where: { lobbyId, isUnsold: true },
    include: { player: true },
    orderBy: { position: "asc" },
  });

  if (unsoldRows.length === 0) {
    state.phase = "COMPLETE";
    await completeAuction(io, lobbyId);
    return;
  }

  // Cap to UNSOLD_CAP_PER_CAT per category so the round stays short.
  // Prefer players that teams still need (sort needy categories first).
  const seatsNeedingA = state.seats.filter((s) => s.categoryCount.A < state.quota.A).length;
  const seatsNeedingB = state.seats.filter((s) => s.categoryCount.B < state.quota.B).length;
  const seatsNeedingC = state.seats.filter((s) => s.categoryCount.C < state.quota.C).length;

  const catCounts: Record<string, number> = { A: 0, B: 0, C: 0 };
  const catNeeded: Record<string, number> = { A: seatsNeedingA, B: seatsNeedingB, C: seatsNeedingC };

  // Sort: needy categories first so they fill their cap before non-needy ones
  const sorted = [...unsoldRows].sort((a, b) => {
    const needA = catNeeded[a.player.category] > 0 ? 0 : 1;
    const needB = catNeeded[b.player.category] > 0 ? 0 : 1;
    return needA - needB;
  });

  const capped = sorted.filter((row) => {
    const cat = row.player.category as "A" | "B" | "C";
    if (catCounts[cat] >= UNSOLD_CAP_PER_CAT) return false;
    catCounts[cat]++;
    return true;
  });

  // Single SQL UPDATE with per-row CASE values — avoids N separate round-trips.
  // (Prisma's updateMany can't set different values per row, so raw SQL is needed.)
  const caseWhenClauses = Prisma.join(
    capped.map((row, i) => Prisma.sql`WHEN ${row.id} THEN ${i}`),
    " ",
  );
  const inList = Prisma.join(capped.map((r) => Prisma.sql`${r.id}`));
  await prisma.$executeRaw`
    UPDATE "AuctionQueue"
    SET phase = 'UNSOLD_ROUND'::"AuctionPhase",
        "isDone" = false,
        position = CASE id ${caseWhenClauses} END
    WHERE id IN (${inList})
  `;

  // Clear in-memory unsold pool
  state.unsoldPool = [];

  console.log(
    `[auction] unsold round queued ${capped.length} players (capped ${UNSOLD_CAP_PER_CAT}/cat) lobbyId=${lobbyId}`,
  );
  await revealNextPlayer(io, lobbyId);
}

// ─── completeAuction ──────────────────────────────────────────────────────────

async function completeAuction(io: IoServer, lobbyId: string): Promise<void> {
  const state = auctionStates.get(lobbyId);
  if (!state) return;

  cancelAllBots(state.botSessions);
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  await prisma.lobby.update({
    where: { id: lobbyId },
    data: { status: "COMPLETE" },
  });

  io.to(lobbyId).emit("lobby:auction_complete", { seats: state.seats });

  auctionStates.delete(lobbyId);
  console.log(`[auction] complete lobbyId=${lobbyId}`);
}
