import { Server } from 'socket.io'
import { PlayerRole, PlayerCategory } from '@prisma/client'
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@npl-auction/types'
import { decideBid, RosterState, QueueSummary } from './botDecision'
import { BotPersonality, CATEGORY_BUDGET_SHARE } from './botPersonalities'

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

export interface BotSession {
  seatId: string
  franchiseId: string
  franchiseName: string
  personality: BotPersonality
  priorityRoles: PlayerRole[]
  remainingPurse: number
  batsmanCount: number
  bowlerCount: number
  marqueeCount: number
  aCount: number
  bCount: number
  cCount: number
  categoryOverspend: Record<string, number>
  abortController: AbortController | null
  bidAttemptedThisRound: boolean
  isBluffingThisPlayer: boolean
  floorSkipPhases: Set<string>
}

export interface PlayerInfo {
  id: string
  basePrice: number
  quality: number
  role: PlayerRole
  category: PlayerCategory
  economy: number | null
  strikeRate: number | null
}

const TOTAL_PURSE = 9_000_000
const SPENDING_FLOOR = 6_500_000

function buildRoster(s: BotSession): RosterState {
  return {
    marqueeCount: s.marqueeCount,
    aCount: s.aCount, bCount: s.bCount, cCount: s.cCount,
    batsmanCount: s.batsmanCount, bowlerCount: s.bowlerCount,
    totalWon: s.marqueeCount + s.aCount + s.bCount + s.cCount,
    purseSpent: TOTAL_PURSE - s.remainingPurse,
    categoryOverspend: s.categoryOverspend,
  }
}

function scheduleBot(
  io: IoServer,
  lobbyId: string,
  session: BotSession,
  player: PlayerInfo,
  currentBid: number,
  currentWinnerId: string | null,
  isHumanWinner: boolean,
  isUnsoldRound: boolean,
  currentPhase: string,
  quota: { A: number; B: number; C: number },
  categoryPlayersRemaining: number,
  queueSummary: QueueSummary,
  starTargetIds: Set<string>,
  eliteTargetIds: Set<string>,
  onBid: (seatId: string, amount: number) => void,
): void {
  session.abortController?.abort()
  session.abortController = null

  const decision = decideBid({
    player,
    currentBid,
    currentWinnerId,
    isHumanWinner,
    myFranchiseId: session.franchiseId,
    personality: session.personality,
    priorityRoles: session.priorityRoles,
    roster: buildRoster(session),
    remainingPurse: session.remainingPurse,
    isUnsoldRound,
    quota,
    categoryPlayersRemaining,
    queueSummary,
    starTargetIds,
    eliteTargetIds,
    spendingFloor: SPENDING_FLOOR,
    isConservativeBluff: session.isBluffingThisPlayer,
    skipFloorInThisPhase: session.floorSkipPhases.has(currentPhase),
  })

  if (decision.action !== 'BID' || decision.amount == null) {
    if (decision.emitThinking && decision.delayMs > 0) {
      // Close-call PASS: show thinking indicator then go quiet
      const controller = new AbortController()
      session.abortController = controller
      io.to(lobbyId).emit('lobby:bot_thinking', {
        seatId: session.seatId,
        franchiseName: session.franchiseName,
      })
      const timer = setTimeout(() => {
        if (!controller.signal.aborted) session.abortController = null
      }, decision.delayMs)
      controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
    }
    return
  }

  const amount = decision.amount
  const controller = new AbortController()
  session.abortController = controller

  if (decision.emitThinking) {
    io.to(lobbyId).emit('lobby:bot_thinking', {
      seatId: session.seatId,
      franchiseName: session.franchiseName,
    })
  }

  const timer = setTimeout(() => {
    if (controller.signal.aborted) return
    session.abortController = null
    session.bidAttemptedThisRound = true
    onBid(session.seatId, amount)
  }, decision.delayMs)

  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
}

export function revealPlayerToBots(
  io: IoServer,
  lobbyId: string,
  player: PlayerInfo,
  humanSeatIds: Set<string>,
  sessions: Map<string, BotSession>,
  isUnsoldRound: boolean,
  currentPhase: string,
  quota: { A: number; B: number; C: number },
  categoryPlayersRemaining: number,
  categoryPlayersShown: number,
  queueSummary: QueueSummary,
  starTargetIds: Set<string>,
  eliteTargetIds: Set<string>,
  onBid: (seatId: string, amount: number) => void,
): void {
  for (const session of sessions.values()) {
    session.bidAttemptedThisRound = false
    session.isBluffingThisPlayer =
      session.personality.type === 'CONSERVATIVE' &&
      !isUnsoldRound &&
      categoryPlayersShown < 10 &&
      Math.random() < 0.30
    scheduleBot(io, lobbyId, session, player, 0, null, false, isUnsoldRound, currentPhase, quota, categoryPlayersRemaining, queueSummary, starTargetIds, eliteTargetIds, onBid)
  }
}

export function onBidPlaced(
  io: IoServer,
  lobbyId: string,
  player: PlayerInfo,
  currentBid: number,
  currentWinnerId: string,
  humanSeatIds: Set<string>,
  sessions: Map<string, BotSession>,
  isUnsoldRound: boolean,
  currentPhase: string,
  quota: { A: number; B: number; C: number },
  categoryPlayersRemaining: number,
  queueSummary: QueueSummary,
  starTargetIds: Set<string>,
  eliteTargetIds: Set<string>,
  onBid: (seatId: string, amount: number) => void,
): void {
  const isHumanWinner = humanSeatIds.has(currentWinnerId)
  for (const session of sessions.values()) {
    if (session.seatId === currentWinnerId) continue
    scheduleBot(io, lobbyId, session, player, currentBid, currentWinnerId, isHumanWinner, isUnsoldRound, currentPhase, quota, categoryPlayersRemaining, queueSummary, starTargetIds, eliteTargetIds, onBid)
  }
}

export function cancelAllBots(sessions: Map<string, BotSession>): void {
  for (const session of sessions.values()) {
    session.abortController?.abort()
    session.abortController = null
  }
}

export function updateRosterOnSold(
  sessions: Map<string, BotSession>,
  winningSeatId: string,
  player: { category: PlayerCategory; role: PlayerRole; finalPrice: number },
  quota: { A: number; B: number; C: number },
): void {
  const winner = sessions.get(winningSeatId)
  if (winner) {
    winner.remainingPurse -= player.finalPrice

    if      (player.category === PlayerCategory.A) winner.aCount++
    else if (player.category === PlayerCategory.B) winner.bCount++
    else if (player.category === PlayerCategory.C) winner.cCount++

    if      (player.role === PlayerRole.BAT)  winner.batsmanCount++
    else if (player.role === PlayerRole.BOWL) winner.bowlerCount++

    const categorySlots: Record<string, number> = { A: quota.A, B: quota.B, C: quota.C }
    const avgBudgetPerSlot = TOTAL_PURSE * CATEGORY_BUDGET_SHARE[player.category] / categorySlots[player.category]
    winner.categoryOverspend[player.category] = (winner.categoryOverspend[player.category] ?? 0) + (player.finalPrice - avgBudgetPerSlot)
  }

}
