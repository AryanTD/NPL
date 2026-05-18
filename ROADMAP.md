# NPL Auction Game — Build Roadmap

Pick up from here at the start of any session. Work tasks in order — each builds on the last.

---

## ✅ Done

| What | Files |
|---|---|
| npm workspaces root | `package.json`, `package-lock.json`, `.gitignore` |
| Shared TypeScript types | `packages/types/index.ts` |
| Server bootstrap | `apps/server/src/index.ts` |
| Prisma schema (8 models) | `apps/server/prisma/schema.prisma` |
| DB migration applied | `apps/server/prisma/migrations/20260426165922_init/` |
| DB seeded | 8 franchises + 168 players on Railway |
| DB seed script | `apps/server/prisma/seed.ts` |
| Player data (2024 + 2025) | `data/players/npl-2024.json`, `data/players/npl-2025.json` |
| Server config | `apps/server/tsconfig.json`, `nodemon.json`, `.env.example`, `package.json` |
| Prisma singleton | `apps/server/src/lib/prisma.ts` |
| Lobby REST API | `apps/server/src/routes/lobby.ts` |
| Bot personalities | `apps/server/src/bots/botPersonalities.ts` |
| Bot mock (deleted — replaced by botDecision.ts) | ~~`apps/server/src/bots/claudeBot.ts`~~ |
| Bot manager | `apps/server/src/bots/botManager.ts` |

---

## ✅ Task 4 — Auction Engine

**File:** `apps/server/src/socket/auctionEngine.ts`

### 4a. State machine + socket wiring

```ts
const auctionStates = new Map<string, AuctionState>();

export function registerAuctionHandlers(io: Server, socket: Socket): void {
  socket.on('lobby:place_bid', ...)
  socket.on('lobby:pass', ...)
  socket.on('disconnect', ...)
}
```

Wire into `src/index.ts`:

```ts
io.on("connection", (socket) => registerAuctionHandlers(io, socket));
```

State transitions: `WAITING → MARQUEE_DRAW → CATEGORY_A → CATEGORY_B → CATEGORY_C → UNSOLD_ROUND → COMPLETE`

### 4b. Marquee draw

- Shuffle 8 marquee players (Fisher-Yates)
- Assign one per seat
- For each: create `SquadSlot` (slotType: MARQUEE, pricePaid: 0)
- Emit `lobby:marquee_assigned` per assignment with 500ms delay between each

### 4c. Player reveal + timer

- Pull next `AuctionQueue` row where `isDone = false` and `phase = current`
- Emit `lobby:player_revealed`
- Start `setInterval` (1s), emit `lobby:timer_tick` each tick
- On timer reaching 0: call `resolveCurrentPlayer()`

### 4d. Bid handling (`lobby:place_bid`)

Validation (reject with `lobby:error` if any fail):

1. Lobby exists and is in AUCTION phase
2. Socket's seatId matches a HUMAN seat in this lobby
3. `amount >= currentBid + 25_000`
4. `amount <= MAX_PRICE[category]`
5. `seat.purseRemaining >= amount`
6. Afford check: `seat.purseRemaining - amount >= remainingRequiredSlots(seat) * basePrice`
7. Category quota not already filled

If valid: update `state.currentBid`, reset timer, emit `lobby:bid_placed` to room.

### 4e. Sold / unsold resolution

On timer expiry:

- **No bid**: mark `AuctionQueue.isUnsold = true`, emit `lobby:player_unsold`, advance to next player
- **Bid exists**:
  - Check if amount === MAX_PRICE → check for lucky draw (2+ contenders)
  - Else: sell directly
  - On sell: deduct purse, increment category count, create `SquadSlot` + `AuctionResult` + `Bid` rows
  - Emit `lobby:player_sold`

### 4f. Lucky draw

- Collect all seats that bid MAX_PRICE on this player
- If > 1: emit `lobby:lucky_draw { playerId, contenderSeatIds }`
- Wait 3s (animation), pick random winner, sell to winner

### 4g. Unsold round

After Cat C completes:

- Re-queue all `isUnsold` players for teams with unfilled quotas
- Only eligible teams can bid (those with open slots in that category)

### 4h. Auction complete

When all teams have filled 3A + 4B + 3C:

- Update `Lobby.status = COMPLETE`
- Emit `lobby:auction_complete { seats }` to room
- Clear in-memory state and cancel all bot `AbortController`s

