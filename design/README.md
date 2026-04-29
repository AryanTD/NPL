# Handoff: NPL Auction — UI Design

## Overview

This is the design handoff for the Nepal Premier League (NPL) Auction Simulation Game — a real-time multiplayer web app where users join a lobby, bid on real Nepali cricketers, and build a franchise squad. The prototype covers the three frontend pages not yet built in the codebase: landing page, lobby waiting room, and live auction room.

---

## About the Design Files

The files in this bundle (`NPL Auction.html`, `tweaks-panel.jsx`) are **design references created in HTML + React/Babel** — interactive prototypes showing intended look, layout, and behaviour. They are **not production code to copy directly**.

Your task is to **recreate these designs in the existing Next.js 14 + Tailwind + TypeScript codebase** (`apps/web/`) using its established patterns and libraries (App Router, Clerk, Socket.io-client, Framer Motion). The HTML prototype simulates Socket.io events locally — in production, all game state comes from the server via the existing `AuctionEngine`.

The fidelity is **high-fidelity**: pixel-precise colors, typography, spacing, and interactions. Recreate as closely as possible.

---

## Target Pages

| File | Route | Status |
|---|---|---|
| `apps/web/app/page.tsx` | `/` | Landing page |
| `apps/web/app/lobby/page.tsx` | `/lobby` | Lobby waiting room |
| `apps/web/app/auction/[lobbyId]/page.tsx` | `/auction/[lobbyId]` | Live auction room |

---

## Design Tokens

These are defined as CSS variables. Map them to Tailwind arbitrary values or a `globals.css` custom-properties block.

### Colors
```
--bg:       #07080f   /* page background */
--s1:       #0c0f1c   /* card surface */
--s2:       #111626   /* elevated surface */
--s3:       #162035   /* input / pressed surface */
--border:   #1c2540   /* default border */
--border2:  #243055   /* stronger border */
--text:     #e4e9f4   /* primary text */
--muted:    #5b6f9a   /* secondary text */
--muted2:   #8899bb   /* tertiary text */
--red:      #dc2626   /* primary action / accent */
--red2:     #b91c1c   /* primary action hover */
--gold:     #c9a84c   /* highlight / sold price */
--green:    #10b981   /* positive / leading */
```

### Typography
```
Font display:  'Rajdhani' (weights 500, 600, 700) — used for all prices, labels, headings
Font body:     'Plus Jakarta Sans' (weights 300, 400, 500, 600) — UI text
```
Import from Google Fonts:
```html
https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600
```

### Spacing & Radius
- Page padding: `24px` standard, `16px` tight
- Card border-radius: `10px` standard, `12px` large, `14px` modal
- Top bar height: `52–56px`
- Bottom teams bar height: `58px`

### Category Colors
```
Category A: #F59E0B  (amber)
Category B: #60A5FA  (blue)
Category C: #34D399  (green)
Marquee:    #F472B6  (pink)
```

### Franchise Colors
| ID  | Name                  | Primary   | Secondary |
|-----|-----------------------|-----------|-----------|
| KTM | Kathmandu Gorkhas     | `#1B3A6B` | `#C9A84C` |
| PKR | Pokhara Avengers      | `#C0392B` | `#FFFFFF` |
| CHT | Chitwan Rhinos        | `#196F3D` | `#F4D03F` |
| BRT | Biratnagar Kings      | `#6C3483` | `#F9E79F` |
| JNK | Janakpur Bolts        | `#1A5276` | `#F39C12` |
| LMB | Lumbini Lions         | `#922B21` | `#FAD7A0` |
| SDR | Sudurpaschim Royals   | `#0E6655` | `#A9DFBF` |
| KRN | Karnali Yaks          | `#4A235A` | `#D7BDE2` |

---

## Screen 1: Landing Page (`/`)

### Layout
Full viewport, centered column. Background: `--bg` with a subtle grid texture overlay (`opacity: 3.5%`).

### Sections

**Logo lockup** (top center):
- Two vertical bars (4×24px red + 4×16px blue) — Nepal flag colors
- `NPL AUCTION` in Rajdhani 700, 52px, `--text`, letter-spacing 3px
- `2025 · SEASON 4` in Rajdhani 500, 18px, `--gold`, letter-spacing 6px
- Subtitle: 14px, `--muted`, max-width 360px, centered

**Auth card** (center):
- Width: 520px, padding: 32px 36px
- Background: `--s1`, border: `1px solid --border`, border-radius: 14px
- Three states: **Default** (name input + buttons), **Create** (franchise picker), **Join** (code input)

