import Link from "next/link";

const s = {
  back: { fontSize: 13, color: "var(--gold)", textDecoration: "none" as const, display: "inline-block" as const, marginBottom: 32 },
  title: { fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 34, color: "var(--text)", letterSpacing: 2, margin: "0 0 6px 0" },
  meta: { fontSize: 13, color: "var(--muted)", marginBottom: 24 },
  intro: { fontSize: 14, color: "var(--muted2)", lineHeight: 1.75, margin: "0 0 12px 0" },
  h2: { fontFamily: "Rajdhani, sans-serif", fontWeight: 600, fontSize: 19, color: "var(--text)", letterSpacing: 1, margin: "32px 0 12px 0", paddingTop: 24, borderTop: "1px solid var(--border)" },
  h3: { fontFamily: "Rajdhani, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--muted2)", letterSpacing: 0.5, margin: "18px 0 8px 0" },
  p: { fontSize: 14, color: "var(--muted2)", lineHeight: 1.75, margin: "0 0 12px 0" },
  li: { fontSize: 14, color: "var(--muted2)", lineHeight: 1.75, marginBottom: 6 },
  ul: { paddingLeft: 20, margin: "0 0 12px 0" },
  strong: { color: "var(--text)", fontWeight: 600 },
  highlight: { background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 6, padding: "10px 14px", margin: "12px 0", fontSize: 14, color: "var(--text)", lineHeight: 1.7 },
  note: { fontSize: 13, color: "var(--muted)", fontStyle: "italic" as const, marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 20 },
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "60px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={s.back}>← Back to home</Link>

        <h1 style={s.title}>PRIVACY POLICY</h1>
        <p style={s.meta}>Last Updated: August 2026</p>

        <p style={s.intro}>
          NPL Auction ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy
          explains how we collect, use, disclose, and safeguard your information when you use our platform ("Service").
        </p>

        <h2 style={s.h2}>1. INFORMATION WE COLLECT</h2>

        <h3 style={s.h3}>1.1 Information You Provide Directly</h3>
        <p style={s.p}><strong style={s.strong}>Registration & Account Data:</strong></p>
        <ul style={s.ul}>
          {["Email address", "Full name (display name)", "Profile picture (via Google OAuth)", "Authentication provider information"].map((item) => <li key={item} style={s.li}>{item}</li>)}
        </ul>
        <p style={s.p}><strong style={s.strong}>Gameplay Data:</strong></p>
        <ul style={s.ul}>
          {["Auction history and bid records", "Squad composition and player selections", "Game statistics (wins, average bid price, etc.)", "Timestamps of all actions", "IP address and device information"].map((item) => <li key={item} style={s.li}>{item}</li>)}
        </ul>

        <h3 style={s.h3}>1.2 Information Collected Automatically</h3>
        <ul style={s.ul}>
          {["Browser type and version", "Operating system", "Pages visited and time spent", "Cookies and local storage data", "Server logs and API metrics"].map((item) => <li key={item} style={s.li}>{item}</li>)}
        </ul>

        <h3 style={s.h3}>1.3 Guest Users</h3>
        <p style={s.p}>
          Guest users can play without creating an account. We collect session-specific gameplay data and temporary
          device identifiers (stored in localStorage). Guest data is <strong style={s.strong}>not retained</strong> after
          the session ends and is <strong style={s.strong}>not linked to any personal identity</strong>.
        </p>

        <h2 style={s.h2}>2. HOW WE USE YOUR INFORMATION</h2>
        <ul style={s.ul}>
          {[
            ["Service Delivery", "Running auctions, managing accounts, processing bids"],
            ["Personalization", "Remembering your preferences, display name, game history"],
            ["Analytics", "Understanding user behavior, improving gameplay"],
            ["Security", "Detecting fraud, enforcing Terms & Conditions"],
            ["Communication", "Sending account updates, bug fixes, new features (opt-in)"],
            ["Leaderboards", "Displaying your stats and rankings (if signed in)"],
            ["Research", "Improving AI bot behavior and game balance (anonymized data only)"],
          ].map(([key, val]) => <li key={key} style={s.li}><strong style={s.strong}>{key}</strong> — {val}</li>)}
        </ul>

        <h2 style={s.h2}>3. DATA SHARING & DISCLOSURE</h2>

        <h3 style={s.h3}>3.1 Third-Party Services</h3>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Google OAuth</strong> — Handles sign-in; we receive your name and profile picture</li>
          <li style={s.li}><strong style={s.strong}>Resend</strong> — Manages email-based magic link authentication</li>
          <li style={s.li}><strong style={s.strong}>Neon PostgreSQL</strong> — Hosts our database (ISO 27001 certified)</li>
          <li style={s.li}><strong style={s.strong}>Render</strong> — Hosts our server (SOC 2 compliant)</li>
          <li style={s.li}><strong style={s.strong}>Vercel</strong> — Hosts our frontend (enterprise-grade security)</li>
        </ul>

        <h3 style={s.h3}>3.2 Legal Requirements</h3>
        <p style={s.p}>We may disclose your information if required by law: court orders or subpoenas, government requests, or protection of safety or legal rights.</p>

        <h3 style={s.h3}>3.3 Business Transfers</h3>
        <p style={s.p}>If NPL Auction is acquired or merged, your data may be transferred as part of that transaction. We will notify you of any such change.</p>

        <div style={s.highlight}>
          <strong>We do not sell, rent, or lease your personal information to third parties for marketing purposes.</strong>
        </div>

        <h2 style={s.h2}>4. DATA SECURITY</h2>
        <ul style={s.ul}>
          {[
            ["Encryption", "Data in transit (HTTPS/TLS) and at rest (PostgreSQL encryption)"],
            ["Authentication", "OAuth 2.0 with secure session management"],
            ["Access Control", "Role-based access, limited employee access"],
            ["Regular Audits", "Security reviews and penetration testing"],
            ["Incident Response", "Procedures in place for data breach notification"],
          ].map(([key, val]) => <li key={key} style={s.li}><strong style={s.strong}>{key}</strong> — {val}</li>)}
        </ul>
        <p style={s.p}>No security system is 100% secure. We cannot guarantee absolute security of your data.</p>

        <h2 style={s.h2}>5. DATA RETENTION</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Signed-in Users</strong> — Account data retained until you delete your account</li>
          <li style={s.li}><strong style={s.strong}>Guest Users</strong> — Session data deleted immediately after logout</li>
          <li style={s.li}><strong style={s.strong}>Audit Logs</strong> — Server logs retained for 90 days for security purposes</li>
          <li style={s.li}><strong style={s.strong}>Deleted Accounts</strong> — Personal data deleted within 30 days; gameplay statistics may be retained in anonymized form</li>
        </ul>

        <h2 style={s.h2}>6. YOUR RIGHTS</h2>
        <p style={s.p}>Depending on your location, you may have rights including:</p>
        <ul style={s.ul}>
          {[
            ["Access", "Request a copy of your personal data"],
            ["Correction", "Update or correct inaccurate information"],
            ["Deletion", "Request deletion of your account and data (right to be forgotten)"],
            ["Portability", "Request your data in a portable format"],
            ["Opt-Out", "Opt out of non-essential communications"],
          ].map(([key, val]) => <li key={key} style={s.li}><strong style={s.strong}>{key}</strong> — {val}</li>)}
        </ul>
        <p style={s.p}>To exercise these rights, contact us at <strong style={s.strong}>privacy@nplaution.com</strong>.</p>

        <h2 style={s.h2}>7. COOKIES & LOCAL STORAGE</h2>
        <p style={s.p}>We use cookies for session management, authentication, and preferences. We store in browser local storage: guest identity (guest ID and display name) and tutorial dismissal flags. You can clear local storage at any time through browser settings.</p>
        <p style={s.p}>See our <Link href="/cookies" style={{ color: "var(--gold)", textDecoration: "none" }}>Cookie Policy</Link> for full details.</p>

        <h2 style={s.h2}>8. CHILDREN'S PRIVACY</h2>
        <p style={s.p}>
          NPL Auction is not intended for children under 13. We do not knowingly collect personal information from
          children under 13. If we become aware of such collection, we will delete the information promptly.
        </p>

        <h2 style={s.h2}>9. INTERNATIONAL DATA TRANSFERS</h2>
        <p style={s.p}>
          Our servers are hosted in the United States (Render) and Europe (Neon). By using NPL Auction, you consent
          to the transfer of your information outside your country of residence.
        </p>

        <h2 style={s.h2}>10. UPDATES TO PRIVACY POLICY</h2>
        <p style={s.p}>
          We may update this Privacy Policy to reflect changes in our practices or legal requirements. We will notify
          you of significant changes via email or by posting the updated policy on our website.
        </p>

        <h2 style={s.h2}>11. CONTACT US</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Email</strong> — privacy@nplaution.com</li>
          <li style={s.li}><strong style={s.strong}>Mailing Address</strong> — Kathmandu, Nepal</li>
          <li style={s.li}><strong style={s.strong}>Response Time</strong> — We aim to respond within 10 business days</li>
        </ul>

        <p style={s.note}>
          By using NPL Auction, you acknowledge that you have read and understood this Privacy Policy and consent
          to our collection and use of your information as described.
        </p>
      </div>
    </div>
  );
}
