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

  link: {
    color: 'var(--accent-warm)',
    textDecoration: 'none',
  } as React.CSSProperties,

  notice: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '14px 18px',
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: '0 0 20px',
    lineHeight: 1.6,
  } as React.CSSProperties,
}

interface TermsOfServiceProps {
  onBack: () => void
}

export default function TermsOfService({ onBack }: TermsOfServiceProps) {
  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={onBack} aria-label="Go back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>
        <span style={s.title}>Terms of Service</span>
      </div>

      <div style={s.prose}>
        <h1 style={s.h1}>Terms of Service</h1>
        <span style={s.dateBadge}>Effective date: {EFFECTIVE_DATE}</span>

        <div style={s.notice}>
          Please read these Terms carefully before using Loci. By creating an account or using the
          Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
        </div>

        {/* 1. Service description */}
        <h2 style={s.h2}>1. About Loci</h2>
        <p style={s.p}>
          Loci is a personal e-reading application that lets you upload, read, and annotate EPUB
          files; listen to AI-generated narration; and use AI-powered tools to study your books.
          Loci does not provide, sell, or license any reading content — all books in your library
          are uploaded by you.
        </p>
        <p style={s.p}>
          The Service is operated by Loci. Questions about these Terms should be directed to{' '}
          <a href="mailto:hello@loci.app" style={s.link}>hello@loci.app</a>.
        </p>

        {/* 2. Accounts */}
        <h2 style={s.h2}>2. Your account</h2>
        <p style={s.p}>
          Accounts are managed by Clerk, our authentication provider. When you create an account
          you must provide accurate information and keep your login credentials secure. You are
          responsible for all activity that occurs under your account.
        </p>
        <ul style={s.ul}>
          <li style={s.li}>You must be at least 13 years old to use Loci</li>
          <li style={s.li}>One account per person — account sharing is not permitted</li>
          <li style={s.li}>Notify us immediately at hello@loci.app if you suspect unauthorised access</li>
        </ul>

        {/* 3. Your content */}
        <h2 style={s.h2}>3. Your content and copyright</h2>
        <p style={s.p}>
          You may only upload EPUB files that you own or have the legal right to use (for
          example, files purchased from a retailer that permits personal use, or DRM-free books
          you have acquired lawfully). Uploading content that infringes third-party intellectual
          property rights is prohibited.
        </p>
        <p style={s.p}>
          Loci does not proactively monitor uploaded content, but we will respond to valid
          copyright notices in accordance with applicable law. You retain all intellectual
          property rights in your uploaded files and in any content you create through the Service
          (annotations, notes, flashcards, etc.).
        </p>

        {/* 4. Licence to Loci */}
        <h2 style={s.h2}>4. Licence you grant to Loci</h2>
        <p style={s.p}>
          By uploading content to Loci, you grant us a limited, non-exclusive, royalty-free
          licence to store, process, and display that content solely for the purpose of providing
          the Service to you. This licence is strictly limited to service delivery and does not
          permit us to use your content for any other purpose. The licence terminates when you
          delete the content or close your account.
        </p>

        {/* 5. Acceptable use */}
        <h2 style={s.h2}>5. Acceptable use</h2>
        <p style={s.p}>The following are prohibited when using Loci:</p>
        <ul style={s.ul}>
          <li style={s.li}>Uploading content that infringes third-party intellectual property rights</li>
          <li style={s.li}>Attempting to access, modify, or delete another user's data</li>
          <li style={s.li}>Reverse-engineering, decompiling, or scraping the Service or its APIs</li>
          <li style={s.li}>Using automated tools to access the Service without authorisation</li>
          <li style={s.li}>Using the Service for any unlawful purpose or in violation of any applicable law</li>
        </ul>
        <p style={s.p}>
          We reserve the right to investigate and take appropriate action, including suspending or
          terminating accounts, in response to violations of this policy.
        </p>

        {/* 6. Subscriptions & payments */}
        <h2 style={s.h2}>6. Subscriptions and payments</h2>
        <p style={s.p}>
          Certain features of Loci may require a paid subscription. The following terms apply
          where a subscription is in place:
        </p>
        <ul style={s.ul}>
          <li style={s.li}>Subscriptions are billed on a recurring basis (monthly or annual, as selected)</li>
          <li style={s.li}>You may cancel at any time; access to paid features continues until the end of the current billing period</li>
          <li style={s.li}>Refunds are not provided for partial billing periods, except where required by applicable law (including UK consumer protection legislation)</li>
          <li style={s.li}>We reserve the right to change subscription pricing with at least 30 days' notice, at which point you may cancel if you do not wish to continue at the new price</li>
          <li style={s.li}>Payments are processed by Stripe; by subscribing you agree to Stripe's{' '}
            <a href="https://stripe.com/legal/consumer" target="_blank" rel="noopener noreferrer" style={s.link}>Terms of Service</a>
          </li>
        </ul>

        {/* 7. Third-party services */}
        <h2 style={s.h2}>7. Third-party services</h2>
        <p style={s.p}>
          AI narration and AI study features depend on third-party APIs (ElevenLabs, Anthropic,
          Google). These services are subject to their own terms and conditions, and their
          availability is not guaranteed by Loci. Loci is not responsible for any interruption
          of, or errors within, third-party services.
        </p>

        {/* 8. Intellectual property */}
        <h2 style={s.h2}>8. Loci's intellectual property</h2>
        <p style={s.p}>
          The Loci application, including its user interface, branding, code, and documentation,
          is owned by Loci and protected by intellectual property laws. No licence is granted to
          you beyond the right to use the Service for its intended personal purpose.
        </p>

        {/* 9. Disclaimer of warranties */}
        <h2 style={s.h2}>9. Disclaimer of warranties</h2>
        <p style={s.p}>
          The Service is provided <strong style={s.strong}>"as is"</strong> and{' '}
          <strong style={s.strong}>"as available"</strong> without warranty of any kind, express
          or implied. We do not warrant that the Service will be uninterrupted, error-free, or
          free of security vulnerabilities. You are solely responsible for maintaining your own
          backup copies of EPUB files uploaded to Loci.
        </p>
        <p style={s.p}>
          Nothing in this clause affects your statutory rights as a consumer under UK law.
        </p>

        {/* 10. Limitation of liability */}
        <h2 style={s.h2}>10. Limitation of liability</h2>
        <p style={s.p}>
          To the fullest extent permitted by applicable law, Loci's total liability to you for
          any claim arising from your use of the Service shall not exceed the greater of (a) the
          total amount you have paid to Loci in the 12 months preceding the claim or (b) £10.
        </p>
        <p style={s.p}>
          Loci is not liable for any loss of data, loss of profits, loss of business, or any
          indirect, incidental, special, or consequential damages, even if we have been advised
          of the possibility of such damages.
        </p>
        <p style={s.p}>
          Nothing in these Terms limits or excludes liability for death or personal injury caused
          by negligence, fraud, or any other liability that cannot be excluded under UK law.
        </p>

        {/* 11. Termination */}
        <h2 style={s.h2}>11. Termination</h2>
        <p style={s.p}>
          You may stop using Loci and delete your account at any time directly within the app.
          Loci may suspend or terminate your access to the Service if you violate these Terms, with
          or without notice, depending on the severity of the violation.
        </p>
        <p style={s.p}>
          Upon termination, your right to use the Service ceases immediately. Your data will be
          deleted in accordance with our Privacy Policy.
        </p>

        {/* 12. Governing law */}
        <h2 style={s.h2}>12. Governing law and jurisdiction</h2>
        <p style={s.p}>
          These Terms are governed by the laws of England and Wales. Any dispute arising out of
          or in connection with these Terms shall be subject to the exclusive jurisdiction of the
          courts of England and Wales, except where mandatory consumer protection laws in your
          country of residence provide otherwise.
        </p>

        {/* 13. Changes */}
        <h2 style={s.h2}>13. Changes to these Terms</h2>
        <p style={s.p}>
          We may update these Terms from time to time. Material changes will be notified within
          the app at least 14 days before they take effect. Continued use of the Service after
          the effective date constitutes your acceptance of the revised Terms. If you do not
          accept the changes, you may close your account before they take effect.
        </p>

        {/* 14. Contact */}
        <h2 style={s.h2}>14. Contact</h2>
        <p style={s.p}>
          For any questions about these Terms, contact Loci at:{' '}
          <a href="mailto:hello@loci.app" style={s.link}>hello@loci.app</a>
        </p>
      </div>
    </div>
  )
}
