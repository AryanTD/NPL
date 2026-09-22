# NPL Auction Game — CLAUDE.md

## What this project is

A real-time multiplayer auction simulation game based on the Nepal Premier League (NPL).
Users join a lobby (1–3 humans + bots, max 8 seats = 8 NPL franchises) and bid on real
Nepali cricketers to build their squad. After the auction, squads earn fantasy points
based on actual NPL match results.

This is a real product targeting real users — Nepali cricket fans.

---

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS — in `apps/web/`
- **Backend**: Node.js + Express + Socket.io — in `apps/server/`
- **Database**: PostgreSQL + Prisma ORM (in `apps/server/prisma/`)
- **Auth**: Auth.js v5 (next-auth@5.0.0-beta.31) — Google OAuth, Email Magic Link (Resend), JWT sessions
- **Bots**: Algorithmic decision engine, no LLM — `apps/server/src/bots/`
- **Hosting**: Vercel (web) + Render (server) + Neon (PostgreSQL, free tier)
- **Monorepo**: npm workspaces, shared types in `packages/types/`

---

## Current Build Status

### Done
- `packages/types/index.ts` — all shared types + Socket.io event contracts
- `apps/server/src/index.ts` — Express + Socket.io bootstrap, CORS, graceful shutdown
- `apps/server/prisma/schema.prisma` — full schema (12 models, all enums); Auth.js models (User, Account, Session, VerificationToken) added alongside game models
- `apps/server/prisma/seed.ts` — bulk-insert franchises + players via `createMany`; quality formula calibrated for single-tournament stats (batting_avg ref=25, wickets ref=15)
- `data/players/npl-2024.json` — **96 real NPL 2024 players** (8 marquee + 88 non-marquee); sourced from Kaggle dataset, overseas players excluded; `npl-2025.json` is no longer used
- `data/scripts/clean_players.py` — Python script that built npl-2024.json from the Kaggle CSVs; re-run to regenerate if raw data changes
- DB migrations applied through `add_phase_groups` (latest), DB seeded with real players on Neon
- Quality range in DB: 45–89; per-category floor applied in seed.ts (A≥65, B≥55, C≥45); marquee quality is manually set in npl-2024.json and preserved as-is
- Player stats include `hs` (highest score, e.g. "34*") and `bbi` (best bowling innings, e.g. "4/16") as nullable strings
- `src/lib/prisma.ts` — singleton Prisma client
- `src/routes/lobby.ts` — `POST /lobby/create`, `POST /lobby/join/:code`, `POST /lobby/leave`, `GET /lobby/stats`, `GET /lobby/:id`
- `src/bots/botPersonalities.ts` — all 6 personality configs (incl. STAR_CHASER) + `CATEGORY_QUALITY_FLOOR` (A≥65, B≥55, C≥45)
- `src/bots/botManager.ts` — think delay + `AbortSignal` cancellation; `BotSession.floorSkipPhases` stores which group phase per category a BALANCED bot will skip floor-quality players in
- `src/bots/botDecision.ts` — fit score + mood decision engine; AGGRESSIVE skips floor-quality players every round; BALANCED randomly skips floor-quality players in one of the two groups per category (pre-decided at auction start, not per-player)
- `src/socket/auctionEngine.ts` — full auction engine (state machine, timer, bid validation, lucky draw, bots, phase transitions) + all Task 5b optimizations applied; unsold round includes all eligible unsold players (no cap) — a player is eligible if at least one seat still has category quota and role quota available
- `packages/types/index.ts` — `lobby:join` + `lobby:start` added to `ClientToServerEvents`
- `apps/web/` — Next.js 14 scaffold (Tailwind, App Router, Auth.js v5, socket.io-client, framer-motion)
- `apps/web/auth.ts` — Auth.js v5 config (Google + Resend providers, JWT strategy, custom session fields: `id`, `username`, `hasSeenLobbyTour`, `hasSeenAuctionTour`)
- `apps/web/lib/prisma.ts` — singleton Prisma client for web (shares the server-generated `@prisma/client`)
- `apps/web/app/providers.tsx` — `<SessionProvider>` client wrapper used in layout
- `apps/web/app/globals.css` — design tokens (13 CSS vars), Google Fonts, keyframes + animation classes (incl. ticker scroll)
- `apps/web/app/layout.tsx` — `<Providers>` root layout + Google Fonts `<link>` tags
- `apps/web/lib/socket.ts` — singleton typed `socket.io-client` export
- `apps/web/app/page.tsx` — landing page: Google/magic-link sign-in + guest mode, sign-out button (signed-in only), games-played ticker, persistent username, 3-state card (default/create/join); first-login name setup screen (NameSetupView); pencil/check inline name editing in DefaultView
- `apps/web/app/api/auth/[...nextauth]/route.ts` — Auth.js route handler
- `apps/web/app/api/user/tour/route.ts` — `PATCH` to mark lobby/auction tour as seen in DB
- `apps/web/app/api/user/username/route.ts` — `PATCH` to persist display name to `User.username`
- `apps/web/app/lobby/page.tsx` — lobby waiting room (socket lifecycle, 8 seat cards, auction format sidebar, START AUCTION with 3s countdown, marquee draw screen)
- `apps/web/app/auction/[lobbyId]/page.tsx` — auction room (player card, timer, bid controls, queue panel, squad panel, teams bar, lucky draw overlay); includes:
  - Lucky draw: `hasEnteredLuckyDraw` state locks button; `luckyActiveRef` + `pendingRevealRef` fix stale-closure winner reveal; 2.8s overlay auto-close
  - Bid notifications: stacking feed of last 4 bids below bid card, opacity-dimmed by age, auto-clears 4s after last bid
  - Recent buys: last 5 sold players shown in left panel under COMING UP
  - Lucky draw entrants: real-time chips showing which teams hit max price
  - All server optimizations applied to `auctionEngine.ts` (TOCTOU fix, single-pass bucket sort, bulk `$executeRaw` for unsold round, `cancelAllBots` before first await)
  - Player card stat layout: 3-zone design — side columns (2 stats each, stacked) + overlapping center hero box (primary stat at large font); role-aware stat selection with AR flex logic for SR/ECON and HS/BBI

