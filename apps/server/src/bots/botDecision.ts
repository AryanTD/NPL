import { PlayerRole, PlayerCategory } from "@prisma/client";
import {
  BotPersonality,
  CATEGORY_BUDGET_SHARE,
  CATEGORY_QUALITY_FLOOR,
  CATEGORY_SLOTS,
} from "./botPersonalities";

export interface RosterState {
  marqueeCount: number;
  aCount: number;
  bCount: number;
  cCount: number;
  batsmanCount: number;
  bowlerCount: number;
  totalWon: number;
  purseSpent: number;
  categoryOverspend: Record<string, number>;
}

export interface QueueSummary {
  remainingByRole: Partial<
    Record<PlayerRole, { count: number; bestQuality: number }>
  >;
}

export interface BotDecisionInput {
  player: {
    id: string;
    basePrice: number;
    quality: number;
    role: PlayerRole;
    category: PlayerCategory;
    economy: number | null;
    strikeRate: number | null;
  };
  currentBid: number;
  currentWinnerId: string | null;
  isHumanWinner: boolean;
  myFranchiseId: string;
  personality: BotPersonality;
  priorityRoles: PlayerRole[];
  roster: RosterState;
  remainingPurse: number;
  isUnsoldRound: boolean;
  quota: { A: number; B: number; C: number };
  categoryPlayersRemaining: number;
  queueSummary: QueueSummary;
  starTargetIds: Set<string>;
  eliteTargetIds: Set<string>;
  spendingFloor: number;
  isConservativeBluff: boolean;
  skipFloorInThisPhase: boolean;
}

export interface BotDecisionOutput {
  action: "BID" | "PASS";
  amount?: number;
  delayMs: number;
  emitThinking: boolean;
}

const TOTAL_PURSE = 9_000_000;
const CATEGORY_MAX_PRICE: Record<string, number> = { A: 1_500_000, B: 1_000_000, C: 500_000 };

