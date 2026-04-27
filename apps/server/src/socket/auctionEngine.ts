import { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  AuctionState,
  LobbySeat,
  Player,
  CurrentBid,
  AuctionPhase,
} from '@npl-auction/types';

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

// ─── Register handlers ────────────────────────────────────────────────────────

export function registerAuctionHandlers(io: IoServer, socket: IoSocket): void {
  socket.on('lobby:join', (data) => {
    console.log(`[auction] lobby:join — socket ${socket.id} seat ${data.seatId}`);
  });

  socket.on('lobby:start', (data) => {
    console.log(`[auction] lobby:start — lobbyId ${data.lobbyId}`);
  });

  socket.on('lobby:place_bid', (data) => {
    console.log(`[auction] lobby:place_bid — lobbyId ${data.lobbyId} amount ${data.amount}`);
  });

  socket.on('lobby:pass', (data) => {
    console.log(`[auction] lobby:pass — lobbyId ${data.lobbyId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[auction] disconnect — socket ${socket.id} reason ${reason}`);
  });
}