### Not yet built
- Fantasy scoring system (post-auction)

### Deliberate non-goals
- **LLM-backed bots.** The `@anthropic-ai/sdk` dependency is a leftover from the original plan and
  is unused. Bots are algorithmic by decision: no per-bid API cost, no added latency, and testable.
  Do not reintroduce an LLM call into the bid path.
- **Crash recovery for in-flight auctions.** Deferred deliberately — see `V2.md`. Reliability work
  is prevention (keep the server warm, never strand a lobby), not rehydration.

See `V2.md` for the current roadmap and `CONTRIBUTING.md` for how topics are built.
`ROADMAP.md` is historical and superseded.

---

## Repo Layout

```
NPL/
├── package.json              ← npm workspaces root
├── CLAUDE.md                 ← this file
├── V2.md                     ← current roadmap (9 topics)
├── CONTRIBUTING.md           ← how topics are designed, built and merged
├── docs/design/              ← one design note per topic (problem, decision, criteria)
├── ROADMAP.md                ← historical build plan (superseded)
├── data/players/
│   └── npl-2024.json          ← 96 real NPL 2024 players (npl-2025.json removed)
├── data/scripts/
│   └── clean_players.py       ← generates npl-2024.json from Kaggle CSVs
├── packages/types/
│   └── index.ts              ← @npl-auction/types (imported by server + web)
└── apps/
    ├── server/               ← @npl-auction/server
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── lib/prisma.ts
    │   │   ├── routes/lobby.ts
    │   │   ├── socket/       ← auctionEngine.ts
    │   │   └── bots/         ← botManager.ts, botDecision.ts, botPersonalities.ts
    │   └── prisma/
    │       ├── schema.prisma
    │       └── seed.ts
    └── web/                  ← Next.js 14 (App Router, Tailwind, Auth.js v5, socket.io-client)
        ├── auth.ts           ← Auth.js v5 config (Google + Resend, JWT, custom session fields)
        ├── app/
        │   ├── globals.css   ← design tokens, fonts, keyframes (incl. ticker animation)
        │   ├── layout.tsx    ← Providers (SessionProvider) root layout + Google Fonts
        │   ├── providers.tsx ← SessionProvider client wrapper
        │   ├── page.tsx      ← landing page (sign-in/guest, ticker, persistent name, create/join)
        │   ├── api/
        │   │   ├── auth/[...nextauth]/route.ts ← Auth.js route handler
        │   │   ├── ping/route.ts           ← GET, proxies server /health (keep-warm)
        │   │   └── user/
        │   │       ├── tour/route.ts      ← PATCH tour seen flag to DB
        │   │       └── username/route.ts  ← PATCH display name to DB
        │   ├── players/          ← player browser (server component + PlayersClient.tsx)
        │   ├── info/ terms/ privacy/ cookies/  ← footer pages
        │   ├── lobby/
        │   │   └── page.tsx  ← lobby waiting room (socket, seat grid, start, marquee draw)
        │   └── auction/
        │       └── [lobbyId]/
        │           └── page.tsx ← auction room (player card, timer, bid controls, queue, squad, teams bar, lucky draw)
        └── lib/
            ├── socket.ts     ← singleton typed socket.io-client
            └── prisma.ts     ← singleton Prisma client (uses shared @prisma/client)
```