export function decideBid(input: BotDecisionInput): BotDecisionOutput {
  const {
    player,
    currentBid,
    currentWinnerId,
    myFranchiseId,
    personality,
    priorityRoles,
    roster,
    remainingPurse,
    isUnsoldRound,
    quota,
    categoryPlayersRemaining,
    queueSummary,
  } = input;

  const totalSlots = 1 + quota.A + quota.B + quota.C;
  const categorySlots: Record<string, number> = {
    MARQUEE: 1,
    A: quota.A,
    B: quota.B,
    C: quota.C,
  };
  const categoryCount: Record<string, number> = {
    MARQUEE: roster.marqueeCount,
    A: roster.aCount,
    B: roster.bCount,
    C: roster.cCount,
  };
  const slotsRemaining = totalSlots - roster.totalWon;

  const instantPass: BotDecisionOutput = {
    action: "PASS",
    delayMs: 0,
    emitThinking: false,
  };

  // ── Step 1: Hard blocks (instant, no delay, no thinking) ─────────────────
  if (currentWinnerId === myFranchiseId) return instantPass;
  if (remainingPurse < currentBid + 25_000) return instantPass;
  if ((categoryCount[player.category] ?? 0) >= categorySlots[player.category])
    return instantPass;
  if (player.role === PlayerRole.BAT && roster.batsmanCount >= 6)
    return instantPass;
  if (player.role === PlayerRole.BOWL && roster.bowlerCount >= 4)
    return instantPass;

  // ── STAR_CHASER: only bid on top 5 remaining per category (skip unsold round) ──
  if (personality.type === "STAR_CHASER" && !isUnsoldRound) {
    if (!input.starTargetIds.has(player.id)) return instantPass;
  }

  const isElite = input.eliteTargetIds.has(player.id);

  // AGGRESSIVE randomly ignores ~1/3 of players — chaotic, not quality-driven
  if (personality.type === "AGGRESSIVE" && Math.random() < 0.33)
    return instantPass;

  // AGGRESSIVE skips floor-quality players (the absolute weakest in each tier)
  // In the unsold round they'll pick them up if quota demands it
  if (
    personality.type === "AGGRESSIVE" &&
    !isUnsoldRound &&
    player.quality <= (CATEGORY_QUALITY_FLOOR[player.category] ?? 0)
  )
    return instantPass;

  // BALANCED pre-selected one group per category to skip floor-quality players
  if (
    personality.type === "BALANCED" &&
    !isUnsoldRound &&
    input.skipFloorInThisPhase &&
    player.quality <= (CATEGORY_QUALITY_FLOOR[player.category] ?? 0)
  )
    return instantPass;

  // ── ROLE_HUNTER priority determination ───────────────────────────────────
  const isBatNeeded = roster.batsmanCount < 3 && player.role === PlayerRole.BAT;
  const isBowlNeeded =
    roster.bowlerCount < 3 && player.role === PlayerRole.BOWL;
  const isMinCountOverride = isBatNeeded || isBowlNeeded;
  const isPriority = isMinCountOverride || priorityRoles.includes(player.role);

  // ROLE_HUNTER uses role-adjusted threshold and ceiling
  const effectiveFitThreshold =
    personality.type === "ROLE_HUNTER"
      ? isPriority
        ? 0.35
        : 0.7
      : personality.fitThreshold;

  const effectiveCeilingMult =
    personality.type === "ROLE_HUNTER"
      ? isPriority
        ? 1.2
        : 0.6
      : personality.ceilingMult;

  // ── Step 2: mustFill override (unsold round only) ─────────────────────────
  const needsThisCategory =
    (categoryCount[player.category] ?? 0) < categorySlots[player.category];
  const mustFill = isUnsoldRound && needsThisCategory;

  // ── Step 3: Fit score ─────────────────────────────────────────────────────
  const qualityFit = Math.min(player.quality / 100, 1);

  // roleFit
  let roleFit: number;
  if (personality.type === "ROLE_HUNTER") {
    roleFit = isPriority ? 1.0 : 0.2;
  } else if (personality.type === "BUDGET_SNIPER") {
    roleFit = 0.6;
  } else {
    roleFit = 0.7;
  }

  // categoryFit
  const categoryRemaining =
    categorySlots[player.category] - (categoryCount[player.category] ?? 0);
  const categoryFit =
    categoryRemaining <= 1 ? 1.0 : categoryRemaining <= 2 ? 0.85 : 0.65;

  // weights
  let Wq: number, Wr: number, Wc: number;
  if (personality.type === "STAR_CHASER") {
    Wq = 0.75;
    Wr = 0.15;
    Wc = 0.1;
  } else if (personality.type === "ROLE_HUNTER") {
    Wq = 0.5;
    Wr = 0.35;
    Wc = 0.15;
  } else {
    Wq = 0.55;
    Wr = 0.25;
    Wc = 0.2;
  }

  const fitScore = qualityFit * Wq + roleFit * Wr + categoryFit * Wc;

  // ── Step 4: Threshold ──────────────────────────────────────────────────────
  const desperationDelta = (slotsRemaining / totalSlots) * 0.25;

  const hasBoughtInCategory = (categoryCount[player.category] ?? 0) > 0;
  let categoryDroughtDelta = 0;
  if (!hasBoughtInCategory && categoryPlayersRemaining <= 2) {
    const urgency = (2 - categoryPlayersRemaining + 1) / 2;
    categoryDroughtDelta = urgency * 0.2;
  }

  const eliteThresholdDelta = isElite ? 0.08 : 0;

  // Floor pressure: bots bid more aggressively when behind on minimum spend
  const purseSpent = TOTAL_PURSE - remainingPurse;
  const floorGap = Math.max(0, input.spendingFloor - purseSpent);
  const floorPressureDelta =
    floorGap > 0 ? Math.min(0.18, (floorGap / input.spendingFloor) * 0.25) : 0;

  const threshold =
    effectiveFitThreshold -
    desperationDelta -
    categoryDroughtDelta -
    eliteThresholdDelta -
    floorPressureDelta;

  // ── Step 5: Fit gate (skipped for mustFill) ───────────────────────────────
  // drought and mustFill both disable lookahead holdout
  const lookaheadActive = !mustFill && categoryDroughtDelta === 0;

  let confidence: number;
  if (!mustFill) {
    confidence =
      Math.abs(fitScore - threshold) / Math.max(Math.abs(threshold), 0.01);
    if (fitScore < threshold) {
      const delayMs = pickDelay(personality);
      return { action: "PASS", delayMs, emitThinking: confidence < 0.4 };
    }
  } else {
    confidence = 1.0;
  }

  // ── Step 6–7: Ceiling ─────────────────────────────────────────────────────
  const qualityAdjustedValue =
    player.basePrice * (0.7 + (player.quality / 100) * 0.6);

  // BUDGET_SNIPER: bluff early in all categories, snipe hard in last 3 or unsold
  const bluffCeilingByCategory: Record<string, number> = {
    A: 1.08,
    B: 1.03,
    C: 1.02,
  };
  const activeCeilingMult =
    personality.type === "BUDGET_SNIPER"
      ? isUnsoldRound || categoryPlayersRemaining <= 3
        ? 1.3
        : (bluffCeilingByCategory[player.category] ?? effectiveCeilingMult)
      : effectiveCeilingMult;

  const humanBoost = input.isHumanWinner ? personality.humanRivalMult : 1.0;
  const eliteHumanMult = isElite && input.isHumanWinner ? 1.08 : 1.0;

  const categoryUrgencyMult =
    categoryRemaining <= 1 ? 1.25 : categoryRemaining <= 2 ? 1.1 : 1.0;
  const roleUrgencyMult = isMinCountOverride ? 1.2 : 1.0;

  const categoryAllocation =
    TOTAL_PURSE * CATEGORY_BUDGET_SHARE[player.category];
  const avgBudgetPerSlot = categoryAllocation / categorySlots[player.category];
  const spendingRatio = currentBid / avgBudgetPerSlot;
  const pacingMult =
    spendingRatio > 1.5 ? 0.8 : spendingRatio > 1.2 ? 0.9 : 1.0;

  const overspend = roster.categoryOverspend[player.category] ?? 0;
  const overspendPenalty =
    overspend > categoryAllocation * 0.5
      ? 0.75
      : overspend > categoryAllocation * 0.25
        ? 0.88
        : 1.0;

  // CONSERVATIVE never gets unsold boost — sticks to its math
  const unsoldBoost =
    isUnsoldRound && personality.type !== "CONSERVATIVE" ? 1.15 : 1.0;

  // drought ceiling mult: scales 1.06 → 1.30
  const droughtCeilingMult =
    categoryDroughtDelta > 0 ? 1.0 + (categoryDroughtDelta / 0.2) * 0.3 : 1.0;
  const eliteCeilingMult = isElite ? 1.2 : 1.0;

  // lookahead adjustments
  let holdoutMult = 1.0;
  let lastOfRoleBoost = 1.0;
  if (lookaheadActive) {
    const roleInfo = queueSummary.remainingByRole[player.role];
    if (roleInfo) {
      if (roleInfo.bestQuality > player.quality && roleInfo.count > 0) {
        if (personality.type === "STAR_CHASER") holdoutMult = 0.7;
        else if (personality.type === "CONSERVATIVE") holdoutMult = 0.8;
        else if (personality.type === "ROLE_HUNTER" && isPriority)
          holdoutMult = 0.8;
        // AGGRESSIVE, BUDGET_SNIPER, BALANCED ignore lookahead
      }
      // Last of this role in current category and bot still needs it
      const stillNeedsRole =
        (player.role === PlayerRole.BAT && roster.batsmanCount < 3) ||
        (player.role === PlayerRole.BOWL && roster.bowlerCount < 3) ||
        (personality.type === "ROLE_HUNTER" && isPriority);
      if (roleInfo.count === 0 && stillNeedsRole) {
        lastOfRoleBoost = 1.25;
      }
    }
  }

  const floorPressureCeilingMult =
    floorGap > 0 ? 1.0 + Math.min(0.15, (floorGap / input.spendingFloor) * 0.2) : 1.0;
  const mistakeFactor = 0.9 + Math.random() * 0.3;

  let ceiling =
    qualityAdjustedValue *
    activeCeilingMult *
    humanBoost *
    eliteHumanMult *
    categoryUrgencyMult *
    roleUrgencyMult *
    pacingMult *
    overspendPenalty *
    unsoldBoost *
    droughtCeilingMult *
    eliteCeilingMult *
    holdoutMult *
    lastOfRoleBoost *
    floorPressureCeilingMult *
    mistakeFactor;

  // mustFill guarantees a minimum viable ceiling
  if (mustFill) {
    ceiling = Math.max(ceiling, player.basePrice + personality.normalIncrement);
  }

  // Reserve buffer: keep enough for remaining slots
  const reserveBuffer = Math.max(slotsRemaining - 1, 0) * 200_000;
  ceiling = Math.min(ceiling, remainingPurse - reserveBuffer);

  // Conservative bluff: commit to a 14L ceiling early in the round
  if (input.isConservativeBluff) {
    ceiling = Math.min(1_400_000, remainingPurse - reserveBuffer);
  }

  // BUDGET_SNIPER: go all the way to max category price for standout athletes —
  // elite economy (<6) or explosive strike rate (>150)
  const isBudgetSniperStar =
    personality.type === "BUDGET_SNIPER" &&
    ((player.economy !== null && player.economy < 6) ||
      (player.strikeRate !== null && player.strikeRate > 150));
  if (isBudgetSniperStar) {
    const maxPrice = CATEGORY_MAX_PRICE[player.category] ?? ceiling;
    ceiling = Math.min(maxPrice, remainingPurse - reserveBuffer);
  }

  if (currentBid >= ceiling) {
    const delayMs = pickDelay(personality);
    return { action: "PASS", delayMs, emitThinking: false };
  }

  // ── Step 8: Bid amount ────────────────────────────────────────────────────
  const isUrgent =
    player.quality > 80 || categoryRemaining <= 1 || isMinCountOverride;
  const increment = isUrgent
    ? personality.urgentIncrement
    : personality.normalIncrement;
  const bidAmount = Math.max(currentBid + increment, player.basePrice);

  if (bidAmount > remainingPurse) return instantPass;

  // ── Step 9–10: Delay + thinking indicator ─────────────────────────────────
  // Bluffing conservative bids fast like AGGRESSIVE to seem decisive
  if (input.isConservativeBluff) {
    return { action: "BID", amount: bidAmount, delayMs: 500 + Math.random() * 700, emitThinking: false };
  }

  const delayMs = pickDelay(personality);
  const emitThinking = !mustFill && confidence < 0.4;

  return { action: "BID", amount: bidAmount, delayMs, emitThinking };
}

function pickDelay(personality: BotPersonality): number {
  const useFast = Math.random() < personality.fastChance;
  const [lo, hi] = useFast ? personality.delayFast : personality.delaySlow;
  return Math.round(lo + Math.random() * (hi - lo));
}
