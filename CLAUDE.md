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

## NPL Auction Rules (mirror real NPL)

### Purse

Each franchise gets NPR 90 lakhs (stored in paisa: 9,000,000) per auction.

### Player Categories (Nepali players only — no overseas in auction)

| Category | Base Price | Max Price | Lucky Draw if max hit |
| -------- | ---------- | --------- | --------------------- |
| A        | 10 lakh    | 15 lakh   | Yes                   |
| B        | 5 lakh     | 10 lakh   | Yes                   |
| C        | 2 lakh     | 5 lakh    | Yes                   |

### Squad composition per team (16 players total)

- 1 Marquee player (assigned by lucky draw before auction)
- 10 auction players: exactly 3×A + 4×B + 3×C
- 4 overseas players (pre-signed, not in auction — stored but not bid on)
- 1 iconic local player (talent hunt pick — stored but not bid on)

### Auction flow

1. Marquee draw — random assignment of 8 marquee players to 8 teams
2. Category A auction (all A players, one by one)
3. Category B auction
4. Category C auction
5. Unsold players second round — teams that haven't filled quotas get another shot
6. Lucky draw — if max price is hit by 2+ teams, random winner

### Bidding mechanics

- Countdown timer: 10 seconds, resets on each new bid
- Minimum bid increment: 25,000 NPR (25k)
- A team cannot bid if: they can't afford it OR it would leave them unable to fill
  remaining required slots at base price
- A team cannot bid on a category they've already filled

### The 8 NPL Franchises

1. Kathmandu Gorkhas (was Gurkhas in 2024)
2. Pokhara Avengers
3. Chitwan Rhinos
4. Biratnagar Kings
5. Janakpur Bolts
6. Lumbini Lions
7. Sudurpaschim Royals
8. Karnali Yaks

---

## Bot Personalities

Bots use the Claude API to reason about bids. Each has a personality that shapes
its system prompt:

- **AGGRESSIVE** — bids hard on star players, willing to go near max, risks budget
- **CONSERVATIVE** — rarely exceeds base price by much, saves budget for later
- **ROLE_HUNTER** — only competes hard for specific roles their squad needs
- **BUDGET_SNIPER** — passes early rounds, swoops with saved budget in Cat B/C
- **BALANCED** — mirrors a sensible real team manager, no extreme behavior

Bot "thinking" delay: 1.5–3.5s (random) to feel human. Show a typing indicator.

---

## Data

- `data/players/npl-2024.json` — NPL 2024 season player pool
- `data/players/npl-2025.json` — NPL 2025 season player pool
- Player fields: id, name, category, role, base_price, season, is_marquee, stats
- Roles: BAT | BOWL | AR (all-rounder) | WK (wicketkeeper)
- All prices stored in NPR (not paisa) in data files, converted on seed

---

## Key Socket.io Events

### Server → Client

- `lobby:state` — full lobby state on join
- `lobby:player_revealed` — next player card shown to all
- `lobby:bid_placed` — { seatId, amount, franchiseName }
- `lobby:timer_tick` — { secondsLeft }
- `lobby:player_sold` — { playerId, seatId, finalPrice }
- `lobby:player_unsold` — player passes to unsold pool
- `lobby:lucky_draw` — max price hit, animating draw...
- `lobby:marquee_assigned` — { playerId, franchiseId }
- `lobby:bot_thinking` — show bot deliberation indicator
- `lobby:auction_complete` — all slots filled, show squads
- `lobby:error` — something went wrong

### Client → Server

- `lobby:place_bid` — { lobbyId, amount }
- `lobby:pass` — human explicitly passes

---

## Dev Commands

```bash
# Root
npm run dev              # runs both web + server concurrently

# Server only
cd apps/server
npm run dev              # nodemon on port 3001

# Web only
cd apps/web
npm run dev              # Next.js on port 3000

# Database
cd apps/server
npx prisma migrate dev   # run migrations
npx prisma db seed       # seed NPL player data
npx prisma studio        # visual DB browser
```

---

## Environment Variables

### apps/server/.env

```
DATABASE_URL=postgresql://...
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

- Game state lives on the server (single source of truth), never trust client
- All bid validation happens server-side before broadcasting
- Bots run entirely on server — client never knows bot internals
- Socket rooms = lobby IDs (e.g. room "ABC123")
- Prices always in NPR integers (no decimals, no paisa in business logic)
- Use optimistic UI for bid button (disable immediately on click, re-enable on rejection)

---

## What NOT to do

- Never store sensitive state on the client
- Never let a client-side bid skip server validation
- Don't use `any` in TypeScript — shared types live in `packages/types/`
- Don't hardcode franchise names — always read from DB
- Don't start building fantasy scoring until auction engine is solid
