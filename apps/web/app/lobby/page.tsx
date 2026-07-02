"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Lobby, LobbySeat, SetsPreviewData, PlayerPreview } from "@npl-auction/types";
import socket from "../../lib/socket";
import TutorialOverlay, { type TourStep } from "../auction/[lobbyId]/TutorialOverlay";

const LOBBY_TOUR_STEPS: TourStep[] = [
  {
    targetId: "tour-seat-grid",
    title: "Your Franchise",
    body: "You're one of 8 NPL franchises. Empty seats are filled by AI bot managers — each with a distinct personality (aggressive, conservative, budget sniper…). Every team starts with the same NPR 90L purse.",
  },
  {
    targetId: "tour-auction-format",
    title: "Auction Phases",
    body: "Bidding runs in order: a marquee draw assigns each team a star player for free, then three rounds of bidding (Cat A → B → C). Any player nobody buys gets a second chance in the Unsold Round.",
  },
  {
    targetId: "tour-cat-phases",
    title: "Categories & Lucky Draw",
    body: "Cat A players go up to रू15L, B up to रू10L, C up to रू5L. If two or more teams bid max price for the same player, a lucky draw picks the winner at random — nobody can outbid their way out.",
  },
  {
    targetId: "tour-info-strip",
    title: "Squad Requirements",
    body: "You must finish with exactly 3 Cat A, 4 Cat B, and 3 Cat C auction players. The game blocks bids that would leave you unable to complete your roster at base price — budget carefully from the start.",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarqueeAssignment {
  playerId: string;
  playerName: string;
  franchiseId: string;
  franchiseName: string;
}

// ─── Franchise metadata (colors not in LobbySeat socket type) ────────────────

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

function meta(franchiseName: string) {
  return (
    FRANCHISE_META[franchiseName] ?? {
      shortName: "???",
      primary: "#5b6f9a",
      secondary: "#e4e9f4",
      city: "",
    }
  );
}

function fmtPurse(n: number): string {
  return `NPR ${(n / 100_000).toFixed(0)}L`;
}

// ─── Root export (Suspense boundary for useSearchParams) ──────────────────────

export default function LobbyPageWrapper() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LobbyPage />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function LobbyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session } = useSession();
  const userId =
    session?.user?.id ??
    (typeof window !== "undefined"
      ? (localStorage.getItem("npl_guest_id") ?? "")
      : "");

  const lobbyId = params.get("lobbyId") ?? "";
  const seatId = params.get("seatId") ?? "";

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [showMarquee, setShowMarquee] = useState(false);
  const [marqueeAssignments, setMarqueeAssignments] = useState<
    MarqueeAssignment[]
  >([]);
  const [marqueeDone, setMarqueeDone] = useState(false);
  const [setsPreview, setSetsPreview] = useState<SetsPreviewData | null>(null);
  const [setsCountdown, setSetsCountdown] = useState<number | null>(null);
  const setsStartedRef = useRef(false);

  // Tour state
  const [showTour, setShowTour] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Socket lifecycle ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !seatId || !userId) return;

    socket.connect();

    socket.on("connect", () => {
      socket.emit("lobby:join", { lobbyId, userId, seatId });
    });

    socket.on("lobby:state", (data) => {
      setLobby(data);
    });

    socket.on("lobby:error", (data) => {
      setError(data.message);
      setStarting(false);
      setCountdown(null);
    });

    // Collect all 8 marquee assignments, show the draw screen, then navigate
    socket.on("lobby:marquee_assigned", (data: MarqueeAssignment) => {
      setShowMarquee(true);
      setMarqueeAssignments((prev) => [...prev, data]);
    });

    socket.on("lobby:sets_preview", (data: SetsPreviewData) => {
      setSetsPreview(data);
      try { sessionStorage.setItem("npl_sets_preview", JSON.stringify(data)); } catch {}
    });

    return () => {
      socket.off("connect");
      socket.off("lobby:state");
      socket.off("lobby:error");
      socket.off("lobby:marquee_assigned");
      socket.off("lobby:sets_preview");
      socket.disconnect();
    };
  }, [lobbyId, seatId, userId, router]);

  // ── Start auction ──────────────────────────────────────────────────────────

  function handleStart() {
    if (starting) return;
    setStarting(true);
    setError(null);

    let count = 3;
    setCountdown(count);

    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdown(null);
        socket.emit("lobby:start", { lobbyId, testMode });
      } else {
        setCountdown(count);
      }
    }, 1_000);
  }

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Start sets countdown after marquee draw + preview data both ready ─────
  useEffect(() => {
    if (!marqueeDone || !setsPreview || setsStartedRef.current) return;
    setsStartedRef.current = true;
    setSetsCountdown(5);
  }, [marqueeDone, setsPreview]);

  // ── Fallback: navigate directly if sets preview never arrives ──────────────
  useEffect(() => {
    if (!marqueeDone || setsStartedRef.current) return;
    const t = setTimeout(() => {
      if (!setsStartedRef.current) {
        setsStartedRef.current = true;
        router.push(`/auction/${lobbyId}?seatId=${seatId}`);
      }
    }, 1_500);
    return () => clearTimeout(t);
  }, [marqueeDone, router, lobbyId, seatId]);

  // ── Sets preview countdown → navigate on 0 ─────────────────────────────────
  useEffect(() => {
    if (setsCountdown === null) return;
    if (setsCountdown <= 0) {
      setSetsPreview(null);
      setSetsCountdown(null);
      router.push(`/auction/${lobbyId}?seatId=${seatId}`);
      return;
    }
    const t = setTimeout(() => setSetsCountdown((c) => (c ?? 1) - 1), 1_000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setsCountdown]);

  // ── Tour auto-trigger ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const hasSeenLocal = localStorage.getItem("hasSeenLobbyTour") === "true";
    const hasSeen = hasSeenLocal || session?.user?.hasSeenLobbyTour === true;
    if (hasSeen) { setTourDismissed(true); return; }
    if (!tourDismissed) {
      const t = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(t);
    }
  }, [userId]); // intentionally excludes tourDismissed to avoid loop

  // ── Marquee draw + post-draw sets preview ─────────────────────────────────

  if (showMarquee && lobby) {
    if (marqueeDone && setsPreview && setsCountdown !== null) {
      return <SetsPreviewOverlay data={setsPreview} secondsLeft={setsCountdown} />;
    }
    return (
      <MarqueeDrawScreen
        seats={lobby.seats}
        assignments={marqueeAssignments}
        mySeatId={seatId}
        onNavigate={() => setMarqueeDone(true)}
      />
    );
  }

  // ── Derive user's seat ─────────────────────────────────────────────────────

  const mySeat = lobby?.seats.find((s) => s.seatId === seatId) ?? null;
  const myMeta = mySeat ? meta(mySeat.franchiseName) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      {/* Top bar */}
      <TopBar lobby={lobby} />

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Main content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            alignSelf: "flex-start",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                FRANCHISE SEATS
              </div>
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  color: "var(--text)",
                }}
              >
                8 Teams · 8 Players · Bot Fill
              </div>
            </div>

            {mySeat && myMeta && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: `${myMeta.primary}20`,
                  border: `1px solid ${myMeta.primary}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: `${myMeta.primary}40`,
                    border: `1px solid ${myMeta.primary}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 700,
                    fontSize: 10,
                    color: myMeta.secondary,
                  }}
                >
                  {myMeta.shortName}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {mySeat.franchiseName}
                </span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}
            >
              {error}
            </div>
          )}

          {/* Seat grid */}
          {lobby ? (
            <div
              id="tour-seat-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              {lobby.seats.map((seat) => (
                <SeatCard
                  key={seat.seatId}
                  seat={seat}
                  isUser={seat.seatId === seatId}
                />
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>
              Connecting…
            </div>
          )}

          {/* Info strip */}
          <div
            id="tour-info-strip"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginTop: 16,
            }}
          >
            {INFO_CARDS.map((card) => (
              <InfoCard key={card.label} {...card} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <Sidebar
          starting={starting}
          countdown={countdown}
          onStart={handleStart}
          isHost={!lobby?.hostUserId || lobby.hostUserId === userId}
          testMode={testMode}
          onToggleTestMode={() => setTestMode((v) => !v)}
          showTourButton={tourDismissed && !showTour}
          onOpenTour={() => { setTourDismissed(false); setShowTour(true); }}
        />
      </div>

      {showTour && (
        <TutorialOverlay
          steps={LOBBY_TOUR_STEPS}
          metadataKey="hasSeenLobbyTour"
          onDismiss={() => { setShowTour(false); setTourDismissed(true); }}
        />
      )}
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({ lobby }: { lobby: Lobby | null }) {
  return (
    <div
      style={{
        height: 56,
        background: "var(--s1)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      {/* Left: logo + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--red)",
          }}
        >
          NPL
        </span>
        <span
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "var(--muted2)",
            letterSpacing: 1,
          }}
        >
          AUCTION LOBBY
        </span>
      </div>

      {/* Right: status + code */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            className="animate-pulse-fade"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--green)",
            }}
          />
          <span style={{ fontSize: 13, color: "var(--muted2)" }}>
            Room Open
          </span>
        </div>
        {lobby && (
          <div
            style={{
              background: "var(--s3)",
              border: "1px solid var(--border2)",
              borderRadius: 6,
              padding: "3px 10px",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: 14,
              color: "var(--text)",
              letterSpacing: 2,
            }}
          >
            {lobby.code}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SeatCard ─────────────────────────────────────────────────────────────────

function SeatCard({ seat, isUser }: { seat: LobbySeat; isUser: boolean }) {
  const m = meta(seat.franchiseName);

  return (
    <div
      style={{
        background: isUser ? `${m.primary}12` : "var(--s1)",
        border: `1px solid ${isUser ? m.primary : "var(--border)"}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Top color bar */}
      <div style={{ height: 3, background: m.primary, width: "100%" }} />

      <div style={{ padding: "12px 12px 10px" }}>
        {/* Crest + name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: `${m.primary}28`,
              border: `1px solid ${m.primary}80`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: 12,
              color: m.secondary,
              flexShrink: 0,
            }}
          >
            {m.shortName}
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                lineHeight: 1.2,
              }}
            >
              {seat.franchiseName}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {m.city}
            </div>
          </div>
        </div>

        {/* Seat row */}
        <div
          style={{
            background: "var(--s2)",
            borderRadius: 6,
            padding: "7px 10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isUser ? "var(--green)" : "var(--muted)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {isUser
                ? (seat.displayName ?? "You")
                : seat.seatType === "HUMAN"
                  ? (seat.displayName ?? "Player")
                  : "Manager"}
            </div>
            {!isUser && (
              <div
                style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}
              >
                {seat.seatType === "BOT" && seat.botPersonality
                  ? seat.botPersonality
                  : "Manager"}
              </div>
            )}
          </div>
          {isUser && (
            <span
              style={{
                fontSize: 10,
                color: "var(--green)",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              YOU
            </span>
          )}
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            Purse: {fmtPurse(seat.purseRemaining)}
          </span>
          <span style={{ fontSize: 11, color: "var(--green)" }}>Ready</span>
        </div>
      </div>
    </div>
  );
}

// ─── InfoCard ─────────────────────────────────────────────────────────────────

type InfoCardProps = { label: string; value: string; sub: string };

const INFO_CARDS: InfoCardProps[] = [
  { label: "PURSE PER TEAM", value: "NPR 90L", sub: "NPR 9,000,000" },
  { label: "AUCTION POOL", value: "22 Players", sub: "6A · 8B · 8C" },
  {
    label: "SQUAD SIZE",
    value: "16 Players",
    sub: "1 Marquee + 10 Auction + 5 Pre-signed",
  },
];

function InfoCard({ label, value, sub }: InfoCardProps) {
  return (
    <div
      style={{
        background: "var(--s1)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Rajdhani, sans-serif",
          fontWeight: 700,
          fontSize: 16,
          color: "var(--text)",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2 }}>
        {sub}
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const AUCTION_FORMAT = [
  { label: "Marquee Draw" },
  { label: "Category A", sub: "Base NPR 10L · Max NPR 15L" },
  { label: "Category B", sub: "Base NPR 5L · Max NPR 10L" },
  { label: "Category C", sub: "Base NPR 2L · Max NPR 5L" },
  { label: "Unsold Round" },
];

function Sidebar({
  starting,
  countdown,
  onStart,
  isHost,
  testMode,
  onToggleTestMode,
  showTourButton,
  onOpenTour,
}: {
  starting: boolean;
  countdown: number | null;
  onStart: () => void;
  isHost: boolean;
  testMode: boolean;
  onToggleTestMode: () => void;
  showTourButton?: boolean;
  onOpenTour?: () => void;
}) {
  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        background: "var(--s1)",
      }}
    >
      {/* Auction format */}
      <div
        id="tour-auction-format"
        style={{
          padding: 20,
          borderBottom: "1px solid var(--border)",
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--muted)",
              letterSpacing: 1,
            }}
          >
            AUCTION FORMAT
          </div>
          {showTourButton && (
            <button
              onClick={onOpenTour}
              title="How to Play"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--s3)",
                border: "1px solid var(--border2)",
                color: "var(--muted2)",
                fontSize: 12,
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
        </div>

        <div id="tour-cat-phases" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {AUCTION_FORMAT.map((item, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "var(--s3)",
                  border: "1px solid var(--border2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "var(--muted2)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text)",
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </div>
                {item.sub && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: 2,
                    }}
                  >
                    {item.sub}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start section */}
      <div style={{ padding: 20, borderTop: "1px solid var(--border)" }}>
        {isHost ? (
          countdown !== null ? (
            /* Countdown card */
            <div
              style={{
                background: "var(--s2)",
                border: "1px solid var(--border2)",
                borderRadius: 10,
                padding: "24px 0",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  fontSize: 64,
                  color: "var(--gold)",
                  lineHeight: 1,
                }}
              >
                {countdown}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                Starting auction…
              </div>
            </div>
          ) : (
            /* Test mode toggle + start button */
            <>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <div
                onClick={onToggleTestMode}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: testMode ? "#F59E0B" : "var(--s3)",
                  border: "1px solid var(--border2)",
                  position: "relative",
                  transition: "background 0.2s",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: testMode ? 18 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: testMode ? "#fff" : "var(--muted)",
                    transition: "left 0.2s",
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: testMode ? "#F59E0B" : "var(--muted)" }}>
                Quick Test (1A+1B+1C per team)
              </span>
            </label>
            <button
              onClick={onStart}
              disabled={starting}
              style={{
                width: "100%",
                background: starting ? "var(--s3)" : "var(--red)",
                border: "none",
                borderRadius: 10,
                padding: "14px 0",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: 2,
                color: starting ? "var(--muted)" : "#fff",
                cursor: starting ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                marginBottom: 12,
              }}
              onMouseEnter={(e) => {
                if (!starting)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--red2)";
              }}
              onMouseLeave={(e) => {
                if (!starting)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--red)";
              }}
            >
              START AUCTION
            </button>
            </>
          )
        ) : (
          /* Non-host waiting state */
          <div
            style={{
              background: "var(--s2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "18px 12px",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            <div
              className="animate-pulse-fade"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--gold)",
                margin: "0 auto 10px",
              }}
            />
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              Waiting for host
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              The host will start the auction
            </div>
          </div>
        )}

        <p
          style={{
            fontSize: 11,
            color: "var(--muted)",
            textAlign: "center",
            margin: 0,
          }}
        >
          {isHost ? "You are the host" : "Only the host can start"}
        </p>
      </div>
    </div>
  );
}

// ─── MarqueeDrawScreen ────────────────────────────────────────────────────────

const TOTAL_SEATS = 8;

function MarqueeDrawScreen({
  seats,
  assignments,
  mySeatId,
  onNavigate,
}: {
  seats: LobbySeat[];
  assignments: MarqueeAssignment[];
  mySeatId: string;
  onNavigate: () => void;
}) {
  const allRevealed = assignments.length >= TOTAL_SEATS;
  const myAssignment =
    assignments.find(
      (a) =>
        seats.find((s) => s.seatId === mySeatId)?.franchiseName ===
        a.franchiseName,
    ) ?? null;

  // Navigate after showing the winner callout
  useEffect(() => {
    if (!allRevealed) return;
    const t = setTimeout(onNavigate, 3_500);
    return () => clearTimeout(t);
  }, [allRevealed, onNavigate]);

  // Build a map: franchiseName → assignment (if revealed)
  const assignmentMap = new Map(assignments.map((a) => [a.franchiseName, a]));

  const mySeat = seats.find((s) => s.seatId === mySeatId);
  const myMeta = mySeat ? meta(mySeat.franchiseName) : null;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        gap: 32,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          LUCKY DRAW
        </div>
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: 36,
            color: "var(--text)",
          }}
        >
          MARQUEE ASSIGNMENT
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          Each franchise receives one marquee player
        </div>
      </div>

      {/* 4-column card grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          width: "100%",
          maxWidth: 900,
          padding: "0 24px",
        }}
      >
        {seats.map((seat) => {
          const m = meta(seat.franchiseName);
          const revealed = assignmentMap.get(seat.franchiseName);
          const isMe = seat.seatId === mySeatId;

          return (
            <div
              key={seat.seatId}
              className={revealed ? "animate-marquee-reveal" : undefined}
              style={{
                background: isMe && revealed ? `${m.primary}18` : "var(--s1)",
                border: `1px solid ${revealed ? (isMe ? m.primary : "var(--border2)") : "var(--border)"}`,
                borderRadius: 10,
                padding: "14px 12px",
                transition: "background .3s, border-color .3s",
              }}
            >
              {/* Franchise header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: `${m.primary}28`,
                    border: `1.5px solid ${m.primary}80`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 700,
                    fontSize: 9,
                    color: m.primary,
                  }}
                >
                  {m.shortName}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: revealed ? "var(--text)" : "var(--muted)",
                  }}
                >
                  {m.shortName}
                </div>
              </div>

              {/* Content */}
              {revealed ? (
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: isMe ? m.secondary : "var(--text)",
                    }}
                  >
                    {revealed.playerName}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: 2,
                    }}
                  >
                    Marquee Player
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 6,
                      background: "#F472B620",
                      border: "1px solid #F472B660",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 10,
                      color: "#F472B6",
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    MARQUEE
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    height: 56,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted)",
                    fontSize: 20,
                    letterSpacing: 4,
                  }}
                >
                  ? ? ?
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User callout — appears after all revealed */}
      {allRevealed && myAssignment && myMeta && (
        <div
          className="animate-pop-in"
          style={{
            background: `${myMeta.primary}20`,
            border: `1px solid ${myMeta.primary}`,
            borderRadius: 10,
            padding: "16px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--muted)",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            YOUR MARQUEE PLAYER
          </div>
          <div
            style={{
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: 24,
              color: myMeta.secondary,
            }}
          >
            {myAssignment.playerName}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Auction begins in a moment…
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SetsPreviewOverlay ───────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  A: "#F59E0B",
  B: "#60A5FA",
  C: "#34D399",
};

function SetsPreviewOverlay({
  data,
  secondsLeft,
}: {
  data: SetsPreviewData;
  secondsLeft: number;
}) {
  const [selectedCat, setSelectedCat] = useState<"A" | "B" | "C">("A");
  const color = CAT_COLORS[selectedCat];

  return (
    <div
      style={{
        height: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          AUCTION DRAW
        </div>
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: 32,
            color: "var(--text)",
          }}
        >
          PLAYER GROUPS
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          The auction runs two rounds per category — here are the sets
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["A", "B", "C"] as const).map((cat) => {
          const isActive = cat === selectedCat;
          const c = CAT_COLORS[cat];
          return (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              style={{
                padding: "8px 32px",
                borderRadius: 8,
                border: `1px solid ${isActive ? c : "var(--border2)"}`,
                background: isActive ? `${c}20` : "var(--s2)",
                color: isActive ? c : "var(--muted2)",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: 15,
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
          width: "100%",
          maxWidth: 680,
          maxHeight: "calc(100vh - 340px)",
          overflowY: "auto",
        }}
      >
        <SetsGroupList label="SET 1" players={data[selectedCat].group1} color={color} />
        <SetsGroupList label="SET 2" players={data[selectedCat].group2} color={color} />
      </div>

      {/* Countdown */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
          Auction starts in
        </div>
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: 48,
            color: "var(--gold)",
            lineHeight: 1,
          }}
        >
          {secondsLeft}
        </div>
      </div>
    </div>
  );
}

function SetsCategoryColumn({
  cat,
  groups,
  color,
}: {
  cat: string;
  groups: { group1: PlayerPreview[]; group2: PlayerPreview[] };
  color: string;
}) {
  return (
    <div>
      {/* Category header */}
      <div
        style={{
          background: `${color}15`,
          border: `1px solid ${color}40`,
          borderRadius: 8,
          padding: "7px 12px",
          marginBottom: 10,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color,
            letterSpacing: 1,
          }}
        >
          CATEGORY {cat}
        </span>
      </div>

      <SetsGroupList label="SET 1" players={groups.group1} color={color} />
      <div style={{ height: 8 }} />
      <SetsGroupList label="SET 2" players={groups.group2} color={color} />
    </div>
  );
}

function SetsGroupList({
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
        background: "var(--s1)",
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
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
