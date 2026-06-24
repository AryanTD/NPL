"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

// ─── Franchise data ───────────────────────────────────────────────────────────

const FRANCHISES = [
  {
    shortName: "KTM",
    name: "Kathmandu Gorkhas",
    city: "Kathmandu",
    primary: "#1B3A6B",
    secondary: "#C9A84C",
  },
  {
    shortName: "PKR",
    name: "Pokhara Avengers",
    city: "Pokhara",
    primary: "#C0392B",
    secondary: "#FFFFFF",
  },
  {
    shortName: "CHT",
    name: "Chitwan Rhinos",
    city: "Chitwan",
    primary: "#196F3D",
    secondary: "#F4D03F",
  },
  {
    shortName: "BRT",
    name: "Biratnagar Kings",
    city: "Biratnagar",
    primary: "#6C3483",
    secondary: "#F9E79F",
  },
  {
    shortName: "JNK",
    name: "Janakpur Bolts",
    city: "Janakpur",
    primary: "#1A5276",
    secondary: "#F39C12",
  },
  {
    shortName: "LMB",
    name: "Lumbini Lions",
    city: "Lumbini",
    primary: "#922B21",
    secondary: "#FAD7A0",
  },
  {
    shortName: "SDR",
    name: "Sudurpaschim Royals",
    city: "Sudurpaschim",
    primary: "#0E6655",
    secondary: "#A9DFBF",
  },
  {
    shortName: "KRN",
    name: "Karnali Yaks",
    city: "Karnali",
    primary: "#4A235A",
    secondary: "#D7BDE2",
  },
] as const;

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

