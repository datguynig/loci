# Loci Design System

A practical reference for every design decision in Loci. Consult this before writing any inline styles or adding new components.

---

## Principles

**Apple meets Notion.** Clean, minimal, functional. Warm paper tones, not cold greys. Generous whitespace, not dense chrome. Every element earns its place.

**Use tokens, not hardcoded values.** All colours must come from CSS custom properties so dark mode works automatically. The only exceptions are the warm panel surfaces documented below.

**Overlay, never resize.** Panels that slide in must use `position: absolute` with `z-index` stacking — never adjust the epub viewer's width or the epubjs ResizeObserver will re-paginate the book.

---

## Colour Tokens

Defined in `src/styles/globals.css`. Applied via `var(--token-name)`.

### Semantic Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-primary` | `#F8F7F4` | `#111110` | Page background |
| `--bg-secondary` | `#EFEDE8` | `#1C1C1A` | Sidebar, panels, sunken areas |
| `--bg-surface` | `#FFFFFF` | `#242422` | Cards, modals, elevated surfaces |
| `--text-primary` | `#1A1A1A` | `#F0EDE8` | Body copy, headings |
| `--text-secondary` | `#6B6560` | `#8A8780` | Labels, captions, metadata |
| `--text-tertiary` | `#B0ACA6` | `#4A4845` | Placeholder, disabled, decorative |
| `--accent` | `#1A1A1A` | `#F0EDE8` | Primary action buttons |
| `--accent-warm` | `#C4A882` | `#C4A882` | Focus rings, TTS waveform, highlights |
| `--border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.07)` | Dividers, card edges |
| `--shadow` | `rgba(0,0,0,0.06)` | `rgba(0,0,0,0.3)` | Base shadow tint |

### Named Colours (Not Yet Tokenised)

These are used in specific components. Document them here so they stay consistent.

| Value | Use |
|---|---|
| `#F5F2EE` | Warm panel background — BookDetailModal left panel. Light mode only by design. |
| `#EAE7E1` | Warm panel border — right edge of BookDetailModal left panel. |
| `#FAFAF8` | Note card background — slightly warmer than `--bg-surface`. |
| `#FFF5F5` | Destructive chip background — delete buttons. |
| `#FECACA` | Destructive chip border. |
| `#DC2626` | Destructive text — delete button labels. |
| `#F5F3F0` | Neutral chip background — archive, secondary actions. |
| `#D8D4CD` | Neutral chip border. |

---

## Typography

Three fonts, three roles. Never mix them up.

| Font | CSS Var | Role | Size range | Weight |
|---|---|---|---|---|
| Playfair Display | `--font-display` | Wordmark, display headings | 20–28px | 400–700 |
| Lora | `--font-reading` | Book titles, quotes, EPUB body | 16–21px | 400–700 |
| DM Sans | `--font-ui` | All UI chrome, labels, buttons | 11–15px | 400–600 |

**Rule:** UI elements always use DM Sans (`var(--font-ui)`). Book-related content (title in modal, note quotes) uses Lora (`var(--font-reading)`). The wordmark is the only Playfair Display usage in the shell UI.

---

## Spacing

Base unit: **8px**. All spacing values are multiples.

Common values: `8 / 12 / 16 / 20 / 24 / 28 / 32px`

- Section breathing room within modals: `marginTop: 28`
- Standard panel padding: `24–32px`
- Compact UI padding (chips, badges): `7px 16px`
- Card internal padding: `10px 12px`

---

## Border Radius

| Value | Use |
|---|---|
| `6px` | Small chips, tags, badges |
| `8px` | Note cards, action chips, popovers |
| `10px` | Buttons, input fields, textareas |
| `12px` | Sidebar panels |
| `16px` | AudioBar, header bar |
| `20px` | Modals |

---

## Elevation & Shadow

Four levels. Use the right one — don't invent intermediates.

| Level | Value | Use |
|---|---|---|
| 1 — Subtle | `0 2px 8px var(--shadow)` | Cards, toolbars, book grid items |
| 2 — Panel | `0 8px 32px rgba(0,0,0,0.12)` | Sidebars, floating popovers |
| 3 — Modal | `0 32px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)` | Modals, dialogs |
| 4 — Cover | `0 8px 32px rgba(0,0,0,0.22), 3px 3px 0 rgba(0,0,0,0.06)` | Book cover images (3D depth effect) |

Modal backdrops: `background: rgba(0,0,0,0.38)` + `backdropFilter: blur(8px)` + `-webkit-backdrop-filter: blur(8px)`.

---

## Motion & Animation

All motion via **Framer Motion**. CSS transitions only for theme changes.

### Standard Patterns

| Pattern | Framer Motion Config | Use |
|---|---|---|
| Fade + slide up | `initial:{opacity:0,y:8}` → `animate:{opacity:1,y:0}` — 180ms easeOut | Toast enter/exit |
| Fade + scale | `initial:{opacity:0,scale:0.97}` → `animate:{opacity:1,scale:1}` — spring | Modals |
| Slide from right | `initial:{x:320}` → spring `stiffness:300, damping:30` | Notes panel, Sidebar |
| Page turn | `initial:{opacity:0,x:±24}` → `animate:{opacity:1,x:0}` | EPUB chapter transitions |
| Theme | `background-color 200ms ease-out, color 200ms ease-out` (CSS on `html/body`) | Global theme switch |

### Critical Rule

**Never use layout animations that resize the epub viewer container.** The epubjs ResizeObserver watches the viewer div and will re-paginate the book whenever its dimensions change — causing a visible flash/re-render.