**Default state:**
- Label `YOUR NAME` (11px, `--muted`, letter-spacing 0.5)
- Text input: background `--s2`, border `--border`, radius 8px, padding 10px 14px, 14px font
- `CREATE ROOM` button: full width, background `--red`, Rajdhani 700, 16px, letter-spacing 1.5px, 12px padding. Disabled when name is empty.
- `JOIN WITH CODE` button: full width, transparent bg, border `--border2`, same typography
- Divider with "or"
- `Quick Play (vs bots only)` button: transparent, 13px, `--muted2`

**Create state (franchise picker):**
- Title `CHOOSE YOUR FRANCHISE` — Rajdhani 700, 22px
- 2-column grid, gap 8px, max-height 420px, scrollable
- Each franchise button:
  - Background `--s2`, border `${franchise.primary}60`
  - Hover: background `${franchise.primary}18`, border `${franchise.primary}`
  - 8×8px color dot (franchise primary)
  - Name: 13px, weight 600
  - City: 11px, `--muted`
  - On click → navigates to lobby with selected franchise

**Join state:**
- 6-character code input: Rajdhani 700, 22px, letter-spacing 4px, centered
- `JOIN` button: same as CREATE ROOM, disabled until code.length === 6

---

## Screen 2: Lobby (`/lobby`)

### Layout
Full viewport. Fixed 56px top bar. Below: flex row — main content area (flex:1, scrollable) + 280px right sidebar.

### Top Bar
- `NPL` logo: Rajdhani 700, 20px, `--red`
- `AUCTION LOBBY` label: Rajdhani 600, 14px, `--muted2`, letter-spacing 1
- Right: green pulse dot + "Room Open" + room code badge

### Main Content (left)
Padding 24px, `alignSelf: flex-start` (shrinks to content, no blank space).

**Header row:**
- Left: `FRANCHISE SEATS` label (11px, `--muted`) + `8 Teams · 8 Players · Bot Fill` (Rajdhani 700, 22px)
- Right: user's franchise badge (primary-color background, border, Rajdhani short code + full name)

**Team grid:** 4-column, gap 12px
Each team card:
- User's seat: background `${primary}12`, border `${primary}`
- Others: background `--s1`, border `--border`
- 3px color bar at top (franchise primary, full width)
- Crest placeholder: 36px circle, `${primary}28` bg, `${primary}80` border, short name in Rajdhani 700
- Franchise name (13px weight 600) + city (11px `--muted`)
- Seat row: background `--s2`, radius 6, 7px 10px padding
  - 6px status dot: green for user, `--muted` for others
  - Name: 12px weight 500
  - "Manager" subtitle for non-user seats (11px `--muted`) — **do not expose bot/AI nature**
  - "YOU" badge (10px `--green`) for user seat
- Bottom row: `Purse: NPR 90L` + `Ready` label

**Info strip:** 3-column grid, gap 10px, marginTop 16px
Cards: background `--s1`, border `--border`, radius 10, padding 12px 16px
- PURSE PER TEAM / NPR 90L / NPR 9,000,000
- AUCTION POOL / 22 players / 6A · 8B · 8C
- SQUAD SIZE / 16 players / 1 Marquee + 10 Auction + 5 Pre-signed

### Right Sidebar (280px)
**Auction Format section** (padding 20px, border-bottom):
Label `AUCTION FORMAT` (11px `--muted`, letter-spacing 1), then 5 items with numbered circles (20px, `--s3` bg, `--border2` border):
1. Marquee Draw
2. Category A — Base NPR 10L · Max NPR 15L
3. Category B — Base NPR 5L · Max NPR 10L
4. Category C — Base NPR 2L · Max NPR 5L
5. Unsold Round

**Start section** (padding 20px, border-top `--border`):
- Countdown state: large gold number (Rajdhani 700, 64px) centered in a card
- Normal state: `START AUCTION` button — full width, `--red` background, Rajdhani 700, 18px, letter-spacing 2, radius 10
  - Hover: `--red2`
- Helper text below button: 11px `--muted`, centered

---

## Screen 3: Marquee Draw (transition screen)

A full-screen animated reveal between Lobby and Auction. Auto-advances after all 8 players are revealed.

### Layout
Centered column, gap 32px. Background `--bg`.

**Header:** "LUCKY DRAW" (11px `--muted`, letter-spacing 2) + "MARQUEE ASSIGNMENT" (Rajdhani 700, 36px)

**Cards grid:** 4-column, gap 12px, max-width 900px
Each card reveals sequentially (~900ms apart) with a `rotateY(0deg)` flip animation.
- Unrevealed: `???` centered in `--muted`
- Revealed: player name (14px weight 600), role (11px `--muted`), MARQUEE badge in pink
- User's card: highlighted with franchise primary color border + background tint