**Bot integration note:** After each `lobby:player_revealed`, trigger all bot seats via `triggerBotDecision()`. Create one `AbortController` per player reveal — call `controller.abort()` in `resolveCurrentPlayer()` before advancing.

---

## ✅ Task 5 — Frontend Setup

```bash
cd apps
npx create-next-app@14 web --typescript --tailwind --app --no-src-dir --no-eslint
cd web
npm install socket.io-client @clerk/nextjs framer-motion
```

Add to `apps/web/package.json` dependencies:

```json
"@npl-auction/types": "*"
```

**Create:**

- `app/layout.tsx` — `<ClerkProvider>` wrapping `{children}`
- `lib/socket.ts` — singleton `io(SERVER_URL)` export
- `.env.local` from `.env.example`

---

## ✅ Task 5b — Auction Engine Optimizations

All 9 optimizations applied to `apps/server/src/socket/auctionEngine.ts`:

- `setImmediate` breaks `sellPlayer → revealNextPlayer` recursive chain
- `state` captured in `setInterval` closure (no per-tick Map lookup)
- `maxPriceBidders: Set<string>` replaces DB query in `resolveCurrentPlayer`
- Unsold `updateMany` merged into one call (isDone + isUnsold)
- `seatsMap: Map<string, LobbySeat>` for O(1) seat lookup in `handleBid` / `sellPlayer`
- `PHASE_ORDER` hoisted to module-level constant
- Marquee draw uses `squadSlot.createMany` (8 → 1 DB call)
- `parsePayload<T>` helper deduplicates 4 inline JSON.parse ternaries
- `preloadedSeats` passed from `lobby:start` into `startAuction` (avoids duplicate DB fetch)

---

## ✅ Task 6 — Landing Page

**File:** `apps/web/app/page.tsx`

- `apps/web/app/globals.css` — 13 CSS design tokens, Plus Jakarta Sans + Rajdhani fonts, 5 keyframes + animation utilities, grid texture class
- `apps/web/app/layout.tsx` — Google Fonts `<link>` tags added
- Landing page: full-viewport, grid texture background, Nepal flag bar logo lockup
- Clerk gate: `<SignInButton>` when signed out; 3-state card when signed in
- **Default state**: name input → CREATE ROOM / JOIN WITH CODE / Quick Play
- **Create state**: 2-col franchise picker (8 cards with primary color hover) → `POST /lobby/create` → `/lobby?lobbyId=...&seatId=...`
- **Join state**: 6-char Rajdhani code input → `POST /lobby/join/:code` → same redirect

---

## ✅ Task 7 — Lobby Waiting Room

**File:** `apps/web/app/lobby/page.tsx`

- Socket lifecycle: connect → `lobby:join` → `lobby:state` → render; `lobby:marquee_assigned` → navigate to auction room; cleanup on unmount
- 56px top bar: NPL logo, AUCTION LOBBY label, pulsing green dot, room code badge
- 4-column seat grid: user card highlighted with franchise primary color; 3px color bar, 36px crest, franchise name/city, seat row with status dot + name ("Manager" for bots — never exposes AI nature), YOU badge, purse/Ready footer
- 3-card info strip: Purse Per Team / Auction Pool / Squad Size
- 280px sidebar: numbered auction format list (5 items with sub-labels) + START AUCTION button → 3s gold countdown card → `lobby:start` emit
- Franchise colors resolved from local `FRANCHISE_META` map (not in `LobbySeat` socket type)
- Suspense boundary wraps `useSearchParams()`

---

## ✅ Task 8 — Auction Room

**File:** `apps/web/app/auction/[lobbyId]/page.tsx`

Layout: `52px TopBar → flex row (210px QueuePanel + flex:1 CenterPanel + 240px SquadPanel) → 58px BottomTeamsBar`

- **MarqueeDrawScreen** (in `lobby/page.tsx`): intercepts all 8 `lobby:marquee_assigned` events before navigating; 4-col grid with flip-reveal animations, auto-navigates 3.5s after all 8 revealed
- **CenterPanel**: animated PlayerCard (solid color header strip, stat grid, `animate-pop-in` keyed on reveal counter); linear progress timer (green→amber→red, pulses ≤5s); `+रू25K / +रू50K / +रू1L` increment buttons; main BID button with client-side validation mirroring server
- **QueuePanel**: upcoming players list with category badges
- **SquadPanel**: my squad only — purse bar, segmented A/B/C quota slots, squad list, live bid feed
- **BottomTeamsBar**: 8 franchise chips, leading team gets pulsing dot
- **LuckyDrawOverlay**: full-screen blur modal, chips spin then stop at winner
- **Bug fixes applied**: franchise selection (page.tsx + lobby.ts), Quick Play `MouseEvent` crash, `AuctionResult` global unique constraint → `@@unique([lobbyId, playerId])` (migration `20260429000000_fix_auction_result_unique_per_lobby`)