---

## NPL Auction Rules (mirror real NPL)

### Purse

Each franchise gets NPR 90 lakhs (9,000,000) per auction. All prices in NPR integers — no paisa in business logic.

### Player Categories (Nepali players only — no overseas in auction)

| Category | Base Price | Max Price | Lucky Draw if max hit |
| -------- | ---------- | --------- | --------------------- |
| A        | 10 lakh    | 15 lakh   | Yes                   |
| B        | 5 lakh     | 10 lakh   | Yes                   |
| C        | 2 lakh     | 5 lakh    | Yes                   |

Bid increment: 25,000 NPR minimum.

### Squad composition per team (16 players total)

- 1 Marquee player (assigned by lucky draw before auction)
- 10 auction players: exactly **3×A + 4×B + 3×C**
- 4 overseas players (pre-signed, not in auction — stored but not bid on)
- 1 iconic local player (talent hunt pick — stored but not bid on)

### Auction flow

1. Marquee draw — random assignment of 8 marquee players to 8 teams
2. Category A auction — split into group 1 (first 11) then group 2 (remaining)
3. Category B auction — group 1 (first 15) then group 2 (remaining)
4. Category C auction — group 1 (first 17) then group 2 (remaining)
5. Unsold players second round — only players where ≥1 team still has category quota AND role quota available; no cap on pool size
6. Lucky draw — if max price is hit by 2+ teams, random winner

### Bid validation (server-side only)

A team **cannot** bid if:
- They can't afford it (purseRemaining < currentBid + 25k)
- It would leave them unable to fill remaining required slots at base price
- They've already filled that category's quota (countA === 3, countB === 4, countC === 3)

### The 8 NPL Franchises

| # | Name | Short | City | Primary | Secondary |
|---|------|-------|------|---------|-----------|
| 1 | Kathmandu Gorkhas | KTM | Kathmandu | #1B3A6B | #C9A84C |
| 2 | Pokhara Avengers | PKR | Pokhara | #C0392B | #FFFFFF |
| 3 | Chitwan Rhinos | CHT | Chitwan | #196F3D | #F4D03F |
| 4 | Biratnagar Kings | BRT | Biratnagar | #6C3483 | #F9E79F |
| 5 | Janakpur Bolts | JNK | Janakpur | #1A5276 | #F39C12 |
| 6 | Lumbini Lions | LMB | Lumbini | #922B21 | #FAD7A0 |
| 7 | Sudurpaschim Royals | SDR | Sudurpaschim | #0E6655 | #A9DFBF |
| 8 | Karnali Yaks | KRN | Karnali | #4A235A | #D7BDE2 |

---

## Bot Personalities

Bots are **algorithmic**. `botDecision.ts` scores each player with a fit score and compares it
against a personality-specific threshold and price ceiling. No LLM is involved and there is no
API call anywhere in the bid path.

Each personality is a config in `botPersonalities.ts`:

| Field | Meaning |
|---|---|
| `fitThreshold` | Base pickiness (0–1); higher = more selective |
| `ceilingMult` | Scales maximum willingness to pay |
| `humanRivalMult` | Ceiling boost when a human, not a bot, is currently winning |
| `delayFast` / `delaySlow` | Think-delay ranges in ms |
| `fastChance` | Probability of using the fast range |
| `normalIncrement` / `urgentIncrement` | Bid step sizes |

| Personality | fit | ceiling | Behaviour |
|---|---|---|---|
| AGGRESSIVE | 0.25 | 1.18 | Fast and wide; randomly ignores ~1/3 of players (chaotic, not quality-driven); skips floor-quality players every round |
| CONSERVATIVE | 0.60 | 1.32 | Picky and deliberate; the only personality that never takes the unsold-round ceiling boost |
| ROLE_HUNTER | 0.35 | 1.40 | Role-adjusted threshold and ceiling; competes hard only for the `priorityRoles` its squad needs |
| BUDGET_SNIPER | 0.28 | 0.65 | Bluffs early, snipes in the last 3 slots and the unsold round; will still go to category max for a standout athlete |
| BALANCED | 0.45 | 1.10 | Sensible middle; per-auction randomly skips floor-quality players in one of the two groups per category (decided at auction start, independent per category) |
| STAR_CHASER | 0.65 | 1.60 | Only bids on the top 5 remaining per category outside the unsold round, and pays heavily for them |