**Winner callout** (appears after all revealed):
Background `${franchise.primary}20`, border `${franchise.primary}`, radius 10, pop-in animation.

---

## Screen 4: Live Auction Room (`/auction/[lobbyId]`)

This is the core screen. All game state comes from Socket.io events.

### Layout
Full viewport. 52px top bar → flex row (210px left + flex:1 center + 240px right) → 58px bottom bar.

### Top Bar
- `NPL` logo (Rajdhani 700, 18px, `--red`)
- Category badge: background `${catColor}20`, border, Rajdhani 700, 12px
- Sold/remaining counters
- Right: franchise crest (28px) + name + purse remaining (Rajdhani 700, `--green`)

### Left Panel: Upcoming Queue (210px)
Header: `COMING UP` (11px `--muted`, letter-spacing 1, padding 12px 14px, border-bottom)

Each queue item (padding 7px 8px):
- Index number (11px `--muted`, 14px wide)
- 6px category color dot
- Player name (12px weight 500, truncated)
- Role badge + base price (10px `--muted`)

### Center Panel: Auction Floor
Padding 20px, scrollable. Content max-width 340px, centered.

**Player Card** (animates in with `pop-in` on each new player):
- Background `--s1`, border `${catColor}40`, radius 12, overflow hidden
- **Header strip**: solid `catColor` background — category label + role badge (left), base/max price (right). Text color `#07080f`.
- **Photo area**: 108×108px striped placeholder SVG, padding 20px top/sides
- **Name**: Rajdhani 700, 24px, centered; role 13px `--muted`
- **Stats row**: 3-column grid, padding 10px 14px, border-top `--border`
  - Stat value: Rajdhani 700, 18px, `catColor`
  - Stat label: 9px `--muted`, uppercase, letter-spacing 0.5

**Bid Panel** (below player card, max-width 340px):
Background `--s1`, border `--border`, radius 12, padding 14px 16px.

Normal bidding state:
- `CURRENT BID` label (11px `--muted`, letter-spacing 1)
- Current leader: 6px franchise color dot + short name + "(you)" if user
- Bid amount: Rajdhani 700, 38px, `--text`
- "Base price — no bids yet" when no bids (12px `--muted`)
- **Timer bar**: label + countdown (Rajdhani 700, 15px). Color transitions:
  - `>18s`: `--green`; `9–18s`: `#f59e0b`; `≤8s`: `#ef4444`
  - Pulses when ≤6s
  - Progress bar: 3px height, `--border2` track, colored fill, 1s linear transition
- **Bid buttons** (when user is NOT leading):
  - Row of 3 increment buttons: `+रू25K`, `+रू50K`, `+रू1L` — background `--s2`, border `--border2`, radius 7, Rajdhani 700 13px. Hover: border `--gold`
  - `BID रू{currentBid + 25K}` — full width, `--red` bg, white text, Rajdhani 700 16px, radius 8
  - Disabled state when canAffordBid() returns false
- **Leading state** (when user IS leading): `#10b98115` bg, `#10b98140` border, `YOU ARE LEADING` in `--green`

Sold/Unsold state:
- SOLD: buyer name in franchise color (Rajdhani 700, 22px) + final price in `--gold` (Rajdhani 700, 28px)
- UNSOLD: "UNSOLD" in `--muted` (Rajdhani 700, 26px)
- Both animate in with `pop-in`

### Right Panel: My Squad (240px)
Top: `MY SQUAD` label + franchise name in franchise primary color (border-bottom).

**Budget bar:**
- `PURSE REMAINING` label + amount in `--green` (Rajdhani 700, 14px)
- 3px progress bar (green fill, `--border` track)

**Quota slots** (A/3, B/4, C/3):
Each row: category badge (20×20px, `${catColor}20` bg, radius 4) + segmented progress bar + `n/max` count

**Squad list** (scrollable):
Each player: category dot + name/role + sold price in `--gold` (Rajdhani 700, 11px)

**Live Feed** (bottom, max-height 130px):
Last 8 auction events. Most recent in `--text`, older in `--muted`. 11px, 3px 12px padding each.

### Bottom Teams Bar (58px)
8 team cards in a flex row, gap 6px, 0 12px padding. Each card:
- Flex:1, min-width 120px, max-width 168px
- Normal: `--s1` bg, `--border` border
- Leading (currently winning bid): `${primary}18` bg, `${primary}` border
- User's: `${primary}0d` tint
- Content: 26px crest + short name (+ ★ for user) + purse `--muted2` + player count
- Leading: 6px pulsing dot (franchise primary)

### Lucky Draw Overlay (modal)
Triggered when any bid reaches the category max price. Blocks interaction.