---

## Build Order Summary

```
Task 4 (Engine)  ──►  Task 8 (Auction UI)
                            ▲
Task 5 (FE setup)  ──►  Task 6 (Landing)  ──►  Task 7 (Lobby)  ──►┘
```

---

## 🔄 Task 9 — Algorithmic Bot Decision System

**Branch:** `feat/algorithmic-bots` (worktree at `.worktrees/algorithmic-bots`)
**Plan file:** `.claude/plans/scalable-jingling-key.md`

**Goal:** Replace mock heuristic bot (`claudeBot.ts`) with a fully algorithmic, personality-driven system that re-evaluates every bid in real time. No AI/LLM calls — pure deterministic logic with controlled randomness.

**Architecture:**
- `botPersonalities.ts` — static config (new BotPersonality interface, PERSONALITIES, CATEGORY_BUDGET_SHARE, CATEGORY_SLOTS)
- `botDecision.ts` — pure `decideBid()` function, zero side effects, fully unit-testable
- `botManager.ts` — per-bot AbortController timers, roster tracking, re-evaluates on every bid placed
- `auctionEngine.ts` — wires the above into auction lifecycle (reveal / bid / sold / unsold)

**Spec discrepancies resolved:**
- `baseValue` → `basePrice` (matches Prisma schema)
- String roles `'Batsman'` → Prisma enum `PlayerRole.BAT`
- Files stay in `src/bots/` (not `src/socket/` as the spec says)
- `isHumanWinner` added to `BotDecisionInput` (was a footnote in spec)

### Subtasks

| # | What | Status | Commit |
|---|------|--------|--------|
| 9.0 | Add `quality Int @default(50)` to Player schema, run migration, regenerate client | ✅ Done | `c00da52` |
| 9.1 | Add Vitest test infrastructure to `apps/server` | ✅ Done | `9c6b02d` |
| 9.2 | Replace `botPersonalities.ts` with new algorithmic config | ✅ Done | `f637693` |
| 9.3 | Create `botDecision.ts` (TDD — pure decision function) | ✅ Done | `c8e1432` |
| 9.4 | Rewrite `botManager.ts` with per-bid re-evaluation and roster tracking | ✅ Done | `0058683` |
| 9.5 | Update `auctionEngine.ts` to wire new bot system | ✅ Done | `0a0300d` |
| 9.6 | Delete `claudeBot.ts`, update this ROADMAP | ✅ Done | — |

### Resuming next session

```bash
# The worktree is already set up — just cd into it
cd /Users/aryantandon/NPL/.worktrees/algorithmic-bots

# Verify state
git log --oneline -5
cd apps/server && npm run typecheck
```

Then open `.claude/plans/scalable-jingling-key.md` for the full step-by-step implementation plan (all code included).

### Key design: per-bid bot re-evaluation

Old flow: each bot fires once at player reveal (fire-and-forget).

New flow:
- **On player revealed** → `revealPlayerToBots()` — each bot schedules a delayed bid via AbortController
- **On bid placed** → `onBidPlaced()` — all non-winning bots cancel their timer, re-run `decideBid()`, reschedule if still bidding
- **On sold/unsold** → `cancelAllBots()` — all timers cancelled; winner's roster updated via `updateRosterOnSold()`

### decideBid ceiling formula

```
ceiling = basePrice × (0.7 + quality/100 × 0.6)   // quality-adjusted value
        × aggressionMult                             // personality (0.75–1.35)
        × humanRivalMult (if human is winning)       // (1.03–1.15)
        × categoryUrgency × roleUrgency              // roster need (1.0–1.5)
        × pacingMult                                 // budget pacing (0.80–1.0)
        × overspendPenalty                           // past overspend (0.75–1.0)
        × unsoldBoost (1.15 if unsold round)
        × mistakeFactor (random 0.9–1.2)
```

Hard caps: `reserveBuffer = (remainingSlots - 1) × 200k`, `ceiling = min(ceiling, purse - buffer)`
