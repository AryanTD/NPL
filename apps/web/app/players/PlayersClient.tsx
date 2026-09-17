"use client";

import { useState } from "react";
import Link from "next/link";

type Role = "BAT" | "BOWL" | "AR" | "WK";
type Category = "A" | "B" | "C";

export interface PlayerData {
  id: string;
  name: string;
  category: Category;
  role: Role;
  quality: number;
  basePrice: number;
  isMarquee: boolean;
  matches: number;
  runs: number;
  wickets: number;
  battingAvg: number | null;
  strikeRate: number | null;
  bowlingAvg: number | null;
  economy: number | null;
  hs: string | null;
  bbi: string | null;
}

type RoleFilter = "ALL" | Role;

const ROLE_BADGE: Record<Role, { bg: string; text: string; label: string }> = {
  BAT: { bg: "rgba(74,144,226,0.12)", text: "#4a90e2", label: "BAT" },
  BOWL: { bg: "rgba(46,160,98,0.12)", text: "#2ea062", label: "BOWL" },
  AR: { bg: "rgba(201,168,76,0.12)", text: "#c9a84c", label: "AR" },
  WK: { bg: "rgba(160,100,220,0.12)", text: "#a064dc", label: "WK" },
};

const ROLE_LABEL: Record<Role, string> = {
  BAT: "Batsman",
  BOWL: "Bowler",
  AR: "All-Rounder",
  WK: "Wicket Keeper",
};

const CAT_BADGE: Record<Category, { bg: string; text: string }> = {
  A: { bg: "rgba(201,168,76,0.12)", text: "#c9a84c" },
  B: { bg: "rgba(136,153,187,0.12)", text: "#8899bb" },
  C: { bg: "rgba(91,111,154,0.12)", text: "#5b6f9a" },
};

function fmt(v: number | string | null): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  return String(v);
}

function getCardStats(p: PlayerData): { label: string; value: string }[] {
  if (p.role === "BAT" || p.role === "WK") {
    return [
      { label: "Matches", value: fmt(p.matches) },
      { label: "Runs", value: fmt(p.runs) },
      { label: "Bat Avg", value: fmt(p.battingAvg) },
      { label: "Strike Rate", value: fmt(p.strikeRate) },
      { label: "Highest Score", value: fmt(p.hs) },
    ];
  }
  if (p.role === "BOWL") {
    return [
      { label: "Matches", value: fmt(p.matches) },
      { label: "Wickets", value: fmt(p.wickets) },
      { label: "Bowl Avg", value: fmt(p.bowlingAvg) },
      { label: "Economy", value: fmt(p.economy) },
      { label: "Best Bowling", value: fmt(p.bbi) },
    ];
  }
  return [
    { label: "Matches", value: fmt(p.matches) },
    { label: "Runs", value: fmt(p.runs) },
    { label: "Wickets", value: fmt(p.wickets) },
    { label: "Bat Avg", value: fmt(p.battingAvg) },
    { label: "Economy", value: fmt(p.economy) },
  ];
}

function getAllStats(p: PlayerData): { label: string; value: string }[] {
  return [
    { label: "Matches", value: fmt(p.matches) },
    { label: "Runs", value: fmt(p.runs) },
    { label: "Wickets", value: fmt(p.wickets) },
    { label: "Batting Avg", value: fmt(p.battingAvg) },
    { label: "Strike Rate", value: fmt(p.strikeRate) },
    { label: "Bowling Avg", value: fmt(p.bowlingAvg) },
    { label: "Economy", value: fmt(p.economy) },
    { label: "Highest Score", value: fmt(p.hs) },
    { label: "Best Bowling", value: fmt(p.bbi) },
  ];
}