**Backdrop:** `rgba(7,8,15,0.85)` + `backdrop-filter: blur(6px)`, fixed inset 0, z-index 100.

**Modal card:**
- Background `--s2`, border `${catColor}60`, radius 16, padding 40px 52px, max-width 620px, centered
- `MAX PRICE HIT — LUCKY DRAW` badge: `${catColor}20` bg, `${catColor}60` border, radius 6, Rajdhani 700 12px in catColor
- Player name (Rajdhani 700, 26px) + role (13px `--muted`) + max price (Rajdhani 700, 22px, `--gold`)
- **Contenders** (all teams that can afford max + have quota):
  Each chip: crest (22px) + franchise short name. Highlighted chip: `${primary}22` bg + border. Winner chip: `${primary}30` bg + full `${primary}` border.
  Animation: cycles through chips rapidly then slows to winner (slot-machine style).
- Spinner while drawing: spinning ring + "Drawing…" (13px `--muted`)
- Winner reveal: "WINNER" label + franchise name in franchise primary (Rajdhani 700, 26px), pop-in animation. Auto-advances after 2.4s.

---

## Bid Validation Rules (mirror server-side logic)

These run **client-side only for UI feedback** (disabling buttons). The server always has final say.

```typescript
function canAffordBid(seat: Seat, newBid: number, player: Player): boolean {
  if (seat.purse < newBid) return false;
  const aLeft = Math.max(0, 3 - seat.countA - (player.cat === 'A' ? 1 : 0));
  const bLeft = Math.max(0, 4 - seat.countB - (player.cat === 'B' ? 1 : 0));
  const cLeft = Math.max(0, 3 - seat.countC - (player.cat === 'C' ? 1 : 0));
  const minNeeded = aLeft * 1000000 + bLeft * 500000 + cLeft * 200000;
  return (seat.purse - newBid) >= minNeeded;
}

function hasQuota(seat: Seat, cat: 'A' | 'B' | 'C'): boolean {
  if (cat === 'A' && seat.countA >= 3) return false;
  if (cat === 'B' && seat.countB >= 4) return false;
  if (cat === 'C' && seat.countC >= 3) return false;
  return true;
}
```

---

## Socket.io Event Mapping

| UI action | Event to emit | Notes |
|---|---|---|
| User clicks BID | `lobby:place_bid` `{ lobbyId, amount }` | Validate client-side first |
| User clicks PASS | `lobby:pass` `{ lobbyId }` | |

| Event received | UI update |
|---|---|
| `lobby:state` | Initialize full game state on join/reconnect |
| `lobby:player_revealed` | New player card (pop-in animation) |
| `lobby:bid_placed` | Update currentBid, currentBidder, reset timer |
| `lobby:timer_tick` | Update countdown + progress bar |
| `lobby:player_sold` | Show SOLD state, update squad + purse |
| `lobby:player_unsold` | Show UNSOLD state |
| `lobby:lucky_draw` | Show LuckyDraw overlay with contender seat IDs |
| `lobby:bot_thinking` | (Optional) subtle thinking indicator on bot's team card |
| `lobby:marquee_assigned` | Show marquee draw animation |
| `lobby:auction_complete` | Navigate to results screen |
| `lobby:error` | Toast/inline error message |

---

## Animations

| Animation | CSS keyframe | Usage |
|---|---|---|
| `pop-in` | scale(0.85)→scale(1.03)→scale(1), opacity 0→1 | New player card, sold/unsold reveal, lucky draw winner |
| `slide-up` | translateY(14px)→0, opacity 0→1 | Landing card, complete screen list items |
| `pulse` | opacity 1→0.45→1 | Lobby online dot, leading bid dot, low timer |
| `spin` | rotate(0→360deg), linear infinite | Lucky draw spinner |
| `marquee-reveal` | rotateY(90deg)→rotateY(-8deg)→rotateY(0) | Marquee card flip reveal |

---

## Currency Formatting

All prices in **NPR (Nepalese Rupees)**. Use the `रू` symbol prefix.

```typescript
const fmtNPR = (n: number): string => {
  if (n >= 100000) return `रू${(n / 100000).toFixed(1).replace('.0', '')}L`;
  return `रू${Math.round(n / 1000)}K`;
};
```

Bid increment: **NPR 25,000 minimum**.

---

## Files in This Bundle

| File | Purpose |
|---|---|
| `NPL Auction.html` | Full interactive prototype — all 4 screens in one file |
| `tweaks-panel.jsx` | Design tweaks panel helper (not for production) |
| `README.md` | This document |

Open `NPL Auction.html` in a browser to interact with the full prototype. The Tweaks panel (toolbar toggle) lets you switch between 5 color themes.
