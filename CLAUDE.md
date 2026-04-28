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
- **Auth**: Clerk
- **AI Bots**: Anthropic Claude API (claude-sonnet-4-6)
- **Hosting**: Vercel (web) + Railway (server + DB)
- **Monorepo**: npm workspaces, shared types in `packages/types/`

---

## Current Build Status

### Done
- `packages/types/index.ts` — all shared types + Socket.io event contracts
- `apps/server/src/index.ts` — Express + Socket.io bootstrap, CORS, graceful shutdown
- `apps/server/prisma/schema.prisma` — full schema (8 models, all enums)
- `apps/server/prisma/seed.ts` — bulk-insert franchises + players via `createMany`
- `data/players/npl-2024.json` + `npl-2025.json` — 88 players each
- DB migration applied to Railway (`20260426165922_init`), DB seeded
- `src/lib/prisma.ts` — singleton Prisma client
- `src/routes/lobby.ts` — `POST /lobby/create`, `POST /lobby/join/:code`, `GET /lobby/:id`
- `src/bots/botPersonalities.ts` — all 5 personality configs
- `src/bots/claudeBot.ts` — mock heuristic bot (real Claude API deferred)
- `src/bots/botManager.ts` — think delay + `AbortSignal` cancellation
- `src/socket/auctionEngine.ts` — full auction engine (state machine, timer, bid validation, lucky draw, bots, phase transitions)
- `packages/types/index.ts` — `lobby:join` + `lobby:start` added to `ClientToServerEvents`
- `apps/web/` — Next.js 14 scaffold (Tailwind, App Router, Clerk v5, socket.io-client, framer-motion)
- `apps/web/app/layout.tsx` — `<ClerkProvider>` root layout
- `apps/web/lib/socket.ts` — singleton typed `socket.io-client` export

### Not yet built
- `apps/web/app/page.tsx` — landing page (Task 6)
- `apps/web/app/lobby/page.tsx` — lobby waiting room (Task 7)
- `apps/web/app/auction/[lobbyId]/page.tsx` — auction room (Task 8)

See `ROADMAP.md` for the full ordered task list.

---

## Repo Layout

```
NPL/
├── package.json              ← npm workspaces root
├── CLAUDE.md                 ← this file
├── ROADMAP.md                ← ordered build plan with task breakdown
├── data/players/
│   ├── npl-2024.json
│   └── npl-2025.json
├── packages/types/
│   └── index.ts              ← @npl-auction/types (imported by server + web)
└── apps/
    ├── server/               ← @npl-auction/server
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── lib/prisma.ts
    │   │   ├── routes/lobby.ts
    │   │   ├── socket/       ← auctionEngine.ts
    │   │   └── bots/         ← botManager.ts, claudeBot.ts (mock), botPersonalities.ts
    │   └── prisma/
    │       ├── schema.prisma
    │       └── seed.ts
    └── web/                  ← Next.js 14 (App Router, Tailwind, Clerk, socket.io-client)
        ├── app/
        │   ├── layout.tsx    ← ClerkProvider root layout
        │   └── page.tsx      ← (todo) landing page
        └── lib/
            └── socket.ts     ← singleton typed socket.io-client
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
2. Category A auction (all A players, one by one)
3. Category B auction
4. Category C auction
5. Unsold players second round — teams that haven't filled quotas get another shot
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

Bots use `claude-sonnet-4-6` to reason about each bid. Personality shapes the system prompt.

| Personality | Behaviour |
|---|---|
| AGGRESSIVE | Bids hard on star players, willing to go to max, risks budget |
| CONSERVATIVE | Rarely exceeds base price by much, saves for later |
| ROLE_HUNTER | Only competes hard for specific roles the squad needs |
| BUDGET_SNIPER | Passes Cat A, swoops with saved budget in Cat B/C |
| BALANCED | Sensible manager — no extreme behaviour |

Bot thinking delay: **1.5–3.5s** (random). Always emit `lobby:bot_thinking` first.
Bots run entirely server-side — the client never sees bot logic or Claude API calls.

---

## Prisma Schema — Model Summary

| Model | Key fields |
|---|---|
| `Player` | id (from JSON), name, category, role, basePrice, season, isMarquee, flat stat columns |
| `Franchise` | name, shortName, city, colorPrimary, colorSecondary |
| `Lobby` | code (6-char), status, season |
| `LobbySeat` | lobbyId, franchiseId, seatType, userId?, botPersonality?, purseRemaining, countA/B/C |
| `AuctionQueue` | lobbyId, playerId, phase, position, isUnsold, isDone |
| `Bid` | lobbyId, seatId, playerId, franchiseId, amount |
| `AuctionResult` | lobbyId, playerId (unique), franchiseId, finalPrice, wasLuckyDraw |
| `SquadSlot` | lobbyId, franchiseId, playerId, slotType (MARQUEE/AUCTION/OVERSEAS/ICONIC), pricePaid |

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
npx prisma generate      # regenerate client after schema change
```

---

## Environment Variables

### apps/server/.env

```
DATABASE_URL=postgresql://user:password@localhost:5432/npl_auction
ANTHROPIC_API_KEY=sk-ant-...
CLIENT_URL=http://localhost:3000
PORT=3001
```

### apps/web/.env.local

```
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

---

## Architecture Decisions

- **Game state lives on the server** — `Map<lobbyId, AuctionState>` in memory, never trust client
- **All bid validation server-side** — client optimistically disables the button but server decides
- **Bots are server-only** — Claude API key never touches the browser
- **Socket rooms = lobby IDs** — `socket.join(lobbyId)` on connect, all broadcasts to room
- **Prices always NPR integers** — no decimals, no paisa in business logic
- **Player IDs are stable strings** — not cuid, set from JSON (e.g. `npl-sandeep-lamichhane`)
- **2025 stats win for marquee players** — seed merges both JSON files into a Map, 2025 overwrites
- **tsconfig rootDir is `.`** — covers both `src/` and `prisma/` so `tsc --noEmit` catches seed.ts too
- **start script is `dist/src/index.js`** — not `dist/index.js`, because rootDir is `.`

---

## What NOT to do

- Never store sensitive state on the client
- Never let a client-side bid skip server validation
- Don't use `any` in TypeScript — shared types live in `packages/types/`
- Don't hardcode franchise names — always read from DB
- Don't start building fantasy scoring until auction engine is solid
- Don't add `node_modules/` to git — covered by `.gitignore`
- Don't run `prisma migrate` without a valid `DATABASE_URL` in `.env`
