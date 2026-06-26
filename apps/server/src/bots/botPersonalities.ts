export type PersonalityType =
  | 'AGGRESSIVE'
  | 'CONSERVATIVE'
  | 'ROLE_HUNTER'
  | 'BUDGET_SNIPER'
  | 'BALANCED'
  | 'STAR_CHASER'

export interface BotPersonality {
  type: PersonalityType
  fitThreshold: number      // base pickiness (0–1); higher = more selective
  ceilingMult: number       // scales max willingness to pay
  humanRivalMult: number    // ceiling boost when a human (not bot) is winning
  moodSensitivity: number   // HOT/COLD delta applied to threshold
  minDelay: number
  maxDelay: number
  normalIncrement: number
  urgentIncrement: number
}

export const PERSONALITIES: Record<PersonalityType, BotPersonality> = {
  AGGRESSIVE:    { type: 'AGGRESSIVE',    fitThreshold: 0.25, ceilingMult: 1.35, humanRivalMult: 1.15, moodSensitivity: 0.08, minDelay:  500, maxDelay: 1200, normalIncrement:  50_000, urgentIncrement: 100_000 },
  CONSERVATIVE:  { type: 'CONSERVATIVE',  fitThreshold: 0.60, ceilingMult: 0.80, humanRivalMult: 1.03, moodSensitivity: 0.05, minDelay: 2500, maxDelay: 4000, normalIncrement:  25_000, urgentIncrement:  50_000 },
  ROLE_HUNTER:   { type: 'ROLE_HUNTER',   fitThreshold: 0.35, ceilingMult: 1.20, humanRivalMult: 1.10, moodSensitivity: 0.10, minDelay: 1500, maxDelay: 2500, normalIncrement:  25_000, urgentIncrement: 100_000 },
  BUDGET_SNIPER: { type: 'BUDGET_SNIPER', fitThreshold: 0.28, ceilingMult: 0.55, humanRivalMult: 1.05, moodSensitivity: 0.06, minDelay: 2000, maxDelay: 3500, normalIncrement:  25_000, urgentIncrement:  25_000 },
  BALANCED:      { type: 'BALANCED',      fitThreshold: 0.45, ceilingMult: 1.00, humanRivalMult: 1.08, moodSensitivity: 0.05, minDelay: 1500, maxDelay: 2500, normalIncrement:  25_000, urgentIncrement:  50_000 },
  STAR_CHASER:   { type: 'STAR_CHASER',   fitThreshold: 0.65, ceilingMult: 1.50, humanRivalMult: 1.12, moodSensitivity: 0.09, minDelay:  800, maxDelay: 2000, normalIncrement:  50_000, urgentIncrement: 100_000 },
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

// Minimum quality floor per category — used by STAR_CHASER relative normalization
export const CATEGORY_QUALITY_FLOOR: Record<string, number> = {
  A: 65,
  B: 55,
  C: 45,
}

export const QUALITY_MAX = 89

export function assignPersonalities(botFranchiseIds: string[]): Record<string, PersonalityType> {
  const types = Object.keys(PERSONALITIES) as PersonalityType[]
  const shuffled = [...types].sort(() => Math.random() - 0.5)
  const result: Record<string, PersonalityType> = {}
  botFranchiseIds.forEach((id, i) => { result[id] = shuffled[i % shuffled.length] })
  return result
}
