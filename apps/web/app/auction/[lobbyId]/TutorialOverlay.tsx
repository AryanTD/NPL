"use client";

import { useEffect, useRef, useState } from "react";
import socket from "../../../lib/socket";

// ─── Step type ────────────────────────────────────────────────────────────────

export interface TourStep {
  targetId: string;
  title: string;
  body: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TourPhase = "active" | "paused";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TutorialOverlayProps {
  steps: TourStep[];
  metadataKey: string;
  onDismiss: () => void;
  lobbyId?: string;        // when provided, pause/resume the server auction
  initiallyPaused?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function computeTooltipSide(
  r: SpotlightRect
): "left" | "right" | "above" | "below" {
  if (typeof window === "undefined") return "below";
  if (window.innerWidth < 640) return "below";
  const sides = [
    { side: "right" as const, space: window.innerWidth - (r.left + r.width) },
    { side: "left" as const, space: r.left },
    { side: "below" as const, space: window.innerHeight - (r.top + r.height) },
    { side: "above" as const, space: r.top },
  ];
  return sides.sort((a, b) => b.space - a.space)[0].side;
}

function computeTooltipPos(
  r: SpotlightRect,
  side: "left" | "right" | "above" | "below"
): { top: number; left: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const W = 280;
  const H = 172;
  const GAP = 14;
  switch (side) {
    case "right":
      return {
        left: r.left + r.width + GAP,
        top: clamp(r.top + r.height / 2 - H / 2, 8, vh - H - 8),
      };
    case "left":
      return {
        left: r.left - W - GAP,
        top: clamp(r.top + r.height / 2 - H / 2, 8, vh - H - 8),
      };
    case "below":
      return {
        top: r.top + r.height + GAP,
        left: clamp(r.left, 16, vw - W - 16),
      };
    case "above":
      return {
        top: r.top - H - GAP,
        left: clamp(r.left, 16, vw - W - 16),
      };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TutorialOverlay({
  steps,
  metadataKey,
  onDismiss,
  lobbyId,
  initiallyPaused = false,
}: TutorialOverlayProps) {
  const [phase, setPhase] = useState<TourPhase>(
    initiallyPaused ? "paused" : "active"
  );
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const phaseRef = useRef<TourPhase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Tracks whether we issued a server pause so we only resume if we did.
  const didPauseRef = useRef(false);

  // ── Server pause/resume lifecycle ─────────────────────────────────────────
  // Pause when the tour becomes active for the first time. On unmount (all
  // dismiss paths — skip, done, Escape) the cleanup resumes the auction.

  useEffect(() => {
    if (!lobbyId || initiallyPaused) return;
    socket.emit("lobby:pause", { lobbyId });
    didPauseRef.current = true;
    return () => {
      if (didPauseRef.current) {
        socket.emit("lobby:resume", { lobbyId });
        didPauseRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount / cleanup on unmount

  // ── Lucky draw: let the draw proceed, resume tour after ───────────────────
  // Lucky draw fires while we're paused → the server is no longer blocked
  // (lucky draw takes over). We surface the pause pill so the user can resume
  // the tour once the draw closes.

  useEffect(() => {
    const onLuckyDraw = () => {
      if (phaseRef.current === "active") {
        // Release our server pause so the lucky draw can complete normally.
        if (lobbyId && didPauseRef.current) {
          socket.emit("lobby:resume", { lobbyId });
          didPauseRef.current = false;
        }
        setPhase("paused");
      }
    };
    socket.on("lobby:lucky_draw", onLuckyDraw);
    return () => { socket.off("lobby:lucky_draw", onLuckyDraw); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // uses refs, no deps needed

  // ── Spotlight positioning ─────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "active") return;

    const measure = () => {
      const el = document.getElementById(steps[step].targetId);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - 8,
        left: r.left - 8,
        width: r.width + 16,
        height: r.height + 16,
      });
    };

    measure();
    const retry = setInterval(() => {
      if (document.getElementById(steps[step].targetId)) {
        measure();
        clearInterval(retry);
      }
    }, 300);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      clearInterval(retry);
    };
  }, [step, phase, steps]);

  // ── Escape key ────────────────────────────────────────────────────────────

  const handleDismissRef = useRef<() => void>(() => {});
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleDismissRef.current(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleDismiss() {
    // Server resume is handled by the mount-effect cleanup — no need to emit here.
    // Persist to localStorage immediately (works for guests too)
    localStorage.setItem(metadataKey, "true");
    // Background persist to DB for signed-in users (401 for guests is silently ignored)
    fetch("/api/user/tour", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: metadataKey }),
    }).catch(() => {});
    onDismiss();
  }
  handleDismissRef.current = handleDismiss;

  function handleNext() {
    if (step < steps.length - 1) {
      setRect(null);
      setStep((s) => s + 1);
    } else {
      handleDismiss();
    }
  }

  function handleResumeTour() {
    // Re-pause the auction now that lucky draw has cleared.
    if (lobbyId) {
      socket.emit("lobby:pause", { lobbyId });
      didPauseRef.current = true;
    }
    setPhase("active");
  }

  // ── Compute tooltip position ──────────────────────────────────────────────

  const tooltipSide = rect ? computeTooltipSide(rect) : "below";
  const tooltipPos = rect
    ? computeTooltipPos(rect, tooltipSide)
    : {
        top: typeof window !== "undefined" ? window.innerHeight / 2 - 86 : 200,
        left: typeof window !== "undefined" ? window.innerWidth / 2 - 140 : 200,
      };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Dim overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(7,8,15,0.82)",
          zIndex: 200,
          pointerEvents: "none",
        }}
      />

      {/* Spotlight cutout */}
      {rect && phase === "active" && (
        <div
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: 10,
            boxShadow: "0 0 0 9999px rgba(7,8,15,0.82)",
            outline: "2px solid var(--gold)",
            outlineOffset: 2,
            zIndex: 201,
            pointerEvents: "none",
            transition:
              "top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease",
          }}
        />
      )}