const SESSION_KEY    = "npl_session";
const GUEST_ID_KEY   = "npl_guest_id";
const GUEST_NAME_KEY = "npl_guest_name";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateGuestId(): string {
  const existing = localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = `guest_${crypto.randomUUID()}`;
  localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = "default" | "create" | "join";

interface ActiveSession {
  lobbyId: string;
  seatId: string;
  code: string;
  status: string;
}

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isLoaded    = status !== "loading";
  const isSignedIn  = status === "authenticated";

  const [view, setView]           = useState<View>("default");
  const [name, setName]           = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);
  const [code, setCode]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isGuest, setIsGuest]     = useState(false);
  const [totalGamesPlayed, setTotalGamesPlayed] = useState<number | null>(null);

  // ── Restore guest state from localStorage ─────────────────────────────────

  useEffect(() => {
    if (localStorage.getItem(GUEST_ID_KEY)) setIsGuest(true);
  }, []);

  // ── Load persistent display name ───────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && session?.user) {
      const saved = session.user.username;
      if (saved) {
        setName(saved);
      } else if (session.user.name) {
        setName(session.user.name.split(" ")[0]);
      }
    } else {
      const saved = localStorage.getItem(GUEST_NAME_KEY);
      if (saved) setName(saved);
    }
    setNameLoaded(true);
  }, [isLoaded, isSignedIn, session]);

  // ── Fetch games-played ticker ──────────────────────────────────────────────

  useEffect(() => {
    fetch(`${SERVER_URL}/lobby/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { totalGamesPlayed: number } | null) => {
        if (d && typeof d.totalGamesPlayed === "number") {
          setTotalGamesPlayed(d.totalGamesPlayed);
        }
      })
      .catch(() => {});
  }, []);

  // ── Derive effective userId ────────────────────────────────────────────────

  function resolveUserId(): string | null {
    if (isSignedIn && session?.user?.id) return session.user.id;
    if (isGuest) return getOrCreateGuestId();
    return null;
  }

  // ── Check for an existing active session on mount ─────────────────────────

  useEffect(() => {
    if (!isLoaded) return;
    const userId = resolveUserId();
    if (!userId) return;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as Omit<ActiveSession, "status">;
      fetch(`${SERVER_URL}/lobby/${s.lobbyId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.status !== "COMPLETE") {
            setActiveSession({ ...s, status: data.status });
          } else {
            localStorage.removeItem(SESSION_KEY);
          }
        })
        .catch(() => localStorage.removeItem(SESSION_KEY));
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, isGuest]);

  // ── Name persistence handlers ──────────────────────────────────────────────

  function handleNameChange(value: string) {
    const v = value.slice(0, 24);
    setName(v);
    if (!isSignedIn) {
      localStorage.setItem(GUEST_NAME_KEY, v.trim());
    }
  }

  function handleNameBlur() {
    if (!isSignedIn || !name.trim()) return;
    fetch("/api/user/username", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name.trim() }),
    }).catch(() => {});
  }

  // ── Guest handler ──────────────────────────────────────────────────────────

  function handleContinueAsGuest() {
    getOrCreateGuestId();
    setIsGuest(true);
  }

  // ── API helpers ─────────────────────────────────────────────────────────────

  async function createLobby(franchiseShortName?: string) {
    const userId = resolveUserId();
    if (!userId || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/lobby/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          displayName: name.trim(),
          season: 2024,
          ...(franchiseShortName ? { franchiseShortName } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        if (res.status === 409 && body.activeGame) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(body.activeGame));
          setActiveSession(body.activeGame);
          setView("default");
          setLoading(false);
          return;
        }
        throw new Error(body.error ?? "Failed to create lobby");
      }
      const data = await res.json();
      localStorage.setItem(SESSION_KEY, JSON.stringify({ lobbyId: data.lobbyId, seatId: data.seatId, code: data.code }));
      router.push(`/lobby?lobbyId=${data.lobbyId}&seatId=${data.seatId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function joinLobby() {
    const userId = resolveUserId();
    if (!userId || code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${SERVER_URL}/lobby/join/${code.toUpperCase()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            displayName: name.trim() || "Player",
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json();
        if (res.status === 409 && body.activeGame) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(body.activeGame));
          setActiveSession(body.activeGame);
          setView("default");
          setLoading(false);
          return;
        }
        throw new Error(body.error ?? "Failed to join lobby");
      }
      const data = await res.json();
      localStorage.setItem(SESSION_KEY, JSON.stringify({ lobbyId: data.lobbyId, seatId: data.seatId, code: data.code }));
      router.push(`/lobby?lobbyId=${data.lobbyId}&seatId=${data.seatId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  // ── Rejoin / dismiss ────────────────────────────────────────────────────────

  function handleRejoin() {
    if (!activeSession) return;
    const dest =
      activeSession.status === "WAITING"
        ? `/lobby?lobbyId=${activeSession.lobbyId}&seatId=${activeSession.seatId}`
        : `/auction/${activeSession.lobbyId}?seatId=${activeSession.seatId}`;
    router.push(dest);
  }

  function handleDismissRejoin() {
    localStorage.removeItem(SESSION_KEY);
    setActiveSession(null);
    const userId = resolveUserId();
    if (userId) {
      fetch(`${SERVER_URL}/lobby/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const showDefaultCard = isSignedIn || isGuest;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* Grid texture overlay */}
      <div className="grid-texture absolute inset-0" />

      {/* Logo lockup */}
      <div className="relative flex flex-col items-center gap-3 mb-6 animate-slide-up">
        {/* Nepal flag color bars */}
        <div className="flex items-end gap-[3px] mb-1">
          <div
            style={{
              width: 4,
              height: 24,
              background: "#dc2626",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              width: 4,
              height: 16,
              background: "#1B3A6B",
              borderRadius: 2,
            }}
          />
        </div>

        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: 52,
            color: "var(--text)",
            letterSpacing: 3,
            lineHeight: 1,
          }}
        >
          NPL AUCTION
        </div>

        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 500,
            fontSize: 18,
            color: "var(--gold)",
            letterSpacing: 6,
          }}
        >
          2025 · SEASON 3
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--muted)",
            maxWidth: 360,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Build your NPL franchise. Bid on Nepali cricketers. Compete in
          real-time against managers across Nepal.
        </p>
      </div>

      {/* Ticker */}
      {totalGamesPlayed !== null && totalGamesPlayed > 0 && (
        <div className="ticker-strip" style={{ marginBottom: 20 }}>
          <span className="ticker-content">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} style={{ marginRight: 56 }}>
                {totalGamesPlayed.toLocaleString()} AUCTIONS PLAYED &nbsp;·&nbsp;
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Auth card */}
      <div
        className="relative animate-slide-up w-full"
        style={{
          maxWidth: 520,
          background: "var(--s1)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "32px 36px",
          animationDelay: "0.1s",
        }}
      >
        {!isLoaded ? (
          <div
            style={{ textAlign: "center", color: "var(--muted)", fontSize: 14 }}
          >
            Loading…
          </div>
        ) : !showDefaultCard ? (
          <SignedOutView onContinueAsGuest={handleContinueAsGuest} />
        ) : view === "default" ? (
          <DefaultView
            name={name}
            nameLoaded={nameLoaded}
            onNameChange={handleNameChange}
            onNameBlur={handleNameBlur}
            error={error}
            loading={loading}
            activeSession={activeSession}
            onRejoin={handleRejoin}
            onDismissRejoin={handleDismissRejoin}
            onCreate={() => {
              setError(null);
              setView("create");
            }}
            onJoin={() => {
              setError(null);
              setView("join");
            }}
            onQuickPlay={() => createLobby()}
          />
        ) : view === "create" ? (
          <CreateView
            name={name}
            loading={loading}
            error={error}
            onBack={() => {
              setView("default");
              setError(null);
            }}
            onSelect={(shortName) => createLobby(shortName)}
          />
        ) : (
          <JoinView
            name={name}
            code={code}
            setCode={setCode}
            loading={loading}
            error={error}
            onBack={() => {
              setView("default");
              setError(null);
            }}
            onJoin={joinLobby}
          />
        )}
      </div>
    </div>
  );
}

// ─── Signed-out view ──────────────────────────────────────────────────────────

function SignedOutView({ onContinueAsGuest }: { onContinueAsGuest: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
          Sign in to save your stats and compete on the leaderboard, or jump
          straight in as a guest.
        </p>
      </div>

      <button
        onClick={() => signIn("google", { callbackUrl: "/" })}
        style={btnPrimary}
      >
        SIGN IN WITH GOOGLE
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <button onClick={onContinueAsGuest} style={btnSecondary}>
        CONTINUE AS GUEST
      </button>

      <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", margin: 0 }}>
        Guest progress is saved locally and not tied to an account.
      </p>
    </div>
  );
}

// ─── Default view ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  WAITING: "In Lobby",
  MARQUEE_DRAW: "Starting…",
  AUCTION: "In Auction",
};

function DefaultView({
  name,
  nameLoaded,
  onNameChange,
  onNameBlur,
  error,
  loading,
  activeSession,
  onRejoin,
  onDismissRejoin,
  onCreate,
  onJoin,
  onQuickPlay,
}: {
  name: string;
  nameLoaded: boolean;
  onNameChange: (v: string) => void;
  onNameBlur: () => void;
  error: string | null;
  loading: boolean;
  activeSession: ActiveSession | null;
  onRejoin: () => void;
  onDismissRejoin: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onQuickPlay: () => void;
}) {
  if (activeSession) {
    const statusLabel = STATUS_LABEL[activeSession.status] ?? activeSession.status;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Active game banner */}
        <div
          style={{
            background: "#92400e18",
            border: "1px solid #92400e60",
            borderRadius: 10,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                className="animate-pulse-fade"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--gold)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--gold)",
                  letterSpacing: 1,
                }}
              >
                ACTIVE GAME
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--gold)",
                  background: "#92400e30",
                  border: "1px solid #92400e80",
                  borderRadius: 4,
                  padding: "2px 7px",
                }}
              >
                {statusLabel}
              </span>
              <span
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 2,
                  color: "var(--text)",
                  background: "var(--s3)",
                  border: "1px solid var(--border2)",
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                {activeSession.code}
              </span>
            </div>
          </div>

          <button
            onClick={onRejoin}
            style={{
              width: "100%",
              background: "var(--gold)",
              border: "none",
              borderRadius: 8,
              padding: "12px 0",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: 1.5,
              color: "#000",
              cursor: "pointer",
            }}
          >
            REJOIN GAME
          </button>
        </div>

        <button
          onClick={onDismissRejoin}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "var(--muted)",
            textAlign: "center",
            padding: "0",
            marginTop: -8,
          }}
        >
          Leave game and start a new one
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Name input */}
      <div>
        <label style={labelStyle}>YOUR NAME</label>
        <input
          type="text"
          placeholder={nameLoaded ? "Display name" : "Loading…"}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={onNameBlur}
          maxLength={24}
          disabled={!nameLoaded}
          style={{ ...inputStyle, opacity: nameLoaded ? 1 : 0.5 }}
        />
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "var(--red)", marginTop: -8 }}>
          {error}
        </p>
      )}

      {/* Create button */}
      <button
        onClick={onCreate}
        disabled={!name.trim() || loading}
        style={{ ...btnPrimary, opacity: !name.trim() ? 0.45 : 1 }}
      >
        CREATE ROOM
      </button>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      {/* Join button */}
      <button onClick={onJoin} disabled={loading} style={btnSecondary}>
        JOIN WITH CODE
      </button>

      {/* Quick play */}
      <button
        onClick={onQuickPlay}
        disabled={loading}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--muted2)",
          textAlign: "center",
          padding: "4px 0",
        }}
      >
        Quick Play (vs bots only)
      </button>
    </div>
  );
}

// ─── Create view (franchise picker) ──────────────────────────────────────────

function CreateView({
  name,
  loading,
  error,
  onBack,
  onSelect,
}: {
  name: string;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onSelect: (franchiseShortName: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={backBtn}>
          ← Back
        </button>
        <span
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: 22,
            color: "var(--text)",
            letterSpacing: 0.5,
          }}
        >
          CHOOSE YOUR FRANCHISE
        </span>
      </div>

      {!name.trim() && (
        <p style={{ fontSize: 13, color: "var(--gold)" }}>
          Go back and enter your name first.
        </p>
      )}

      {error && <p style={{ fontSize: 13, color: "var(--red)" }}>{error}</p>}

      {/* Franchise grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          maxHeight: 420,
          overflowY: "auto",
        }}
      >
        {FRANCHISES.map((f) => (
          <FranchiseButton
            key={f.shortName}
            franchise={f}
            disabled={!name.trim() || loading}
            onClick={() => onSelect(f.shortName)}
          />
        ))}
      </div>
    </div>
  );
}

function FranchiseButton({
  franchise,
  disabled,
  onClick,
}: {
  franchise: (typeof FRANCHISES)[number];
  disabled: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `${franchise.primary}18` : "var(--s2)",
        border: `1px solid ${hovered ? franchise.primary : `${franchise.primary}60`}`,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: "background 0.15s, border-color 0.15s",
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: franchise.primary,
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {franchise.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
          {franchise.city}
        </div>
      </div>
    </button>
  );
}

// ─── Join view ────────────────────────────────────────────────────────────────

function JoinView({
  name,
  code,
  setCode,
  loading,
  error,
  onBack,
  onJoin,
}: {
  name: string;
  code: string;
  setCode: (v: string) => void;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onJoin: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={backBtn}>
          ← Back
        </button>
        <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>
          Enter room code
        </span>
      </div>

      {/* Code input */}
      <input
        type="text"
        placeholder="A1B2C3"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        maxLength={6}
        style={{
          ...inputStyle,
          fontFamily: "Rajdhani, sans-serif",
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 4,
          textAlign: "center",
        }}
      />

      {!name.trim() && (
        <p style={{ fontSize: 13, color: "var(--gold)" }}>
          Go back and enter your name first.
        </p>
      )}

      {error && <p style={{ fontSize: 13, color: "var(--red)" }}>{error}</p>}

      {/* Join button */}
      <button
        onClick={onJoin}
        disabled={code.length !== 6 || !name.trim() || loading}
        style={{
          ...btnPrimary,
          opacity: code.length !== 6 || !name.trim() ? 0.45 : 1,
        }}
      >
        {loading ? "JOINING…" : "JOIN"}
      </button>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--muted)",
  letterSpacing: 0.5,
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--s2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  background: "var(--red)",
  border: "none",
  borderRadius: 8,
  padding: "12px 0",
  fontFamily: "Rajdhani, sans-serif",
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: 1.5,
  color: "#fff",
  cursor: "pointer",
  transition: "background 0.15s",
};

const btnSecondary: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 8,
  padding: "12px 0",
  fontFamily: "Rajdhani, sans-serif",
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: 1.5,
  color: "var(--text)",
  cursor: "pointer",
};

const backBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 13,
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};
