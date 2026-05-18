'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import type { Lobby, LobbySeat } from '@npl-auction/types';
import socket from '../../lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarqueeAssignment {
  playerId:     string;
  playerName:   string;
  franchiseId:  string;
  franchiseName: string;
}

// ─── Franchise metadata (colors not in LobbySeat socket type) ────────────────

const FRANCHISE_META: Record<string, { shortName: string; primary: string; secondary: string; city: string }> = {
  'Kathmandu Gorkhas':   { shortName: 'KTM', primary: '#1B3A6B', secondary: '#C9A84C', city: 'Kathmandu'    },
  'Pokhara Avengers':    { shortName: 'PKR', primary: '#C0392B', secondary: '#FFFFFF', city: 'Pokhara'      },
  'Chitwan Rhinos':      { shortName: 'CHT', primary: '#196F3D', secondary: '#F4D03F', city: 'Chitwan'      },
  'Biratnagar Kings':    { shortName: 'BRT', primary: '#6C3483', secondary: '#F9E79F', city: 'Biratnagar'   },
  'Janakpur Bolts':      { shortName: 'JNK', primary: '#1A5276', secondary: '#F39C12', city: 'Janakpur'     },
  'Lumbini Lions':       { shortName: 'LMB', primary: '#922B21', secondary: '#FAD7A0', city: 'Lumbini'      },
  'Sudurpaschim Royals': { shortName: 'SDR', primary: '#0E6655', secondary: '#A9DFBF', city: 'Sudurpaschim' },
  'Karnali Yaks':        { shortName: 'KRN', primary: '#4A235A', secondary: '#D7BDE2', city: 'Karnali'      },
};

