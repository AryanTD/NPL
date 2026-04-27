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
| Bot mock + interface | `apps/server/src/bots/claudeBot.ts` |
| Bot manager | `apps/server/src/bots/botManager.ts` |

---

## 🔲 Task 4 — Auction Engine  *(large — split into two sessions)*

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
io.on('connection', socket => registerAuctionHandlers(io, socket));
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

## 🔲 Task 5 — Frontend Setup  *(small)*

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

## 🔲 Task 6 — Landing Page  *(small)*

**File:** `apps/web/app/page.tsx`

- Clerk `<SignedIn>` / `<SignedOut>` gates
- "Create Lobby" → `POST /lobby/create` → `router.push('/lobby?id=...')`
- "Join with code" → 6-char input → `POST /lobby/join/:code` → redirect

---

## 🔲 Task 7 — Lobby Waiting Room  *(medium)*

**File:** `apps/web/app/lobby/page.tsx`

- On mount: connect socket, emit auth token, subscribe to `lobby:state`
- Render 8 seat cards showing: franchise name, seat type (HUMAN/BOT/EMPTY), personality badge for bots
- "Start Auction" button — visible only to host, enabled when ≥2 seats filled
- On start: emit `lobby:start` → server transitions to MARQUEE_DRAW

---

## 🔲 Task 8 — Auction Room  *(large)*

**File:** `apps/web/app/auction/[lobbyId]/page.tsx`

Subscribe to all server events, compose:

| Component | File | Notes |
|---|---|---|
| PlayerCard | `components/PlayerCard.tsx` | framer-motion flip animation on reveal |
| BidTimer | `components/BidTimer.tsx` | SVG circle countdown, red < 5s, resets on bid |
| PurseBar | `components/PurseBar.tsx` | green → yellow → red as budget drains |
| FranchiseRow | `components/FranchiseRow.tsx` | 8 rows, squad count, purse, bot-thinking dots |
| BidButton | `components/BidButton.tsx` | shows `current + 25k`, disabled when invalid, optimistic disable on click |

---

## Build Order Summary

```
Task 4 (Engine)  ──►  Task 8 (Auction UI)
                            ▲
Task 5 (FE setup)  ──►  Task 6 (Landing)  ──►  Task 7 (Lobby)  ──►┘
```