Think delay is personality-specific — `delayFast` vs `delaySlow`, chosen by `fastChance`, spanning
roughly 300ms–4.5s. Always emit `lobby:bot_thinking` first.
Bots run entirely server-side — the client never sees the decision logic.

**Floor quality** = quality at the category minimum threshold (`CATEGORY_QUALITY_FLOOR`: A=65, B=55, C=45). In the unsold round, floor-skip rules are lifted — bots fill quota normally.

---

## Prisma Schema — Model Summary

| Model | Key fields |
|---|---|
| `Player` | id (from JSON), name, category, role, basePrice, season, isMarquee, flat stat columns (matches, runs, wickets, battingAvg, strikeRate, bowlingAvg, economy, hs, bbi) |
| `Franchise` | name, shortName, city, colorPrimary, colorSecondary |
| `Lobby` | code (6-char), status, season |
| `LobbySeat` | lobbyId, franchiseId, seatType, userId?, botPersonality?, purseRemaining, countA/B/C |
| `AuctionQueue` | lobbyId, playerId, phase, position, isUnsold, isDone |
| `Bid` | lobbyId, seatId, playerId, franchiseId, amount |
| `AuctionResult` | lobbyId, playerId (unique), franchiseId, finalPrice, wasLuckyDraw |
| `SquadSlot` | lobbyId, franchiseId, playerId, slotType (MARQUEE/AUCTION/OVERSEAS/ICONIC), pricePaid |
| `User` | id (cuid), name, email, image, username?, hasSeenLobbyTour, hasSeenAuctionTour — Auth.js |
| `Account` | userId, provider, providerAccountId — OAuth token storage (Auth.js) |
| `Session` | sessionToken, userId, expires — unused in JWT mode but required by adapter |
| `VerificationToken` | identifier, token, expires — used by Email Magic Link (Resend) provider |

---

## Key Socket.io Events

### Server → Client

| Event | Payload |
|---|---|
| `lobby:state` | Full `Lobby` object (sent on join/reconnect) |
| `lobby:player_revealed` | `Player` |
| `lobby:bid_placed` | `{ seatId, franchiseName, amount, timestamp }` |
| `lobby:timer_tick` | `{ secondsLeft }` |
| `lobby:player_sold` | `{ playerId, seatId, franchiseName, finalPrice }` |
| `lobby:player_unsold` | `{ playerId, playerName }` |
| `lobby:lucky_draw` | `{ playerId, contenderSeatIds }` |
| `lobby:marquee_assigned` | `{ playerId, playerName, franchiseId, franchiseName }` |
| `lobby:bot_thinking` | `{ seatId, franchiseName }` |
| `lobby:auction_complete` | `{ seats: LobbySeat[] }` |
| `lobby:error` | `{ message, code? }` |

### Client → Server

| Event | Payload |
|---|---|
| `lobby:place_bid` | `{ lobbyId, amount }` |
| `lobby:pass` | `{ lobbyId }` |

All event types are in `packages/types/index.ts` as `ServerToClientEvents` / `ClientToServerEvents`.

---

## Dev Commands

```bash
# Root
npm run dev              # runs both web + server concurrently

# Server only
cd apps/server
npm run dev              # nodemon → ts-node on port 3001
npm run build            # tsc → dist/src/index.js
npm run start            # node dist/src/index.js

# Database
cd apps/server
npx prisma migrate dev   # create/run migrations
npx prisma db seed       # seed franchises + players
npx prisma studio        # visual DB browser
npx prisma generate      # regenerate client after schema change (always run from apps/server, never apps/web)
```

### Resetting tutorials (for testing)

Tours are stored in two places — clear both to force the overlay to reappear:

1. **Browser (all users)** — run in DevTools console:
   ```javascript
   localStorage.removeItem("hasSeenLobbyTour")
   localStorage.removeItem("hasSeenAuctionTour")
   ```
   Then refresh. This works for both guests and signed-in users (localStorage is checked first).

2. **Database (signed-in users only)** — open Prisma Studio (`npx prisma studio` from `apps/server`), find the User row, and set `hasSeenLobbyTour` and `hasSeenAuctionTour` back to `false`. Without this step, the DB flag will re-seed localStorage on the next sign-in.

---

## Environment Variables

Canonical copies live in `apps/server/.env.example` and `apps/web/.env.example` — keep those in sync with this section.

