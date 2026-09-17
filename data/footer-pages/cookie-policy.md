# Cookie Policy

**Last Updated**: August 2026

## Overview

NPL Auction uses cookies and similar technologies to enhance your experience, maintain security, and understand how you use our platform. This Cookie Policy explains what cookies are, why we use them, and your choices regarding their use.

## What Are Cookies?

Cookies are small text files stored on your device (computer, tablet, or mobile phone) when you visit a website. They contain information that is sent back to the server on subsequent visits, allowing the website to recognize your device and personalize your experience.

## Types of Cookies We Use

### 1. Essential Cookies (Required)

These cookies are necessary for NPL Auction to function properly. You cannot opt out of these without disabling core features.

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `sessionToken` | Maintains your logged-in session | Session (until logout) |
| `authToken` | Stores JWT authentication token | 30 days |
| `__Host-authjs.*` | Auth.js session management | 30 days |
| `NEXT_LOCALE` | Stores your language preference | 1 year |

### 2. Functionality Cookies (Required for Features)

These cookies enable specific features and remember your preferences.

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `npl_guest_id` | Identifies guest sessions | Session or 30 days |
| `npl_guest_name` | Stores guest player display name | 30 days |
| `hasSeenLobbyTour` | Remembers if you've dismissed lobby tutorial | 1 year |
| `hasSeenAuctionTour` | Remembers if you've dismissed auction tutorial | 1 year |

### 3. Performance & Analytics Cookies (Optional)

These cookies help us understand how you use NPL Auction and improve performance.

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `_ga` | Google Analytics (if enabled) | 2 years |
| `_gid` | Google Analytics session ID | 24 hours |

**Note**: These are only set if you consent to analytics cookies.

### 4. Third-Party Cookies

**Google OAuth**:
- When you sign in with Google, Google sets cookies for authentication
- See [Google's Cookie Policy](https://policies.google.com/technologies/cookies) for details

**Resend (Email Provider)**:
- Email authentication may set cookies for session management
- See [Resend's Privacy Policy](https://resend.com/privacy) for details

## How We Use Cookies

### Authentication & Security
- Keep you logged in across sessions
- Prevent unauthorized access to your account
- Detect and prevent fraudulent activity

### User Experience
- Remember your display name and preferences
- Store whether you've dismissed tutorial overlays
- Maintain socket.io connection state during auctions

### Analytics & Improvement
- Track page visits and feature usage
- Measure performance metrics
- Understand which features are most popular
- Fix bugs and improve gameplay

### Personalization
- Remember your language preference
- Customize the auction interface
- Show relevant content based on your history

## Local Storage

In addition to cookies, we use browser **local storage** to store:

- `npl_guest_id` — Temporary identifier for guest players
- `npl_guest_name` — Display name for guest users
- `hasSeenLobbyTour` — Tour dismissal flag
- `hasSeenAuctionTour` — Tour dismissal flag

Local storage persists until you manually clear browser data and is **not sent to our servers** automatically (we read it client-side only).

## Your Cookie Choices

### Browser Settings

You can control cookies through your browser settings:

**Chrome**:
1. Click **Settings** → **Privacy and Security** → **Cookies and other site data**
2. Choose to block all cookies, third-party cookies, or specific sites

**Firefox**:
1. Click **Settings** → **Privacy & Security** → **Cookies and Site Data**
2. Choose your preference

**Safari**:
1. Click **Safari** → **Preferences** → **Privacy**
2. Manage cookie settings

**Edge**:
1. Click **Settings** → **Privacy, search, and services** → **Cookies**
2. Manage cookie settings

### Blocking Cookies

**Warning**: Blocking essential cookies will prevent NPL Auction from functioning properly. You will not be able to:
- Log in to your account
- Play auctions
- Save your preferences

We recommend allowing essential cookies (`sessionToken`, `authToken`) while opting out of analytics cookies if you prefer.

### Do Not Track (DNT)

If your browser sends a "Do Not Track" signal, NPL Auction respects this preference for analytics cookies. However, essential cookies required for authentication will still be used.

## Cookie Consent Banner

When you first visit NPL Auction, we display a cookie consent banner allowing you to:
- ✅ Accept all cookies
- ⚙️ Manage cookie preferences
- ❌ Decline non-essential cookies

You can update your preferences at any time by clicking **Manage Cookies** in the footer.

## Third-Party Cookie Partners

### Google Analytics (if enabled)
- **Purpose**: Track user behavior and platform usage
- **Policy**: [Google Analytics Privacy Policy](https://policies.google.com/privacy)
- **Opt-Out**: Use [Google Analytics Opt-Out Browser Add-on](https://tools.google.com/dlpage/gaoptout)

### Google OAuth
- **Purpose**: Secure sign-in and authentication
- **Policy**: [Google's Privacy Policy](https://policies.google.com/privacy)
- **Cookies**: `G_AUTHUSER_H`, `APISID`, `SAPISID`, and others

### Socket.io
- **Purpose**: Real-time auction communication
- **Cookies**: Session identifiers for WebSocket connections
- **Policy**: Inherits our privacy practices

## Cookie Retention

| Cookie Type | Retention Period | Notes |
|------------|-----------------|-------|
| Session cookies | Until logout | Automatically deleted when you close the session |
| Authentication cookies | 30 days | Allows you to stay logged in across visits |
| Preference cookies | 1 year | Remembers tour dismissals and language settings |
| Analytics cookies | 2 years | Used to track long-term trends |
| Guest session cookies | Session or 30 days | Deleted after session ends or after 30 days |

## Clearing Cookies & Data

### Clear Cookies Manually

**Chrome/Edge/Firefox**:
1. Press **Ctrl+Shift+Delete** (Windows) or **Cmd+Shift+Delete** (Mac)
2. Select **Cookies and other site data**
3. Click **Clear data**

**Safari**:
1. Click **Safari** → **Preferences** → **Privacy**
2. Click **Manage Website Data**
3. Select NPL Auction and click **Remove**

### Clear Local Storage

Open DevTools (`F12` or `Cmd+Option+J`) and run:
```javascript
localStorage.removeItem("npl_guest_id");
localStorage.removeItem("npl_guest_name");
localStorage.removeItem("hasSeenLobbyTour");
localStorage.removeItem("hasSeenAuctionTour");
```

## Updates to This Policy

We may update this Cookie Policy to reflect changes in our practices or legal requirements. Significant changes will be announced via email or on our website.

## Contact Us

For questions about our use of cookies:

- **Email**: cookies@nplaution.com
- **Privacy Page**: See our [Privacy Policy](/privacy-policy)

---

**By continuing to use NPL Auction, you consent to our use of cookies as described in this policy.**