      {/* Tooltip card */}
      {phase === "active" && (
        <div
          key={`tour-tooltip-${step}`}
          className="animate-pop-in"
          style={{
            position: "fixed",
            top: tooltipPos.top,
            left: tooltipPos.left,
            width: 280,
            background: "var(--s2)",
            border: "1px solid var(--border2)",
            borderRadius: 12,
            padding: 16,
            zIndex: 202,
            pointerEvents: "all",
          }}
        >
          <div className={`tour-arrow tour-arrow--${tooltipSide}`} />

          <div
            style={{
              fontSize: 10,
              color: "var(--muted)",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            STEP {step + 1} OF {steps.length}
          </div>

          <div
            style={{
              fontFamily: "Rajdhani",
              fontWeight: 700,
              fontSize: 16,
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            {steps[step].title}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--muted2)",
              lineHeight: 1.65,
            }}
          >
            {steps[step].body}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
            }}
          >
            <button
              onClick={handleDismiss}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              Skip tour
            </button>
            <button
              onClick={handleNext}
              style={{
                background: "var(--gold)",
                color: "#07080f",
                border: "none",
                borderRadius: 7,
                padding: "7px 16px",
                fontFamily: "Rajdhani",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 0.5,
                cursor: "pointer",
              }}
            >
              {step === steps.length - 1 ? "Done" : "Next →"}
            </button>
          </div>
        </div>
      )}

      {/* Pause pill — shown when a lucky draw interrupted the tour */}
      {phase === "paused" && (
        <button
          onClick={handleResumeTour}
          style={{
            position: "fixed",
            bottom: 74,
            left: 16,
            zIndex: 210,
            background: "var(--s3)",
            border: "1px solid var(--border2)",
            borderRadius: 20,
            padding: "8px 16px",
            fontFamily: "Rajdhani",
            fontWeight: 600,
            fontSize: 12,
            color: "var(--text)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: 0.3,
          }}
        >
          <span style={{ color: "var(--gold)" }}>⚡</span>
          Tour paused — Resume
        </button>
      )}
    </>
  );
}