function meta(franchiseName: string) {
  return FRANCHISE_META[franchiseName] ?? { shortName: '???', primary: '#5b6f9a', secondary: '#e4e9f4', city: '' };
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function LobbyPage() {
  const router       = useRouter();
  const params       = useSearchParams();
  const { user }     = useUser();

  const lobbyId = params.get('lobbyId') ?? '';
  const seatId  = params.get('seatId')  ?? '';

  const [lobby,              setLobby]              = useState<Lobby | null>(null);
  const [error,              setError]              = useState<string | null>(null);
  const [starting,           setStarting]           = useState(false);
  const [countdown,          setCountdown]          = useState<number | null>(null);
  const [showMarquee,        setShowMarquee]        = useState(false);
  const [marqueeAssignments, setMarqueeAssignments] = useState<MarqueeAssignment[]>([]);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Socket lifecycle ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !seatId || !user?.id) return;

    socket.connect();

    socket.on('connect', () => {
      socket.emit('lobby:join', { lobbyId, userId: user.id, seatId });
    });

    socket.on('lobby:state', (data) => {
      setLobby(data);
    });

    socket.on('lobby:error', (data) => {
      setError(data.message);
      setStarting(false);
      setCountdown(null);
    });

    // Collect all 8 marquee assignments, show the draw screen, then navigate
    socket.on('lobby:marquee_assigned', (data: MarqueeAssignment) => {
      setShowMarquee(true);
      setMarqueeAssignments(prev => [...prev, data]);
    });

    return () => {
      socket.off('connect');
      socket.off('lobby:state');
      socket.off('lobby:error');
      socket.off('lobby:marquee_assigned');
      socket.disconnect();
    };
  }, [lobbyId, seatId, user?.id, router]);

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
        socket.emit('lobby:start', { lobbyId });
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

  // ── Marquee draw screen ────────────────────────────────────────────────────

  if (showMarquee && lobby) {
    return (
      <MarqueeDrawScreen
        seats={lobby.seats}
        assignments={marqueeAssignments}
        mySeatId={seatId}
        onNavigate={() => router.push(`/auction/${lobbyId}?seatId=${seatId}`)}
      />
    );
  }

  // ── Derive user's seat ─────────────────────────────────────────────────────

  const mySeat = lobby?.seats.find((s) => s.seatId === seatId) ?? null;
  const myMeta = mySeat ? meta(mySeat.franchiseName) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Top bar */}
      <TopBar lobby={lobby} />

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, alignSelf: 'flex-start' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, marginBottom: 4 }}>
                FRANCHISE SEATS
              </div>
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text)' }}>
                8 Teams · 8 Players · Bot Fill
              </div>
            </div>

            {mySeat && myMeta && (
              <div
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          8,
                  background:   `${myMeta.primary}20`,
                  border:       `1px solid ${myMeta.primary}`,
                  borderRadius: 8,
                  padding:      '6px 12px',
                }}
              >
                <div
                  style={{
                    width: 20, height: 20,
                    borderRadius: '50%',
                    background: `${myMeta.primary}40`,
                    border: `1px solid ${myMeta.primary}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10,
                    color: myMeta.secondary,
                  }}
                >
                  {myMeta.shortName}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {mySeat.franchiseName}
                </span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{error}</div>
          )}

          {/* Seat grid */}
          {lobby ? (
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap:                 12,
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
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>Connecting…</div>
          )}

          {/* Info strip */}
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap:                 10,
              marginTop:           16,
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
        />
      </div>
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({ lobby }: { lobby: Lobby | null }) {
  return (
    <div
      style={{
        height:      56,
        background:  'var(--s1)',
        borderBottom: '1px solid var(--border)',
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'space-between',
        padding:     '0 24px',
        flexShrink:  0,
      }}
    >
      {/* Left: logo + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--red)' }}>
          NPL
        </span>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--muted2)', letterSpacing: 1 }}>
          AUCTION LOBBY
        </span>
      </div>

      {/* Right: status + code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            className="animate-pulse-fade"
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--muted2)' }}>Room Open</span>
        </div>
        {lobby && (
          <div
            style={{
              background:   'var(--s3)',
              border:       '1px solid var(--border2)',
              borderRadius: 6,
              padding:      '3px 10px',
              fontFamily:   'Rajdhani, sans-serif',
              fontWeight:   700,
              fontSize:     14,
              color:        'var(--text)',
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
        background:   isUser ? `${m.primary}12` : 'var(--s1)',
        border:       `1px solid ${isUser ? m.primary : 'var(--border)'}`,
        borderRadius: 10,
        overflow:     'hidden',
      }}
    >
      {/* Top color bar */}
      <div style={{ height: 3, background: m.primary, width: '100%' }} />

      <div style={{ padding: '12px 12px 10px' }}>
        {/* Crest + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width:        36,
              height:       36,
              borderRadius: '50%',
              background:   `${m.primary}28`,
              border:       `1px solid ${m.primary}80`,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              fontFamily:   'Rajdhani, sans-serif',
              fontWeight:   700,
              fontSize:     12,
              color:        m.secondary,
              flexShrink:   0,
            }}
          >
            {m.shortName}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
              {seat.franchiseName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{m.city}</div>
          </div>
        </div>

        {/* Seat row */}
        <div
          style={{
            background:   'var(--s2)',
            borderRadius: 6,
            padding:      '7px 10px',
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   isUser ? 'var(--green)' : 'var(--muted)',
              flexShrink:   0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isUser
                ? (seat.displayName ?? 'You')
                : seat.seatType === 'HUMAN'
                  ? (seat.displayName ?? 'Player')
                  : 'Manager'
              }
            </div>
            {!isUser && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Manager</div>
            )}
          </div>
          {isUser && (
            <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>YOU</span>
          )}
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Purse: {fmtPurse(seat.purseRemaining)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--green)' }}>Ready</span>
        </div>
      </div>
    </div>
  );
}

// ─── InfoCard ─────────────────────────────────────────────────────────────────

type InfoCardProps = { label: string; value: string; sub: string };

const INFO_CARDS: InfoCardProps[] = [
  { label: 'PURSE PER TEAM', value: 'NPR 90L',    sub: 'NPR 9,000,000'           },
  { label: 'AUCTION POOL',   value: '22 Players',  sub: '6A · 8B · 8C'            },
  { label: 'SQUAD SIZE',     value: '16 Players',  sub: '1 Marquee + 10 Auction + 5 Pre-signed' },
];

function InfoCard({ label, value, sub }: InfoCardProps) {
  return (
    <div
      style={{
        background:   'var(--s1)',
        border:       '1px solid var(--border)',
        borderRadius: 10,
        padding:      '12px 16px',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const AUCTION_FORMAT = [
  { label: 'Marquee Draw' },
  { label: 'Category A', sub: 'Base NPR 10L · Max NPR 15L' },
  { label: 'Category B', sub: 'Base NPR 5L · Max NPR 10L'  },
  { label: 'Category C', sub: 'Base NPR 2L · Max NPR 5L'   },
  { label: 'Unsold Round' },
];

function Sidebar({
  starting, countdown, onStart,
}: {
  starting: boolean;
  countdown: number | null;
  onStart: () => void;
}) {
  return (
    <div
      style={{
        width:        280,
        flexShrink:   0,
        borderLeft:   '1px solid var(--border)',
        display:      'flex',
        flexDirection: 'column',
        background:   'var(--s1)',
      }}
    >
      {/* Auction format */}
      <div style={{ padding: 20, borderBottom: '1px solid var(--border)', flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, marginBottom: 12 }}>
          AUCTION FORMAT
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AUCTION_FORMAT.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div
                style={{
                  width:        20,
                  height:       20,
                  borderRadius: '50%',
                  background:   'var(--s3)',
                  border:       '1px solid var(--border2)',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  fontSize:     11,
                  color:        'var(--muted2)',
                  flexShrink:   0,
                  marginTop:    1,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.label}</div>
                {item.sub && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.sub}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start section */}
      <div style={{ padding: 20, borderTop: '1px solid var(--border)' }}>
        {countdown !== null ? (
          /* Countdown card */
          <div
            style={{
              background:   'var(--s2)',
              border:       '1px solid var(--border2)',
              borderRadius: 10,
              padding:      '24px 0',
              textAlign:    'center',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize:   64,
                color:      'var(--gold)',
                lineHeight: 1,
              }}
            >
              {countdown}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              Starting auction…
            </div>
          </div>
        ) : (
          /* Start button */
          <button
            onClick={onStart}
            disabled={starting}
            style={{
              width:         '100%',
              background:    starting ? 'var(--s3)' : 'var(--red)',
              border:        'none',
              borderRadius:  10,
              padding:       '14px 0',
              fontFamily:    'Rajdhani, sans-serif',
              fontWeight:    700,
              fontSize:      18,
              letterSpacing: 2,
              color:         starting ? 'var(--muted)' : '#fff',
              cursor:        starting ? 'not-allowed' : 'pointer',
              transition:    'background 0.15s',
              marginBottom:  12,
            }}
            onMouseEnter={(e) => { if (!starting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--red2)'; }}
            onMouseLeave={(e) => { if (!starting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--red)'; }}
          >
            START AUCTION
          </button>
        )}

        <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
          Any player in the room can start
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
  const myAssignment = assignments.find(a =>
    seats.find(s => s.seatId === mySeatId)?.franchiseName === a.franchiseName
  ) ?? null;

  // Navigate after showing the winner callout
  useEffect(() => {
    if (!allRevealed) return;
    const t = setTimeout(onNavigate, 3_500);
    return () => clearTimeout(t);
  }, [allRevealed, onNavigate]);

  // Build a map: franchiseName → assignment (if revealed)
  const assignmentMap = new Map(assignments.map(a => [a.franchiseName, a]));

  const mySeat = seats.find(s => s.seatId === mySeatId);
  const myMeta = mySeat ? meta(mySeat.franchiseName) : null;

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 32,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 2, marginBottom: 8 }}>
          LUCKY DRAW
        </div>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 36, color: 'var(--text)' }}>
          MARQUEE ASSIGNMENT
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Each franchise receives one marquee player
        </div>
      </div>

      {/* 4-column card grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, width: '100%', maxWidth: 900, padding: '0 24px',
      }}>
        {seats.map(seat => {
          const m        = meta(seat.franchiseName);
          const revealed = assignmentMap.get(seat.franchiseName);
          const isMe     = seat.seatId === mySeatId;

          return (
            <div
              key={seat.seatId}
              className={revealed ? 'animate-marquee-reveal' : undefined}
              style={{
                background: isMe && revealed ? `${m.primary}18` : 'var(--s1)',
                border: `1px solid ${revealed ? (isMe ? m.primary : 'var(--border2)') : 'var(--border)'}`,
                borderRadius: 10, padding: '14px 12px',
                transition: 'background .3s, border-color .3s',
              }}
            >
              {/* Franchise header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: `${m.primary}28`, border: `1.5px solid ${m.primary}80`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9, color: m.primary,
                }}>
                  {m.shortName}
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 500,
                  color: revealed ? 'var(--text)' : 'var(--muted)',
                }}>
                  {m.shortName}
                </div>
              </div>

              {/* Content */}
              {revealed ? (
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, lineHeight: 1.3,
                    color: isMe ? m.secondary : 'var(--text)',
                  }}>
                    {revealed.playerName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Marquee Player
                  </div>
                  <div style={{
                    display: 'inline-block', marginTop: 6,
                    background: '#F472B620', border: '1px solid #F472B660',
                    borderRadius: 4, padding: '2px 6px',
                    fontSize: 10, color: '#F472B6',
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 700,
                  }}>
                    MARQUEE
                  </div>
                </div>
              ) : (
                <div style={{
                  height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--muted)', fontSize: 20, letterSpacing: 4,
                }}>
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
            borderRadius: 10, padding: '16px 28px', textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, marginBottom: 4 }}>
            YOUR MARQUEE PLAYER
          </div>
          <div style={{
            fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 24,
            color: myMeta.secondary,
          }}>
            {myAssignment.playerName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Auction begins in a moment…
          </div>
        </div>
      )}
    </div>
  );
}
