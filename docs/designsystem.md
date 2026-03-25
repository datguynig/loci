# Loci Design System

A practical reference for every design decision in Loci. Consult this before writing any inline styles or adding new components.

---

## Principles

**Apple meets Notion.** Clean, minimal, functional. Warm paper tones, not cold greys. Generous whitespace, not dense chrome. Every element earns its place.

**Use tokens, not hardcoded values.** All colours must come from CSS custom properties so dark mode and palette switching work automatically. The only exceptions are the warm panel surfaces documented below.

**Overlay, never resize.** Panels that slide in must use `position: absolute` with `z-index` stacking — never adjust the epub viewer's width or the epubjs ResizeObserver will re-paginate the book.

---

## Colour System

Loci has two palettes. The active palette plus light/dark mode = four theme combinations. All four are defined in `src/styles/globals.css`.

### How Palettes Work

```
data-theme="dark"               — light/dark toggle (applied to document.documentElement)
data-color-scheme="slate"       — Slate palette override (omit for Library default)
```

`PaletteToggle` switches `data-color-scheme`. `ThemeToggle` switches `data-theme`.

### Library Palette (default)

Forest green accent + antique paper backgrounds + aged gold warm accent.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-primary` | `#F7F2E7` | `#0A0D0B` | Page background |
| `--bg-secondary` | `#EDE6D0` | `#111510` | Sidebar, panels, sunken areas |
| `--bg-surface` | `#FDFBF5` | `#172019` | Cards, modals, elevated surfaces |
| `--text-primary` | `#1A150E` | `#EDE8D5` | Body copy, headings |
| `--text-secondary` | `#5A5040` | `#9A9078` | Labels, captions, metadata |
| `--text-tertiary` | `#A09070` | `#3E4840` | Placeholder, disabled, decorative |
| `--accent` | `#1D6B48` | `#4DAA7A` | Primary actions, Reader tier colour |
| `--accent-subtle` | `rgba(29,107,72,0.08)` | `rgba(77,170,122,0.12)` | Accent tint backgrounds |
| `--accent-warm` | `#B8952A` | `#D4AE4A` | Scholar tier colour, highlights, focus rings |
| `--accent-warm-highlight` | `rgba(184,149,42,0.25)` | `rgba(212,174,74,0.25)` | Scholar card glow, warm tint |
| `--border` | `rgba(29,107,72,0.12)` | `rgba(77,170,122,0.15)` | Dividers, card edges |
| `--shadow` | `rgba(26,21,14,0.08)` | `rgba(0,0,0,0.5)` | Base shadow tint |

### Slate Palette (`data-color-scheme="slate"`)

Copper accent + warm cream/ink backgrounds. Overrides only the tokens that differ.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-primary` | `#FAFAF8` | `#0F0E0C` | Page background |
| `--bg-secondary` | `#F2F1EE` | `#1A1916` | Panels |
| `--bg-surface` | `#FFFFFF` | `#232220` | Cards, modals |
| `--text-primary` | `#1C1B18` | `#F0EDE5` | Body copy |
| `--text-secondary` | `#6B645A` | `#8A8278` | Labels |
| `--text-tertiary` | `#A09788` | `#4A4640` | Placeholder |
| `--accent` | `#B5622A` | `#D0773A` | Primary actions |
| `--accent-warm` | `#C8751E` | `#E0894A` | Warm highlights |
| `--border` | `rgba(181,98,42,0.12)` | `rgba(208,119,58,0.15)` | Dividers |

### Tier Colour Mapping

| Tier | Token | Use |
|---|---|---|
| Free | `--text-tertiary` | Muted, no active accent |
| Reader | `--accent` | Green (Library) / copper (Slate) |
| Scholar | `--accent-warm` | Gold (Library) / warm copper (Slate) |

### Semantic Error Tokens (theme-neutral)

| Token | Light | Dark |
|---|---|---|
| `--error` | `#DC2626` | `#F87171` |
| `--error-bg` | `#FEF2F2` | `#2D1215` |
| `--error-border` | `#FECACA` | `#7F1D1D` |
| `--error-text` | `#7F1D1D` | `#FCA5A5` |

### Named Colours (Not Tokenised)

These are used in specific components. Keep them consistent.

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
| `9–10px` | Buttons, input fields, textareas |
| `12px` | Sidebar panels |
| `16px` | AudioBar, header bar, pricing cards |
| `20px` | Modals |
| `99px` | Pill toggles, billing interval selectors |

---

## Elevation & Shadow

Four levels. Use the right one — don't invent intermediates.

| Level | Value | Use |
|---|---|---|
| 1 — Subtle | `0 2px 8px var(--shadow)` | Cards, toolbars, book grid items |
| 2 — Panel | `0 8px 32px rgba(0,0,0,0.12)` | Sidebars, floating popovers |
| 3 — Modal | `0 32px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)` | Modals, dialogs |
| 4 — Cover | `0 8px 32px rgba(0,0,0,0.22), 3px 3px 0 rgba(0,0,0,0.06)` | Book cover images (3D depth effect) |

Modal backdrops: `background: rgba(0,0,0,0.45)` + optional `backdropFilter: blur(8px)`.

