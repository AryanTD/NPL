import Link from "next/link";

const s = {
  back: { fontSize: 13, color: "var(--gold)", textDecoration: "none" as const, display: "inline-block" as const, marginBottom: 32 },
  title: { fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 34, color: "var(--text)", letterSpacing: 2, margin: "0 0 24px 0" },
  h2: { fontFamily: "Rajdhani, sans-serif", fontWeight: 600, fontSize: 19, color: "var(--text)", letterSpacing: 1, margin: "32px 0 12px 0", paddingTop: 24, borderTop: "1px solid var(--border)" },
  h3: { fontFamily: "Rajdhani, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--muted2)", letterSpacing: 0.5, margin: "18px 0 8px 0" },
  p: { fontSize: 14, color: "var(--muted2)", lineHeight: 1.75, margin: "0 0 12px 0" },
  li: { fontSize: 14, color: "var(--muted2)", lineHeight: 1.75, marginBottom: 6 },
  ul: { paddingLeft: 20, margin: "0 0 12px 0" },
  strong: { color: "var(--text)", fontWeight: 600 },
};

export default function InfoPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "60px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={s.back}>← Back to home</Link>

        <h1 style={s.title}>MORE INFORMATION</h1>

        <p style={s.p}>
          NPL Auction is a real-time multiplayer auction simulation game based on the Nepal Premier League (NPL),
          where cricket fans build and manage virtual NPL franchise rosters through competitive bidding.
        </p>

        <h2 style={s.h2}>HOW IT WORKS</h2>

        <h3 style={s.h3}>The Auction Experience</h3>
        <ol style={{ paddingLeft: 20, margin: "0 0 12px 0" }}>
          {[
            ["Join a Lobby", "Create or join a game lobby with up to 8 teams (human players or AI bots)"],
            ["Marquee Draw", "Randomly assigned marquee players to each franchise"],
            ["Live Auction", "Bid on real Nepali cricketers across three categories (A, B, C) in real-time"],
            ["Build Your Squad", "Assemble exactly 16 players per team: 1 Marquee, 10 auction players (3×A, 4×B, 3×C), 4 Overseas, 1 Iconic local"],
            ["Fantasy Scoring", "After the auction, your squad earns points based on actual NPL match results"],
          ].map(([title, desc], i) => (
            <li key={i} style={{ ...s.li, marginBottom: 10 }}>
              <strong style={s.strong}>{title}</strong> — {desc}
            </li>
          ))}
        </ol>

        <h2 style={s.h2}>GAME RULES</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Purse</strong> — Each franchise gets NPR 90 lakhs (9,000,000) to spend</li>
          <li style={s.li}>
            <strong style={s.strong}>Category Prices</strong>
            <ul style={{ paddingLeft: 18, marginTop: 6 }}>
              <li style={s.li}>Category A: Base 10L, Max 15L</li>
              <li style={s.li}>Category B: Base 5L, Max 10L</li>
              <li style={s.li}>Category C: Base 2L, Max 5L</li>
            </ul>
          </li>
          <li style={s.li}><strong style={s.strong}>Bid Increment</strong> — Minimum 25,000 NPR per bid</li>
          <li style={s.li}><strong style={s.strong}>Lucky Draw</strong> — If 2+ teams hit max price on a player, a lucky draw determines the winner</li>
        </ul>

        <h2 style={s.h2}>REAL PLAYERS, REAL DATA</h2>
        <p style={s.p}>
          All players are real Nepali cricketers from the Nepal Premier League 2024 season. Player stats include:
        </p>
        <ul style={s.ul}>
          {["Matches played", "Runs scored", "Wickets taken", "Batting average", "Strike rate", "Bowling average", "Economy rate", "Career highlights"].map((item) => (
            <li key={item} style={s.li}>{item}</li>
          ))}
        </ul>

        <h2 style={s.h2}>AI OPPONENTS</h2>
        <p style={s.p}>Play against intelligent AI bots with distinct personalities:</p>
        <ul style={s.ul}>
          {[
            ["AGGRESSIVE", "Takes risks, bids high on star players"],
            ["CONSERVATIVE", "Plays it safe, saves budget for endgame"],
            ["ROLE_HUNTER", "Targets specific player roles for squad synergy"],
            ["BUDGET_SNIPER", "Passes early categories, swoops with saved budget"],
            ["BALANCED", "Sensible manager with no extreme behavior"],
            ["AI Reasoner", "Uses Claude AI for contextual, intelligent decision-making"],
          ].map(([name, desc]) => (
            <li key={name} style={s.li}>
              <strong style={s.strong}>{name}</strong> — {desc}
            </li>
          ))}
        </ul>

        <h2 style={s.h2}>GUEST & SIGN-IN</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Play as Guest</strong> — No account needed, play immediately</li>
          <li style={s.li}><strong style={s.strong}>Sign In</strong> — Create an account with Google OAuth or email magic link to save your stats and compete on the leaderboard</li>
        </ul>

        <h2 style={s.h2}>CONTACT & SUPPORT</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Email</strong> — support@nplaution.com</li>
          <li style={s.li}><strong style={s.strong}>Twitter</strong> — @NPLAuction</li>
        </ul>

        <h2 style={s.h2}>RESPONSIBLE GAMING</h2>
        <p style={s.p}>
          NPL Auction is purely for entertainment and fantasy sports simulation. No real money is involved.
          Play responsibly and have fun building your dream squad!
        </p>
      </div>
    </div>
  );
}
