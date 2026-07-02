// ─── Shared constants ─────────────────────────────────────────────────────────

export const SPENDING_FLOOR = 6_500_000; // 6.5M NPR minimum spend per team

// ─── Enums / Literals ────────────────────────────────────────────────────────

export type PlayerCategory = 'A' | 'B' | 'C';

export type PlayerRole = 'BAT' | 'BOWL' | 'AR' | 'WK';

export type BotPersonality =
  | 'AGGRESSIVE'
  | 'CONSERVATIVE'
  | 'ROLE_HUNTER'
  | 'BUDGET_SNIPER'
  | 'BALANCED'
  | 'STAR_CHASER';

export type LobbyStatus = 'WAITING' | 'MARQUEE_DRAW' | 'AUCTION' | 'COMPLETE';

export type AuctionPhase =
  | 'MARQUEE_DRAW'
  | 'CATEGORY_A'
  | 'CATEGORY_B'
  | 'CATEGORY_C'
  | 'CATEGORY_A_2'
  | 'CATEGORY_B_2'
  | 'CATEGORY_C_2'
  | 'UNSOLD_ROUND'
  | 'COMPLETE';

export type SeatType = 'HUMAN' | 'BOT' | 'EMPTY';

// ─── Player ──────────────────────────────────────────────────────────────────

export interface PlayerStats {
  matches: number;
  runs: number;
  wickets: number;
  batting_avg: number | null;
  strike_rate: number | null;
  bowling_avg: number | null;
  economy: number | null;
  hs: string | null;
  bbi: string | null;
}

export interface Player {
  id: string;
  name: string;
  category: PlayerCategory;
  role: PlayerRole;
  base_price: number; // NPR
  season: number;     // e.g. 2024 | 2025
  is_marquee: boolean;
  stats: PlayerStats;
}

// ─── Franchise ───────────────────────────────────────────────────────────────

export interface Franchise {
  id: string;
  name: string;
  shortName: string;  // e.g. "KTM", "PKR"
  city: string;
}

// ─── Squad slot (one acquired player on a team) ──────────────────────────────

export type SlotType = 'MARQUEE' | 'AUCTION' | 'OVERSEAS' | 'ICONIC';

export interface SquadSlot {
  franchiseId: string;
  playerId: string;
  player: Player;
  slotType: SlotType;
  pricePaid: number; // NPR; 0 for pre-assigned slots
}

// ─── Lobby & Seats ───────────────────────────────────────────────────────────

export interface LobbySeat {
  seatId: string;       // e.g. "seat_1" … "seat_8"
  seatType: SeatType;
  franchiseId: string;
  franchiseName: string;
  userId?: string;      // present when seatType === 'HUMAN'
  displayName?: string;
  botPersonality?: BotPersonality; // present when seatType === 'BOT'
  purseRemaining: number; // NPR
  squad: SquadSlot[];
  /** How many of each category have been acquired so far */
  categoryCount: {
    A: number;
    B: number;
    C: number;
  };
}

export interface Lobby {
  id: string;
  code: string;     // 6-char join code, e.g. "ABC123"
  status: LobbyStatus;
  season: number;
  seats: LobbySeat[];
  createdAt: string; // ISO timestamp
  hostUserId?: string;
  quota?: { A: number; B: number; C: number };
}

// ─── Auction State ───────────────────────────────────────────────────────────

export interface CurrentBid {
  seatId: string;
  franchiseName: string;
  amount: number; // NPR
}

export interface AuctionState {
  lobbyId: string;
  phase: AuctionPhase;
  currentPlayer: Player | null;
  currentBid: CurrentBid | null;
  timerSeconds: number;   // seconds remaining (0–10)
  seats: LobbySeat[];
  /** Players not yet sold, pending second-round re-listing */
  unsoldPool: Player[];
  /** Whether a lucky draw is currently in progress */
  luckyDrawActive: boolean;
  /** Seat IDs tied at max price during lucky draw */
  luckyDrawContenders: string[];
}

