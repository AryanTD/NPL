import { Server } from 'socket.io';
import { BotPersonality, PlayerCategory } from '@prisma/client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@npl-auction/types';
import { decide, BotContext } from './claudeBot';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const THINK_MIN_MS = 1_500;
const THINK_MAX_MS = 3_500;

function thinkDelay(signal: AbortSignal): Promise<void> {
  const ms = THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Bot decision aborted', 'AbortError'));
    }, { once: true });
  });
}

export interface BotSeatInfo {
  seatId:         string;
  franchiseName:  string;
  personality:    BotPersonality;
  purseRemaining: number;
  /** Minimum purse that must remain after bidding to cover unfilled slots */
  minPurseBuffer: number;
}

/**
 * Trigger a bot decision for a single seat.
 *
 * Pass an AbortSignal so the auction engine can cancel in-flight decisions
 * when the player is sold, the timer expires, or the phase advances.
 * If the signal fires during the think delay, the function returns silently
 * without calling onBid.
 */
export async function triggerBotDecision(
  io: IoServer,
  lobbyId: string,
  seat: BotSeatInfo,
  currentBid: number | null,
  basePrice: number,
  maxPrice: number,
  category: PlayerCategory,
  signal: AbortSignal,
  /** Callback invoked only when bot decides to BID and signal is still live */
  onBid: (seatId: string, amount: number) => void,
): Promise<void> {
  // Show thinking indicator to all clients in the room
  io.to(lobbyId).emit('lobby:bot_thinking', {
    seatId:        seat.seatId,
    franchiseName: seat.franchiseName,
  });

  try {
    await thinkDelay(signal);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    throw err;
  }

  // Double-check: signal may have fired between delay resolution and here
  if (signal.aborted) return;

  const ctx: BotContext = {
    personality:    seat.personality,
    currentBid,
    basePrice,
    maxPrice,
    category,
    purseRemaining: seat.purseRemaining,
    minPurseBuffer: seat.minPurseBuffer,
  };

  const decision = decide(ctx);

  if (decision.action === 'BID' && decision.amount !== undefined) {
    onBid(seat.seatId, decision.amount);
  }
  // PASS — do nothing; the auction timer continues
}
