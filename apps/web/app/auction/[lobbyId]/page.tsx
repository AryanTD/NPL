"use client";

import { memo, Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type {
  BidEvent,
  Lobby,
  LobbySeat,
  Player,
  PlayerCategory,
  PlayerRole,
  SetsPreviewData,
  PlayerPreview,
} from "@npl-auction/types";
import { SPENDING_FLOOR } from "@npl-auction/types";
import socket from "../../../lib/socket";
import TutorialOverlay, { type TourStep } from "./TutorialOverlay";

const AUCTION_TOUR_STEPS: TourStep[] = [
  {
    targetId: "tour-player-card",
    title: "",
    body: "The category shows the price band. Base price is where bidding starts and max price is the ceiling.",
  },
  {
    targetId: "tour-bid-panel",
    title: "",
    body: "Every bid must raise the price by at least 25K. If the timer runs out with no bids, the player goes unsold.",
  },
  {
    targetId: "tour-bid-actions",
    title: "",
    body: "If two or more teams reach max price, a lucky draw picks the winner. Press ENTER LUCKY DRAW to join.",
  },
  {
    targetId: "tour-squad-panel",
    title: "",
    body: "Track your remaining quota and budget here. The bid button turns off if a bid would leave your squad incomplete.",
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const FRANCHISE_META: Record<
  string,
  { shortName: string; primary: string; secondary: string; city: string }
> = {
  "Kathmandu Gorkhas": {
    shortName: "KTM",
    primary: "#1B3A6B",
    secondary: "#C9A84C",
    city: "Kathmandu",
  },
  "Pokhara Avengers": {
    shortName: "PKR",
    primary: "#C0392B",
    secondary: "#FFFFFF",
    city: "Pokhara",
  },
  "Chitwan Rhinos": {
    shortName: "CHT",
    primary: "#196F3D",
    secondary: "#F4D03F",
    city: "Chitwan",
  },
  "Biratnagar Kings": {
    shortName: "BRT",
    primary: "#6C3483",
    secondary: "#F9E79F",
    city: "Biratnagar",
  },
  "Janakpur Bolts": {
    shortName: "JNK",
    primary: "#1A5276",
    secondary: "#F39C12",
    city: "Janakpur",
  },
  "Lumbini Lions": {
    shortName: "LMB",
    primary: "#922B21",
    secondary: "#FAD7A0",
    city: "Lumbini",
  },
  "Sudurpaschim Royals": {
    shortName: "SDR",
    primary: "#0E6655",
    secondary: "#A9DFBF",
    city: "Sudurpaschim",
  },
  "Karnali Yaks": {
    shortName: "KRN",
    primary: "#4A235A",
    secondary: "#D7BDE2",
    city: "Karnali",
  },
};

const CAT_COLOR: Record<string, string> = {
  A: "#F59E0B",
  B: "#60A5FA",
  C: "#34D399",
  MARQUEE: "#F472B6",
};
const CAT_BASE: Record<string, number> = {
  A: 1_000_000,
  B: 500_000,
  C: 200_000,
};
const CAT_MAX: Record<string, number> = {
  A: 1_500_000,
  B: 1_000_000,
  C: 500_000,
};
const CAT_LABEL: Record<string, string> = {
  A: "Category A",
  B: "Category B",
  C: "Category C",
  CATEGORY_A: "Category A",
  CATEGORY_B: "Category B",
  CATEGORY_C: "Category C",
  CATEGORY_A_2: "Category A",
  CATEGORY_B_2: "Category B",
  CATEGORY_C_2: "Category C",
  MARQUEE_DRAW: "Marquee Draw",
  UNSOLD_ROUND: "Unsold Round",
};
const DEFAULT_CAT_QUOTAS = { A: 3, B: 4, C: 3 } as const;
const BUDGET = 9_000_000;
const BID_INC = 25_000;
const TIMER_MAX = 10;

const ROLE_LABEL: Record<string, string> = {
  BAT: "Batsman",
  BOWL: "Bowler",
  AR: "All-Rounder",
  WK: "WK-Batsman",
};
const ROLE_BADGE: Record<string, string> = {
  BAT: "BAT",
  BOWL: "BWL",
  AR: "AR",
  WK: "WK",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function meta(name: string) {
  return (
    FRANCHISE_META[name] ?? {
      shortName: "???",
      primary: "#5b6f9a",
      secondary: "#e4e9f4",
      city: "",
    }
  );
}

function fmtNPR(n: number): string {
  if (n >= 1_000_000) return `रू${(n / 100_000).toFixed(1).replace(".0", "")}L`;
  return `रू${Math.round(n / 1_000)}K`;
}

function fmtL(n: number): string {
  return `रू${(n / 100_000).toFixed(1).replace(".0", "")}L`;
}

function canAffordBid(
  seat: LobbySeat,
  newBid: number,
  player: Player,
  quota: { A: number; B: number; C: number },
): boolean {
  if (seat.purseRemaining < newBid) return false;
  const cat = player.category;
  const aLeft = Math.max(
    0,
    quota.A - seat.categoryCount.A - (cat === "A" ? 2 : 0),
  );
  const bLeft = Math.max(
    0,
    quota.B - seat.categoryCount.B - (cat === "B" ? 1 : 0),
  );
  const cLeft = Math.max(
    0,
    quota.C - seat.categoryCount.C - (cat === "C" ? 1 : 0),
  );
  const minNeeded =
    aLeft * CAT_BASE.A + bLeft * CAT_BASE.B + cLeft * CAT_BASE.C;
  return seat.purseRemaining - newBid >= minNeeded;
}

function hasQuota(
  seat: LobbySeat,
  cat: string,
  quota: { A: number; B: number; C: number },
): boolean {
  if (cat === "A" && seat.categoryCount.A >= quota.A) return false;
  if (cat === "B" && seat.categoryCount.B >= quota.B) return false;
  if (cat === "C" && seat.categoryCount.C >= quota.C) return false;
  return true;
}

function parseBBIWickets(bbi: string | null): number {
  if (!bbi) return 0;
  const n = parseInt(bbi.split("/")[0], 10);
  return isNaN(n) ? 0 : n;
}

function parseHS(hs: string | null): number {
  if (!hs) return 0;
  const n = parseInt(hs.replace("*", ""), 10);
  return isNaN(n) ? 0 : n;
}

// statRows returns exactly 5 items in layout order: [top1, top2, HERO, bottom1, bottom2]
function statRows(player: Player): { label: string; value: string }[] {
  const s = player.stats;
  const dec = (v: number | null): string =>
    v === null || v === 0 ? "—" : v.toFixed(1);
  const int = (v: number): string => (v === 0 ? "—" : String(v));

  switch (player.role) {
    case "BAT":
    case "WK":
      // top: MATCHES · AVG   hero: RUNS   bottom: SR · HS
      return [
        { label: "MATCHES", value: String(s.matches) },
        { label: "AVG", value: dec(s.batting_avg) },
        { label: "RUNS", value: String(s.runs) },
        { label: "SR", value: dec(s.strike_rate) },
        { label: "HS", value: s.hs ?? "—" },
      ];
    case "BOWL":
      // top: MATCHES · ECON   hero: WKTS   bottom: AVG · BBI
      return [
        { label: "MATCHES", value: String(s.matches) },
        { label: "ECON", value: dec(s.economy) },
        { label: "WKTS", value: int(s.wickets) },
        { label: "AVG", value: dec(s.bowling_avg) },
        { label: "BBI", value: s.bbi ?? "—" },
      ];
    case "AR": {
      const sr = s.strike_rate;
      const econ = s.economy;
      const hsParsed = parseHS(s.hs);
      const bbiWkts = parseBBIWickets(s.bbi);

      // Both notable → top: MATCHES · WKTS   hero: RUNS   bottom: HS · BBI
      if (hsParsed >= 50 && bbiWkts >= 4) {
        return [
          { label: "MATCHES", value: String(s.matches) },
          { label: "WKTS", value: int(s.wickets) },
          { label: "RUNS", value: String(s.runs) },
          { label: "HS", value: s.hs ?? "—" },
          { label: "BBI", value: s.bbi ?? "—" },
        ];
      }

      // flex4 (top-right): SR vs ECON
      const srGood = sr !== null && sr > 120;
      const econGood = econ !== null && econ < 7.5;
      let flex4Label: string;
      let flex4Value: string;
      if (sr !== null && sr > 140) {
        flex4Label = "SR";
        flex4Value = dec(sr);
      } else if (srGood && !econGood) {
        flex4Label = "SR";
        flex4Value = dec(sr);
      } else if (econGood && !srGood) {
        flex4Label = "ECON";
        flex4Value = dec(econ);
      } else {
        const pickSR = Math.random() > 0.5;
        flex4Label = pickSR ? "SR" : "ECON";
        flex4Value = pickSR ? dec(sr) : dec(econ);
      }

      // flex5 (bottom-right): HS vs BBI
      let flex5Label: string;
      let flex5Value: string;
      if (hsParsed >= 50) {
        flex5Label = "HS";
        flex5Value = s.hs ?? "—";
      } else if (bbiWkts >= 4) {
        flex5Label = "BBI";
        flex5Value = s.bbi ?? "—";
      } else if (hsParsed > 40) {
        flex5Label = "HS";
        flex5Value = s.hs ?? "—";
      } else {
        const pickHS = Math.random() > 0.5;
        flex5Label = pickHS ? "HS" : "BBI";
        flex5Value = pickHS ? (s.hs ?? "—") : (s.bbi ?? "—");
      }

      // top: MATCHES · flex4   hero: RUNS   bottom: WKTS · flex5
      return [
        { label: "MATCHES", value: String(s.matches) },
        { label: flex4Label, value: flex4Value },
        { label: "RUNS", value: String(s.runs) },
        { label: "WKTS", value: int(s.wickets) },
        { label: flex5Label, value: flex5Value },
      ];
    }
    default:
      return [
        { label: "MATCHES", value: String(s.matches) },
        { label: "AVG", value: dec(s.batting_avg) },
        { label: "RUNS", value: String(s.runs) },
        { label: "WKTS", value: int(s.wickets) },
        { label: "BBI", value: s.bbi ?? "—" },
      ];
  }
}

// ─── Root export (Suspense for params) ───────────────────────────────────────

export default function AuctionPageWrapper() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <AuctionPage />
    </Suspense>
  );
}

function FullPageLoader() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div
        className="animate-spin-slow"
        style={{
          width: 28,
          height: 28,
          border: "2px solid var(--border2)",
          borderTopColor: "var(--gold)",
          borderRadius: "50%",
        }}
      />
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BidPanelState = "bidding" | "sold" | "unsold";

interface CurrentBidInfo {
  seatId: string;
  franchiseName: string;
  amount: number;
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AuctionPage() {
  const params = useParams();
  const sp = useSearchParams();
  const { data: session } = useSession();
  const userId =
    session?.user?.id ??
    (typeof window !== "undefined"
      ? (localStorage.getItem("npl_guest_id") ?? "")
      : "");

  const lobbyId = params.lobbyId as string;
  const seatId = sp.get("seatId") ?? "";

  // Core state
  const [catQuotas, setCatQuotas] = useState<{
    A: number;
    B: number;
    C: number;
  }>(DEFAULT_CAT_QUOTAS);
  const [seats, setSeats] = useState<LobbySeat[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentBid, setCurrentBid] = useState<CurrentBidInfo | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(TIMER_MAX);
  const [bidPanelState, setBidPanelState] = useState<BidPanelState>("bidding");
  const [soldInfo, setSoldInfo] = useState<{
    franchiseName: string;
    primary: string;
    price: number;
  } | null>(null);
  const [playerKey, setPlayerKey] = useState(0); // for pop-in re-trigger
  const [bidPending, setBidPending] = useState(false);
  const categoryRevealCount = useRef<Record<string, number>>({
    A: 0,
    B: 0,
    C: 0,
  });
  const [showPlane, setShowPlane] = useState(false);
  const [bidNotifs, setBidNotifs] = useState<
    Array<{ id: number; shortName: string; amount: number; primary: string }>
  >([]);
  const bidNotifCounter = useRef(0);
  const bidNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lucky draw state
  const [luckyActive, setLuckyActive] = useState(false);
  const [luckyContenders, setLuckyContenders] = useState<string[]>([]);
  const [luckyWinner, setLuckyWinner] = useState<string | null>(null);
  const [hasEnteredLuckyDraw, setHasEnteredLuckyDraw] = useState(false);
  // Tracks which seatIds have bid max price for the current player (shown in real-time)
  const [luckyDrawEntrants, setLuckyDrawEntrants] = useState<string[]>([]);

  // Pause state (quickplay only)
  const [isPaused, setIsPaused] = useState(false);

  // Complete state
  const [auctionComplete, setAuctionComplete] = useState(false);
  const [finalSeats, setFinalSeats] = useState<LobbySeat[] | null>(null);
  const [floorPerSeat, setFloorPerSeat] = useState<Record<string, boolean>>({});

  // Tour state
  const [showTour, setShowTour] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(false);

  // Sets preview state
  const [setsData, setSetsData] = useState<SetsPreviewData | null>(null);
  const [showSets, setShowSets] = useState(false);

  // Sold/unsold counts
  const [soldCount, setSoldCount] = useState(0);

  // Recent buys (last 5 sold players, shown in the left panel)
  const [recentBuys, setRecentBuys] = useState<
    Array<{
      playerName: string;
      franchiseName: string;
      shortName: string;
      finalPrice: number;
      category: PlayerCategory;
    }>
  >([]);

  // Upcoming queue
  const [upcomingQueue, setUpcomingQueue] = useState<
    Array<{
      playerId: string;
      playerName: string;
      category: PlayerCategory;
      role: PlayerRole;
      basePrice: number;
    }>
  >([]);

  // Ref so socket closures always see the latest currentPlayer
  const currentPlayerRef = useRef<Player | null>(null);
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  // Ref so socket closures always see current luckyActive (state is stale inside socket handlers)
  const luckyActiveRef = useRef(false);
  // Buffer for player_revealed events that arrive while the lucky draw overlay is showing
  const pendingRevealRef = useRef<Player | null>(null);

  // ── Load sets preview from sessionStorage ────────────────────────────────
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("npl_sets_preview");
      if (stored) setSetsData(JSON.parse(stored) as SetsPreviewData);
    } catch {}
  }, []);

  // ── Socket lifecycle ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !seatId || !userId) return;

    socket.connect();

    socket.on("connect", () => {
      socket.emit("lobby:join", { lobbyId, userId, seatId });
    });

    socket.on("lobby:state", (lobby: Lobby) => {
      setSeats(lobby.seats);
      if (lobby.quota) setCatQuotas(lobby.quota);
      // Restore sold count from squad data on reconnect
      const auctionSold = lobby.seats.reduce(
        (sum, s) =>
          sum + s.squad.filter((sl) => sl.slotType === "AUCTION").length,
        0,
      );
      setSoldCount(auctionSold);
      // Keep session fresh so the landing page can offer rejoin (skip if already complete)
      if (lobby.status !== "COMPLETE") {
        localStorage.setItem(
          "npl_session",
          JSON.stringify({ lobbyId, seatId, code: lobby.code }),
        );
      } else {
        localStorage.removeItem("npl_session");
      }
    });

    socket.on("lobby:player_revealed", (player: Player) => {
      // If the lucky draw overlay is still showing, buffer this event.
      // handleLuckyDrawClose will apply it after the overlay closes.
      if (luckyActiveRef.current) {
        pendingRevealRef.current = player;
        return;
      }
      applyPlayerRevealed(player);
    });

    socket.on("lobby:bid_placed", (event: BidEvent) => {
      const m = meta(event.franchiseName);
      setCurrentBid({
        seatId: event.seatId,
        franchiseName: event.franchiseName,
        amount: event.amount,
      });
      setBidPending(false);
      const notifId = ++bidNotifCounter.current;
      setBidNotifs((prev) =>
        [
          {
            id: notifId,
            shortName: m.shortName,
            amount: event.amount,
            primary: m.primary,
          },
          ...prev,
        ].slice(0, 4),
      );
      if (bidNotifTimerRef.current) clearTimeout(bidNotifTimerRef.current);
      bidNotifTimerRef.current = setTimeout(() => setBidNotifs([]), 4_000);
      // Track teams that have reached max price (entered the lucky draw pool)
      const catMaxNow = currentPlayerRef.current
        ? (CAT_MAX[currentPlayerRef.current.category] ?? 0)
        : 0;
      if (catMaxNow > 0 && event.amount >= catMaxNow) {
        setLuckyDrawEntrants((prev) =>
          prev.includes(event.seatId) ? prev : [...prev, event.seatId],
        );
      }
    });

    socket.on(
      "lobby:timer_tick",
      ({ secondsLeft }: { secondsLeft: number }) => {
        setTimerSeconds(secondsLeft);
        // Capture the starting value so the progress bar always starts full
        setTimerMax((prev) => Math.max(prev, secondsLeft));
      },
    );

    socket.on(
      "lobby:player_sold",
      ({
        playerId,
        seatId: winnerId,
        franchiseName,
        finalPrice,
      }: {
        playerId: string;
        seatId: string;
        franchiseName: string;
        finalPrice: number;
      }) => {
        const player = currentPlayerRef.current;
        const cat = player?.category;
        const m = meta(franchiseName);
        if (cat && player) {
          setSeats((prev) =>
            prev.map((s) => {
              if (s.seatId !== winnerId) return s;
              return {
                ...s,
                purseRemaining: s.purseRemaining - finalPrice,
                categoryCount: {
                  ...s.categoryCount,
                  [cat]: s.categoryCount[cat] + 1,
                },
                squad: [
                  ...s.squad,
                  {
                    franchiseId: s.franchiseId,
                    playerId,
                    player,
                    slotType: "AUCTION" as const,
                    pricePaid: finalPrice,
                  },
                ],
              };
            }),
          );
        }
        setSoldCount((c) => c + 1);
        if (player) {
          setRecentBuys((prev) =>
            [
              {
                playerName: player.name,
                franchiseName,
                shortName: m.shortName,
                finalPrice,
                category: player.category,
              },
              ...prev,
            ].slice(0, 5),
          );
        }

        if (luckyActiveRef.current) {
          // Lucky draw path: store winner + sold info; don't clear currentPlayer so
          // the overlay stays mounted and can reveal the winner before closing.
          setLuckyWinner(winnerId);
          setSoldInfo({ franchiseName, primary: m.primary, price: finalPrice });
        } else {
          // Normal sold flow
          setSoldInfo({ franchiseName, primary: m.primary, price: finalPrice });
          setBidPanelState("sold");
          setCurrentPlayer(null);
          setCurrentBid(null);
        }
      },
    );

    socket.on(
      "lobby:player_unsold",
      ({ playerName }: { playerId: string; playerName: string }) => {
        setBidPanelState("unsold");
        setCurrentPlayer(null);
        setCurrentBid(null);
      },
    );

    socket.on(
      "lobby:lucky_draw",
      ({
        contenderSeatIds,
      }: {
        playerId: string;
        contenderSeatIds: string[];
      }) => {
        luckyActiveRef.current = true;
        setLuckyActive(true);
        setLuckyContenders(contenderSeatIds);
        setLuckyWinner(null);
      },
    );

    socket.on(
      "lobby:marquee_assigned",
      ({
        playerName,
        franchiseName,
      }: {
        playerId: string;
        playerName: string;
        franchiseId: string;
        franchiseName: string;
      }) => {},
    );

    socket.on(
      "lobby:queue_update",
      ({
        upcoming,
      }: {
        upcoming: Array<{
          playerId: string;
          playerName: string;
          category: PlayerCategory;
          role: PlayerRole;
          basePrice: number;
        }>;
      }) => {
        setUpcomingQueue(upcoming);
      },
    );

    socket.on("lobby:bot_thinking", () => {
      // Subtle — no visible indicator needed beyond bid placement
    });

    socket.on(
      "lobby:auction_complete",
      ({
        seats: done,
        floorPerSeat: fpm,
      }: {
        seats: LobbySeat[];
        floorPerSeat: Record<string, boolean>;
      }) => {
        setAuctionComplete(true);
        setFinalSeats(done);
        setFloorPerSeat(fpm);
        setCurrentPlayer(null);
        setCurrentBid(null);
        localStorage.removeItem("npl_session");
      },
    );

    socket.on(
      "lobby:error",
      ({ message, code }: { message: string; code?: string }) => {
        setBidPending(false);
        setHasEnteredLuckyDraw(false);
        if (code === "SESSION_LOST") return; // handled by redirect logic
      },
    );

    socket.on("lobby:auction_paused", () => setIsPaused(true));
    socket.on("lobby:auction_resumed", () => setIsPaused(false));

    return () => {
      socket.off("connect");
      socket.off("lobby:state");
      socket.off("lobby:player_revealed");
      socket.off("lobby:bid_placed");
      socket.off("lobby:timer_tick");
      socket.off("lobby:player_sold");
      socket.off("lobby:player_unsold");
      socket.off("lobby:lucky_draw");
      socket.off("lobby:marquee_assigned");
      socket.off("lobby:queue_update");
      socket.off("lobby:bot_thinking");
      socket.off("lobby:auction_complete");
      socket.off("lobby:error");
      socket.off("lobby:auction_paused");
      socket.off("lobby:auction_resumed");
      socket.disconnect();
    };
  }, [lobbyId, seatId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──────────────────────────────────────────────────────────────

  const mySeat = seats.find((s) => s.seatId === seatId) ?? null;
  const isQuickPlay = seats.filter((s) => s.seatType === "HUMAN").length === 1;
  const isUserLeading = currentBid?.seatId === seatId;
  const bidderMeta = currentBid ? meta(currentBid.franchiseName) : null;
  const [timerMax, setTimerMax] = useState(TIMER_MAX);
  const timerPct = (timerSeconds / timerMax) * 100;
  const timerColor =
    timerSeconds <= 3
      ? "#ef4444"
      : timerSeconds <= Math.ceil(timerMax * 0.6)
        ? "#f59e0b"
        : "var(--green)";
  const catCfg = currentPlayer
    ? {
        color: CAT_COLOR[currentPlayer.category] ?? "#888",
        label: CAT_LABEL[currentPlayer.category] ?? currentPlayer.category,
        base: currentPlayer.base_price,
        max: CAT_MAX[currentPlayer.category] ?? currentPlayer.base_price,
      }
    : null;

  const catMax = currentPlayer ? (CAT_MAX[currentPlayer.category] ?? 0) : 0;
  const atMaxPrice = !!(
    currentBid &&
    currentBid.amount >= catMax &&
    catMax > 0
  );

  // Increment buttons — hidden when at max price (lucky draw entry only)
  const incrementOptions: { label: string; amount: number }[] =
    currentPlayer && mySeat && !atMaxPrice
      ? (currentPlayer.category === "C"
          ? [BID_INC, BID_INC * 2]
          : [BID_INC, BID_INC * 2, BID_INC * 4]
        ).map((inc) => ({
          label: `+${fmtNPR(inc)}`,
          amount:
            (currentBid?.amount ?? currentPlayer.base_price - BID_INC) + inc,
        }))
      : [];

  // At max price: bid exactly max (to enter lucky draw); otherwise current + increment
  const nextBid = atMaxPrice
    ? catMax
    : currentBid
      ? currentBid.amount + BID_INC
      : (currentPlayer?.base_price ?? 0);

  const canBidNow = !!(
    mySeat &&
    currentPlayer &&
    !luckyActive &&
    !bidPending &&
    !isPaused &&
    !hasEnteredLuckyDraw &&
    bidPanelState === "bidding" &&
    mySeat.seatType === "HUMAN" &&
    hasQuota(mySeat, currentPlayer.category, catQuotas) &&
    canAffordBid(mySeat, nextBid, currentPlayer, catQuotas) &&
    !(atMaxPrice && isUserLeading)
  );

  // ── Tour auto-trigger ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const hasSeenLocal = localStorage.getItem("hasSeenAuctionTour") === "true";
    const hasSeen = hasSeenLocal || session?.user?.hasSeenAuctionTour === true;
    if (hasSeen) {
      setTourDismissed(true);
      return;
    }
    if (!tourDismissed) {
      const t = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(t);
    }
  }, [userId]); // intentionally excludes tourDismissed to avoid loop

  function handleBid(amount: number) {
    if (!mySeat || !currentPlayer) return;
    if (!hasQuota(mySeat, currentPlayer.category, catQuotas)) return;
    if (!canAffordBid(mySeat, amount, currentPlayer, catQuotas)) return;
    if (atMaxPrice) setHasEnteredLuckyDraw(true);
    setBidPending(true);
    socket.emit("lobby:place_bid", { lobbyId, amount });
  }

  function applyPlayerRevealed(player: Player) {
    setBidNotifs([]);
    if (bidNotifTimerRef.current) {
      clearTimeout(bidNotifTimerRef.current);
      bidNotifTimerRef.current = null;
    }
    setCurrentPlayer(player);
    setCurrentBid(null);
    setTimerSeconds(TIMER_MAX);
    setTimerMax(0);
    setBidPanelState("bidding");
    setSoldInfo(null);
    setBidPending(false);
    setLuckyActive(false);
    setLuckyContenders([]);
    setLuckyWinner(null);
    setHasEnteredLuckyDraw(false);
    setLuckyDrawEntrants([]);
    setPlayerKey((k) => k + 1);
    const cat = player.category as string;
    categoryRevealCount.current[cat] =
      (categoryRevealCount.current[cat] ?? 0) + 1;
    if (categoryRevealCount.current[cat] === 4) setShowPlane(true);
  }

  function handleLuckyDrawClose() {
    luckyActiveRef.current = false;
    setLuckyActive(false);
    setLuckyContenders([]);
    setLuckyWinner(null);
    setHasEnteredLuckyDraw(false);
    setCurrentBid(null);
    // Show "SOLD TO" panel with the winner; cleared when the next player arrives
    setBidPanelState("sold");

    // player_revealed was buffered while the overlay was open — apply it after
    // showing the sold panel briefly so the user can see who won
    const buffered = pendingRevealRef.current;
    pendingRevealRef.current = null;
    if (buffered) {
      setTimeout(() => applyPlayerRevealed(buffered), 0);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (auctionComplete && finalSeats) {
    return (
      <AuctionCompleteScreen
        seats={finalSeats}
        mySeatId={seatId}
        floorPerSeat={floorPerSeat}
      />
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Top bar (52px) */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: 2,
            color: "var(--red)",
          }}
        >
          NPL
        </div>
        <div
          style={{
            width: 1,
            height: 18,
            background: "var(--border)",
            flexShrink: 0,
          }}
        />

        {currentPlayer && catCfg && (
          <div
            style={{
              background: `${catCfg.color}20`,
              border: `1px solid ${catCfg.color}50`,
              borderRadius: 5,
              padding: "3px 9px",
              fontFamily: "Rajdhani",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 1,
              color: catCfg.color,
            }}
          >
            {catCfg.label.toUpperCase()}
          </div>
        )}

        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          <span
            style={{
              color: "var(--text)",
              fontFamily: "Rajdhani",
              fontWeight: 700,
            }}
          >
            {soldCount}
          </span>{" "}
          sold
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {setsData && (
            <button
              onClick={() => setShowSets(true)}
              title="View Player Groups"
              style={{
                height: 26,
                padding: "0 9px",
                borderRadius: 5,
                background: "var(--s3)",
                border: "1px solid var(--border2)",
                color: "var(--muted2)",
                fontSize: 10,
                fontFamily: "Rajdhani",
                fontWeight: 700,
                letterSpacing: 1,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              SETS
            </button>
          )}
          {tourDismissed && !showTour && (
            <button
              onClick={() => {
                setTourDismissed(false);
                setShowTour(true);
              }}
              title="How to Play"
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--s3)",
                border: "1px solid var(--border2)",
                color: "var(--muted2)",
                fontSize: 13,
                fontFamily: "Rajdhani",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ?
            </button>
          )}
          <FranchiseCrest
            franchiseName={mySeat?.franchiseName ?? ""}
            size={28}
          />
          <div>
            <div
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}
            >
              {mySeat?.franchiseName ?? "—"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                display: "flex",
                gap: 6,
              }}
            >
              <span
                style={{
                  color: "var(--green)",
                  fontFamily: "Rajdhani",
                  fontWeight: 600,
                }}
              >
                {fmtL(mySeat?.purseRemaining ?? BUDGET)}
              </span>
              <span>remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body: 3 columns */}
      <div
        style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
      >
        {/* LEFT: Queue (210px) */}
        <div
          style={{
            width: 210,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              color: "var(--muted)",
              letterSpacing: 1,
            }}
          >
            COMING UP
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
            {upcomingQueue.length === 0 ? (
              <div
                style={{
                  padding: "20px 8px",
                  fontSize: 12,
                  color: "var(--muted)",
                  textAlign: "center",
                }}
              >
                Auction starting…
              </div>
            ) : (
              upcomingQueue.map((player) => (
                <div
                  key={player.playerId}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    padding: "6px 8px",
                    borderBottom: "1px solid #0c0f1c",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background:
                        CAT_COLOR[player.category] ?? CAT_COLOR.MARQUEE,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {player.playerName}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        marginTop: 1,
                      }}
                    >
                      {ROLE_BADGE[player.role] ?? player.role} ·{" "}
                      {fmtNPR(player.basePrice)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent buys */}
          {recentBuys.length > 0 && (
            <div
              style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  letterSpacing: 1,
                  padding: "8px 14px 4px",
                }}
              >
                RECENT BUYS
              </div>
              <div style={{ padding: "0 6px 6px" }}>
                {recentBuys.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderBottom: "1px solid #0c0f1c",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: CAT_COLOR[b.category] ?? CAT_COLOR.MARQUEE,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {b.playerName}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--muted)",
                          marginTop: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {b.shortName} · {fmtNPR(b.finalPrice)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CENTER: Auction floor */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: 20,
            gap: 14,
            overflow: "auto",
          }}
        >
          {currentPlayer && bidPanelState === "bidding" ? (
            <div
              key={playerKey}
              className="animate-pop-in"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                width: "100%",
                maxWidth: 340,
              }}
            >
              {/* Player card */}
              <div
                id="tour-player-card"
                style={{
                  background: "var(--s1)",
                  border: `1px solid ${catCfg?.color}40`,
                  borderRadius: 12,
                  overflow: "hidden",
                  width: "100%",
                }}
              >
                {/* Colored header strip */}
                <div
                  style={{
                    background: catCfg?.color,
                    padding: "7px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Rajdhani",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#07080f",
                      letterSpacing: 0.5,
                    }}
                  >
                    {catCfg?.label} ·{" "}
                    {ROLE_BADGE[currentPlayer.role] ?? currentPlayer.role}
                  </span>
                  <span
                    style={{ fontSize: 11, color: "#07080f", opacity: 0.6 }}
                  >
                    Base {fmtNPR(catCfg?.base ?? 0)} · Max{" "}
                    {fmtNPR(catCfg?.max ?? 0)}
                  </span>
                </div>

                {/* Avatar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "20px 20px 12px",
                  }}
                >
                  <PlayerAvatar player={currentPlayer} />
                </div>

                {/* Name + role */}
                <div style={{ padding: "0 16px 14px", textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "Rajdhani",
                      fontWeight: 700,
                      fontSize: 24,
                      color: "var(--text)",
                    }}
                  >
                    {currentPlayer.name}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      marginTop: 2,
                    }}
                  >
                    {ROLE_LABEL[currentPlayer.role] ?? currentPlayer.role}
                  </div>
                </div>

                {/* Stats: side columns + overlapping center hero */}
                {(() => {
                  const rows = statRows(currentPlayer);
                  if (rows.length < 5) return null;
                  const [t1, t2, hero, b1, b2] = rows;
                  const sideCell = (s: { label: string; value: string }) => (
                    <div
                      key={s.label}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "8px 0",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Rajdhani",
                          fontWeight: 700,
                          fontSize: 22,
                          color: "var(--text)",
                        }}
                      >
                        {s.value}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          marginTop: 2,
                        }}
                      >
                        {s.label}
                      </div>
                    </div>
                  );
                  return (
                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "stretch",
                        padding: "22px 12px",
                        gap: 8,
                      }}
                    >
                      {/* Left column */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 0,
                        }}
                      >
                        {sideCell(t1)}
                        <div
                          style={{
                            height: 1,
                            background: "var(--border)",
                            margin: "0 8px",
                          }}
                        />
                        {sideCell(b1)}
                      </div>

                      {/* Center hero — taller, overlaps via negative margin */}
                      <div
                        style={{
                          flex: "0 0 38%",
                          margin: "-20px 0",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: `${catCfg?.color}15`,
                          border: `1.5px solid ${catCfg?.color}55`,
                          borderRadius: 10,
                          boxShadow: `0 4px 18px ${catCfg?.color}30`,
                          zIndex: 1,
                          position: "relative",
                          padding: "10px 0",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "Rajdhani",
                            fontWeight: 800,
                            fontSize: 40,
                            lineHeight: 1,
                            color: catCfg?.color,
                          }}
                        >
                          {hero.value}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: catCfg?.color,
                            opacity: 0.7,
                            textTransform: "uppercase",
                            letterSpacing: 1.5,
                            marginTop: 5,
                          }}
                        >
                          {hero.label}
                        </div>
                      </div>

                      {/* Right column */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 0,
                        }}
                      >
                        {sideCell(t2)}
                        <div
                          style={{
                            height: 1,
                            background: "var(--border)",
                            margin: "0 8px",
                          }}
                        />
                        {sideCell(b2)}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Bid panel */}
              <div
                id="tour-bid-panel"
                style={{
                  width: "100%",
                  background: "var(--s1)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                {/* Current bid header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      letterSpacing: 1,
                    }}
                  >
                    CURRENT BID
                  </span>
                  {bidderMeta && currentBid && (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: bidderMeta.primary,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          color: bidderMeta.primary,
                          fontWeight: 500,
                        }}
                      >
                        {bidderMeta.shortName}
                        {isUserLeading ? " · YOU" : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bid amount */}
                <div
                  style={{
                    fontFamily: "Rajdhani",
                    fontWeight: 700,
                    fontSize: 38,
                    color: "var(--text)",
                    lineHeight: 1,
                  }}
                >
                  {fmtNPR(currentBid?.amount ?? currentPlayer.base_price)}
                </div>
                {!currentBid && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 4,
                    }}
                  >
                    Base price — no bids yet
                  </div>
                )}

                {/* Timer */}
                <div style={{ marginTop: 14, marginBottom: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      Timer
                    </span>
                    <span
                      style={{
                        fontFamily: "Rajdhani",
                        fontWeight: 700,
                        fontSize: 15,
                        color: isPaused ? "#10b981" : timerColor,
                        animation:
                          !isPaused && timerSeconds <= 5
                            ? "pulse-fade .5s ease-in-out infinite"
                            : "none",
                      }}
                    >
                      {isPaused
                        ? "PAUSED"
                        : `${String(timerSeconds).padStart(2, "0")}s`}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 3,
                      background: "var(--border2)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${timerPct}%`,
                        background: isPaused ? "#10b981" : timerColor,
                        borderRadius: 2,
                        transition: "width 1s linear, background .3s",
                        opacity: isPaused ? 0.35 : 1,
                      }}
                    />
                  </div>
                </div>

                {/* Bid buttons */}
                {isUserLeading ? (
                  <div
                    style={{
                      background: "#10b98115",
                      border: "1px solid #10b98140",
                      borderRadius: 8,
                      padding: 10,
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--green)",
                        fontFamily: "Rajdhani",
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: 1,
                      }}
                    >
                      YOU ARE LEADING
                    </span>
                  </div>
                ) : (
                  <div
                    id="tour-bid-actions"
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {/* Increment buttons */}
                    <div style={{ display: "flex", gap: 6 }}>
                      {incrementOptions.map(({ label, amount }) => {
                        const can = !!(
                          mySeat &&
                          currentPlayer &&
                          hasQuota(mySeat, currentPlayer.category, catQuotas) &&
                          canAffordBid(mySeat, amount, currentPlayer, catQuotas)
                        );
                        return (
                          <button
                            key={label}
                            onClick={() => can && handleBid(amount)}
                            style={{
                              flex: 1,
                              padding: "8px 0",
                              background: can ? "var(--s2)" : "var(--s1)",
                              border: `1px solid ${can ? "var(--border2)" : "var(--border)"}`,
                              borderRadius: 7,
                              color: can ? "var(--text)" : "var(--muted)",
                              fontFamily: "Rajdhani",
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: can ? "pointer" : "not-allowed",
                            }}
                            onMouseEnter={(e) => {
                              if (can)
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.borderColor = "var(--gold)";
                            }}
                            onMouseLeave={(e) => {
                              if (can)
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.borderColor = "var(--border2)";
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Main bid button */}
                    <button
                      onClick={() => canBidNow && handleBid(nextBid)}
                      disabled={!canBidNow}
                      style={{
                        background: canBidNow ? "var(--red)" : "var(--s3)",
                        color: canBidNow ? "#fff" : "var(--muted)",
                        border: "none",
                        borderRadius: 8,
                        padding: 11,
                        fontFamily: "Rajdhani",
                        fontWeight: 700,
                        fontSize: 16,
                        letterSpacing: 1.5,
                        cursor: canBidNow ? "pointer" : "not-allowed",
                        transition: "background .15s",
                      }}
                      onMouseEnter={(e) => {
                        if (canBidNow)
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "var(--red2)";
                      }}
                      onMouseLeave={(e) => {
                        if (canBidNow)
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "var(--red)";
                      }}
                    >
                      {bidPending
                        ? "BIDDING…"
                        : atMaxPrice && hasEnteredLuckyDraw
                          ? "LUCKY DRAW ENTERED"
                          : atMaxPrice
                            ? "ENTER LUCKY DRAW"
                            : `BID ${fmtNPR(nextBid)}`}
                    </button>

                    {/* Lucky draw entrants — shown in real-time as teams bid max price */}
                    {atMaxPrice && luckyDrawEntrants.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          justifyContent: "center",
                          marginTop: 10,
                        }}
                      >
                        {luckyDrawEntrants.map((entrantSeatId) => {
                          const s = seats.find(
                            (seat) => seat.seatId === entrantSeatId,
                          );
                          if (!s) return null;
                          const m = meta(s.franchiseName);
                          return (
                            <div
                              key={entrantSeatId}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: `${m.primary}20`,
                                border: `1px solid ${m.primary}55`,
                              }}
                            >
                              <div
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: m.primary,
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: m.primary,
                                  fontFamily: "Rajdhani",
                                  letterSpacing: 0.5,
                                }}
                              >
                                {m.shortName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bid notification stack — outside the card, last 4, dimming by age */}
              {bidNotifs.length > 0 && (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {bidNotifs.map((notif, i) => (
                    <div
                      key={notif.id}
                      className={i === 0 ? "animate-slide-up" : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "5px 10px",
                        borderRadius: 7,
                        background: `${notif.primary}14`,
                        border: `1px solid ${notif.primary}30`,
                        opacity: [1, 0.55, 0.28, 0.12][i] ?? 0.12,
                        transition: "opacity .3s",
                      }}
                    >
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: notif.primary,
                          flexShrink: 0,
                          opacity: [1, 0.7, 0.45, 0.25][i] ?? 0.25,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "Rajdhani",
                          fontWeight: 700,
                          fontSize: 12,
                          color: notif.primary,
                          letterSpacing: 0.5,
                        }}
                      >
                        {notif.shortName}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted2)" }}>
                        bid {fmtNPR(notif.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : bidPanelState === "sold" || bidPanelState === "unsold" ? (
            <div
              key="result"
              className="animate-pop-in"
              style={{ width: "100%", maxWidth: 340 }}
            >
              <div
                style={{
                  background: "var(--s1)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "32px 16px",
                  textAlign: "center",
                }}
              >
                {bidPanelState === "sold" && soldInfo ? (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        letterSpacing: 1,
                        marginBottom: 6,
                      }}
                    >
                      SOLD TO
                    </div>
                    <div
                      style={{
                        fontFamily: "Rajdhani",
                        fontWeight: 700,
                        fontSize: 22,
                        color: soldInfo.primary,
                      }}
                    >
                      {soldInfo.franchiseName}
                    </div>
                    <div
                      style={{
                        fontFamily: "Rajdhani",
                        fontWeight: 700,
                        fontSize: 28,
                        color: "var(--gold)",
                        marginTop: 4,
                      }}
                    >
                      {fmtNPR(soldInfo.price)}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      fontFamily: "Rajdhani",
                      fontWeight: 700,
                      fontSize: 26,
                      color: "var(--muted)",
                    }}
                  >
                    UNSOLD
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Waiting for next player…
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: My Squad (240px) */}
        <div
          id="tour-squad-panel"
          style={{
            width: 240,
            flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                letterSpacing: 1,
                marginBottom: 2,
              }}
            >
              MY SQUAD
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: mySeat
                  ? meta(mySeat.franchiseName).primary
                  : "var(--text)",
              }}
            >
              {mySeat?.franchiseName ?? "—"}
            </div>
          </div>

          {/* Purse bar */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                PURSE REMAINING
              </span>
              <span
                style={{
                  fontFamily: "Rajdhani",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--green)",
                }}
              >
                {fmtL(mySeat?.purseRemaining ?? BUDGET)}
              </span>
            </div>
            <div
              style={{
                height: 3,
                background: "var(--border)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${((mySeat?.purseRemaining ?? BUDGET) / BUDGET) * 100}%`,
                  background: "var(--green)",
                  borderRadius: 2,
                  transition: "width .5s",
                }}
              />
            </div>

            {/* Spending floor indicator */}
            {(() => {
              const spent = BUDGET - (mySeat?.purseRemaining ?? BUDGET);
              const metFloor = spent >= SPENDING_FLOOR;
              const floorPct = Math.min(100, (spent / SPENDING_FLOOR) * 100);
              return (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontSize: 9, color: "var(--muted)" }}>
                      SPEND FLOOR
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: metFloor ? "var(--green)" : "#f59e0b",
                      }}
                    >
                      {metFloor
                        ? "✓ MET"
                        : `${fmtL(SPENDING_FLOOR - spent)} to go`}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 2,
                      background: "var(--border)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${floorPct}%`,
                        background: metFloor ? "var(--green)" : "#f59e0b",
                        borderRadius: 2,
                        transition: "width .5s",
                      }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Quota slots */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {(["A", "B", "C"] as const).map((cat) => {
              const max = catQuotas[cat];
              const filled = mySeat?.categoryCount[cat] ?? 0;
              const cc = CAT_COLOR[cat];
              return (
                <div
                  key={cat}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      flexShrink: 0,
                      background: `${cc}20`,
                      border: `1px solid ${cc}60`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "Rajdhani",
                      fontWeight: 700,
                      fontSize: 11,
                      color: cc,
                    }}
                  >
                    {cat}
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: 3 }}>
                    {Array.from({ length: max }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          background: i < filled ? cc : "var(--border)",
                          transition: "background .3s",
                        }}
                      />
                    ))}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                      width: 24,
                      textAlign: "right",
                    }}
                  >
                    {filled}/{max}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Squad list */}
          <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
            {!mySeat || mySeat.squad.length === 0 ? (
              <div
                style={{
                  padding: "20px 8px",
                  fontSize: 12,
                  color: "var(--muted)",
                  textAlign: "center",
                }}
              >
                No players yet
              </div>
            ) : (
              mySeat.squad.map((slot) => (
                <div
                  key={slot.playerId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 8px",
                    borderRadius: 6,
                    borderBottom: "1px solid #0c0f1c",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background:
                        CAT_COLOR[slot.player.category] ?? CAT_COLOR.MARQUEE,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {slot.player.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>
                      {ROLE_BADGE[slot.player.role] ?? slot.player.role}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--gold)",
                      fontFamily: "Rajdhani",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {slot.pricePaid > 0 ? fmtNPR(slot.pricePaid) : "—"}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pause / Resume footer — quickplay only */}
          {isQuickPlay && !auctionComplete && (
            <div
              style={{
                padding: "10px 12px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() =>
                  socket.emit(isPaused ? "lobby:resume" : "lobby:pause", {
                    lobbyId,
                  })
                }
                disabled={luckyActive || !currentPlayer}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  background: isPaused ? "#10b98115" : "#ef444415",
                  border: `1px solid ${isPaused ? "#10b98150" : "#ef444450"}`,
                  borderRadius: 8,
                  color: isPaused ? "#10b981" : "#ef4444",
                  fontFamily: "Rajdhani",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 1,
                  cursor:
                    luckyActive || !currentPlayer ? "not-allowed" : "pointer",
                  opacity: luckyActive || !currentPlayer ? 0.4 : 1,
                  transition: "all .2s",
                }}
              >
                {isPaused ? "▶  RESUME AUCTION" : "⏸  PAUSE AUCTION"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: 8 team cards (58px) */}
      <div
        style={{
          height: 58,
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 6,
          overflowX: "auto",
        }}
      >
        {seats.map((seat) => {
          const m = meta(seat.franchiseName);
          const isLeading = seat.seatId === currentBid?.seatId;
          const isMe = seat.seatId === seatId;
          const playerCnt = seat.squad.length;
          return (
            <div
              key={seat.seatId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 10px",
                borderRadius: 7,
                background: isLeading
                  ? `${m.primary}18`
                  : isMe
                    ? `${m.primary}0d`
                    : "var(--s1)",
                border: `1px solid ${isLeading ? m.primary : isMe ? `${m.primary}60` : "var(--border)"}`,
                flex: 1,
                minWidth: 120,
                maxWidth: 168,
                transition: "all .25s",
                flexShrink: 0,
              }}
            >
              <FranchiseCrest franchiseName={seat.franchiseName} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: isMe ? 600 : 400,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "var(--text)",
                  }}
                >
                  {m.shortName}
                  {isMe ? " ★" : ""}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--muted2)",
                    fontFamily: "Rajdhani",
                    display: "flex",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      color:
                        seat.purseRemaining < 1_000_000
                          ? "#ef4444"
                          : "var(--muted2)",
                    }}
                  >
                    {fmtL(seat.purseRemaining)}
                  </span>
                  <span>{playerCnt}P</span>
                  {seat.seatType === "BOT" && seat.botPersonality && (
                    <span style={{ color: "var(--muted2)", opacity: 0.7 }}>
                      {seat.botPersonality.slice(0, 4)}
                    </span>
                  )}
                </div>
              </div>
              {isLeading && (
                <div
                  className="animate-pulse-fade"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: m.primary,
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Flying plane banner — NPL stats notice, triggers on 4th player of each category */}
      {showPlane && (
        <div
          style={{
            position: "fixed",
            top: 68,
            right: 0,
            zIndex: 9999,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
            animation: "fly-banner 20s linear forwards",
          }}
          onAnimationEnd={() => setShowPlane(false)}
        >
          <span style={{ fontSize: 26, display: "inline-block", transform: "rotate(-135deg)" }}>✈️</span>
          <div
            style={{
              background: "rgba(15,15,20,0.88)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              backdropFilter: "blur(4px)",
            }}
          >
            ✦ All player stats are from the NPL tournament only ✦
          </div>
        </div>
      )}

      {/* Lucky draw overlay */}
      {luckyActive && currentPlayer && luckyContenders.length > 0 && (
        <LuckyDrawOverlay
          player={currentPlayer}
          contenders={luckyContenders}
          seats={seats}
          winner={luckyWinner}
          onClose={handleLuckyDrawClose}
        />
      )}

      {/* In-auction How to Play tour */}
      {showTour && (
        <TutorialOverlay
          steps={AUCTION_TOUR_STEPS}
          metadataKey="hasSeenAuctionTour"
          lobbyId={lobbyId}
          onDismiss={() => {
            setShowTour(false);
            setTourDismissed(true);
          }}
          initiallyPaused={luckyActive}
        />
      )}

      {/* Player sets modal */}
      {showSets && setsData && (
        <SetsModal data={setsData} onClose={() => setShowSets(false)} />
      )}
    </div>
  );
}

// ─── SetsModal ────────────────────────────────────────────────────────────────

const SETS_CAT_COLORS: Record<string, string> = {
  A: "#F59E0B",
  B: "#60A5FA",
  C: "#34D399",
};

function SetsModal({
  data,
  onClose,
}: {
  data: SetsPreviewData;
  onClose: () => void;
}) {
  const [selectedCat, setSelectedCat] = useState<"A" | "B" | "C">("A");
  const color = SETS_CAT_COLORS[selectedCat];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--s1)",
          border: "1px solid var(--border2)",
          borderRadius: 14,
          padding: "24px 28px",
          maxWidth: 680,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                letterSpacing: 2,
                marginBottom: 3,
              }}
            >
              AUCTION DRAW
            </div>
            <div
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: 22,
                color: "var(--text)",
              }}
            >
              PLAYER GROUPS
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--s3)",
              border: "1px solid var(--border2)",
              color: "var(--muted2)",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["A", "B", "C"] as const).map((cat) => {
            const isActive = cat === selectedCat;
            const c = SETS_CAT_COLORS[cat];
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                style={{
                  padding: "7px 28px",
                  borderRadius: 7,
                  border: `1px solid ${isActive ? c : "var(--border2)"}`,
                  background: isActive ? `${c}20` : "var(--s2)",
                  color: isActive ? c : "var(--muted2)",
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 1,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                CAT {cat}
              </button>
            );
          })}
        </div>

        {/* Two groups side by side for selected category */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <SetsPlayerList label="SET 1" players={data[selectedCat].group1} color={color} />
          <SetsPlayerList label="SET 2" players={data[selectedCat].group2} color={color} />
        </div>
      </div>
    </div>
  );
}

