import { BotPersonality, PlayerCategory, PlayerRole } from '@prisma/client';

export interface PersonalityConfig {
  // How far above base price the bot is willing to go (multiplier on base price)
  // e.g. 1.4 means willing to bid up to 1.4× base price before backing off
  aggressionMultiplier: number;

  // Fraction of MAX price the bot is willing to reach (0.0–1.0)
  // e.g. 0.9 means will bid up to 90% of the category max price
  maxPriceWillingness: number;

  // Probability (0.0–1.0) of opening a bid when no one else has bid yet
  openingBidChance: number;

  // How much the bot weights each role when deciding to compete hard
  roleWeights: Record<PlayerRole, number>;

  // Per-category willingness multiplier (relative — higher = more eager)
  categoryEagerness: Record<PlayerCategory, number>;

  // Plain-English description — will be used in the future Claude system prompt
  description: string;
}

export const PERSONALITIES: Record<BotPersonality, PersonalityConfig> = {
  AGGRESSIVE: {
    aggressionMultiplier: 1.6,
    maxPriceWillingness:  0.95,
    openingBidChance:     0.85,
    roleWeights:    { BAT: 1.2, BOWL: 1.2, AR: 1.3, WK: 1.0 },
    categoryEagerness: { A: 1.4, B: 1.1, C: 0.8 },
    description:
      'You are an aggressive franchise manager who bids hard on star players. ' +
      'You are willing to approach the maximum price and accept budget risk. ' +
      'You prioritise winning the best players over saving money.',
  },

  CONSERVATIVE: {
    aggressionMultiplier: 1.15,
    maxPriceWillingness:  0.65,
    openingBidChance:     0.45,
    roleWeights:    { BAT: 1.0, BOWL: 1.0, AR: 1.0, WK: 1.0 },
    categoryEagerness: { A: 0.8, B: 1.0, C: 1.1 },
    description:
      'You are a conservative franchise manager who rarely exceeds base price by much. ' +
      'You protect your budget for later rounds and avoid bidding wars. ' +
      'You are happy to let marquee players go if the price gets too high.',
  },

  ROLE_HUNTER: {
    aggressionMultiplier: 1.5,
    maxPriceWillingness:  0.85,
    openingBidChance:     0.55,
    roleWeights:    { BAT: 0.7, BOWL: 0.7, AR: 1.8, WK: 1.6 },
    categoryEagerness: { A: 1.0, B: 1.2, C: 1.2 },
    description:
      'You are a role-focused franchise manager who only competes hard for specific ' +
      'roles your squad is missing. You go all-in for all-rounders and wicketkeepers ' +
      'but largely ignore pure batsmen and bowlers unless the price is a bargain.',
  },

  BUDGET_SNIPER: {
    aggressionMultiplier: 1.1,
    maxPriceWillingness:  0.75,
    openingBidChance:     0.25,
    roleWeights:    { BAT: 1.0, BOWL: 1.0, AR: 1.1, WK: 1.0 },
    categoryEagerness: { A: 0.4, B: 1.3, C: 1.5 },
    description:
      'You are a patient budget sniper. You deliberately pass on Category A players ' +
      'to save budget, then swoop aggressively in Categories B and C when other teams ' +
      'have spent out. You look for undervalued players that slip through.',
  },

  BALANCED: {
    aggressionMultiplier: 1.3,
    maxPriceWillingness:  0.78,
    openingBidChance:     0.60,
    roleWeights:    { BAT: 1.0, BOWL: 1.0, AR: 1.1, WK: 1.0 },
    categoryEagerness: { A: 1.0, B: 1.0, C: 1.0 },
    description:
      'You are a sensible, well-rounded franchise manager. You bid on good players ' +
      'across all categories without extreme behaviour. You balance budget preservation ' +
      'with squad quality and avoid unnecessary bidding wars.',
  },
};