// ─── Sets Preview ────────────────────────────────────────────────────────────

export interface PlayerPreview {
  id: string;
  name: string;
  role: PlayerRole;
}

export interface SetsPreviewData {
  A: { group1: PlayerPreview[]; group2: PlayerPreview[] };
  B: { group1: PlayerPreview[]; group2: PlayerPreview[] };
  C: { group1: PlayerPreview[]; group2: PlayerPreview[] };
}

// ─── Bid Event ───────────────────────────────────────────────────────────────

export interface BidEvent {
  seatId: string;
  franchiseName: string;
  amount: number; // NPR
  timestamp: string; // ISO
}

// ─── Socket.io Events ────────────────────────────────────────────────────────

/** Events the SERVER emits to the CLIENT */
export interface ServerToClientEvents {
  /** Full lobby state sent on join or reconnect */
  'lobby:state': (lobby: Lobby) => void;

  /** Next player card revealed to all seats */
  'lobby:player_revealed': (player: Player) => void;

  /** A bid was placed (could be human or bot) */
  'lobby:bid_placed': (event: BidEvent) => void;

  /** Countdown tick */
  'lobby:timer_tick': (data: { secondsLeft: number }) => void;

  /** Player was sold */
  'lobby:player_sold': (data: {
    playerId: string;
    seatId: string;
    franchiseName: string;
    finalPrice: number;
  }) => void;

  /** Player passed to unsold pool */
  'lobby:player_unsold': (data: { playerId: string; playerName: string }) => void;

  /** Max price hit by 2+ teams — lucky draw running */
  'lobby:lucky_draw': (data: {
    playerId: string;
    contenderSeatIds: string[];
  }) => void;

  /** Marquee player assigned to a franchise */
  'lobby:marquee_assigned': (data: {
    playerId: string;
    playerName: string;
    franchiseId: string;
    franchiseName: string;
  }) => void;

  /** Bot is deliberating — show typing indicator */
  'lobby:bot_thinking': (data: { seatId: string; franchiseName: string }) => void;

  /** All auction slots filled — show final squads */
  'lobby:auction_complete': (data: { seats: LobbySeat[]; floorPerSeat: Record<string, boolean> }) => void;

  /** Server-side error */
  'lobby:error': (data: { message: string; code?: string }) => void;

  /** Upcoming players queue */
  'lobby:queue_update': (data: {
    upcoming: Array<{
      playerId: string;
      playerName: string;
      category: PlayerCategory;
      role: PlayerRole;
      basePrice: number;
    }>;
  }) => void;

  /** Auction paused (quickplay only) */
  'lobby:auction_paused': (data: { isPaused: true }) => void;

  /** Auction resumed after pause (quickplay only) */
  'lobby:auction_resumed': (data: { isPaused: false }) => void;

  /** Player group sets revealed before auction starts (5s preview) */
  'lobby:sets_preview': (data: SetsPreviewData) => void;
}

/** Events the CLIENT emits to the SERVER */
export interface ClientToServerEvents {
  /** Associate this socket with a lobby seat (send immediately on connect) */
  'lobby:join': (data: { lobbyId: string; userId: string; seatId: string }) => void;

  /** Host starts the auction (lobby must be in WAITING status) */
  'lobby:start': (data: { lobbyId: string; testMode?: boolean }) => void;

  /** Human places a bid */
  'lobby:place_bid': (data: { lobbyId: string; amount: number }) => void;

  /** Human explicitly passes on the current player */
  'lobby:pass': (data: { lobbyId: string }) => void;

  /** Pause the auction (quickplay / bot-only games only) */
  'lobby:pause': (data: { lobbyId: string }) => void;

  /** Resume a paused auction (quickplay / bot-only games only) */
  'lobby:resume': (data: { lobbyId: string }) => void;
}

/** Inter-server events (not used client-side, but exported for completeness) */
export type InterServerEvents = Record<string, never>;

/** Per-socket data stored server-side */
export interface SocketData {
  userId: string;
  lobbyId: string;
  seatId: string;
}
