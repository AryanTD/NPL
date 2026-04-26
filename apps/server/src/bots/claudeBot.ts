/**
 * claudeBot.ts — MOCK IMPLEMENTATION
 *
 * This is a placeholder that uses simple heuristics instead of the Claude API.
 * Replace the body of `decide()` with a real Anthropic API call when ready.
 *
 * The interface this file exports must not change — botManager.ts depends on it.
 */

import { BotPersonality, PlayerCategory } from '@prisma/client';
import { PersonalityConfig, PERSONALITIES } from './botPersonalities';

export interface BotDecision {
  action: 'BID' | 'PASS';
  amount?: number; // only set when action === 'BID', in NPR
}

export interface BotContext {
  personality:    BotPersonality;
  currentBid:     number | null;  // null = no bids placed yet
  basePrice:      number;
  maxPrice:       number;
  category:       PlayerCategory;
  purseRemaining: number;
  /** Minimum purse that must remain after this bid to still fill open slots */
  minPurseBuffer: number;
}

const BID_INCREMENT = 25_000;

/**
 * Decide whether to BID or PASS on the current player.
 *
 * MOCK logic — personality-weighted probability + simple budget guards.
 * Replace with Claude API call in the real implementation.
 */
export function decide(ctx: BotContext): BotDecision {
  const config: PersonalityConfig = PERSONALITIES[ctx.personality];

  // Hard stop: can't afford to bid without breaking the purse buffer
  const nextBid = (ctx.currentBid ?? ctx.basePrice - BID_INCREMENT) + BID_INCREMENT;
  if (nextBid > ctx.purseRemaining - ctx.minPurseBuffer) {
    return { action: 'PASS' };
  }

  // Hard stop: don't exceed what this personality is willing to pay
  const willingMax = Math.floor(ctx.maxPrice * config.maxPriceWillingness);
  if (nextBid > willingMax) {
    return { action: 'PASS' };
  }

  // If no bid yet, use openingBidChance to decide whether to open
  if (ctx.currentBid === null) {
    if (Math.random() > config.openingBidChance) {
      return { action: 'PASS' };
    }
    return { action: 'BID', amount: ctx.basePrice };
  }

  // Compute the ceiling this bot is willing to reach
  const aggressionCeiling = Math.floor(ctx.basePrice * config.aggressionMultiplier);
  const categoryMultiplier = config.categoryEagerness[ctx.category];
  const effectiveCeiling = Math.min(
    Math.floor(aggressionCeiling * categoryMultiplier),
    willingMax,
  );

  if (nextBid > effectiveCeiling) {
    return { action: 'PASS' };
  }

  // Add some randomness so bots don't always bid to their ceiling
  // (probability of continuing decreases as price climbs toward ceiling)
  const progress = (nextBid - ctx.basePrice) / Math.max(effectiveCeiling - ctx.basePrice, 1);
  const bidProbability = 1 - progress * 0.6; // starts near 1.0, falls as price rises

  if (Math.random() > bidProbability) {
    return { action: 'PASS' };
  }

  return { action: 'BID', amount: nextBid };
}
