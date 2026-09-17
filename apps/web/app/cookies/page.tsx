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
  ol: { paddingLeft: 20, margin: "0 0 12px 0" },
  strong: { color: "var(--text)", fontWeight: 600 },
  note: { fontSize: 13, color: "var(--muted)", fontStyle: "italic" as const, marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 20 },
};

function CookieRow({ name, purpose, duration }: { name: string; purpose: string; duration: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr 1fr",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
        color: "var(--muted2)",
      }}
    >
      <code style={{ color: "var(--gold)", fontFamily: "monospace", fontSize: 12 }}>{name}</code>
      <span>{purpose}</span>
      <span style={{ color: "var(--muted)", textAlign: "right" as const }}>{duration}</span>
    </div>
  );
}

function CookieTableHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr 1fr",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--border2)",
        fontSize: 11,
        color: "var(--muted)",
        letterSpacing: 0.5,
        textTransform: "uppercase" as const,
        fontFamily: "Rajdhani, sans-serif",
        fontWeight: 600,
        marginBottom: 4,
      }}
    >
      <span>Cookie</span>
      <span>Purpose</span>
      <span style={{ textAlign: "right" as const }}>Duration</span>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "60px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" style={s.back}>← Back to home</Link>

        <h1 style={s.title}>COOKIE POLICY</h1>
        <p style={s.meta}>Last Updated: August 2026</p>

        <p style={s.intro}>
          NPL Auction uses cookies and similar technologies to enhance your experience, maintain security, and
          understand how you use our platform. This Cookie Policy explains what cookies are, why we use them,
          and your choices regarding their use.
        </p>

        <h2 style={s.h2}>WHAT ARE COOKIES?</h2>
        <p style={s.p}>
          Cookies are small text files stored on your device when you visit a website. They contain information
          that is sent back to the server on subsequent visits, allowing the website to recognize your device
          and personalize your experience.
        </p>

        <h2 style={s.h2}>TYPES OF COOKIES WE USE</h2>

        <h3 style={s.h3}>1. Essential Cookies (Required)</h3>
        <p style={s.p}>
          These cookies are necessary for NPL Auction to function properly. You cannot opt out of these without
          disabling core features.
        </p>
        <CookieTableHeader />
        <CookieRow name="sessionToken" purpose="Maintains your logged-in session" duration="Session" />
        <CookieRow name="authToken" purpose="Stores JWT authentication token" duration="30 days" />
        <CookieRow name="__Host-authjs.*" purpose="Auth.js session management" duration="30 days" />
        <CookieRow name="NEXT_LOCALE" purpose="Stores your language preference" duration="1 year" />

        <h3 style={{ ...s.h3, marginTop: 24 }}>2. Functionality Cookies</h3>
        <p style={s.p}>These cookies enable specific features and remember your preferences.</p>
        <CookieTableHeader />
        <CookieRow name="npl_guest_id" purpose="Identifies guest sessions" duration="Session / 30 days" />
        <CookieRow name="npl_guest_name" purpose="Stores guest player display name" duration="30 days" />
        <CookieRow name="hasSeenLobbyTour" purpose="Remembers lobby tutorial dismissal" duration="1 year" />
        <CookieRow name="hasSeenAuctionTour" purpose="Remembers auction tutorial dismissal" duration="1 year" />

        <h3 style={{ ...s.h3, marginTop: 24 }}>3. Performance & Analytics Cookies (Optional)</h3>
        <p style={s.p}>These cookies help us understand how you use NPL Auction and improve performance. They are only set if you consent to analytics cookies.</p>
        <CookieTableHeader />
        <CookieRow name="_ga" purpose="Google Analytics (if enabled)" duration="2 years" />
        <CookieRow name="_gid" purpose="Google Analytics session ID" duration="24 hours" />

        <h3 style={{ ...s.h3, marginTop: 24 }}>4. Third-Party Cookies</h3>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Google OAuth</strong> — When you sign in with Google, Google sets cookies for authentication. See Google's Cookie Policy for details.</li>
          <li style={s.li}><strong style={s.strong}>Resend (Email Provider)</strong> — Email authentication may set cookies for session management. See Resend's Privacy Policy for details.</li>
        </ul>

        <h2 style={s.h2}>LOCAL STORAGE</h2>
        <p style={s.p}>
          In addition to cookies, we use browser local storage to store:
        </p>
        <ul style={s.ul}>
          <li style={s.li}><code style={{ color: "var(--gold)", fontSize: 12 }}>npl_guest_id</code> — Temporary identifier for guest players</li>
          <li style={s.li}><code style={{ color: "var(--gold)", fontSize: 12 }}>npl_guest_name</code> — Display name for guest users</li>
          <li style={s.li}><code style={{ color: "var(--gold)", fontSize: 12 }}>hasSeenLobbyTour</code> — Tour dismissal flag</li>
          <li style={s.li}><code style={{ color: "var(--gold)", fontSize: 12 }}>hasSeenAuctionTour</code> — Tour dismissal flag</li>
        </ul>
        <p style={s.p}>Local storage is <strong style={s.strong}>not sent to our servers</strong> automatically — we read it client-side only.</p>

        <h2 style={s.h2}>YOUR COOKIE CHOICES</h2>

        <h3 style={s.h3}>Browser Settings</h3>
        <p style={s.p}>You can control cookies through your browser settings:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Chrome</strong> — Settings → Privacy and Security → Cookies and other site data</li>
          <li style={s.li}><strong style={s.strong}>Firefox</strong> — Settings → Privacy & Security → Cookies and Site Data</li>
          <li style={s.li}><strong style={s.strong}>Safari</strong> — Safari → Preferences → Privacy</li>
          <li style={s.li}><strong style={s.strong}>Edge</strong> — Settings → Privacy, search, and services → Cookies</li>
        </ul>

        <h3 style={s.h3}>Blocking Cookies</h3>
        <p style={s.p}>
          <strong style={s.strong}>Warning:</strong> Blocking essential cookies will prevent NPL Auction from
          functioning properly — you will not be able to log in, play auctions, or save your preferences. We recommend
          allowing essential cookies while opting out of analytics cookies if you prefer.
        </p>

        <h3 style={s.h3}>Do Not Track (DNT)</h3>
        <p style={s.p}>
          If your browser sends a "Do Not Track" signal, NPL Auction respects this preference for analytics cookies.
          Essential cookies required for authentication will still be used.
        </p>

        <h2 style={s.h2}>CLEARING COOKIES & DATA</h2>
        <p style={s.p}>To clear cookies, press <strong style={s.strong}>Ctrl+Shift+Delete</strong> (Windows) or <strong style={s.strong}>Cmd+Shift+Delete</strong> (Mac) in your browser and select "Cookies and other site data."</p>
        <p style={s.p}>To clear local storage, open DevTools (F12) and run:</p>
        <div
          style={{
            background: "var(--s2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "12px 16px",
            margin: "0 0 12px 0",
            fontFamily: "monospace",
            fontSize: 12,
            color: "var(--gold)",
            overflowX: "auto" as const,
          }}
        >
          {`localStorage.removeItem("npl_guest_id");\nlocalStorage.removeItem("npl_guest_name");\nlocalStorage.removeItem("hasSeenLobbyTour");\nlocalStorage.removeItem("hasSeenAuctionTour");`}
        </div>

        <h2 style={s.h2}>COOKIE RETENTION</h2>
        <CookieTableHeader />
        <CookieRow name="Session cookies" purpose="Until logout — automatically deleted when you close the session" duration="Session" />
        <CookieRow name="Authentication" purpose="Allows you to stay logged in across visits" duration="30 days" />
        <CookieRow name="Preference cookies" purpose="Remembers tour dismissals and language settings" duration="1 year" />
        <CookieRow name="Analytics cookies" purpose="Used to track long-term trends" duration="2 years" />
        <CookieRow name="Guest session" purpose="Deleted after session ends or after 30 days" duration="Session / 30 days" />

        <h2 style={s.h2}>UPDATES TO THIS POLICY</h2>
        <p style={s.p}>
          We may update this Cookie Policy to reflect changes in our practices or legal requirements. Significant
          changes will be announced via email or on our website.
        </p>

        <h2 style={s.h2}>CONTACT US</h2>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Email</strong> — cookies@nplaution.com</li>
          <li style={s.li}><strong style={s.strong}>Privacy Page</strong> — <Link href="/privacy" style={{ color: "var(--gold)", textDecoration: "none" }}>See our Privacy Policy</Link></li>
        </ul>

        <p style={s.note}>
          By continuing to use NPL Auction, you consent to our use of cookies as described in this policy.
        </p>
      </div>
    </div>
  );
}
