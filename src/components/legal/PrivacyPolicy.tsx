const EFFECTIVE_DATE = '23 March 2026'

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  } as React.CSSProperties,

  topBar: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '0 24px',
    height: 56,
  } as React.CSSProperties,

  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    color: 'var(--text-secondary)',
    padding: 0,
  } as React.CSSProperties,

  title: {
    fontFamily: 'var(--font-ui)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  } as React.CSSProperties,

  prose: {
    maxWidth: 680,
    margin: '0 auto',
    padding: '40px 24px 80px',
  } as React.CSSProperties,

  h1: {
    fontFamily: 'var(--font-display)',
    fontSize: 32,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  } as React.CSSProperties,

  dateBadge: {
    display: 'inline-block',
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    color: 'var(--text-tertiary)',
    margin: '0 0 40px',
  } as React.CSSProperties,

  h2: {
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    margin: '40px 0 12px',
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
  } as React.CSSProperties,

  p: {
    fontFamily: 'var(--font-reading)',
    fontSize: 15,
    lineHeight: 1.75,
    color: 'var(--text-secondary)',
    margin: '0 0 14px',
  } as React.CSSProperties,

  ul: {
    fontFamily: 'var(--font-reading)',
    fontSize: 15,
    lineHeight: 1.75,
    color: 'var(--text-secondary)',
    margin: '0 0 14px',
    paddingLeft: 22,
  } as React.CSSProperties,

  li: {
    marginBottom: 4,
  } as React.CSSProperties,

  strong: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    margin: '0 0 20px',
  } as React.CSSProperties,

  th: {
    textAlign: 'left' as const,
    fontWeight: 600,
    color: 'var(--text-primary)',
    padding: '8px 12px',
    borderBottom: '2px solid var(--border)',
  } as React.CSSProperties,

  td: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,

  link: {
    color: 'var(--accent-warm)',
    textDecoration: 'none',
  } as React.CSSProperties,
}

interface PrivacyPolicyProps {
  onBack: () => void
}

