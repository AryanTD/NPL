import { PlayerRole, PlayerCategory } from '@prisma/client'
import { BotPersonality, CATEGORY_BUDGET_SHARE, CATEGORY_SLOTS, CATEGORY_QUALITY_FLOOR, QUALITY_MAX } from './botPersonalities'

export interface RosterState {
  marqueeCount: number
  aCount: number
  bCount: number
  cCount: number
  batsmanCount: number
  bowlerCount: number
  totalWon: number
  purseSpent: number
  categoryOverspend: Record<string, number>
}

export interface QueueSummary {
  remainingByRole: Partial<Record<PlayerRole, { count: number; bestQuality: number }>>
}

export interface BotDecisionInput {
  player: {
    id: string
    basePrice: number
    quality: number
    role: PlayerRole
    category: PlayerCategory
  }
  currentBid: number
  currentWinnerId: string | null
  isHumanWinner: boolean
  myFranchiseId: string
  personality: BotPersonality
  priorityRoles: PlayerRole[]
  roster: RosterState
  remainingPurse: number
  isUnsoldRound: boolean
  quota: { A: number; B: number; C: number }
  categoryPlayersRemaining: number
  mood: 'HOT' | 'COLD' | 'NEUTRAL'
  queueSummary: QueueSummary
}

export interface BotDecisionOutput {
  action: 'BID' | 'PASS'
  amount?: number
  delayMs: number
  emitThinking: boolean
}

const TOTAL_PURSE = 9_000_000

