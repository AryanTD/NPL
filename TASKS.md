# NPL Auction Game — Task List

## ✅ Completed

- Full auction engine with state machine, timer, bid validation, lucky draw, bots, phase transitions
- All server-side optimizations: TOCTOU fix, single-pass bucket sort, bulk `$executeRaw` for unsold round, `cancelAllBots` before awaits
- Lucky draw button lock (`hasEnteredLuckyDraw` state)
- Lucky draw winner reveal after overlay (stale-closure fix via `luckyActiveRef` + `pendingRevealRef`)
- Stacking bid notifications (last 4, opacity-dimmed by age) outside bid card
- Recent buys list (last 5) in left panel under COMING UP
- Lucky draw entrant chips shown in real-time as teams hit max price
- Live feed removed, replaced with recent buys
- Migrated DB from Railway (trial expired) to Neon (free tier, permanent); added `DIRECT_URL` + `directUrl` in schema for Prisma migrations
- Added `hs` and `bbi` fields to Player (schema, seed, types, engine, UI)
- Player card stat redesign: 3-zone layout with overlapping center hero box; role-aware 5-stat display with AR flex logic

---

## 🔴 Immediate (do these first)

### 1. Bug Testing Session

Open **two browser windows with different accounts** and work through this checklist:

**Auction flow:**

- [ ] Full auction runs to completion (all players auctioned)
- [ ] Unsold round works (players that got no bids re-appear)
- [ ] Lucky draw fires when 2+ teams match max price
- [ ] Auction complete screen shows correct squads
- [ ] Bots don't run out of money and get stuck
- [ ] Category quota blocks correctly (max 3A / 4B / 3C per team)
- [ ] Timer ticks and resets correctly on new bids

**Multi-human (2 windows):**

- [ ] Both humans join same lobby via code
- [ ] Both see the same player on block simultaneously
- [ ] Bid from window 1 instantly appears in window 2
- [ ] Timer stays in sync across both
- [ ] Refreshing mid-auction reconnects correctly with current state

**Edge cases:**

- [ ] Close tab mid-auction — does the remaining human keep playing?
- [ ] Marquee draw screen → auction transition (3.5s gap) — no missed events?

---

### 2. Fix Bugs Found Above

Fix whatever breaks in step 1 before moving on.

---

## 🟡 Next Up

### 4. Fantasy Scoring

**Data source**: `/Users/aryantandon/Nepal-Premier-League-2024-Analysis/Final Tables/npl_final.csv` (7,486 ball-by-ball rows)

**Step 4a** — Write `data/scripts/calc_fantasy_scores.py`:

- Read `npl_final.csv`
- Compute per-player: runs, 4s, 6s, wickets, maidens, catches, stumpings
- Apply standard T20 fantasy points (runs=1pt, 4=+1, 6=+2, wicket=25, catch=8, etc.)
- Output `data/fantasy/npl-2024-scores.json`

**Step 4b** — Add `fantasyPoints` to `Player` model in `schema.prisma` and seed it

**Step 4c** — Build `apps/web/app/results/[lobbyId]/page.tsx`:

- Triggered after `lobby:auction_complete` event
- Show each team's squad + fantasy points total
- Rank all 8 teams by points → leaderboard

---

### 5. Multi-Human Polish

After bug testing reveals the actual gaps, fix:

- Human seat highlighting (each human sees their own seat highlighted)
- Bid controls disabled correctly for other humans' perspective
- Lobby waiting room: copy-to-clipboard button for the 6-char join code

---

## 🟢 Backlog (do after above are solid)

### 6. Server Process Management

The server is currently started manually with a background `ts-node` command. Fix the nodemon orphan issue so `npm run dev` from root reliably starts and hot-reloads both web and server.

### 7. Post-Auction UI

- Show bot team squads (currently no UI for what bots won)
- Player detail modal (click any player to see full stats)

### 8. Polish

- Sound effects (bid placed, player sold, lucky draw, auction complete)
- Mobile responsiveness for auction room
- Bot "reasoning" blurb when a bot bids

### 9. Production Deploy

- Railway: proper `Dockerfile` or nixpacks config + `pm2` for uptime
- Vercel: set env vars in dashboard
- Railway DB: migrations + seed in deploy pipeline

---

## Quick Reference

```bash
# Start server (Terminal 1 — manual until nodemon is fixed)
cd apps/server && npx ts-node --project tsconfig.json src/index.ts

# Start web (Terminal 2)
cd apps/web && npm run dev

# Re-seed after JSON edits
cd apps/server && npx prisma db seed

# Create + apply a new migration
cd apps/server && npx prisma migrate dev --name <migration_name>

# View DB
cd apps/server && npx prisma studio
```