### apps/server/.env

```
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require   # pooled (Neon)
DIRECT_URL=postgresql://...@...neon.tech/neondb?sslmode=require      # unpooled, used by Prisma migrations
CLIENT_URL=http://localhost:3000
PORT=3001
```

### apps/web/.env.local

```
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
AUTH_SECRET=<random string — generate with: npx auth secret>
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
AUTH_RESEND_KEY=re_...   # from resend.com — free tier: 100 emails/day
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require   # same pooled URL as server
DIRECT_URL=postgresql://...@...neon.tech/neondb?sslmode=require      # same direct URL as server
```

---

## Architecture Decisions

- **Game state lives on the server** — `Map<lobbyId, AuctionState>` in memory, never trust client
- **All bid validation server-side** — client optimistically disables the button but server decides
- **Bots are server-only** — decision logic never reaches the browser; clients see only `lobby:bot_thinking` and the resulting bid
- **Socket rooms = lobby IDs** — `socket.join(lobbyId)` on connect, all broadcasts to room
- **Prices always NPR integers** — no decimals, no paisa in business logic
- **Player IDs are stable strings** — not cuid, set from JSON (e.g. `npl-sandeep-lamichhane`)
- **Single season (2024)** — only `npl-2024.json` is seeded; both lobby creation and the auction engine use `season: 2024`; do not hardcode `2025` anywhere
- **tsconfig rootDir is `.`** — covers both `src/` and `prisma/` so `tsc --noEmit` catches seed.ts too
- **start script is `dist/src/index.js`** — not `dist/index.js`, because rootDir is `.`
- **Migrations are tracked in git** — `apps/server/prisma/migrations/` was once gitignored, which left the schema unreproducible from a clone. The directory must stay tracked; `.gitignore` carries a comment saying so
- **Neon DB requires `directUrl`** — `schema.prisma` uses `DATABASE_URL` (pooled) for queries and `DIRECT_URL` (unpooled) for migrations; both must be set in `.env`
- **Server must be started manually** — `npx ts-node --project tsconfig.json src/index.ts` from `apps/server/`; nodemon orphan issue not yet fixed
- **Auth: Auth.js v5, JWT sessions, Google + Resend (magic link)** — no Clerk. `userId` on `LobbySeat`/`Lobby` is either an Auth.js cuid (signed-in) or `guest_${UUID}` (guest); server treats it as an opaque string. Resend requires `AUTH_RESEND_KEY` and uses the `VerificationToken` model for one-time tokens
- **Guest identity** — `guest_${crypto.randomUUID()}` stored in `localStorage.npl_guest_id`; guest display name in `localStorage.npl_guest_name`; no DB record for guests
- **One Prisma schema** — Auth.js models live in `apps/server/prisma/schema.prisma` alongside game models; both server and web import from the same `@prisma/client`; always run `prisma generate` / `prisma migrate` from `apps/server/`
- **Auth.js type augmentation** — must augment `@auth/core/types` (not `next-auth`) because `useSession()` from `next-auth/react` imports `Session` from `@auth/core/types` directly; augmentation lives in `apps/web/auth.ts`
- **Tutorial metadata** — stored in `localStorage` immediately on dismiss (works for guests); also PATCH'd to `User.hasSeenLobbyTour` / `User.hasSeenAuctionTour` in DB for signed-in users (fire-and-forget, 401 for guests is silently ignored)
- **Persistent username** — stored in `User.username` in DB for signed-in users; `localStorage.npl_guest_name` for guests; pre-populated on landing page via session or localStorage

---

## What NOT to do

- Never store sensitive state on the client
- Never let a client-side bid skip server validation
- Don't use `any` in TypeScript — shared types live in `packages/types/`
- Don't hardcode franchise names — always read from DB
- Don't start building fantasy scoring until auction engine is solid
- Don't add `node_modules/` to git — covered by `.gitignore`
- Don't run `prisma migrate` without a valid `DATABASE_URL` in `.env`
- Don't hardcode `season: 2025` anywhere — only season 2024 data exists; using 2025 causes empty player queries and auction crashes
- Don't add a separate `apps/web/prisma/schema.prisma` — the server schema is the single source of truth; running `prisma generate` in `apps/web` will overwrite the server's generated client
- Don't augment `next-auth` module for session types — augment `@auth/core/types` instead (see Architecture Decisions above)
- Don't reintroduce an LLM call into the bot bid path — bots are algorithmic by decision (see Deliberate non-goals)
- Don't reference Clerk anywhere — it has been fully removed; `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are no longer used