export default function PlayersClient({ players }: { players: PlayerData[] }) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerData | null>(null);

  const filtered =
    roleFilter === "ALL" ? players : players.filter((p) => p.role === roleFilter);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            fontSize: 13,
            color: "var(--gold)",
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 28,
          }}
        >
          ← Back to home
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <h1
            style={{
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: 36,
              color: "var(--text)",
              letterSpacing: 2,
              margin: 0,
            }}
          >
            PLAYERS
          </h1>
          <span
            style={{
              background: "rgba(201,168,76,0.08)",
              border: "1px solid rgba(201,168,76,0.25)",
              color: "var(--gold)",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 600,
              fontSize: 12,
              padding: "3px 10px",
              borderRadius: 4,
              letterSpacing: 1,
            }}
          >
            NPL 2024 · {players.length} PLAYERS
          </span>
        </div>

        {/* Role filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
          {(["ALL", "BAT", "BOWL", "AR", "WK"] as const).map((r) => {
            const active = roleFilter === r;
            return (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  border: active ? "1px solid var(--gold)" : "1px solid var(--border)",
                  background: active ? "rgba(201,168,76,0.08)" : "transparent",
                  color: active ? "var(--gold)" : "var(--muted2)",
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: 1,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {r === "ALL" ? "ALL ROLES" : r}
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
            {filtered.length} of {players.length}
          </span>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((p) => (
            <PlayerCard key={p.id} player={p} onOpenModal={() => setSelectedPlayer(p)} />
          ))}
        </div>
      </div>

      {selectedPlayer && (
        <StatsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}

function PlayerCard({
  player: p,
  onOpenModal,
}: {
  player: PlayerData;
  onOpenModal: () => void;
}) {
  const stats = getCardStats(p);
  const role = ROLE_BADGE[p.role];
  const cat = CAT_BADGE[p.category];

  return (
    <div
      style={{
        background: "var(--s1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "16px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Name + badges */}
      <div>
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: 16,
            color: "var(--text)",
            marginBottom: 7,
            lineHeight: 1.2,
          }}
        >
          {p.name}
          {p.isMarquee && (
            <span
              style={{
                marginLeft: 7,
                fontSize: 9,
                background: "rgba(201,168,76,0.12)",
                color: "var(--gold)",
                border: "1px solid rgba(201,168,76,0.3)",
                padding: "1px 5px",
                borderRadius: 3,
                verticalAlign: "middle",
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              MARQUEE
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: role.bg,
              color: role.text,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            {role.label}
          </span>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: cat.bg,
              color: cat.text,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            CAT {p.category}
          </span>
        </div>
      </div>

      {/* Stats: 2×2 grid + 1 full-width */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 12px",
            marginBottom: 8,
          }}
        >
          {stats.slice(0, 4).map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--muted)",
                  letterSpacing: 0.5,
                  marginBottom: 2,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  color: s.value === "—" ? "var(--muted)" : "var(--text)",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
        {stats[4] && (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "var(--muted)",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {stats[4].label}
            </div>
            <div
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: stats[4].value === "—" ? "var(--muted)" : "var(--text)",
              }}
            >
              {stats[4].value}
            </div>
          </div>
        )}
      </div>

      {/* Footer row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid var(--border)",
          paddingTop: 10,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Base:{" "}
          <span
            style={{
              color: "var(--gold)",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 600,
            }}
          >
            {(p.basePrice / 100000).toFixed(0)}L
          </span>
        </span>
        <button
          onClick={onOpenModal}
          style={{
            fontSize: 11,
            color: "var(--muted2)",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "3px 10px",
            cursor: "pointer",
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          FULL STATS
        </button>
      </div>
    </div>
  );
}

function StatsModal({
  player: p,
  onClose,
}: {
  player: PlayerData;
  onClose: () => void;
}) {
  const allStats = getAllStats(p);
  const role = ROLE_BADGE[p.role];
  const cat = CAT_BADGE[p.category];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--s2)",
          border: "1px solid var(--border2)",
          borderRadius: 12,
          padding: "28px 28px 24px",
          maxWidth: 480,
          width: "100%",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            fontSize: 22,
            cursor: "pointer",
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>

        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: 21,
              color: "var(--text)",
              margin: "0 0 10px 0",
              paddingRight: 24,
              lineHeight: 1.2,
            }}
          >
            {p.name}
            {p.isMarquee && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 9,
                  background: "rgba(201,168,76,0.12)",
                  color: "var(--gold)",
                  border: "1px solid rgba(201,168,76,0.3)",
                  padding: "1px 5px",
                  borderRadius: 3,
                  verticalAlign: "middle",
                  letterSpacing: 1,
                  fontWeight: 700,
                }}
              >
                MARQUEE
              </span>
            )}
          </h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 4,
                background: role.bg,
                color: role.text,
                fontWeight: 600,
              }}
            >
              {ROLE_LABEL[p.role]}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 4,
                background: cat.bg,
                color: cat.text,
                fontWeight: 600,
              }}
            >
              Category {p.category}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 4,
                background: "rgba(91,111,154,0.1)",
                color: "var(--muted2)",
                fontWeight: 600,
              }}
            >
              Quality: {p.quality}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 4,
                background: "rgba(201,168,76,0.08)",
                color: "var(--gold)",
                fontWeight: 600,
              }}
            >
              Base: {(p.basePrice / 100000).toFixed(0)}L NPR
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
            borderTop: "1px solid var(--border)",
            paddingTop: 20,
          }}
        >
          {allStats.map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--muted)",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 600,
                  fontSize: 18,
                  color: s.value === "—" ? "var(--muted)" : "var(--text)",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