function SetsPlayerList({
  label,
  players,
  color,
}: {
  label: string;
  players: PlayerPreview[];
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--s2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color,
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 6,
          fontFamily: "Rajdhani, sans-serif",
        }}
      >
        {label}
      </div>
      {players.map((p) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            color: "var(--text)",
            padding: "2px 0",
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.name}
          </span>
          <span
            style={{
              color: "var(--muted)",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: 0.5,
              marginLeft: 6,
              flexShrink: 0,
            }}
          >
            {p.role}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── FranchiseCrest ───────────────────────────────────────────────────────────

function FranchiseCrest({
  franchiseName,
  size = 36,
}: {
  franchiseName: string;
  size?: number;
}) {
  const m = meta(franchiseName);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `${m.primary}28`,
        border: `1.5px solid ${m.primary}80`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Rajdhani",
        fontWeight: 700,
        fontSize: Math.round(size * 0.3),
        color: m.primary,
        letterSpacing: 0.5,
      }}
    >
      {m.shortName}
    </div>
  );
}

// ─── PlayerAvatar ─────────────────────────────────────────────────────────────

function PlayerAvatar({
  player,
  size = 108,
}: {
  player: Player;
  size?: number;
}) {
  const cc = CAT_COLOR[player.category] ?? "#888";
  const init = player.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const pid = player.id.replace(/[^a-z0-9]/gi, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 112 112"
      style={{ display: "block", borderRadius: 8, overflow: "hidden" }}
    >
      <defs>
        <pattern
          id={`stripe-${pid}`}
          patternUnits="userSpaceOnUse"
          width="10"
          height="10"
          patternTransform="rotate(135)"
        >
          <rect width="10" height="10" fill="#0c0f1c" />
          <rect width="5" height="10" fill="#111626" opacity="0.9" />
        </pattern>
      </defs>
      <rect width="112" height="112" fill={`url(#stripe-${pid})`} />
      <rect width="112" height="112" fill={cc} fillOpacity="0.07" />
      <text
        x="56"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={cc}
        fillOpacity="0.55"
        fontSize="30"
        fontFamily="Rajdhani"
        fontWeight="700"
      >
        {init}
      </text>
      <text
        x="56"
        y="80"
        textAnchor="middle"
        fill="#3a4f70"
        fontSize="9"
        fontFamily="Plus Jakarta Sans"
      >
        player photo
      </text>
    </svg>
  );
}