export default function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={onBack} aria-label="Go back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>
        <span style={s.title}>Privacy Policy</span>
      </div>

      <div style={s.prose}>
        <h1 style={s.h1}>Privacy Policy</h1>
        <span style={s.dateBadge}>Effective date: {EFFECTIVE_DATE}</span>

        {/* 1. Who we are */}
        <h2 style={s.h2}>1. Who we are</h2>
        <p style={s.p}>
          Loci ("we", "us", "our") operates the Loci reading application available at loci.app.
          We are the data controller for personal data processed through the Service. If you have
          any questions about this policy or your data, contact us at{' '}
          <a href="mailto:hello@loci.app" style={s.link}>hello@loci.app</a>.
        </p>

        {/* 2. Data we collect */}
        <h2 style={s.h2}>2. Data we collect</h2>

        <p style={s.p}><strong style={s.strong}>a) Account data (via Clerk)</strong></p>
        <p style={s.p}>
          When you create an account, we collect your email address, display name, and profile
          photo (if provided). This data is managed by our authentication provider, Clerk, on our
          behalf.
        </p>

        <p style={s.p}><strong style={s.strong}>b) Content you upload</strong></p>
        <p style={s.p}>
          EPUB files you upload are stored securely in cloud storage under your unique user ID.
          Cover images extracted from your books are also stored and served via CDN. We do not
          access the content of your books except where required for security or legal obligations.
        </p>

        <p style={s.p}><strong style={s.strong}>c) Reading and study data</strong></p>
        <p style={s.p}>
          To provide a seamless reading experience, we store:
        </p>
        <ul style={s.ul}>
          <li style={s.li}>Reading progress (current chapter, scroll position, TTS sentence position, total reading time)</li>
          <li style={s.li}>Annotations you create (highlighted text and optional notes)</li>
          <li style={s.li}>Bookmarks, flashcards, scratchpad notes, and quiz session results</li>
          <li style={s.li}>Reader preferences (theme, font size, layout mode, voice selection)</li>
        </ul>

        <p style={s.p}><strong style={s.strong}>d) Data transmitted to third-party AI and TTS services</strong></p>
        <p style={s.p}>
          When you use AI narration (ElevenLabs), sentence-length text chunks from your current
          page are sent to ElevenLabs to generate audio. When you use AI Study features
          (quizzes, summaries, flashcard generation), the current chapter text and any notes or
          annotations you have created are sent to an AI provider (Anthropic Claude or Google
          Gemini) via a secure server-side function.
        </p>

        <p style={s.p}><strong style={s.strong}>e) Browser local storage</strong></p>
        <p style={s.p}>
          We store a copy of your preferences and recent annotations in your browser's local
          storage to enable fast, offline-capable access. We also store small flags to track
          whether you have completed the onboarding tour. This data stays on your device and is
          not sent to any server independently.
        </p>

        {/* 3. How we use it */}
        <h2 style={s.h2}>3. How we use your data</h2>
        <p style={s.p}>
          We use your data solely to provide and improve the Loci Service — including syncing your
          library across devices, enabling AI narration, and powering the study tools. We do not
          profile you for advertising, sell your data to third parties, or use your data for any
          purpose unrelated to delivering the Service.
        </p>

        {/* 4. Sub-processors */}
        <h2 style={s.h2}>4. Sub-processors (who we share data with)</h2>
        <p style={s.p}>
          We work with the following third-party processors. Each receives only the data necessary
          to perform their specific function:
        </p>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Provider</th>
              <th style={s.th}>Purpose</th>
              <th style={s.th}>Country</th>
              <th style={s.th}>Privacy policy</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={s.td}>Clerk</td>
              <td style={s.td}>Authentication &amp; account management</td>
              <td style={s.td}>US</td>
              <td style={s.td}><a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" style={s.link}>clerk.com/privacy</a></td>
            </tr>
            <tr>
              <td style={s.td}>Supabase</td>
              <td style={s.td}>Database &amp; file storage</td>
              <td style={s.td}>US</td>
              <td style={s.td}><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={s.link}>supabase.com/privacy</a></td>
            </tr>
            <tr>
              <td style={s.td}>ElevenLabs</td>
              <td style={s.td}>AI narration (when enabled)</td>
              <td style={s.td}>US</td>
              <td style={s.td}><a href="https://elevenlabs.io/privacy" target="_blank" rel="noopener noreferrer" style={s.link}>elevenlabs.io/privacy</a></td>
            </tr>
            <tr>
              <td style={s.td}>Anthropic</td>
              <td style={s.td}>AI study features (Claude)</td>
              <td style={s.td}>US</td>
              <td style={s.td}><a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={s.link}>anthropic.com/privacy</a></td>
            </tr>
            <tr>
              <td style={s.td}>Google</td>
              <td style={s.td}>AI study features (Gemini, alternative)</td>
              <td style={s.td}>US</td>
              <td style={s.td}><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={s.link}>policies.google.com/privacy</a></td>
            </tr>
            <tr>
              <td style={s.td}>Stripe</td>
              <td style={s.td}>Payment processing (where applicable)</td>
              <td style={s.td}>US</td>
              <td style={s.td}><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={s.link}>stripe.com/privacy</a></td>
            </tr>
          </tbody>
        </table>

        {/* 5. International transfers */}
        <h2 style={s.h2}>5. International data transfers</h2>
        <p style={s.p}>
          All sub-processors listed above are based in the United States. Transfers of personal
          data outside the UK are protected by Standard Contractual Clauses (SCCs) approved by
          the Information Commissioner's Office, or by the UK Extension to the EU–US Data Privacy
          Framework where applicable.
        </p>

        {/* 6. Data retention */}
        <h2 style={s.h2}>6. Data retention</h2>
        <p style={s.p}>
          We retain your account and reading data for as long as your account remains active. If
          you delete your account, all associated data is permanently removed from our servers
          within 30 days. Local storage data (in your browser) persists until you clear your
          browser storage or delete your account through the app, which clears it automatically.
        </p>

        {/* 7. Security */}
        <h2 style={s.h2}>7. Security</h2>
        <p style={s.p}>
          We take reasonable measures to protect your data:
        </p>
        <ul style={s.ul}>
          <li style={s.li}>All Supabase database tables use Row-Level Security (RLS) — each user can only access their own data</li>
          <li style={s.li}>Authentication is handled via cryptographically signed JWTs (Clerk)</li>
          <li style={s.li}>All data in transit is encrypted via HTTPS</li>
          <li style={s.li}>EPUB files are stored in a private storage bucket — not publicly accessible</li>
        </ul>
        <p style={s.p}>
          No system is completely secure. If you believe your account has been compromised, please
          contact us at hello@loci.app immediately.
        </p>

        {/* 8. Your rights */}
        <h2 style={s.h2}>8. Your rights under UK GDPR</h2>
        <p style={s.p}>
          As a UK resident, you have the following rights over your personal data:
        </p>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Access</strong> — request a copy of the personal data we hold about you</li>
          <li style={s.li}><strong style={s.strong}>Rectification</strong> — ask us to correct inaccurate data</li>
          <li style={s.li}><strong style={s.strong}>Erasure</strong> — delete your account and all associated data directly in the app, or by emailing us</li>
          <li style={s.li}><strong style={s.strong}>Portability</strong> — request your data in a machine-readable format by emailing hello@loci.app</li>
          <li style={s.li}><strong style={s.strong}>Restriction</strong> — ask us to restrict processing of your data in certain circumstances</li>
          <li style={s.li}><strong style={s.strong}>Objection</strong> — object to processing based on legitimate interests</li>
        </ul>
        <p style={s.p}>
          To exercise any of these rights, email{' '}
          <a href="mailto:hello@loci.app" style={s.link}>hello@loci.app</a>. We will respond
          within 30 days. You also have the right to lodge a complaint with the{' '}
          <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={s.link}>
            Information Commissioner's Office (ICO)
          </a>.
        </p>

        {/* 9. Cookies & local storage */}
        <h2 style={s.h2}>9. Cookies and local storage</h2>
        <p style={s.p}>
          Clerk sets session cookies strictly necessary for authentication. These are not
          advertising cookies and cannot be disabled without logging out. Loci uses browser
          local storage to cache preferences and annotations — this is functional, not
          behavioural. We do not use any third-party advertising or tracking cookies.
        </p>

        {/* 10. Children */}
        <h2 style={s.h2}>10. Children</h2>
        <p style={s.p}>
          Loci is not directed at users under the age of 13. We do not knowingly collect personal
          data from children. If you believe a child has created an account, please contact us at{' '}
          <a href="mailto:hello@loci.app" style={s.link}>hello@loci.app</a> and we will remove it
          promptly.
        </p>

        {/* 11. Changes */}
        <h2 style={s.h2}>11. Changes to this policy</h2>
        <p style={s.p}>
          We may update this Privacy Policy from time to time. Material changes will be announced
          within the app before they take effect. The effective date at the top of this page
          always reflects the most recent version. Continued use of the Service after the
          effective date constitutes your acceptance of the revised policy.
        </p>

        {/* 12. Contact */}
        <h2 style={s.h2}>12. Contact</h2>
        <p style={s.p}>
          For any privacy-related queries, requests, or complaints, contact Loci at:{' '}
          <a href="mailto:hello@loci.app" style={s.link}>hello@loci.app</a>
        </p>
      </div>
    </div>
  )
}
