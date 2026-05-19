import { PlayerRole } from '@prisma/client'

export type PersonalityType = 'AGGRESSIVE' | 'CONSERVATIVE' | 'ROLE_HUNTER' | 'BUDGET_SNIPER' | 'BALANCED'

export interface BotPersonality {
  type: PersonalityType
  aggressionMult: number
  humanRivalMult: number
  minQuality: number
  minDelay: number
  maxDelay: number
  normalIncrement: number
  urgentIncrement: number
}

export const PERSONALITIES: Record<PersonalityType, BotPersonality> = {
  AGGRESSIVE:    { type: 'AGGRESSIVE',    aggressionMult: 1.35, humanRivalMult: 1.15, minQuality: 25, minDelay:  500, maxDelay: 1200, normalIncrement:  50_000, urgentIncrement: 100_000 },
  CONSERVATIVE:  { type: 'CONSERVATIVE',  aggressionMult: 0.80, humanRivalMult: 1.03, minQuality: 45, minDelay: 2500, maxDelay: 4000, normalIncrement:  25_000, urgentIncrement:  50_000 },
  ROLE_HUNTER:   { type: 'ROLE_HUNTER',   aggressionMult: 1.20, humanRivalMult: 1.10, minQuality: 30, minDelay: 1500, maxDelay: 2500, normalIncrement:  25_000, urgentIncrement: 100_000 },
  BUDGET_SNIPER: { type: 'BUDGET_SNIPER', aggressionMult: 0.75, humanRivalMult: 1.05, minQuality: 58, minDelay: 2000, maxDelay: 3500, normalIncrement:  25_000, urgentIncrement:  25_000 },
  BALANCED:      { type: 'BALANCED',      aggressionMult: 1.00, humanRivalMult: 1.08, minQuality: 35, minDelay: 1500, maxDelay: 2500, normalIncrement:  25_000, urgentIncrement:  50_000 },
}

// Budget allocation fractions out of 9,000,000 total purse
export const CATEGORY_BUDGET_SHARE: Record<string, number> = {
  MARQUEE: 0.30,
  A:       0.30,
  B:       0.25,
  C:       0.15,
}

// Total slots per category per team
export const CATEGORY_SLOTS: Record<string, number> = {
  MARQUEE: 1,
  A:       3,
  B:       4,
  C:       3,
}

export function assignPersonalities(botFranchiseIds: string[]): Record<string, PersonalityType> {
  const types = Object.keys(PERSONALITIES) as PersonalityType[]
  const shuffled = [...types].sort(() => Math.random() - 0.5)
  const result: Record<string, PersonalityType> = {}
  botFranchiseIds.forEach((id, i) => { result[id] = shuffled[i % shuffled.length] })
  return result
}