Always use overlay panels:
```tsx
// ✅ Correct — panel overlays without resizing the viewer
<motion.div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 20 }} />

// ❌ Wrong — resizes the viewer, triggers epubjs re-pagination
<div style={{ right: panelOpen ? 320 : 0, transition: 'right 280ms ease' }} />
```

---

## Z-Index Scale

| Layer | Value | Component |
|---|---|---|
| Base | `0` | Normal content |
| Overlay | `10` | Sidebar, chapter nav bar |
| Notes panel | `20` | NotesPanel (inside reader) |
| Reader chrome | `30` | Header, AudioBar |
| Toast | `100` | Toast notifications |
| Modal backdrop | `200` | BookDetailModal overlay |
| Modal card | `201` | BookDetailModal card |

---

## Component Patterns

### Primary Button

```tsx
{
  background: '#1A1917',       // or var(--accent)
  color: '#FFFFFF',
  borderRadius: 10,
  padding: '10px 20px',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
}
```

### Ghost / Icon Button

No background, no border. Communicates via opacity on hover.

```tsx
{
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  opacity: 1,                  // 0.6 on hover
}
```

### Chip Button

Bordered pill for secondary actions. Two variants:

```tsx
// Neutral (archive, secondary)
{
  background: '#F5F3F0',
  border: '1px solid #D8D4CD',
  borderRadius: 8,
  padding: '7px 16px',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  fontWeight: 500,
  color: '#6B6560',
  cursor: 'pointer',
}

// Destructive (delete)
{
  background: '#FFF5F5',
  border: '1px solid #FECACA',
  borderRadius: 8,
  padding: '7px 16px',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  fontWeight: 500,
  color: '#DC2626',
  cursor: 'pointer',
}
```

### Input / Textarea

```tsx
{
  background: 'transparent',
  border: `1px solid ${focused ? 'rgba(196,168,130,0.6)' : '#E8E5E0'}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  resize: 'vertical',          // for textareas
}
```

Focus state toggled via `onFocus`/`onBlur` + local `focused` state (inline styles can't use `:focus`).

### Card

```tsx
{
  background: '#FAFAF8',
  borderRadius: 8,
  padding: '10px 12px',
}
```

### Modal

```tsx
// Backdrop
{
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.38)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  zIndex: 200,
}

// Card
{
  background: 'var(--bg-surface)',
  borderRadius: 20,
  maxWidth: 720,
  width: '90vw',
  boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)',
  zIndex: 201,
  position: 'relative',
}
```

### Toast

```tsx
// Container
{
  position: 'fixed',
  bottom: 116,     // above AudioBar (52px) + chapter nav (52px) + gap
  right: 16,
  zIndex: 100,
}

// Toast item
{
  background: 'var(--accent-warm)',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 13,
  boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
  maxWidth: 340,
}
```

---

## Dark Mode

**Rule:** Always use `var(--token)`. Never hardcode colour hex values in component inline styles.

```tsx
// ✅ Correct
color: 'var(--text-primary)'
background: 'var(--bg-surface)'

// ❌ Wrong — breaks dark mode
color: '#1A1A1A'
background: '#FFFFFF'
```

**Exceptions** — the warm panel colours are intentionally light-mode-only surfaces (they represent warm paper). They stay fixed in dark mode:
- `#F5F2EE` — BookDetailModal left panel
- `#EAE7E1` — BookDetailModal left panel border

These are editorial surfaces that should feel like physical paper regardless of system theme.

---

## Accessibility

- **Focus ring:** `outline: 2px solid var(--accent-warm); outline-offset: 2px` — set globally in `globals.css`, applies to all `:focus-visible` elements.
- **High contrast:** `@media (prefers-contrast: high)` overrides in `globals.css` — `--text-primary` goes to pure black/white.
- **Scrollbars:** 6px, `border-radius: 3px`, transparent track, `var(--border)` thumb.
- **ARIA:** Toast container uses `role="status" aria-live="polite"`. Modals should trap focus (Clerk handles this for auth; custom modals use `useEffect` with `Escape` key listener).

---

## EPUB Viewer Specifics

The epub content renders inside an `iframe` managed by epubjs. CSS injected into the iframe is separate from the shell UI. The `--font-reading`, `--bg-primary`, and `--text-primary` variables are injected into the iframe document at load time so the reading experience respects the current theme.

**Never apply shell UI styles inside the iframe** — they won't work and can conflict with epubjs pagination.

---

## Landing Page

`src/components/Landing.tsx` is a **distinct surface** from the app shell. It is the marketing page shown to signed-out users and is entirely self-contained — it does not share sidebar, reader, or modal component patterns.

**Inline styles are intentional here.** The landing page uses inline style objects throughout rather than shared component classes. This keeps it decoupled from the app shell and easier to iterate on independently.

**Colour tokens still apply.** All colour usage follows the semantic token system (`var(--accent-warm)`, `var(--bg-primary)`, `var(--text-secondary)`, etc.). No hardcoded colour hex values are introduced — the dark mode rules from above hold here too.

**Component-scoped CSS animations.** Two animations are defined inside a `<style>` tag within the component and are intentionally **not** extracted to `globals.css`, as they are only needed on this surface:

| Animation | Class / usage | Behaviour |
|---|---|---|
| `blink` | Inline on `<span>` in `Cursor` component | 1s step-end infinite opacity toggle; simulates a typewriter cursor |
| `waveform-bar` | `.waveform-bar` CSS class on `<div>` elements | Animates bar height for the audio waveform visualisation used in `SmallWaveform` and the hero narration section |

If either animation is ever needed outside the landing page, move them to `globals.css` at that point.
