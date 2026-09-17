import Link from "next/link";

const s = {
  back: { fontSize: 13, color: "var(--gold)", textDecoration: "none" as const, display: "inline-block" as const, marginBottom: 32 },
  title: { fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 34, color: "var(--text)", letterSpacing: 2, margin: "0 0 6px 0" },
  meta: { fontSize: 13, color: "var(--muted)", marginBottom: 24 },
  intro: { fontSize: 14, color: "var(--muted2)", lineHeight: 1.75, margin: "0 0 12px 0" },
  h2: { fontFamily: "Rajdhani, sans-serif", fontWeight: 600, fontSize: 19, color: "var(--text)", letterSpacing: 1, margin: "32px 0 12px 0", paddingTop: 24, borderTop: "1px solid var(--border)" },
  p: { fontSize: 14, color: "var(--muted2)", lineHeight: 1.75, margin: "0 0 12px 0" },
  li: { fontSize: 14, color: "var(--muted2)", lineHeight: 1.75, marginBottom: 6 },
  ul: { paddingLeft: 20, margin: "0 0 12px 0" },
  strong: { color: "var(--text)", fontWeight: 600 },
  note: { fontSize: 13, color: "var(--muted)", fontStyle: "italic" as const, marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 20 },
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "60px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={s.back}>← Back to home</Link>

        <h1 style={s.title}>TERMS & CONDITIONS</h1>
        <p style={s.meta}>Last Updated: August 2026</p>

        <p style={s.intro}>
          These Terms and Conditions ("Terms") govern your use of the NPL Auction platform ("Service") operated by
          NPL Auction ("we," "us," "our," or "Company"). By accessing and using NPL Auction, you agree to be bound
          by these Terms. If you do not agree with any part of these Terms, please do not use our Service.
        </p>

        <h2 style={s.h2}>1. USE LICENSE</h2>
        <p style={s.p}>
          Permission is granted to temporarily download one copy of the materials on NPL Auction for personal,
          non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and
          under this license you may not:
        </p>
        <ul style={s.ul}>
          {[
            "Modify or copy the materials",
            "Use the materials for any commercial purpose or for any public display",
            "Attempt to reverse engineer, disassemble, or decode any software on NPL Auction",
            "Remove any copyright or other proprietary notations from the materials",
            "Transfer the materials to another person or \"mirror\" the materials on any other server",
          ].map((item) => <li key={item} style={s.li}>{item}</li>)}
        </ul>
        <p style={s.p}>
          This license shall automatically terminate if you violate any of these restrictions and may be terminated
          by NPL Auction at any time.
        </p>

        <h2 style={s.h2}>2. USER ACCOUNTS</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Age Requirement</strong> — You must be at least 13 years old to use NPL Auction</li>
          <li style={s.li}><strong style={s.strong}>Account Responsibility</strong> — You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account</li>
          <li style={s.li}><strong style={s.strong}>Accuracy</strong> — You agree to provide accurate, current, and complete information during registration</li>
          <li style={s.li}><strong style={s.strong}>Account Termination</strong> — We reserve the right to suspend or terminate accounts that violate these Terms</li>
        </ul>

        <h2 style={s.h2}>3. GUEST & REGISTERED USERS</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Guest Play</strong> — Guest players can participate in auctions without creating an account. Guest data is not retained after the session ends</li>
          <li style={s.li}><strong style={s.strong}>Registered Users</strong> — Creating an account allows you to track statistics and compete on leaderboards. Your data is retained according to our Privacy Policy</li>
          <li style={s.li}><strong style={s.strong}>Authentication</strong> — We use Google OAuth and email-based authentication to verify your identity</li>
        </ul>

        <h2 style={s.h2}>4. GAMEPLAY & RULES</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Fair Play</strong> — You agree not to engage in cheating, exploiting bugs, or using unauthorized tools or scripts</li>
          <li style={s.li}><strong style={s.strong}>Auction Integrity</strong> — All bids and transactions are final once confirmed by the server</li>
          <li style={s.li}><strong style={s.strong}>AI Opponents</strong> — AI bots are simulated players with distinct personalities. Their decisions are made algorithmically and may not always be predictable</li>
          <li style={s.li}><strong style={s.strong}>Technical Issues</strong> — While we strive for reliability, we do not guarantee uninterrupted service. Technical issues, server maintenance, or network problems may affect gameplay</li>
        </ul>

        <h2 style={s.h2}>5. INTELLECTUAL PROPERTY</h2>
        <p style={s.p}>
          All content on NPL Auction, including logos, graphics, player data, and game mechanics, is the property of
          NPL Auction or its content suppliers. Player statistics are sourced from the Nepal Premier League and are
          used for entertainment and educational purposes.
        </p>

        <h2 style={s.h2}>6. LIMITATION OF LIABILITY</h2>
        <p style={s.p}>
          To the fullest extent permitted by law, NPL Auction shall not be liable for:
        </p>
        <ul style={s.ul}>
          {[
            "Direct, indirect, incidental, special, consequential, or punitive damages",
            "Loss of data, revenue, or profits",
            "Service interruptions or technical failures",
            "Third-party claims or actions",
          ].map((item) => <li key={item} style={s.li}>{item}</li>)}
        </ul>
        <p style={s.p}>This limitation applies even if NPL Auction has been advised of the possibility of such damages.</p>

        <h2 style={s.h2}>7. INDEMNIFICATION</h2>
        <p style={s.p}>
          You agree to indemnify, defend, and hold harmless NPL Auction and its officers, directors, employees, and
          agents from any claims, damages, or costs arising from your violation of these Terms, misuse of the Service,
          violation of any laws or regulations, or infringement of third-party rights by your actions.
        </p>

        <h2 style={s.h2}>8. DISCLAIMER OF WARRANTIES</h2>
        <p style={s.p}>
          NPL Auction is provided on an "AS-IS" and "AS-AVAILABLE" basis. We make no warranties, express or implied,
          regarding accuracy of player data or game results, uninterrupted or error-free service, or fitness for a
          particular purpose.
        </p>

        <h2 style={s.h2}>9. THIRD-PARTY SERVICES</h2>
        <p style={s.p}>
          NPL Auction uses third-party services including Google OAuth, Resend (email), and cloud hosting providers.
          Your use of these services is governed by their respective terms of service and privacy policies.
        </p>

        <h2 style={s.h2}>10. MODIFICATION OF TERMS</h2>
        <p style={s.p}>
          We reserve the right to modify these Terms at any time. Changes will be effective upon posting to this page.
          Your continued use of NPL Auction following the posting of revised Terms means you accept and agree to the changes.
        </p>

        <h2 style={s.h2}>11. GOVERNING LAW</h2>
        <p style={s.p}>
          These Terms are governed by and construed in accordance with the laws of Nepal, and you irrevocably submit
          to the exclusive jurisdiction of the courts in Kathmandu, Nepal.
        </p>

        <h2 style={s.h2}>12. CONTACT US</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Email</strong> — legal@nplaution.com</li>
          <li style={s.li}><strong style={s.strong}>Address</strong> — Kathmandu, Nepal</li>
        </ul>

        <p style={s.note}>
          By using NPL Auction, you acknowledge that you have read, understood, and agree to be bound by these
          Terms and Conditions.
        </p>
      </div>
    </div>
  );
}
