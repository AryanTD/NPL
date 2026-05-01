import { describe, it, expect } from 'vitest'
import { PlayerRole, PlayerCategory } from '@prisma/client'
import { decideBid, BotDecisionInput, RosterState } from '../../src/bots/botDecision'
import { PERSONALITIES } from '../../src/bots/botPersonalities'

function emptyRoster(): RosterState {
  return {
    marqueeCount: 1,
    aCount: 0, bCount: 0, cCount: 0,
    batsmanCount: 0, bowlerCount: 0,
    totalWon: 1,
    purseSpent: 0,
    categoryOverspend: {},
  }
}

function base(overrides: Partial<BotDecisionInput> = {}): BotDecisionInput {
  return {
    player: { id: 'p-1', basePrice: 500_000, quality: 75, role: PlayerRole.BAT, category: PlayerCategory.A },
    currentBid: 0,
    currentWinnerId: null,
    isHumanWinner: false,
    myFranchiseId: 'f-1',
    personality: PERSONALITIES.BALANCED,
    priorityRoles: [],
    roster: emptyRoster(),
    remainingPurse: 7_000_000,
    isUnsoldRound: false,
    ...overrides,
  }
}

describe('decideBid — hard blocks', () => {
  it('PASSes when already winning', () => {
    expect(decideBid(base({ currentWinnerId: 'f-1' })).action).toBe('PASS')
  })

  it('PASSes when purse < currentBid + 25k', () => {
    expect(decideBid(base({ currentBid: 500_000, remainingPurse: 524_999 })).action).toBe('PASS')
  })

  it('PASSes when all 11 slots filled', () => {
    const roster: RosterState = { ...emptyRoster(), aCount: 3, bCount: 4, cCount: 3, totalWon: 11 }
    expect(decideBid(base({ roster })).action).toBe('PASS')
  })

  it('PASSes when category A quota full', () => {
    const roster: RosterState = { ...emptyRoster(), aCount: 3, totalWon: 4 }
    expect(decideBid(base({ roster })).action).toBe('PASS')
  })

  it('PASSes when batsman hard cap (6) reached', () => {
    const roster: RosterState = { ...emptyRoster(), batsmanCount: 6 }
    expect(decideBid(base({ roster })).action).toBe('PASS')
  })

  it('PASSes when bowler hard cap (4) reached', () => {
    const roster: RosterState = { ...emptyRoster(), bowlerCount: 4 }
    expect(decideBid(base({
      roster,
      player: { id: 'p', basePrice: 500_000, quality: 75, role: PlayerRole.BOWL, category: PlayerCategory.A },
    })).action).toBe('PASS')
  })

  it('PASSes when quality below personality minQuality', () => {
    // CONSERVATIVE minQuality = 60
    expect(decideBid(base({
      personality: PERSONALITIES.CONSERVATIVE,
      player: { id: 'p', basePrice: 500_000, quality: 55, role: PlayerRole.AR, category: PlayerCategory.A },
    })).action).toBe('PASS')
  })

  it('PASSes when currentBid is above any reasonable ceiling', () => {
    expect(decideBid(base({ currentBid: 3_000_000 })).action).toBe('PASS')
  })
})

describe('decideBid — BID path', () => {
  it('BIDs at basePrice when currentBid is 0 (opening)', () => {
    const r = decideBid(base({ currentBid: 0 }))
    expect(r.action).toBe('BID')
    expect(r.amount).toBe(500_000) // max(0 + 25k, 500k) = 500k
  })

  it('BIDs at currentBid + normalIncrement for normal player', () => {
    const r = decideBid(base({ currentBid: 500_000 }))
    expect(r.action).toBe('BID')
    expect(r.amount).toBe(525_000) // BALANCED normalIncrement = 25k
  })

  it('uses urgentIncrement when quality > 80', () => {
    const r = decideBid(base({
      currentBid: 500_000,
      player: { id: 'p', basePrice: 500_000, quality: 85, role: PlayerRole.AR, category: PlayerCategory.A },
    }))
    expect(r.action).toBe('BID')
    expect(r.amount).toBe(550_000) // BALANCED urgentIncrement = 50k
  })

  it('uses urgentIncrement when only 1 category slot remains', () => {
    const roster: RosterState = { ...emptyRoster(), aCount: 2, totalWon: 3 }
    const r = decideBid(base({ currentBid: 500_000, roster }))
    expect(r.action).toBe('BID')
    expect(r.amount).toBe(550_000)
  })

  it('delayMs is within personality range across many calls', () => {
    for (let i = 0; i < 30; i++) {
      const r = decideBid(base())
      expect(r.delayMs).toBeGreaterThanOrEqual(PERSONALITIES.BALANCED.minDelay)
      expect(r.delayMs).toBeLessThanOrEqual(PERSONALITIES.BALANCED.maxDelay)
    }
  })
})

describe('decideBid — ROLE_HUNTER', () => {
  it('PASSes on off-role player with quality 65 (below 70 threshold)', () => {
    expect(decideBid(base({
      personality: PERSONALITIES.ROLE_HUNTER,
      priorityRoles: [PlayerRole.WK],
      player: { id: 'p', basePrice: 500_000, quality: 65, role: PlayerRole.BOWL, category: PlayerCategory.A },
    })).action).toBe('PASS')
  })

  it('BIDs on priority-role player at quality 55 (above 50 threshold)', () => {
    expect(decideBid(base({
      personality: PERSONALITIES.ROLE_HUNTER,
      priorityRoles: [PlayerRole.WK],
      player: { id: 'p', basePrice: 200_000, quality: 55, role: PlayerRole.WK, category: PlayerCategory.B },
    })).action).toBe('BID')
  })
})

describe('decideBid — budget safety', () => {
  it('PASSes when reserveBuffer leaves no room for the bid', () => {
    // 10 slots remaining, reserveBuffer = 9 * 200k = 1.8M, maxAffordable = 540k - 1.8M < 0
    expect(decideBid(base({ currentBid: 500_000, remainingPurse: 540_000 })).action).toBe('PASS')
  })
})
