import Link from "next/link";

export default function TermsPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        gap: 16,
      }}
    >
      <h1
        style={{
          fontFamily: "Rajdhani, sans-serif",
          fontWeight: 700,
          fontSize: 32,
          color: "var(--text)",
          letterSpacing: 2,
          margin: 0,
        }}
      >
        TERMS & CONDITIONS
      </h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>Coming soon.</p>
      <Link href="/" style={{ fontSize: 13, color: "var(--gold)", textDecoration: "none", marginTop: 8 }}>
        ← Back to home
      </Link>
    </div>
  );
}
