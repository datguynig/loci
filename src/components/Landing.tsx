import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClerk } from '@clerk/clerk-react'
import { useWindowWidth } from '../hooks/useWindowWidth'

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useLoopingTypewriter(text: string, speed = 40, enabled = true) {
  const [displayed, setDisplayed] = useState('')
  const stateRef = useRef<{ index: number; resetting: boolean }>({ index: 0, resetting: false })

  useEffect(() => {
    if (!enabled) { setDisplayed(''); return }
    stateRef.current = { index: 0, resetting: false }
    setDisplayed('')
    const interval = setInterval(() => {
      const s = stateRef.current
      if (s.resetting) return
      if (s.index < text.length) {
        s.index++
        setDisplayed(text.slice(0, s.index))
      } else {
        s.resetting = true
        setTimeout(() => { s.index = 0; s.resetting = false; setDisplayed('') }, 2800)
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed, enabled])

  return displayed
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
  )
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
  }
  return { theme, toggle }
}

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────

function Cursor() {
  return (
    <span style={{
      display: 'inline-block', width: 1, height: '0.85em',
      background: 'var(--accent-warm)', marginLeft: 1,
      verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite',
    }} />
  )
}

function SmallWaveform({ color = 'var(--accent-warm)' }: { color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.12}s`, background: color }} />
      ))}
    </div>
  )
}

function TabProgressLine({ duration }: { duration: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    setWidth(0)
    const t = setTimeout(() => setWidth(100), 40)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ height: '100%', width: `${width}%`, background: 'var(--accent-warm)', opacity: 0.45, transition: `width ${duration}ms linear`, borderRadius: '0 99px 99px 0' }} />
  )
}

// ─── Hero Panels ──────────────────────────────────────────────────────────────

type HeroTab = 'Read' | 'Listen' | 'Study'
const HERO_TABS: HeroTab[] = ['Read', 'Listen', 'Study']

function HeroReadPanel() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setProgress(34), 120)
    return () => clearTimeout(t)
  }, [])
  const chapters = ['Ch. I', 'Ch. II', 'Ch. III', 'Ch. IV', 'Chapter V', 'Ch. VI']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 120, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '12px 0', flexShrink: 0, overflow: 'hidden' }}>
          {chapters.map((ch) => {
            const active = ch === 'Chapter V'
            return (
              <div key={ch} style={{
                padding: '5px 12px', fontFamily: 'var(--font-display)', fontSize: 11,
                color: active ? 'var(--accent-warm)' : 'var(--text-tertiary)',
                background: active ? 'rgba(196,168,130,0.22)' : 'transparent',
                borderRadius: active ? 4 : 0, margin: active ? '0 6px' : 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {active ? `▶ ${ch}` : ch}
              </div>
            )
          })}
        </div>
        <div style={{ flex: 1, padding: '28px 32px', background: 'var(--bg-surface)', overflow: 'hidden', position: 'relative' }}>
          <p style={{ fontFamily: 'var(--font-reading)', fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)', margin: 0, textAlign: 'justify' }}>
            It was on a dreary night of November that I beheld the accomplishment of my toils.{' '}
            <span style={{ background: 'rgba(196,168,130,0.22)', borderRadius: 3, padding: '2px 2px', color: 'var(--text-primary)', boxShadow: '0 0 0 1.5px rgba(196,168,130,0.25)' }}>
              I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet.
            </span>{' '}
            It was already one in the morning; the rain pattered dismally against the panes, and my candle was nearly burnt out, when, by the glimmer of the half-extinguished light, I saw the dull yellow eye of the creature open; it breathed hard, and a convulsive motion agitated its limbs. How can I describe my emotions at this catastrophe, or how delineate the wretch whom with such infinite pains and care I had endeavoured to form?
          </p>
          <p style={{ fontFamily: 'var(--font-reading)', fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)', margin: '1.1em 0 0', textAlign: 'justify' }}>
            His limbs were in proportion, and I had selected his features as beautiful. Beautiful! Great God! His yellow skin scarcely covered the work of muscles and arteries beneath; his hair was of a lustrous black, and flowing; his teeth of a pearly whiteness; but these luxuriances only formed a more horrid contrast with his watery eyes, that seemed almost of the same colour as the dun-white sockets in which they were set, his shrivelled complexion and straight black lips.
          </p>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(to bottom, transparent, var(--bg-surface))', pointerEvents: 'none' }} />
        </div>
      </div>
      {/* Chapter progress bar */}
      <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', padding: '6px 16px 7px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Chapter V · 34%</span>
        <div style={{ flex: 1, height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, background: 'var(--accent-warm)', width: `${progress}%`, transition: 'width 2.5s cubic-bezier(0.4,0,0.2,1)', opacity: 0.8 }} />
        </div>
      </div>
    </div>
  )
}

function HeroListenPanel() {
  const [scrubberWidth, setScrubberWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setScrubberWidth(60), 120)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, padding: '28px 32px', background: 'var(--bg-surface)', overflow: 'hidden', position: 'relative' }}>
        <p style={{ fontFamily: 'var(--font-reading)', fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)', margin: 0, textAlign: 'justify' }}>
          It was on a dreary night of November that I beheld the accomplishment of my toils. I collected the instruments of life around me,{' '}
          <span style={{ background: 'rgba(196,168,130,0.22)', borderRadius: 3, padding: '2px 3px', color: 'var(--text-primary)', boxShadow: '0 0 0 2px rgba(196,168,130,0.22)' }}>
            that I might infuse a spark of being into the lifeless thing
          </span>{' '}
          that lay at my feet. The rain pattered dismally against the panes, and my candle was nearly burnt out. With an anxiety that almost amounted to agony, I collected the instruments of life around me. The rain fell in torrents, and thin sheets of lightning illuminated my ghastly work. I had done it — and now I could not look upon it.
        </p>
        <p style={{ fontFamily: 'var(--font-reading)', fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)', margin: '1.1em 0 0', textAlign: 'justify' }}>
          I passed the night wretchedly. Sometimes my pulse beat so quickly and hardly that I felt the palpitation of every artery; at others, I nearly sank to the ground through languor and extreme weakness. Mingled with this horror, I felt the bitterness of disappointment; dreams that had been my food and pleasant rest for so long a space were now become a hell to me; and the change was so rapid, the overthrow so complete!
        </p>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(to bottom, transparent, var(--bg-surface))', pointerEvents: 'none' }} />
      </div>
      <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        {/* Scrubber row */}
        <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>4:32</span>
          <div style={{ flex: 1, height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: '100%', borderRadius: 99, background: 'var(--accent-warm)', width: `${scrubberWidth}%`, transition: 'width 12s linear', opacity: 0.9 }} />
          </div>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>12:18</span>
        </div>
        {/* Sentence preview */}
        <div style={{ height: 22, padding: '0 16px', overflow: 'hidden' }}>
          <span style={{ fontFamily: 'var(--font-reading)', fontStyle: 'italic', fontSize: 11, color: 'var(--text-tertiary)' }}>
            <span style={{ background: 'rgba(196,168,130,0.22)', padding: '1px 4px', borderRadius: 3, color: 'var(--text-secondary)' }}>
              that I might infuse a spark of being into the lifeless thing
            </span>
          </span>
        </div>
        {/* Controls */}
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', cursor: 'default' }}>↩</span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 16px rgba(196,168,130,0.4)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', cursor: 'default' }}>↪</span>
          <SmallWaveform color="var(--accent-warm)" />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 20, padding: 2, border: '1px solid var(--border)' }}>
              {['Turbo', 'Quality'].map((m, i) => (
                <span key={m} style={{ padding: '2px 8px', borderRadius: 16, fontSize: 10, fontFamily: 'var(--font-ui)', fontWeight: 500, background: i === 0 ? 'var(--accent-warm)' : 'transparent', color: i === 0 ? '#fff' : 'var(--text-tertiary)' }}>{m}</span>
              ))}
            </div>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', background: 'var(--bg-secondary)' }}>1×</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', background: 'var(--bg-secondary)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-warm)', display: 'inline-block' }} />
              Sarah
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const STUDY_TEXT = "Chapter V is the pivot of the novel. Frankenstein succeeds, but his immediate revulsion reveals that the real horror is not the creature itself — it is what the act of creation says about him."

function HeroStudyPanel() {
  const text = useLoopingTypewriter(STUDY_TEXT, 34)
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, padding: '28px 24px', background: 'var(--bg-surface)', overflow: 'hidden', position: 'relative' }}>
        <p style={{ fontFamily: 'var(--font-reading)', fontSize: 13, lineHeight: 1.85, color: 'var(--text-secondary)', margin: 0, textAlign: 'justify' }}>
          It was on a dreary night of November that I beheld the accomplishment of my toils with an anxiety that almost amounted to agony. I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet.
        </p>
        <p style={{ fontFamily: 'var(--font-reading)', fontSize: 13, lineHeight: 1.85, color: 'var(--text-secondary)', margin: '1em 0 0', textAlign: 'justify' }}>
          It was already one in the morning; the rain pattered dismally against the panes, and my candle was nearly burnt out, when, by the glimmer of the half-extinguished light, I saw the dull yellow eye of the creature open; it breathed hard, and a convulsive motion agitated its limbs.
        </p>
        <p style={{ fontFamily: 'var(--font-reading)', fontSize: 13, lineHeight: 1.85, color: 'var(--text-secondary)', margin: '1em 0 0', textAlign: 'justify' }}>
          How can I describe my emotions at this catastrophe, or how delineate the wretch whom with such infinite pains and care I had endeavoured to form? His limbs were in proportion, and I had selected his features as beautiful. Beautiful! Great God! His yellow skin scarcely covered the work of muscles and arteries beneath.
        </p>
        <p style={{ fontFamily: 'var(--font-reading)', fontSize: 13, lineHeight: 1.85, color: 'var(--text-secondary)', margin: '1em 0 0', textAlign: 'justify' }}>
          I had worked hard for nearly two years, for the sole purpose of infusing life into an inanimate body. For this I had deprived myself of rest and health. I had desired it with an ardour that far exceeded moderation; but now that I had finished, the beauty of the dream vanished, and breathless horror and disgust filled my heart.
        </p>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, transparent, var(--bg-surface))', pointerEvents: 'none' }} />
      </div>
      <div style={{ width: 220, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', padding: '14px 14px', flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Study assistant</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {['Summarise', 'Quiz', '⚡'].map((chip, i) => (
            <span key={chip} style={{ fontFamily: 'var(--font-ui)', fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: i === 1 ? 'var(--accent-warm)' : 'var(--bg-primary)', color: i === 1 ? '#fff' : 'var(--text-secondary)' }}>{chip}</span>
          ))}
        </div>
        {/* Completed exchange */}
        <div style={{ marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textAlign: 'right' }}>Summarise Chapter V</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--accent-warm)' }}>✦</span>{' '}Victor abandons the creature after it comes to life, horrified by what he's created. The creature disappears into the night.
          </div>
        </div>
        {/* In-progress typewriter */}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textAlign: 'right' }}>Quiz me on Chapter V</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          <span style={{ color: 'var(--accent-warm)' }}>✦</span>{' '}{text}<Cursor />
        </div>
      </div>
    </div>
  )
}

function HeroMockup({ rightPanel = false }: { rightPanel?: boolean }) {
  const [activeTab, setActiveTab] = useState<HeroTab>('Read')
  const [userClicked, setUserClicked] = useState(false)

  useEffect(() => {
    if (userClicked) return
    const timer = setInterval(() => {
      setActiveTab((prev) => HERO_TABS[(HERO_TABS.indexOf(prev) + 1) % HERO_TABS.length])
    }, 6500)
    return () => clearInterval(timer)
  }, [userClicked])

  const panels: Record<HeroTab, React.ReactNode> = {
    Read: <HeroReadPanel />,
    Listen: <HeroListenPanel />,
    Study: <HeroStudyPanel />,
  }

  return (
    <motion.div
      initial={rightPanel ? { opacity: 0, x: 40 } : { opacity: 0, y: 48 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={rightPanel
        ? { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.5 }
        : { type: 'spring', damping: 26, stiffness: 160, delay: 0.95 }
      }
      style={{
        width: '100%',
        maxWidth: rightPanel ? 'none' : 1100,
        borderRadius: rightPanel ? '16px 0 0 16px' : '16px 16px 0 0',
        overflow: 'hidden',
        border: '1px solid rgba(196,168,130,0.19)',
        ...(rightPanel ? { borderRight: 'none' } : { borderBottom: 'none' }),
        boxShadow: rightPanel
          ? '-24px 0 64px rgba(0,0,0,0.07), inset 0 1px 0 rgba(196,168,130,0.13)'
          : '0 -32px 80px rgba(196,168,130,0.04), inset 0 1px 0 rgba(196,168,130,0.13)',
      }}
    >
      {/* Tab bar */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {HERO_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setUserClicked(true) }}
              style={{
                fontFamily: 'var(--font-ui)', fontSize: 12,
                fontWeight: activeTab === tab ? 600 : 400,
                padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: activeTab === tab ? 'rgba(196,168,130,0.22)' : 'transparent',
                color: activeTab === tab ? 'var(--accent-warm)' : 'var(--text-tertiary)',
                transition: 'all 150ms ease',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-tertiary)' }}>Frankenstein — Ch. V</span>
      </div>
      {/* Auto-advance progress line */}
      {!userClicked && (
        <div key={activeTab} style={{ height: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <TabProgressLine duration={6500} />
        </div>
      )}
      {/* Content */}
      <div style={{ height: rightPanel ? 580 : 320, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {panels[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Feature Mockup: AI (quiz in progress) ────────────────────────────────────

const QUIZ_TEXT = "The creature is described as having \"watery eyes\" and a \"shrivelled complexion.\" The contrast between Frankenstein's obsession and the grotesque result shows how desire distorts perception."

function FeatureMockupAI() {
  const text = useLoopingTypewriter(QUIZ_TEXT, 38)
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 24 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Study assistant</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Summarise', 'Quiz', '⚡'].map((chip, i) => (
            <span key={chip} style={{ fontFamily: 'var(--font-ui)', fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: i === 1 ? 'var(--accent-warm)' : 'var(--bg-surface)', color: i === 1 ? '#fff' : 'var(--text-secondary)' }}>{chip}</span>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600, color: 'var(--accent-warm)', marginBottom: 6 }}>Question 2 of 5</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 10 }}>
          How does Shelley describe the creature at the moment of creation?
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 5, flexShrink: 0 }}>You</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-surface)', borderRadius: 6, padding: '5px 8px', flex: 1 }}>Ugly and deeply unsettling</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent-warm)', fontSize: 12, flexShrink: 0 }}>✓</span>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {text}<Cursor />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Why Loci ─────────────────────────────────────────────────────────────────

const WHY_LOCI = [
  {
    n: '01',
    title: 'It already read your book.',
    body: "Other tools make you paste in the text every time. Loci already has your chapter, your highlights, your notes, and your scratchpad. Ask a question. Run a quiz. Generate flashcards. The context is already there.",
  },
  {
    n: '02',
    title: 'Narration good enough for a 4-hour commute.',
    body: "Your browser's built-in voice sounds robotic. The voices in Loci are expressive and clear — comfortable for an entire audiobook. Each sentence is highlighted as it's spoken.",
  },
  {
    n: '03',
    title: 'Read, listen, study — in one place.',
    body: 'No switching between your reader, your notes app, and a separate chat tool. Everything happens inside the book: highlights, notes, narration, quizzes, flashcards.',
  },
]

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'Is my library private?',
    a: 'Your books are stored securely in the cloud under your account — no one else can access them. When you use study features, only the chapter you\'re currently reading is ever sent anywhere. Your full library stays private.',
  },
  {
    q: 'What formats does Loci support?',
    a: 'EPUB only. Most ebooks from publishers and sources like Project Gutenberg are available in EPUB. Kindle files can be converted to EPUB using free tools like Calibre.',
  },
  {
    q: 'How is Loci different from other reading apps?',
    a: "Loci is built around your own book collection — not a catalog you subscribe to. You bring your EPUB files; Loci handles the narration, study tools, and cross-device sync. Your library, your annotations, and your progress are yours.",
  },
  {
    q: 'How does narration work?',
    a: "Loci Narration is included with every Reader and Scholar subscription. Reader includes Loci Narration with natural, lifelike voices. Scholar adds Loci Narration Pro — expressive, audiobook-quality voices. Each sentence is highlighted in the text as it's spoken.",
  },
  {
    q: 'What happens when the free trial ends?',
    a: "After your 7-day trial you can choose Reader ($7.99/month or $79/year) or Scholar ($13.99/month or $139/year), or continue using Loci for free with up to 5 books and your device's built-in voice. No charge until you add a payment method.",
  },
]

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {item.q}
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 16, display: 'flex' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 18px', paddingRight: 32 }}>
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Landing ─────────────────────────────────────────────────────────────

export default function Landing() {
  const { openSignIn, openSignUp } = useClerk()
  const { theme, toggle: toggleTheme } = useTheme()
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 768
  const [menuOpen, setMenuOpen] = useState(false)

  // Navigation background adapts to theme
  const navBg = theme === 'dark' ? 'rgba(17,17,16,0.92)' : 'rgba(248,247,244,0.92)'

  const scrollTo = (id: string) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  // Shared scroll-reveal config
  const inView = {
    initial: { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' } as const,
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: '0.12em',
    color: 'var(--accent-warm)', marginBottom: 12, display: 'block', textTransform: 'uppercase',
  }

  const h2Style: React.CSSProperties = {
    fontFamily: 'var(--font-display)', fontSize: isMobile ? 28 : 38,
    color: 'var(--text-primary)', lineHeight: 1.15, margin: '12px 0 16px', fontWeight: 600,
  }

  const bodyStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-secondary)',
    lineHeight: 1.7, marginBottom: 0,
  }

  // Voice personas for ElevenLabs section
  const voices = [
    { name: 'Sarah', desc: 'Warm & Clear', initial: 'S', hue: '#C4A882' },
    { name: 'Adam', desc: 'Deep & Authoritative', initial: 'A', hue: '#7A9E8E' },
    { name: 'Bella', desc: 'Bright & Expressive', initial: 'B', hue: '#9B8EC4' },
    { name: 'River', desc: 'Calm & Natural', initial: 'Ri', hue: '#C4957A' },
  ]

  const [activeVoiceDemo, setActiveVoiceDemo] = useState<string | null>(null)
  const [barHeights, setBarHeights] = useState<number[]>([])
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)

  function stopVoiceDemo() {
    if (activeAudioRef.current) { activeAudioRef.current.pause(); activeAudioRef.current = null }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    setActiveVoiceDemo(null)
    setBarHeights([])
  }

  function playVoiceDemo(voiceName: string) {
    stopVoiceDemo()
    if (activeVoiceDemo === voiceName) return

    setActiveVoiceDemo(voiceName)

    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 128 // 64 frequency bins
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const audio = new Audio(`/demo-voices/${voiceName.toLowerCase()}.mp3`)
    activeAudioRef.current = audio

    const source = ctx.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(ctx.destination)

    function draw() {
      analyser.getByteFrequencyData(dataArray)
      setBarHeights(Array.from(dataArray).map(v => v / 255))
      animFrameRef.current = requestAnimationFrame(draw)
    }

    const cleanup = () => { stopVoiceDemo() }
    audio.onended = cleanup
    audio.onerror = cleanup

    audio.play().then(() => { ctx.resume(); draw() }).catch(cleanup)
  }

  useEffect(() => () => {
    if (activeAudioRef.current) activeAudioRef.current.pause()
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    audioCtxRef.current?.close()
  }, [])

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        html { scroll-behavior: smooth; }
        .landing-hero-grid {
          background-image: radial-gradient(var(--border) 1px, transparent 1px);
          background-size: 28px 28px;
        }
      `}</style>

      {/* ── 1. Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 56, background: navBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 32px' }}>
        <span
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
        >Loci</span>

        {!isMobile && (
          <div style={{ display: 'flex', gap: 32 }}>
            {[['How it works', 'how-it-works'], ['Pricing', 'pricing'], ['FAQ', 'faq']].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0', transition: 'color 150ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={toggleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }} title="Toggle theme">
            {theme === 'dark'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          {!isMobile && (
            <>
              <button onClick={() => openSignIn()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)', padding: '6px 12px' }}>Sign in</button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => openSignUp()}
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                Start free trial
              </motion.button>
            </>
          )}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {menuOpen
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
              }
            </button>
          )}
        </div>
      </nav>

      {/* ── Mobile nav drawer ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && isMobile && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.35)' }}
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                position: 'fixed', top: 56, left: 0, right: 0, zIndex: 99,
                background: navBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid var(--border)',
                padding: '8px 0 16px',
              }}
            >
              {[['How it works', 'how-it-works'], ['Pricing', 'pricing'], ['FAQ', 'faq']].map(([label, id]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--text-primary)',
                    padding: '14px 24px',
                  }}
                >
                  {label}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 24px' }} />
              <div style={{ padding: '8px 24px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => { setMenuOpen(false); openSignIn() }}
                  style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-primary)', padding: '12px 0', borderRadius: 8, width: '100%' }}>
                  Sign in
                </button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => { setMenuOpen(false); openSignUp() }}
                  style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, padding: '13px 0', borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%' }}>
                  Start free trial
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 2. Hero ─────────────────────────────────────────────────────────── */}
      {isMobile ? (
        /* Mobile: centered, stacked */
        <section className="landing-hero-grid" style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', paddingTop: 56 }}>
          <div style={{ textAlign: 'center', padding: '72px 28px 48px', maxWidth: 560, margin: '0 auto' }}>
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.0, margin: '0 0 20px', letterSpacing: '-0.025em' }}
            >
              Read, listen & learn from any book you own.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
              style={{ fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--text-secondary)', margin: '0 auto 36px', lineHeight: 1.65, maxWidth: 340 }}
            >
              Narration that sounds human. A study assistant that converts reading into retention.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => openSignUp()}
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, padding: '14px 36px', borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                Start 7-day free trial
              </motion.button>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)' }}>No credit card required</span>
            </motion.div>
          </div>
          <div style={{ width: '100%', padding: '0 16px' }}>
            <HeroMockup />
          </div>
        </section>
      ) : (
        /* Desktop: left/right split — text left, product right (bleeds to edge) */
        <section
          className="landing-hero-grid"
          style={{
            background: 'var(--bg-primary)',
            minHeight: '100vh',
            display: 'grid',
            gridTemplateColumns: '44% 56%',
            overflow: 'hidden',
            paddingTop: 56,
          }}
        >
          {/* Left: Content */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 56px 80px max(48px, 8vw)' }}>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 3.8vw, 62px)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.05, margin: '0 0 28px', letterSpacing: '-0.03em', textAlign: 'left' }}
            >
              Read, listen & learn<br />from any book<br />you own.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.25 }}
              style={{ fontFamily: 'var(--font-ui)', fontSize: 17, color: 'var(--text-secondary)', margin: '0 0 44px', lineHeight: 1.65, maxWidth: 340, textAlign: 'left' }}
            >
              Narration that sounds human. A study assistant that converts reading into retention.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}
            >
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 0 0 3px rgba(196,168,130,0.22)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openSignUp()}
                style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'box-shadow 200ms' }}
              >
                Start 7-day free trial
              </motion.button>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                No credit card required
              </span>
              <button
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontFamily: 'var(--font-ui)', fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                See how it works ↓
              </button>
            </motion.div>
          </div>

          {/* Right: Product — anchored to top, bleeds to viewport edge */}
          <div style={{
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 0 0 32px',
          }}>
            <HeroMockup rightPanel />
            <div style={{ padding: '14px 32px 14px 0', display: 'flex', gap: 20, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
              {[
                { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>, label: 'Any ebook, instantly listenable' },
                { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>, label: 'Natural narration' },
                { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, label: 'Only the current chapter is ever shared' },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)' }}>
                  {icon}
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Problem ──────────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? '80px 24px' : '100px 24px', background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ display: isMobile ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: '1fr 1fr 1fr', gap: 40 }}>
            {[
              { label: 'THE STUDENT', text: "You have an exam in 3 days. You highlighted the entire textbook. You re-read your highlights and realise you don't understand any of it in context. You've been re-reading for hours and it isn't working." },
              { label: 'THE PROFESSIONAL', text: "You read Atomic Habits in January. It's July. You just recommended it to a colleague and couldn't name a single specific technique from the book." },
              { label: 'THE AVID READER', text: "Your Goodreads says 67 books read. Someone asks your opinion on one of them. You remember the cover and that you liked it." },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55, delay: i * 0.14, ease: 'easeOut' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase' }}>{item.label}</div>
                <p style={{ fontFamily: 'var(--font-reading)', fontStyle: 'italic', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8, borderLeft: '2px solid var(--accent-warm)', paddingLeft: 20, margin: 0 }}>
                  "{item.text}"
                </p>
              </motion.div>
            ))}
          </div>
          <motion.p {...inView} style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginTop: 64 }}>
            Your books aren't going to read themselves. With Loci, they do.
          </motion.p>
        </div>
      </section>

      {/* ── 5. Narration section ────────────────────────────────────────────── */}
      <section style={{ background: 'var(--bg-secondary)', padding: isMobile ? '80px 0' : '100px 0', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '0 24px', marginBottom: 48 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--accent-warm)', display: 'block', marginBottom: 16 }}>NARRATION</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 32 : 52, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Narration that sounds like a person,<br />not a machine.
            </h2>
          </motion.div>
        </div>

        {/* Currently reading preview */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{ textAlign: 'center', padding: '0 24px', marginBottom: 40 }}>
          <p style={{ fontFamily: 'var(--font-reading)', fontStyle: 'italic', fontSize: isMobile ? 14 : 17, color: 'var(--text-secondary)', maxWidth: 680, margin: '0 auto', lineHeight: 1.8 }}>
            "For this I had deprived myself of rest and health. I had desired it with an ardour that far exceeded moderation;{' '}
            <span style={{ background: 'rgba(196,168,130,0.22)', borderRadius: 3, padding: '2px 4px', color: 'var(--text-primary)', boxShadow: '0 0 0 1.5px rgba(196,168,130,0.31)' }}>
              but now that I had finished, the beauty of the dream vanished.
            </span>"
          </p>
        </motion.div>

        {/* Wide waveform */}
        <motion.div initial={{ opacity: 0, scaleX: 0.7 }} whileInView={{ opacity: 1, scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 64, padding: '0 24px', marginBottom: 64, opacity: activeVoiceDemo ? 1 : 0.35, transition: 'opacity 400ms ease' }}>
          {(() => {
            const barCount = isMobile ? 32 : 64
            const staticHeights = [0.4, 0.7, 1.0, 0.6, 0.85, 0.45, 0.9, 0.55, 0.75, 1.0, 0.5, 0.8,
                                   0.65, 0.9, 0.5, 0.75, 1.0, 0.55, 0.8, 0.45, 0.7, 0.95, 0.6, 0.85,
                                   0.35, 0.75, 1.0, 0.5, 0.9, 0.6, 0.8, 0.45]
            const hasLiveData = barHeights.length > 0
            const activeHue = activeVoiceDemo ? (voices.find(v => v.name === activeVoiceDemo)?.hue ?? '#C4A882') : '#C4A882'
            const hueRgb = parseInt(activeHue.slice(1, 3), 16) + ',' + parseInt(activeHue.slice(3, 5), 16) + ',' + parseInt(activeHue.slice(5, 7), 16)
            // Speech lives in roughly the lower 40% of bins — map all bars to that range
            const speechBins = Math.floor(barHeights.length * 0.4)
            return Array.from({ length: barCount }).map((_, i) => {
              let h: number
              if (hasLiveData) {
                const binIndex = Math.floor((i / barCount) * speechBins)
                // Boost sensitivity: speech values cluster in 0–180 range, not 0–255
                h = Math.min(1, (barHeights[binIndex] ?? 0) * 1.5)
              } else {
                h = staticHeights[i % staticHeights.length]
              }
              const barHeight = hasLiveData ? Math.max(4, h * 60) : Math.round(h * 60)
              return (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: barHeight,
                    borderRadius: 3,
                    alignSelf: 'flex-end',
                    background: `rgba(${hueRgb},${0.3 + h * 0.6})`,
                    transition: hasLiveData ? 'height 50ms ease, background 200ms ease' : 'background 400ms ease',
                  }}
                />
              )
            })
          })()}
        </motion.div>

        {/* Voice persona cards */}
        <p style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 16px', letterSpacing: '0.02em' }}>
          Click any voice to hear a preview
        </p>
        <div style={{ maxWidth: 880, margin: '0 auto', display: isMobile ? 'grid' : 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14, padding: '0 24px', marginBottom: 52 }}>
          {voices.map((v, i) => {
            const isActive = activeVoiceDemo === v.name
            return (
              <motion.div key={v.name}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.08 }}
                onClick={() => playVoiceDemo(v.name)}
                style={{
                  background: 'var(--bg-surface)',
                  border: isActive ? `1.5px solid ${v.hue}` : '1px solid var(--border)',
                  borderRadius: 16, padding: '20px 16px', textAlign: 'center',
                  cursor: 'pointer',
                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                  transition: 'border-color 150ms ease, transform 150ms ease',
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: isActive ? `${v.hue}28` : `${v.hue}18`,
                  border: `1.5px solid ${v.hue}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontFamily: 'var(--font-display)', fontSize: isActive ? 14 : 17, color: v.hue,
                  transition: 'background 150ms ease, font-size 150ms ease',
                }}>
                  {isActive ? '■' : v.initial}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{v.name}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>{v.desc}</div>
                {isActive ? (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: v.hue, fontWeight: 600 }}>■ playing</div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.7 }}>▶ preview</div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Feature bullets */}
        <div style={{ display: 'flex', gap: isMobile ? 16 : 40, justifyContent: 'center', flexWrap: 'wrap', padding: '0 24px' }}>
          {['Each sentence highlighted as it\'s spoken', 'Multiple voices to choose from'].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent-warm)', fontWeight: 700 }}>✓</span>
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. Feature Bento Grid ──────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? '80px 24px' : '100px 24px', background: 'var(--bg-primary)' }}>
        <motion.h2 {...inView} style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 32 : 44, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 12px' }}>
          Read it. Hear it. Learn from it.
        </motion.h2>
        <motion.p {...inView} style={{ fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 48px' }}>
          Every tool works together inside the book — no switching apps, no losing your place.
        </motion.p>

        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '7fr 5fr',
          gridTemplateRows: 'auto auto',
          gap: 16,
        }}>
          {/* AI Study — large card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '32px 32px 0', overflow: 'hidden', gridRow: isMobile ? 'auto' : 'span 1' }}
          >
            <span style={labelStyle}>STUDY TOOLS</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 22 : 28, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, margin: '0 0 12px' }}>
              The study assistant that already read your book.
            </h3>
            <p style={{ ...bodyStyle, marginBottom: 0, maxWidth: 400 }}>
              No copy-pasting. No context-switching. It knows which chapter you're on, what you've highlighted, and what's in your notes.
            </p>
            <FeatureMockupAI />
          </motion.div>

          {/* Highlights — smaller card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0.08 }}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, overflow: 'hidden' }}
          >
            <span style={labelStyle}>HIGHLIGHTS & NOTES</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 22 : 24, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, margin: '0 0 12px' }}>
              Highlight anything. It's always yours.
            </h3>
            <p style={{ ...bodyStyle, maxWidth: 320 }}>
              Select any passage to highlight or add a note. Export everything as plain text — your insights, always on your terms.
            </p>
            {/* Mini highlight illustration */}
            <div style={{ marginTop: 24, background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontFamily: 'var(--font-reading)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 14px' }}>
                ...I collected{' '}
                <span style={{ background: 'rgba(196,168,130,0.38)', borderRadius: 3, padding: '2px 1px', color: 'var(--text-primary)' }}>
                  the instruments of life around me, that I might infuse a spark of being
                </span>{' '}
                into the lifeless thing...
              </p>
              <div style={{ background: 'rgba(196,168,130,0.08)', border: '1px solid rgba(196,168,130,0.18)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 9, color: 'var(--accent-warm)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.1em' }}>YOUR NOTE</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Compare pg. 12 — same creation-as-violation imagery. Prometheus parallel?</div>
              </div>
            </div>
          </motion.div>

          {/* Reading Experience — left bottom */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0.12 }}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, gridColumn: isMobile ? 'auto' : '2 / 3', gridRow: isMobile ? 'auto' : '2 / 3' }}
          >
            <span style={labelStyle}>READING EXPERIENCE</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 22 : 24, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, margin: '0 0 12px' }}>
              Designed around the words, not the interface.
            </h3>
            <p style={{ ...bodyStyle, maxWidth: 320 }}>
              Font size. Dark mode. Scroll or paginated. The interface stays out of the way.
            </p>
            {/* Mini settings illustration */}
            <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ label: 'A−', active: false }, { label: 'A', active: true }, { label: 'A+', active: false }].map(({ label, active }) => (
                <span key={label} style={{ fontFamily: 'var(--font-ui)', fontSize: 13, padding: '6px 12px', borderRadius: 6, border: `1px solid ${active ? 'var(--accent-warm)' : 'var(--border)'}`, color: active ? 'var(--accent-warm)' : 'var(--text-tertiary)', background: active ? 'rgba(196,168,130,0.1)' : 'var(--bg-secondary)' }}>{label}</span>
              ))}
              {[{ label: 'Scroll', active: true }, { label: 'Pages', active: false }].map(({ label, active }) => (
                <span key={label} style={{ fontFamily: 'var(--font-ui)', fontSize: 13, padding: '6px 12px', borderRadius: 6, border: `1px solid ${active ? 'var(--accent-warm)' : 'var(--border)'}`, color: active ? 'var(--accent-warm)' : 'var(--text-tertiary)', background: active ? 'rgba(196,168,130,0.1)' : 'var(--bg-secondary)' }}>{label}</span>
              ))}
            </div>
          </motion.div>

          {/* Privacy card — right bottom */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: 0.16 }}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, gridColumn: isMobile ? 'auto' : '1 / 2', gridRow: isMobile ? 'auto' : '2 / 3', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <div style={{ marginBottom: 20 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warm)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 36 : 44, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 10 }}>Your library,<br />everywhere.</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 360 }}>
              Books, notes, and reading progress sync across every device. Pick up exactly where you left off.
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 7. How It Works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: isMobile ? '80px 24px' : '100px 24px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <motion.div {...inView} style={{ marginBottom: 64 }}>
            <span style={labelStyle}>HOW IT WORKS</span>
            <h2 style={h2Style}>From first page to first flashcard.</h2>
          </motion.div>
          {[
            { n: '01', text: 'You upload your ebook to Loci. The book loads instantly and syncs to your account — accessible on any device.' },
            { n: '02', text: 'You turn on narration. You pick a voice. It reads the chapter aloud while each sentence is highlighted in the text as it\'s spoken.' },
            { n: '03', text: 'You finish the chapter. You tap "Quiz me." The study assistant — which has your chapter text, your highlights, and your notes — generates five targeted questions.' },
            { n: '04', text: 'You get three right, two wrong. You retry the two you missed. It explains the correct answer using something specific from the chapter.' },
            { n: '05', text: 'You tap "Flashcards." Eight cards appear immediately. Save them or export to your notes app.' },
            { n: '06', text: 'Tomorrow, you actually remember what you read.' },
          ].map((beat, i) => (
            <motion.div
              key={beat.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 24, borderTop: '1px solid var(--border)', padding: '28px 0', alignItems: 'baseline' }}
            >
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--accent-warm)', letterSpacing: '0.08em' }}>{beat.n}</span>
              <p style={{ fontFamily: 'var(--font-reading)', fontSize: isMobile ? 15 : 17, color: 'var(--text-primary)', lineHeight: 1.75, margin: 0 }}>
                {i === 5 ? <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{beat.text}</strong> : beat.text}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 8. Why Loci ─────────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? '80px 24px' : '100px 24px', background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <motion.div {...inView} style={{ marginBottom: 64 }}>
            <span style={labelStyle}>WHY LOCI</span>
            <h2 style={h2Style}>Three tools. One book. Zero switching.</h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 40 : 56 }}>
            {WHY_LOCI.map((item, i) => (
              <motion.div
                key={item.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 700, color: 'var(--accent-warm)', lineHeight: 1, marginBottom: 20, opacity: 0.6 }}>{item.n}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, margin: '0 0 14px' }}>{item.title}</h3>
                <p style={{ fontFamily: 'var(--font-reading)', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 11. Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: isMobile ? '80px 24px' : '100px 24px', background: 'var(--bg-secondary)', textAlign: 'center' }}>
        <motion.div {...inView} style={{ marginBottom: 52 }}>
          <span style={labelStyle}>PRICING</span>
          <h2 style={{ ...h2Style, textAlign: 'center', margin: '12px 0 0' }}>Start free. Upgrade when you're ready.</h2>
        </motion.div>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Free card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', textAlign: 'left', opacity: theme === 'dark' ? 0.6 : 0.85 }}
          >
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', opacity: 0.45, marginBottom: 6 }}>Loci</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, marginBottom: 2 }}>$0</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, opacity: 0.55 }}>Always free</div>
            </div>
            <div style={{ padding: '16px 20px 24px' }}>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 2, opacity: 0.8 }}>
                <li>5 books</li>
                <li>Device voice (unlimited)</li>
                <li>Bookmarks &amp; progress sync</li>
                <li>Annotations &amp; highlights</li>
              </ul>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => openSignUp()}
                style={{ background: 'transparent', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, padding: '11px 0', borderRadius: 10, border: '1.5px solid var(--border)', cursor: 'pointer', width: '100%', marginTop: 16, opacity: 0.8 }}>
                Start reading free
              </motion.button>
            </div>
          </motion.div>

          {/* Reader card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.08 }}
            style={{ background: 'var(--bg-surface)', border: '2px solid #2563eb', borderRadius: 20, overflow: 'hidden', textAlign: 'left' }}
          >
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#2563eb', marginBottom: 6 }}>Loci Reader</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: '#2563eb', marginBottom: 2 }}>$7.99<span style={{ fontSize: 16, fontWeight: 500 }}>/mo</span></div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, opacity: 0.6 }}>or $79/yr — Save 2 months</div>
            </div>
            <div style={{ padding: '16px 20px 24px' }}>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 2, opacity: 0.8 }}>
                <li>Unlimited books</li>
                <li>Loci Narration — lifelike voices</li>
                <li>Word-by-word highlighting</li>
                <li>Multiple voice choices</li>
                <li>Scratchpad</li>
              </ul>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => openSignUp()}
                style={{ background: '#2563eb', color: '#fff', fontFamily: 'var(--font-display)', fontStyle: 'italic' as const, fontSize: 15, padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer', width: '100%', marginTop: 16 }}>
                Get started
              </motion.button>
            </div>
          </motion.div>

          {/* Scholar card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.16 }}
            style={{ background: 'var(--bg-surface)', border: '2px solid #7c3aed', borderRadius: 20, overflow: 'hidden', textAlign: 'left', position: 'relative' as const, transform: isMobile ? 'none' : 'translateY(-10px)' }}
          >
            <div style={{ position: 'absolute' as const, top: 0, right: 16, background: '#7c3aed', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '0.04em', fontFamily: 'var(--font-ui)' }}>MOST POPULAR</div>
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#7c3aed', marginBottom: 6 }}>Loci Scholar</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: '#7c3aed', marginBottom: 2 }}>$13.99<span style={{ fontSize: 16, fontWeight: 500 }}>/mo</span></div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, opacity: 0.6 }}>or $139/yr — Save 2 months</div>
            </div>
            <div style={{ padding: '16px 20px 24px' }}>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 2, opacity: 0.8 }}>
                <li>Everything in Reader</li>
                <li>Loci Narration Pro — audiobook-quality voices</li>
                <li>Practice Quizzes</li>
                <li>Chapter Briefs</li>
                <li>Study Guide</li>
                <li>Flashcards</li>
              </ul>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, opacity: 0.7 }}>
                Students: $9.99/mo with code <strong>STUDENT</strong>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => openSignUp()}
                style={{ background: '#7c3aed', color: '#fff', fontFamily: 'var(--font-display)', fontStyle: 'italic' as const, fontSize: 15, padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer', width: '100%', marginTop: 16 }}>
                Get started
              </motion.button>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0 0', textAlign: 'center' as const }}>No credit card required · cancel anytime</p>
            </div>
          </motion.div>
        </div>
      </section>

      <div style={{ padding: '0 24px', background: 'var(--bg-secondary)' }}>
        <p style={{ textAlign: 'center', fontSize: 12, opacity: 0.45, fontFamily: 'var(--font-ui)', color: 'var(--text-tertiary)', margin: '0 auto', paddingBottom: 32, maxWidth: 600 }}>
          Loci uses advanced language models to power Practice Quizzes, Chapter Briefs, and Study Guide.
        </p>
      </div>

      {/* ── 12. FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: isMobile ? '80px 24px' : '100px 24px', background: 'var(--bg-primary)' }}>
        <motion.div {...inView} style={{ marginBottom: 56, textAlign: 'center' }}>
          <span style={labelStyle}>FAQ</span>
          <h2 style={{ ...h2Style, textAlign: 'center', margin: '12px 0 0' }}>Honest answers.</h2>
        </motion.div>
        <FAQAccordion />
      </section>

      {/* ── 13. Final CTA ────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--bg-secondary)', padding: isMobile ? '100px 24px 120px' : '140px 24px 160px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background watermark */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 'clamp(80px, 18vw, 220px)',
          color: 'var(--text-primary)', opacity: 0.03, pointerEvents: 'none', userSelect: 'none' as const, lineHeight: 1, whiteSpace: 'nowrap' as const,
        }}>
          Study.
        </div>
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 36 : 64, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.05, margin: '0 auto 20px', letterSpacing: '-0.025em', maxWidth: 720 }}>
            That 400-page textbook isn't going to read itself.
          </h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 17, color: 'var(--text-secondary)', margin: '0 auto 48px', maxWidth: 480, lineHeight: 1.65 }}>
            So let Loci read it for you. Upload your EPUB, hit play, and turn your commute into revision time.
          </p>
          <motion.button whileHover={{ scale: 1.02, boxShadow: '0 0 0 3px rgba(196,168,130,0.22)' }} whileTap={{ scale: 0.98 }} onClick={() => openSignUp()}
            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, padding: '18px 48px', borderRadius: 12, border: 'none', cursor: 'pointer', marginBottom: 20 }}>
            Start 7-day free trial
          </motion.button>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 14px' }}>
            No credit card required · Cancel anytime
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
            Already have an account?{' '}
            <span onClick={() => openSignIn()} style={{ color: 'var(--accent-warm)', cursor: 'pointer', textDecoration: 'underline' }}>Sign in</span>
          </p>
        </motion.div>
      </section>

      {/* ── 14. Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', padding: '28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Loci</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)' }}>© 2026</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="#privacy" style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}>
            Privacy Policy
          </a>
          <a href="#terms" style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}>
            Terms of Service
          </a>
          <button onClick={() => openSignIn()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)', padding: 0 }}>Sign in</button>
        </div>
      </footer>
    </div>
  )
}