export function decideBid(input: BotDecisionInput): BotDecisionOutput {
  const {
    player, currentBid, currentWinnerId, myFranchiseId,
    personality, priorityRoles, roster, remainingPurse,
    isUnsoldRound, quota, categoryPlayersRemaining, mood, queueSummary,
  } = input

  const totalSlots = 1 + quota.A + quota.B + quota.C
  const categorySlots: Record<string, number> = { MARQUEE: 1, A: quota.A, B: quota.B, C: quota.C }
  const categoryCount: Record<string, number> = {
    MARQUEE: roster.marqueeCount, A: roster.aCount, B: roster.bCount, C: roster.cCount,
  }
  const slotsRemaining = totalSlots - roster.totalWon

  const instantPass: BotDecisionOutput = { action: 'PASS', delayMs: 0, emitThinking: false }

  // ── Step 1: Hard blocks (instant, no delay, no thinking) ─────────────────
  if (currentWinnerId === myFranchiseId)                                  return instantPass
  if (remainingPurse < currentBid + 25_000)                               return instantPass
  if ((categoryCount[player.category] ?? 0) >= categorySlots[player.category]) return instantPass
  if (player.role === PlayerRole.BAT  && roster.batsmanCount >= 6)        return instantPass
  if (player.role === PlayerRole.BOWL && roster.bowlerCount  >= 4)        return instantPass

  // ── ROLE_HUNTER priority determination ───────────────────────────────────
  const isBatNeeded  = roster.batsmanCount < 3 && player.role === PlayerRole.BAT
  const isBowlNeeded = roster.bowlerCount  < 3 && player.role === PlayerRole.BOWL
  const isMinCountOverride = isBatNeeded || isBowlNeeded
  const isPriority = isMinCountOverride || priorityRoles.includes(player.role)

  // ROLE_HUNTER uses role-adjusted threshold and ceiling
  const effectiveFitThreshold = personality.type === 'ROLE_HUNTER'
    ? (isPriority ? 0.35 : 0.70)
    : personality.fitThreshold

  const effectiveCeilingMult = personality.type === 'ROLE_HUNTER'
    ? (isPriority ? 1.20 : 0.60)
    : personality.ceilingMult

  // ── Step 2: mustFill override (unsold round only) ─────────────────────────
  const needsThisCategory = (categoryCount[player.category] ?? 0) < categorySlots[player.category]
  const mustFill = isUnsoldRound && needsThisCategory

  // ── Step 3: Fit score ─────────────────────────────────────────────────────
  // qualityFit: STAR_CHASER uses category-relative normalization
  let qualityFit: number
  if (personality.type === 'STAR_CHASER') {
    const floor = CATEGORY_QUALITY_FLOOR[player.category] ?? 45
    qualityFit = Math.max(0, (player.quality - floor) / (QUALITY_MAX - floor))
  } else {
    qualityFit = Math.min(player.quality / 100, 1)
  }

  // roleFit
  let roleFit: number
  if (personality.type === 'ROLE_HUNTER') {
    roleFit = isPriority ? 1.0 : 0.2
  } else if (personality.type === 'BUDGET_SNIPER') {
    roleFit = 0.6
  } else {
    roleFit = 0.7
  }

  // categoryFit
  const categoryRemaining = categorySlots[player.category] - (categoryCount[player.category] ?? 0)
  const categoryFit = categoryRemaining <= 1 ? 1.0 : categoryRemaining <= 2 ? 0.85 : 0.65

  // weights
  let Wq: number, Wr: number, Wc: number
  if (personality.type === 'STAR_CHASER')  { Wq = 0.75; Wr = 0.15; Wc = 0.10 }
  else if (personality.type === 'ROLE_HUNTER') { Wq = 0.50; Wr = 0.35; Wc = 0.15 }
  else                                          { Wq = 0.55; Wr = 0.25; Wc = 0.20 }

  const fitScore = qualityFit * Wq + roleFit * Wr + categoryFit * Wc

  // ── Step 4: Threshold ──────────────────────────────────────────────────────
  const desperationDelta = (slotsRemaining / totalSlots) * 0.25

  const moodDelta = mood === 'HOT'  ?  personality.moodSensitivity
                  : mood === 'COLD' ? -personality.moodSensitivity
                  : 0

  const hasBoughtInCategory = (categoryCount[player.category] ?? 0) > 0
  let categoryDroughtDelta = 0
  if (!hasBoughtInCategory && categoryPlayersRemaining <= 5) {
    const urgency = (5 - categoryPlayersRemaining + 1) / 5
    categoryDroughtDelta = urgency * 0.20
  }

  const threshold = effectiveFitThreshold - desperationDelta - moodDelta - categoryDroughtDelta

  // ── Step 5: Fit gate (skipped for mustFill) ───────────────────────────────
  // drought and mustFill both disable lookahead holdout
  const lookaheadActive = !mustFill && categoryDroughtDelta === 0

  let confidence: number
  if (!mustFill) {
    confidence = Math.abs(fitScore - threshold) / Math.max(Math.abs(threshold), 0.01)
    if (fitScore < threshold) {
      const delayMs = clampDelay(personality, confidence)
      return { action: 'PASS', delayMs, emitThinking: confidence < 0.4 }
    }
  } else {
    confidence = 1.0
  }

  // ── Step 6–7: Ceiling ─────────────────────────────────────────────────────
  const qualityAdjustedValue = player.basePrice * (0.7 + (player.quality / 100) * 0.6)

  // BUDGET_SNIPER flips to aggressive at category end or unsold round
  const activeCeilingMult = personality.type === 'BUDGET_SNIPER' && (categoryPlayersRemaining <= 3 || isUnsoldRound)
    ? 1.10
    : effectiveCeilingMult

  const humanBoost = input.isHumanWinner ? personality.humanRivalMult : 1.0

  const categoryUrgencyMult = categoryRemaining <= 1 ? 1.25 : categoryRemaining <= 2 ? 1.10 : 1.0
  const roleUrgencyMult = isMinCountOverride ? 1.20 : 1.0

  const categoryAllocation = TOTAL_PURSE * CATEGORY_BUDGET_SHARE[player.category]
  const avgBudgetPerSlot   = categoryAllocation / categorySlots[player.category]
  const spendingRatio = currentBid / avgBudgetPerSlot
  const pacingMult = spendingRatio > 1.5 ? 0.80 : spendingRatio > 1.2 ? 0.90 : 1.0

  const overspend = roster.categoryOverspend[player.category] ?? 0
  const overspendPenalty = overspend > categoryAllocation * 0.5  ? 0.75
                         : overspend > categoryAllocation * 0.25 ? 0.88
                         : 1.0

  // CONSERVATIVE never gets unsold boost — sticks to its math
  const unsoldBoost = isUnsoldRound && personality.type !== 'CONSERVATIVE' ? 1.15 : 1.0

  // drought ceiling mult: scales 1.06 → 1.30
  const droughtCeilingMult = categoryDroughtDelta > 0
    ? 1.0 + (categoryDroughtDelta / 0.20) * 0.30
    : 1.0

  // lookahead adjustments
  let holdoutMult = 1.0
  let lastOfRoleBoost = 1.0
  if (lookaheadActive) {
    const roleInfo = queueSummary.remainingByRole[player.role]
    if (roleInfo) {
      if (roleInfo.bestQuality > player.quality && roleInfo.count > 0) {
        if      (personality.type === 'STAR_CHASER')                          holdoutMult = 0.70
        else if (personality.type === 'CONSERVATIVE')                         holdoutMult = 0.80
        else if (personality.type === 'ROLE_HUNTER' && isPriority)            holdoutMult = 0.80
        // AGGRESSIVE, BUDGET_SNIPER, BALANCED ignore lookahead
      }
      // Last of this role in current category and bot still needs it
      const stillNeedsRole = (player.role === PlayerRole.BAT  && roster.batsmanCount < 3)
                          || (player.role === PlayerRole.BOWL && roster.bowlerCount  < 3)
                          || (personality.type === 'ROLE_HUNTER' && isPriority)
      if (roleInfo.count === 0 && stillNeedsRole) {
        lastOfRoleBoost = 1.25
      }
    }
  }

  const moodCeilingMult = mood === 'HOT' ? 1.10 : mood === 'COLD' ? 0.90 : 1.0
  const mistakeFactor   = 0.9 + Math.random() * 0.3

  let ceiling = qualityAdjustedValue
    * activeCeilingMult
    * humanBoost
    * categoryUrgencyMult
    * roleUrgencyMult
    * pacingMult
    * overspendPenalty
    * unsoldBoost
    * droughtCeilingMult
    * holdoutMult
    * lastOfRoleBoost
    * moodCeilingMult
    * mistakeFactor

  // mustFill guarantees a minimum viable ceiling
  if (mustFill) {
    ceiling = Math.max(ceiling, player.basePrice + personality.normalIncrement)
  }

  // Reserve buffer: keep enough for remaining slots
  const reserveBuffer = Math.max(slotsRemaining - 1, 0) * 200_000
  ceiling = Math.min(ceiling, remainingPurse - reserveBuffer)

  if (currentBid >= ceiling) {
    const delayMs = mustFill ? personality.minDelay : clampDelay(personality, confidence)
    return { action: 'PASS', delayMs, emitThinking: false }
  }

  // ── Step 8: Bid amount ────────────────────────────────────────────────────
  const isUrgent  = player.quality > 80 || categoryRemaining <= 1 || isMinCountOverride
  const increment = isUrgent ? personality.urgentIncrement : personality.normalIncrement
  const bidAmount = Math.max(currentBid + increment, player.basePrice)

  if (bidAmount > remainingPurse) return instantPass

  // ── Step 9–10: Delay + thinking indicator ─────────────────────────────────
  const delayMs = mustFill ? personality.minDelay : clampDelay(personality, confidence)
  const emitThinking = !mustFill && confidence < 0.4

  return { action: 'BID', amount: bidAmount, delayMs, emitThinking }
}

function clampDelay(personality: BotPersonality, confidence: number): number {
  const raw = personality.maxDelay - confidence * (personality.maxDelay - personality.minDelay)
  return Math.max(personality.minDelay, Math.min(personality.maxDelay, raw))
}
