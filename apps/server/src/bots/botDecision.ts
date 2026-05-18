import { PlayerRole, PlayerCategory } from '@prisma/client'
import { BotPersonality, CATEGORY_BUDGET_SHARE, CATEGORY_SLOTS } from './botPersonalities'

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
}

export interface BotDecisionOutput {
  action: 'BID' | 'PASS'
  amount?: number
  delayMs: number
}

const TOTAL_PURSE = 9_000_000
const TOTAL_SLOTS = 11

export function decideBid(input: BotDecisionInput): BotDecisionOutput {
  const { player, currentBid, currentWinnerId, myFranchiseId, personality, priorityRoles, roster, remainingPurse, isUnsoldRound } = input
  const delayMs = personality.minDelay + Math.random() * (personality.maxDelay - personality.minDelay)
  const pass: BotDecisionOutput = { action: 'PASS', delayMs }

  // Hard blocks
  if (currentWinnerId === myFranchiseId) return pass
  if (remainingPurse < currentBid + 25_000) return pass
  if (roster.totalWon >= TOTAL_SLOTS) return pass

  const categoryCount: Record<string, number> = {
    MARQUEE: roster.marqueeCount, A: roster.aCount, B: roster.bCount, C: roster.cCount,
  }
  if ((categoryCount[player.category] ?? 0) >= CATEGORY_SLOTS[player.category]) return pass

  if (player.role === PlayerRole.BAT  && roster.batsmanCount >= 6) return pass
  if (player.role === PlayerRole.BOWL && roster.bowlerCount  >= 4) return pass

  let effectiveMinQuality = personality.minQuality
  if (personality.type === 'ROLE_HUNTER') {
    effectiveMinQuality = priorityRoles.includes(player.role) ? 50 : 70
  }
  if (player.quality < effectiveMinQuality) return pass

  // Compute ceiling
  const qualityAdjustedValue = player.basePrice * (0.7 + (player.quality / 100) * 0.6)

  let aggressionMult = personality.aggressionMult
  if (personality.type === 'ROLE_HUNTER') {
    aggressionMult = priorityRoles.includes(player.role) ? 1.50 : 0.60
  }

  const humanBoost = input.isHumanWinner ? personality.humanRivalMult : 1.0

  const categoryRemaining = CATEGORY_SLOTS[player.category] - (categoryCount[player.category] ?? 0)
  const categoryUrgency = categoryRemaining <= 1 ? 1.25 : categoryRemaining <= 2 ? 1.10 : 1.0

  let roleUrgency = 1.0
  if (player.role === PlayerRole.BAT  && roster.batsmanCount < 3) roleUrgency = 1.20
  if (player.role === PlayerRole.BOWL && roster.bowlerCount  < 3) roleUrgency = 1.20

  const categoryAllocation = TOTAL_PURSE * CATEGORY_BUDGET_SHARE[player.category]
  const avgBudgetPerSlot   = categoryAllocation / CATEGORY_SLOTS[player.category]
  const spendingRatio = currentBid / avgBudgetPerSlot
  const pacingMult = spendingRatio > 1.5 ? 0.80 : spendingRatio > 1.2 ? 0.90 : 1.0

  const overspend = roster.categoryOverspend[player.category] ?? 0
  const overspendPenalty = overspend > categoryAllocation * 0.5  ? 0.75
                         : overspend > categoryAllocation * 0.25 ? 0.88
                         : 1.0

  const remainingSlots  = TOTAL_SLOTS - roster.totalWon
  const desperation     = remainingSlots > 0 ? remainingPurse / remainingSlots : remainingPurse
  const isDesperateLate = remainingPurse < TOTAL_PURSE * 0.15 && remainingSlots <= 3

  const unsoldBoost   = isUnsoldRound ? 1.15 : 1.0
  const mistakeFactor = 0.9 + Math.random() * 0.3

  let ceiling = qualityAdjustedValue
    * aggressionMult
    * humanBoost
    * categoryUrgency * roleUrgency
    * pacingMult
    * overspendPenalty
    * unsoldBoost
    * mistakeFactor

  if (isDesperateLate) ceiling = Math.min(ceiling, desperation)

  const reserveBuffer = Math.max(remainingSlots - 1, 0) * 200_000
  ceiling = Math.min(ceiling, remainingPurse - reserveBuffer)

  if (currentBid >= ceiling) return pass

  const isUrgent  = player.quality > 80 || categoryRemaining <= 1
  const increment = isUrgent ? personality.urgentIncrement : personality.normalIncrement
  const bidAmount = Math.max(currentBid + increment, player.basePrice)

  if (bidAmount > remainingPurse) return pass

  return { action: 'BID', amount: bidAmount, delayMs }
}
