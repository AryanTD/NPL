export type PersonalityType =
  | "AGGRESSIVE"
  | "CONSERVATIVE"
  | "ROLE_HUNTER"
  | "BUDGET_SNIPER"
  | "BALANCED"
  | "STAR_CHASER";

export interface BotPersonality {
  type: PersonalityType;
  fitThreshold: number; // base pickiness (0–1); higher = more selective
  ceilingMult: number; // scales max willingness to pay
  humanRivalMult: number; // ceiling boost when a human (not bot) is winning
  delayFast: [number, number]; // [lo, hi] ms — quick bid mode
  delaySlow: [number, number]; // [lo, hi] ms — calm/deliberate mode
  fastChance: number; // probability (0–1) of using fast mode
  normalIncrement: number;
  urgentIncrement: number;
}

export const PERSONALITIES: Record<PersonalityType, BotPersonality> = {
  AGGRESSIVE: {
    type: "AGGRESSIVE",
    fitThreshold: 0.25,
    ceilingMult: 1.18,
    humanRivalMult: 1.15,
    delayFast: [300, 900],
    delaySlow: [2500, 4000],
    fastChance: 0.85,
    normalIncrement: 50_000,
    urgentIncrement: 100_000,
  },
  CONSERVATIVE: {
    type: "CONSERVATIVE",
    fitThreshold: 0.6,
    ceilingMult: 1.32,
    humanRivalMult: 1.03,
    delayFast: [2000, 3500],
    delaySlow: [400, 1000],
    fastChance: 0.15,
    normalIncrement: 25_000,
    urgentIncrement: 50_000,
  },
  ROLE_HUNTER: {
    type: "ROLE_HUNTER",
    fitThreshold: 0.35,
    ceilingMult: 1.4,
    humanRivalMult: 1.1,
    delayFast: [1500, 2500],
    delaySlow: [400, 900],
    fastChance: 0.25,
    normalIncrement: 25_000,
    urgentIncrement: 100_000,
  },
  BUDGET_SNIPER: {
    type: "BUDGET_SNIPER",
    fitThreshold: 0.28,
    ceilingMult: 0.65,
    humanRivalMult: 1.05,
    delayFast: [2500, 4500],
    delaySlow: [500, 1000],
    fastChance: 0.1,
    normalIncrement: 25_000,
    urgentIncrement: 25_000,
  },
  BALANCED: {
    type: "BALANCED",
    fitThreshold: 0.45,
    ceilingMult: 1.1,
    humanRivalMult: 1.08,
    delayFast: [1200, 2500],
    delaySlow: [400, 800],
    fastChance: 0.3,
    normalIncrement: 25_000,
    urgentIncrement: 50_000,
  },
  STAR_CHASER: {
    type: "STAR_CHASER",
    fitThreshold: 0.65,
    ceilingMult: 1.6,
    humanRivalMult: 1.12,
    delayFast: [700, 1800],
    delaySlow: [2500, 3500],
    fastChance: 0.7,
    normalIncrement: 50_000,
    urgentIncrement: 100_000,
  },
};

// Budget allocation fractions out of 9,000,000 total purse
export const CATEGORY_BUDGET_SHARE: Record<string, number> = {
  MARQUEE: 0.3,
  A: 0.3,
  B: 0.25,
  C: 0.15,
};

// Total slots per category per team
export const CATEGORY_SLOTS: Record<string, number> = {
  MARQUEE: 1,
  A: 3,
  B: 4,
  C: 3,
};

// Minimum quality floor per category — used by STAR_CHASER relative normalization
export const CATEGORY_QUALITY_FLOOR: Record<string, number> = {
  A: 65,
  B: 55,
  C: 45,
};

export const QUALITY_MAX = 100;

export function assignPersonalities(
  botFranchiseIds: string[],
): Record<string, PersonalityType> {
  const types = Object.keys(PERSONALITIES) as PersonalityType[];
  const shuffled = [...types].sort(() => Math.random() - 0.5);
  const result: Record<string, PersonalityType> = {};
  botFranchiseIds.forEach((id, i) => {
    result[id] = shuffled[i % shuffled.length];
  });
  return result;
}