Scholar card elevation (pricing): `0 0 0 4px var(--accent-warm-highlight), 0 8px 40px var(--shadow)` — outer glow ring rather than transform (keeps grid alignment).

---

## Motion & Animation

All motion via **Framer Motion**. CSS transitions only for theme changes.

### Standard Patterns

| Pattern | Framer Motion Config | Use |
|---|---|---|
| Fade + slide up | `initial:{opacity:0,y:8}` → `animate:{opacity:1,y:0}` — 180ms easeOut | Toast enter/exit |
| Fade + scale | `initial:{scale:0.96,opacity:0,y:8}` → `animate:{scale:1,opacity:1,y:0}` — 200ms | Modals (UpgradeModal, BookDetailModal) |
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
| UpgradeModal | `100` | UpgradeModal backdrop + card |
| Modal backdrop | `200` | BookDetailModal overlay |
| Modal card | `201` | BookDetailModal card |
| Clerk modal | `400+` | Rendered by Clerk SDK — always above our stack |

**UpgradeModal + Clerk interaction:** When triggering UpgradeModal from inside the Clerk UserProfile modal (e.g., the Subscription page), call `closeUserProfile()` first, then `setTimeout(onUpgrade, 200)` to let the Clerk modal animate out before UpgradeModal opens. This avoids z-index collision.

---

## Component Patterns

### Primary Button

```tsx
{
  background: 'var(--accent)',   // or var(--accent-warm) for Scholar tier
  color: 'var(--bg-primary)',
  borderRadius: 9,
  padding: '11px 0',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
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

### Pill Toggle (Billing interval, palette selector)

```tsx
{
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 99,
  padding: '5px 14px 5px 10px',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
}
```

### Input / Textarea

```tsx
{
  background: 'transparent',
  border: `1px solid ${focused ? 'rgba(196,168,130,0.6)' : 'var(--border)'}`,
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
  background: 'var(--bg-surface)',
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
  background: 'rgba(0,0,0,0.45)',
  zIndex: 200,  // or 100 for UpgradeModal
}

// Card
{
  background: 'var(--bg-primary)',
  borderRadius: 20,
  maxWidth: 580,  // UpgradeModal; 720 for BookDetailModal
  width: '100%',
  boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
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
  color: 'var(--bg-primary)',
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

// ❌ Wrong — breaks dark mode and palette switching
color: '#1A1A1A'
background: '#FFFFFF'
```

**Exceptions** — the warm panel colours are intentionally light-mode-only surfaces (they represent warm paper). They stay fixed in dark mode:
- `#F5F2EE` — BookDetailModal left panel
- `#EAE7E1` — BookDetailModal left panel border

These are editorial surfaces that should feel like physical paper regardless of system theme.

---

## Accessibility

- **Focus ring:** `outline: 2px solid var(--accent); outline-offset: 2px` — set globally in `globals.css`, applies to all `:focus-visible` elements.
- **High contrast:** `@media (prefers-contrast: high)` overrides in `globals.css` — `--text-primary` goes to pure black/white.
- **Scrollbars:** 6px, `border-radius: 3px`, transparent track, `var(--text-tertiary)` thumb.
- **ARIA:** Toast container uses `role="status" aria-live="polite"`. Modals should trap focus (Clerk handles this for auth; custom modals use `useEffect` with `Escape` key listener and `role="dialog" aria-modal={true}`).

---

## EPUB Viewer Specifics

The epub content renders inside an `iframe` managed by epubjs. CSS injected into the iframe is separate from the shell UI. The `--font-reading`, `--bg-primary`, and `--text-primary` variables are injected into the iframe document at load time so the reading experience respects the current theme.

**Never apply shell UI styles inside the iframe** — they won't work and can conflict with epubjs pagination.

---

## Landing Page

`src/components/Landing.tsx` is a **distinct surface** from the app shell. It is the marketing page shown to signed-out users and is entirely self-contained — it does not share sidebar, reader, or modal component patterns.

**Inline styles are intentional here.** The landing page uses inline style objects throughout rather than shared component classes. This keeps it decoupled from the app shell and easier to iterate on independently.

**Colour tokens still apply.** All colour usage follows the semantic token system (`var(--accent-warm)`, `var(--bg-primary)`, `var(--text-secondary)`, etc.). No hardcoded colour hex values are introduced — the dark mode and palette rules above hold here too.

**Pricing section specifics:**
- Three-column card grid (Free / Reader / Scholar) with equal-height cards via `alignItems: 'stretch'`
- Billing interval toggle is a pill (`borderRadius: 99`) using `var(--bg-surface)` background
- Feature list items use `var(--text-primary)` for contrast (not `--text-secondary`)
- Scholar card uses `box-shadow: 0 0 0 4px var(--accent-warm-highlight)` as an outer glow ring
- "No credit card required" appears as a single centred line below the card grid

**Component-scoped CSS animations.** Two animations are defined inside a `<style>` tag within the component:

| Animation | Class / usage | Behaviour |
|---|---|---|
| `blink` | Inline on `<span>` in `Cursor` component | 1s step-end infinite opacity toggle; simulates a typewriter cursor |
| `waveform-bar` | `.waveform-bar` CSS class on `<div>` elements | Animates bar height for the audio waveform visualisation |

If either animation is ever needed outside the landing page, move them to `globals.css` at that point.