// ─── LuckyDrawOverlay ─────────────────────────────────────────────────────────

function LuckyDrawOverlay({
  player,
  contenders,
  seats,
  winner,
  onClose,
}: {
  player: Player;
  contenders: string[];
  seats: LobbySeat[];
  winner: string | null;
  onClose: () => void;
}) {
  const [highlighted, setHighlighted] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const winnerRef = useRef(winner);
  useEffect(() => {
    winnerRef.current = winner;
  }, [winner]);

  useEffect(() => {
    let stopped = false;
    let speed = 80;
    let count = 0;

    const spin = () => {
      if (stopped) return;
      count++;
      setHighlighted((prev) => (prev + 1) % contenders.length);

      const hasWinner = winnerRef.current !== null;
      const minCycles = contenders.length * 3;

      if (count >= minCycles && hasWinner) {
        // Find winner index and land on it
        const wIdx = contenders.indexOf(winnerRef.current!);
        setHighlighted(wIdx >= 0 ? wIdx : 0);
        setRevealed(true);
        setTimeout(() => {
          if (!stopped) onClose();
        }, 1_500);
        return;
      }

      if (count > minCycles - contenders.length)
        speed = Math.min(speed + 50, 480);
      setTimeout(spin, speed);
    };

    setTimeout(spin, speed);
    return () => {
      stopped = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cc = CAT_COLOR[player.category] ?? "#888";
  const winnerSeat = winner ? seats.find((s) => s.seatId === winner) : null;
  const winnerMeta = winnerSeat ? meta(winnerSeat.franchiseName) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(7,8,15,.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "var(--s2)",
          border: `1px solid ${cc}60`,
          borderRadius: 16,
          padding: "40px 52px",
          maxWidth: 620,
          width: "92%",
          textAlign: "center",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-block",
            background: `${cc}20`,
            border: `1px solid ${cc}60`,
            borderRadius: 6,
            padding: "3px 12px",
            marginBottom: 14,
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: 12,
            color: cc,
            letterSpacing: 1,
          }}
        >
          MAX PRICE HIT — LUCKY DRAW
        </div>

        <div
          style={{
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: 26,
            marginBottom: 2,
            color: "var(--text)",
          }}
        >
          {player.name}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
          {ROLE_LABEL[player.role] ?? player.role}
        </div>
        <div
          style={{
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: 22,
            color: "var(--gold)",
            marginBottom: 22,
          }}
        >
          {fmtNPR(CAT_MAX[player.category] ?? 0)}
        </div>

        {/* Contender chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginBottom: 22,
          }}
        >
          {contenders.map((cSeatId, i) => {
            const seat = seats.find((s) => s.seatId === cSeatId);
            if (!seat) return null;
            const m = meta(seat.franchiseName);
            const isHit = highlighted === i;
            const isWon = revealed && winner === cSeatId;
            return (
              <div
                key={cSeatId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: isWon
                    ? `${m.primary}30`
                    : isHit
                      ? `${m.primary}22`
                      : "var(--s1)",
                  border: `1px solid ${isWon ? m.primary : isHit ? `${m.primary}aa` : "var(--border)"}`,
                  transform: isHit && !revealed ? "scale(1.07)" : "scale(1)",
                  transition: !revealed ? "all .07s" : "all .4s",
                }}
              >
                <FranchiseCrest franchiseName={seat.franchiseName} size={22} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isWon
                      ? m.secondary
                      : isHit
                        ? m.primary
                        : "var(--muted2)",
                  }}
                >
                  {m.shortName}
                </span>
              </div>
            );
          })}
        </div>

        {/* Spinner / winner reveal */}
        {!revealed ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "var(--muted)",
            }}
          >
            <div
              className="animate-spin-slow"
              style={{
                width: 14,
                height: 14,
                border: "2px solid var(--border)",
                borderTopColor: "var(--gold)",
                borderRadius: "50%",
              }}
            />
            <span style={{ fontSize: 13 }}>Drawing…</span>
          </div>
        ) : (
          winnerSeat &&
          winnerMeta && (
            <div className="animate-pop-in">
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                WINNER
              </div>
              <div
                style={{
                  fontFamily: "Rajdhani",
                  fontWeight: 700,
                  fontSize: 26,
                  color: winnerMeta.primary,
                }}
              >
                {winnerSeat.franchiseName}
              </div>
              <div
                style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}
              >
                {player.name} signed at {fmtNPR(CAT_MAX[player.category] ?? 0)}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Auction Complete Screen ──────────────────────────────────────────────────

function AuctionCompleteScreen({
  seats,
  mySeatId,
  floorPerSeat,
}: {
  seats: LobbySeat[];
  mySeatId: string;
  floorPerSeat: Record<string, boolean>;
}) {
  const mySeat = seats.find((s) => s.seatId === mySeatId);
  const m = mySeat ? meta(mySeat.franchiseName) : null;
  const spent = BUDGET - (mySeat?.purseRemaining ?? BUDGET);
  const myFloorMet = mySeat ? (floorPerSeat[mySeat.seatId] ?? false) : false;

  return (
    <div
      style={{
        height: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "20px 28px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 2,
            color: "var(--red)",
          }}
        >
          NPL
        </div>
        <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        <div
          style={{
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: 1,
            color: "var(--text)",
          }}
        >
          AUCTION COMPLETE
        </div>
        {mySeat && m && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            {mySeat.franchiseName} · spent {fmtNPR(spent)} ·{" "}
            {fmtL(mySeat.purseRemaining)} left
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: myFloorMet ? "var(--green)" : "#f59e0b",
                background: myFloorMet
                  ? "rgba(52,211,153,0.12)"
                  : "rgba(245,158,11,0.12)",
                padding: "2px 7px",
                borderRadius: 4,
              }}
            >
              {myFloorMet ? "✓ FLOOR MET" : "✗ FLOOR MISSED"}
            </span>
          </div>
        )}
      </div>

      {/* Squad cards grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {seats.map((seat) => (
            <SquadCard
              key={seat.seatId}
              seat={seat}
              isMe={seat.seatId === mySeatId}
              metFloor={floorPerSeat[seat.seatId] ?? false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SquadCard({
  seat,
  isMe,
  metFloor,
}: {
  seat: LobbySeat;
  isMe: boolean;
  metFloor: boolean;
}) {
  const m = meta(seat.franchiseName);
  const marquee = seat.squad.find((s) => s.slotType === "MARQUEE");
  const auction = seat.squad.filter((s) => s.slotType === "AUCTION");

  return (
    <div
      style={{
        background: isMe ? `${m.primary}10` : "var(--s1)",
        border: `1px solid ${isMe ? m.primary : "var(--border)"}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ height: 3, background: m.primary }} />
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <FranchiseCrest franchiseName={seat.franchiseName} size={32} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            {seat.franchiseName}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {fmtL(seat.purseRemaining)} left
          </div>
        </div>
        {isMe && (
          <span
            style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}
          >
            YOU
          </span>
        )}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: metFloor ? "var(--green)" : "#f59e0b",
          }}
        >
          {metFloor ? "✓" : "✗"}
        </span>
      </div>
      {marquee && (
        <div
          style={{
            padding: "8px 14px",
            borderBottom: "1px solid var(--border)",
            background: `${CAT_COLOR.MARQUEE}0a`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: CAT_COLOR.MARQUEE,
              letterSpacing: 0.5,
              marginBottom: 3,
            }}
          >
            MARQUEE
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {marquee.player.name}
          </div>
        </div>
      )}
      <div style={{ padding: "6px 14px 10px" }}>
        {auction.length === 0 ? (
          <div
            style={{ fontSize: 12, color: "var(--muted)", padding: "6px 0" }}
          >
            No auction players
          </div>
        ) : (
          auction.map((slot) => (
            <div
              key={slot.playerId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "5px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: CAT_COLOR[slot.player.category] ?? "#888",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text)",
                    }}
                  >
                    {slot.player.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {ROLE_BADGE[slot.player.role] ?? slot.player.role} ·{" "}
                    {slot.player.category}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--gold)",
                  fontFamily: "Rajdhani",
                  fontWeight: 600,
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                {slot.pricePaid > 0 ? fmtNPR(slot.pricePaid) : "—"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
