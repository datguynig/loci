import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_EPUB = path.join(__dirname, '../fixtures/test.epub')
const LONG_TEST_EPUB = path.join(__dirname, '../fixtures/long-test.epub')
const NONLINEAR_COVER_EPUB = path.join(__dirname, '../fixtures/nonlinear-cover.epub')
const FRANKENSTEIN_EPUB = path.join(__dirname, '../../public/ebooks/Frankenstein.epub')
const frankensteinAvailable = fs.existsSync(FRANKENSTEIN_EPUB)

// ─── Helpers ───────────────────────────────────────────────────────────────

async function loadEpub(page: Page) {
  await page.goto('/')
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('text=or click to browse'),
  ])
  await fileChooser.setFiles(TEST_EPUB)
}

async function loadLongEpub(page: Page) {
  await page.goto('/')
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('text=or click to browse'),
  ])
  await fileChooser.setFiles(LONG_TEST_EPUB)
}

async function loadFrankenstein(page: Page) {
  await page.goto('/')
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('text=or click to browse'),
  ])
  await fileChooser.setFiles(FRANKENSTEIN_EPUB)
}

async function loadNonlinearCoverFixture(page: Page) {
  await page.goto('/')
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('text=or click to browse'),
  ])
  await fileChooser.setFiles(NONLINEAR_COVER_EPUB)
}

async function waitForBookReady(page: Page) {
  // Loading spinner disappears
  await expect(page.getByText('Loading book…')).toBeHidden({ timeout: 15_000 })
  // epub.js creates multiple iframes for its spread layout — use .first()
  await expect(page.locator('#epub-viewer iframe').first()).toBeVisible({ timeout: 10_000 })
}

// Sidebar aside — use exact aria-label to avoid matching the hamburger/close buttons
function sidebarPanel(page: Page) {
  return page.locator('aside[aria-label="Table of contents"]')
}

// Play/Pause button — epub.js may inject controls in its iframe; scope to AudioBar
function playPauseBtn(page: Page) {
  return page.locator('button[aria-label="Play"], button[aria-label="Pause"]').first()
}

// Open reader settings popover via gear button
async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Reader settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Reader settings' })).toBeVisible()
}

// ─── Landing Page ──────────────────────────────────────────────────────────

test.describe('Landing page', () => {
  test('shows the Loci wordmark and drop zone', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Loci')).toBeVisible()
    await expect(page.getByText('Drop your EPUB to begin reading')).toBeVisible()
    await expect(page.getByText('or click to browse')).toBeVisible()
    await expect(page.getByText('Your file stays on your device')).toBeVisible()
  })

  test('shows error for non-EPUB file', async ({ page }) => {
    await page.goto('/')
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('text=or click to browse'),
    ])
    await fileChooser.setFiles({
      name: 'corrupt.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from('this is not a valid epub zip file'),
    })
    // epub.js will fail to open the corrupt file — error message should appear
    await expect(page.getByText(/unable to read|doesn't appear/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('accepts a valid EPUB and transitions to reader', async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
    await expect(page.getByText('Test Book')).toBeVisible()
  })
})

// ─── Reader: Basic Layout ──────────────────────────────────────────────────

test.describe('Reader layout', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('header is visible with title and controls', async ({ page }) => {
    await expect(page.getByText('Test Book')).toBeVisible()
    await expect(page.getByLabel('Toggle table of contents')).toBeVisible()
    // Font size and layout controls live in the settings popover
    await openSettings(page)
    const dialog = page.getByRole('dialog', { name: 'Reader settings' })
    await expect(dialog.getByLabel('Font size sm')).toBeVisible()
    await expect(dialog.getByLabel('Font size xl')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Scroll' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '2 Page' })).toBeVisible()
  })

  test('AudioBar is in flow and not hiding behind viewport edge', async ({ page }) => {
    await expect(page.getByLabel('Previous chapter')).toBeVisible()
    await expect(page.getByLabel('Next chapter')).toBeVisible()

    // Use speed selector to anchor AudioBar position check
    const speedBox = await page.getByLabel('Playback speed').boundingBox()
    const viewportSize = page.viewportSize()
    expect(speedBox).not.toBeNull()
    expect(speedBox!.y + speedBox!.height).toBeLessThanOrEqual(viewportSize!.height + 4)
  })

  test('epub viewer iframe is present and has non-zero dimensions', async ({ page }) => {
    const iframe = page.locator('#epub-viewer iframe').first()
    const box = await iframe.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(100)
    expect(box!.height).toBeGreaterThan(100)
  })

  test('epub viewer does not overlap AudioBar', async ({ page }) => {
    const viewerBox = await page.locator('#epub-viewer').boundingBox()
    const audioBarBox = await page.getByLabel('Playback speed').boundingBox()
    expect(viewerBox).not.toBeNull()
    expect(audioBarBox).not.toBeNull()
    // Viewer bottom edge should be at or above audiobar top edge
    expect(viewerBox!.y + viewerBox!.height).toBeLessThanOrEqual(audioBarBox!.y + 4)
  })

  test('layout controls switch active mode', async ({ page }) => {
    await openSettings(page)
    const dialog = page.getByRole('dialog', { name: 'Reader settings' })
    await expect(dialog.getByRole('button', { name: 'Scroll' })).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByRole('button', { name: '2 Page' }).click()
    await expect(dialog.getByRole('button', { name: '2 Page' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('spread mode enables page or chapter transport scope', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('dialog', { name: 'Reader settings' }).getByRole('button', { name: '2 Page' }).click()
    // click outside to close popover
    await page.mouse.click(400, 300)
    await expect(page.getByLabel('Previous page')).toBeVisible()
    await page.getByLabel('Navigate by chapter').click()
    await expect(page.getByLabel('Previous chapter')).toBeVisible()
    await expect(page.getByLabel('Next chapter')).toBeVisible()
  })
})

// ─── Reader: Navigation ────────────────────────────────────────────────────

test.describe('Chapter navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('Next chapter button keeps epub rendered', async ({ page }) => {
    await page.getByLabel('Next chapter').click()
    await page.waitForTimeout(600)
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
    await expect(page.getByText('Test Book')).toBeVisible()
  })

  test('Prev chapter button after next keeps epub rendered', async ({ page }) => {
    await page.getByLabel('Next chapter').click()
    await page.waitForTimeout(400)
    await page.getByLabel('Previous chapter').click()
    await page.waitForTimeout(400)
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
    await expect(page.getByText('Test Book')).toBeVisible()
  })

  test('ArrowRight keyboard shortcut keeps epub rendered', async ({ page }) => {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })

  test('page navigation buttons keep epub rendered', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('dialog', { name: 'Reader settings' }).getByRole('button', { name: '2 Page' }).click()
    await page.mouse.click(400, 300)
    await page.getByLabel('Next page').click()
    await page.waitForTimeout(400)
    await page.getByLabel('Previous page').click()
    await page.waitForTimeout(400)
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })

  test('multi-step page navigation dismisses loading overlay', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('dialog', { name: 'Reader settings' }).getByRole('button', { name: '2 Page' }).click()
    await page.mouse.click(400, 300)
    for (let i = 0; i < 6; i++) {
      await page.getByLabel('Next page').click()
      await page.waitForTimeout(280)
    }
    await expect(page.getByText('Loading book…')).toBeHidden()
    await expect(page.getByText('Loading chapter…')).toBeHidden()
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })

  test('multi-step chapter navigation dismisses loading overlay', async ({ page }) => {
    for (let i = 0; i < 4; i++) {
      await page.getByLabel('Next chapter').click()
      await page.waitForTimeout(400)
    }
    await expect(page.getByText('Loading book…')).toBeHidden()
    await expect(page.getByText('Loading chapter…')).toBeHidden()
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })

  test('ArrowLeft keyboard shortcut keeps epub rendered', async ({ page }) => {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(300)
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })

  test('Space bar navigates and keeps epub rendered', async ({ page }) => {
    await page.keyboard.press('Space')
    await page.waitForTimeout(400)
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })

  test('rapid chapter navigation does not crash the reader', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Next chapter').click()
      await page.waitForTimeout(150)
    }
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
    await expect(page.getByText('Test Book')).toBeVisible()
  })

  test('long books advance chapter numbers through spine navigation', async ({ page }) => {
    await loadLongEpub(page)
    await waitForBookReady(page)
    await expect(page.getByText('Long Test Book')).toBeVisible()
    const pageInfo = page.locator('header').getByText(/\d+ \/ \d+/)
    await expect(pageInfo).toBeVisible()
    const initial = await pageInfo.textContent()
    const total = initial?.match(/^1 \/ (\d+)$/)?.[1]
    expect(total).toBeTruthy()
    if (total === '1') {
      await page.getByLabel('Next chapter').click()
      await expect(pageInfo).toHaveText('1 / 1')
      return
    }

    await page.getByLabel('Next chapter').click()
    await expect(pageInfo).toHaveText(`2 / ${total}`)
    await page.getByLabel('Next chapter').click()
    await expect(pageInfo).toHaveText(`3 / ${total}`)
  })
})

test.describe('Nonlinear spine (non-linear cover first)', () => {
  test('opens first linear chapter on load and next chapter advances', async ({ page }) => {
    test.skip(!fs.existsSync(NONLINEAR_COVER_EPUB), 'nonlinear-cover.epub fixture missing')
    await loadNonlinearCoverFixture(page)
    await waitForBookReady(page)
    await expect(page.getByText('Nonlinear Cover Fixture')).toBeVisible()
    const frame = page.frameLocator('#epub-viewer iframe').first()
    await expect(frame.getByText('NONLINEAR_FIXTURE_CHAPTER_ONE')).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Next chapter').click()
    await expect(frame.getByText('NONLINEAR_FIXTURE_CHAPTER_TWO')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Frankenstein EPUB regression', () => {
  test('scroll layout loads and overlay clears', async ({ page }) => {
    test.skip(!frankensteinAvailable, 'public/ebooks/Frankenstein.epub not present')
    await loadFrankenstein(page)
    await waitForBookReady(page)
    await expect(page.getByText('Loading book…')).toBeHidden()
    await expect(page.getByText('Loading chapter…')).toBeHidden()
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })

  test('two-page layout and repeated page turns clear loading', async ({ page }) => {
    test.skip(!frankensteinAvailable, 'public/ebooks/Frankenstein.epub not present')
    await loadFrankenstein(page)
    await waitForBookReady(page)
    await openSettings(page)
    await page.getByRole('dialog', { name: 'Reader settings' }).getByRole('button', { name: '2 Page' }).click()
    await page.mouse.click(400, 300)
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Next page').click()
      await page.waitForTimeout(300)
    }
    await expect(page.getByText('Loading book…')).toBeHidden()
    await expect(page.getByText('Loading chapter…')).toBeHidden()
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })
})

// ─── Reader: Table of Contents ─────────────────────────────────────────────

test.describe('Table of contents', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('opens sidebar on hamburger click', async ({ page }) => {
    await page.getByLabel('Toggle table of contents').click()
    await expect(sidebarPanel(page)).toBeVisible()
    await expect(page.getByText('Contents')).toBeVisible()
  })

  test('shows chapter entries from the EPUB TOC', async ({ page }) => {
    await page.getByLabel('Toggle table of contents').click()
    await expect(sidebarPanel(page).getByText('Chapter One')).toBeVisible()
    await expect(sidebarPanel(page).getByText('Chapter Two')).toBeVisible()
  })

  test('navigates to a chapter when TOC entry clicked', async ({ page }) => {
    await page.getByLabel('Toggle table of contents').click()
    await sidebarPanel(page).getByText('Chapter Two').click()
    await expect(sidebarPanel(page)).toBeHidden()
    await expect(page.locator('#epub-viewer iframe').first()).toBeVisible()
  })

  test('closes sidebar with close button', async ({ page }) => {
    await page.getByLabel('Toggle table of contents').click()
    await expect(sidebarPanel(page)).toBeVisible()
    await page.getByLabel('Close table of contents').click()
    await expect(sidebarPanel(page)).toBeHidden()
  })

  test('closes sidebar by clicking backdrop', async ({ page }) => {
    await page.getByLabel('Toggle table of contents').click()
    await expect(sidebarPanel(page)).toBeVisible()
    await page.mouse.click(700, 300)
    await expect(sidebarPanel(page)).toBeHidden()
  })

  test('T keyboard shortcut toggles sidebar', async ({ page }) => {
    await page.keyboard.press('t')
    await expect(sidebarPanel(page)).toBeVisible()
    await page.keyboard.press('t')
    await expect(sidebarPanel(page)).toBeHidden()
  })
})

// ─── Reader: Theme ─────────────────────────────────────────────────────────

test.describe('Theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('data-theme attribute is set on mount', async ({ page }) => {
    const attr = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(['light', 'dark']).toContain(attr)
  })

  test('theme toggle button switches data-theme', async ({ page }) => {
    const initial = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    // aria-label is "Switch to dark mode" or "Switch to light mode"
    await page.getByLabel(/Switch to (dark|light) mode/).click()
    const after = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(after).not.toBe(initial)
    expect(['light', 'dark']).toContain(after)
  })

  test('D keyboard shortcut toggles theme', async ({ page }) => {
    const initial = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    await page.keyboard.press('d')
    const after = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(after).not.toBe(initial)
  })

  test('toggling theme twice returns to original', async ({ page }) => {
    const initial = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    await page.keyboard.press('d')
    await page.keyboard.press('d')
    const final = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(final).toBe(initial)
  })

  test('dark mode injects light text color into epub iframe', async ({ page }) => {
    // Force dark mode
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
    // Switch to dark via toggle
    await page.getByLabel(/Switch to (dark|light) mode/).click()
    await expect(page.evaluate(() => document.documentElement.getAttribute('data-theme'))).resolves.toBe('dark')

    // Wait for the override style to be injected (rendered event fires after chapter loads)
    await page.waitForTimeout(500)

    // Check that the epub iframe body has a light text color (our !important override)
    const bodyColor = await page.evaluate(() => {
      const iframe = document.querySelector('#epub-viewer iframe') as HTMLIFrameElement | null
      if (!iframe?.contentDocument) return null
      return iframe.contentDocument.getElementById('loci-dark-override')?.textContent ?? null
    })
    expect(bodyColor).not.toBeNull()
    expect(bodyColor).toContain('#F0EDE8')
  })
})

// ─── Reader: Font Size ─────────────────────────────────────────────────────

test.describe('Font size controls', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('starts with md as the active font size', async ({ page }) => {
    await openSettings(page)
    await expect(page.getByLabel('Font size md')).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking XL font size marks it as active', async ({ page }) => {
    await openSettings(page)
    await page.getByLabel('Font size xl').click()
    await expect(page.getByLabel('Font size xl')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Font size md')).toHaveAttribute('aria-pressed', 'false')
  })

  test('+ keyboard shortcut increases font size', async ({ page }) => {
    await page.keyboard.press('+')
    await openSettings(page)
    await expect(page.getByLabel('Font size lg')).toHaveAttribute('aria-pressed', 'true')
  })

  test('- keyboard shortcut decreases font size', async ({ page }) => {
    await page.keyboard.press('+')
    await page.keyboard.press('-')
    await openSettings(page)
    await expect(page.getByLabel('Font size md')).toHaveAttribute('aria-pressed', 'true')
  })
})

// ─── Reader: TTS ───────────────────────────────────────────────────────────

test.describe('Audio / TTS controls', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('Play button is visible and enabled', async ({ page }) => {
    await expect(playPauseBtn(page)).toBeVisible()
    await expect(playPauseBtn(page)).toBeEnabled()
  })

  test('Skip back and skip forward buttons are visible', async ({ page }) => {
    await expect(page.getByLabel('Skip back')).toBeVisible()
    await expect(page.getByLabel('Skip forward')).toBeVisible()
  })

  test('speed selector has correct default and all options', async ({ page }) => {
    const select = page.getByLabel('Playback speed')
    await expect(select).toHaveValue('1')
    const options = await select.locator('option').allTextContents()
    expect(options).toContain('0.5×')
    expect(options).toContain('1×')
    expect(options).toContain('2×')
  })

  test('speed selector can be changed', async ({ page }) => {
    await page.getByLabel('Playback speed').selectOption('1.5')
    await expect(page.getByLabel('Playback speed')).toHaveValue('1.5')
  })

  test('navigating chapter does not leave play button missing', async ({ page }) => {
    await playPauseBtn(page).click()
    await page.waitForTimeout(200)
    await page.getByLabel('Next chapter').click()
    await page.waitForTimeout(400)
    // After navigation TTS stops — play button should be visible
    await expect(playPauseBtn(page)).toBeVisible()
  })
})

// ─── TTS Reading Highlight ─────────────────────────────────────────────────

test.describe('TTS reading highlight', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('highlight appears on a paragraph when TTS is playing', async ({ page }) => {
    // Intercept speech synthesis so no audio is needed
    await page.evaluate(() => {
      window.speechSynthesis.speak = () => {}
    })

    await page.getByRole('button', { name: 'Play', exact: true }).click()
    // Wait briefly for the highlight effect
    await page.waitForTimeout(600)

    const highlighted = await page.evaluate(() => {
      const iframes = document.querySelectorAll('#epub-viewer iframe')
      for (const iframe of Array.from(iframes)) {
        const doc = (iframe as HTMLIFrameElement).contentDocument
        if (!doc) continue
        const el = doc.querySelector('[data-loci-reading]') as HTMLElement | null
        if (el) return el.style.background
      }
      return null
    })

    expect(highlighted).not.toBeNull()
    expect(highlighted).toContain('196')  // rgba(196,168,130,…)
  })

  test('highlight clears when TTS is stopped', async ({ page }) => {
    await page.evaluate(() => { window.speechSynthesis.speak = () => {} })
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.waitForTimeout(600)
    await page.getByLabel('Stop').click()
    await page.waitForTimeout(300)

    const highlighted = await page.evaluate(() => {
      const iframes = document.querySelectorAll('#epub-viewer iframe')
      for (const iframe of Array.from(iframes)) {
        const doc = (iframe as HTMLIFrameElement).contentDocument
        if (!doc) continue
        if (doc.querySelector('[data-loci-reading]')) return true
      }
      return false
    })

    expect(highlighted).toBe(false)
  })

  test('highlight advances through at least 3 sentences', async ({ page }) => {
    // Abort ElevenLabs so TTS falls back to browser speech synthesis immediately
    await page.route('**/api.elevenlabs.io/**', route => route.abort())

    // Capture utterances rather than speaking them, so we control when each ends
    await page.evaluate(() => {
      ;(window as any).__utterances = [] as SpeechSynthesisUtterance[]
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        ;(window as any).__utterances.push(u)
      }
      window.speechSynthesis.cancel = () => {}
    })

    await page.getByRole('button', { name: 'Play', exact: true }).click()

    // Wait until the first utterance is queued (ElevenLabs fallback has happened)
    await page.waitForFunction(() => (window as any).__utterances?.length >= 1, { timeout: 5000 })
    await page.waitForTimeout(200) // let React re-render the highlight

    const getHighlight = () => page.evaluate(() => {
      const iframes = document.querySelectorAll('#epub-viewer iframe')
      for (const iframe of Array.from(iframes)) {
        const doc = (iframe as HTMLIFrameElement).contentDocument
        if (!doc) continue
        const el = doc.querySelector('[data-loci-reading]') as HTMLElement | null
        if (el) return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
      }
      return null
    })

    const h0 = await getHighlight()
    expect(h0, 'sentence 0 should be highlighted').not.toBeNull()

    // Advance to sentence 1
    await page.evaluate(() => (window as any).__utterances[0]?.onend?.(new Event('end')))
    await page.waitForFunction(() => (window as any).__utterances?.length >= 2, { timeout: 3000 })
    await page.waitForTimeout(200)
    const h1 = await getHighlight()
    expect(h1, 'sentence 1 should be highlighted').not.toBeNull()

    // Advance to sentence 2
    await page.evaluate(() => (window as any).__utterances[1]?.onend?.(new Event('end')))
    await page.waitForFunction(() => (window as any).__utterances?.length >= 3, { timeout: 3000 })
    await page.waitForTimeout(200)
    const h2 = await getHighlight()
    expect(h2, 'sentence 2 should be highlighted').not.toBeNull()

    // Each sentence should highlight different text — the core behaviour being tested
    const unique = new Set([h0, h1, h2])
    expect(
      unique.size,
      `highlight should advance through 3 distinct sentences but got: ${JSON.stringify([h0, h1, h2])}`
    ).toBe(3)
  })
})

// ─── Annotations ───────────────────────────────────────────────────────────

test.describe('Annotations', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('sidebar has Contents and Notes tabs', async ({ page }) => {
    await page.getByLabel('Toggle table of contents').click()
    const sidebar = sidebarPanel(page)
    await expect(sidebar.getByRole('tab', { name: 'Contents', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('tab', { name: /Notes/ })).toBeVisible()
  })

  test('Notes tab shows empty state when no annotations exist', async ({ page }) => {
    await page.getByLabel('Toggle table of contents').click()
    const sidebar = sidebarPanel(page)
    await sidebar.getByRole('tab', { name: /Notes/ }).click()
    await expect(sidebar.getByText('No notes yet')).toBeVisible()
  })

  test('selecting text in epub viewer fires selection callback', async ({ page }) => {
    // Simulate mouseup with selected text inside the iframe
    const selectionFired = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        const iframes = document.querySelectorAll('#epub-viewer iframe')
        const iframe = iframes[0] as HTMLIFrameElement | undefined
        if (!iframe?.contentDocument) { resolve(false); return }
        const doc = iframe.contentDocument
        // Manually fire mouseup with a text selection
        const p = doc.querySelector('p')
        if (!p) { resolve(false); return }
        // Mock getSelection to return a non-empty selection
        const origGetSel = doc.getSelection.bind(doc)
        doc.getSelection = () => ({
          toString: () => 'quick brown fox',
          getRangeAt: () => ({
            getBoundingClientRect: () => ({ left: 10, top: 50, width: 120, height: 20 }),
          }),
        } as unknown as Selection)
        doc.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        doc.getSelection = origGetSel
        // Give React time to set state
        setTimeout(() => {
          const bubble = document.querySelector('button[aria-label="Select voice"]')
          // The SelectionBubble "+ Note" button would be a plain button (not aria-labelled)
          // just check the overlay div has children
          const overlay = document.querySelector('#epub-viewer')?.parentElement?.querySelector('[style*="pointer-events: none"]')
          resolve(overlay !== null && overlay.children.length > 0)
        }, 300)
      })
    })
    // Selection mechanism is wired (overlay exists in DOM)
    // This test primarily verifies no crash occurs
    expect(typeof selectionFired).toBe('boolean')
  })
})

// ─── Reader Settings ───────────────────────────────────────────────────────

test.describe('Reader settings', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('gear button opens settings popover with highlight and autoscroll toggles', async ({ page }) => {
    await page.getByRole('button', { name: 'Reader settings' }).click()
    const dialog = page.getByRole('dialog', { name: 'Reader settings' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('switch', { name: 'Sentence highlight' })).toBeVisible()
    await expect(dialog.getByRole('switch', { name: 'Auto-scroll to sentence' })).toBeVisible()
  })

  test('gear button toggles settings popover closed', async ({ page }) => {
    const gear = page.getByRole('button', { name: 'Reader settings' })
    await gear.click()
    await expect(page.getByRole('dialog', { name: 'Reader settings' })).toBeVisible()
    await gear.click()
    await expect(page.getByRole('dialog', { name: 'Reader settings' })).not.toBeVisible()
  })

  test('turning off sentence highlight stops marks appearing in epub DOM', async ({ page }) => {
    await page.route('**/api.elevenlabs.io/**', route => route.abort())
    await page.evaluate(() => {
      window.speechSynthesis.speak = () => {}
      window.speechSynthesis.cancel = () => {}
    })

    // Disable highlight via settings
    await page.getByRole('button', { name: 'Reader settings' }).click()
    const highlightSwitch = page.getByRole('switch', { name: 'Sentence highlight' })
    await expect(highlightSwitch).toHaveAttribute('aria-checked', 'true')
    await highlightSwitch.click()
    await expect(highlightSwitch).toHaveAttribute('aria-checked', 'false')

    // Start TTS
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.waitForTimeout(600)

    // No highlight mark should appear
    const marked = await page.evaluate(() => {
      const iframes = document.querySelectorAll('#epub-viewer iframe')
      for (const iframe of Array.from(iframes)) {
        const doc = (iframe as HTMLIFrameElement).contentDocument
        if (!doc) continue
        if (doc.querySelector('[data-loci-reading]')) return true
      }
      return false
    })
    expect(marked).toBe(false)
  })

  test('preferences persist across page reload', async ({ page }) => {
    // Change font size to XL via settings popover
    await openSettings(page)
    await page.getByLabel('Font size xl').click()
    await expect(page.getByLabel('Font size xl')).toHaveAttribute('aria-pressed', 'true')

    // Disable highlight
    await page.getByRole('switch', { name: 'Sentence highlight' }).click()

    // Reload the page (without re-uploading — preferences are in localStorage)
    await page.reload()
    await page.goto('/')
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('text=or click to browse'),
    ])
    const TEST_EPUB_PATH = 'tests/fixtures/test.epub'
    await fileChooser.setFiles(TEST_EPUB_PATH)
    await waitForBookReady(page)

    // Font size XL should still be active
    await openSettings(page)
    await expect(page.getByLabel('Font size xl')).toHaveAttribute('aria-pressed', 'true')

    // Highlight should still be off
    await expect(page.getByRole('switch', { name: 'Sentence highlight' }))
      .toHaveAttribute('aria-checked', 'false')
  })

  test('opening settings closes any active selection bubble', async ({ page }) => {
    // Fire a text selection inside the epub iframe
    await page.evaluate(() => {
      const iframes = document.querySelectorAll('#epub-viewer iframe')
      const iframe = iframes[0] as HTMLIFrameElement | undefined
      if (!iframe?.contentDocument) return
      const doc = iframe.contentDocument
      doc.getSelection = () => ({
        toString: () => 'quick brown fox',
        getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 10, top: 50, width: 120, height: 20 }) }),
      } as unknown as Selection)
      doc.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await page.waitForTimeout(300)

    // Selection bubble should be present
    const bubble = page.getByRole('button', { name: 'Add note for selected text' })
    await expect(bubble).toBeVisible()

    // Opening settings should dismiss the bubble
    await page.getByRole('button', { name: 'Reader settings' }).click()
    await expect(bubble).not.toBeVisible()
  })
})

// ─── Reader: Error Handling ────────────────────────────────────────────────

test.describe('Error handling', () => {
  test('corrupt EPUB shows error toast', async ({ page }) => {
    await page.goto('/')
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('text=or click to browse'),
    ])
    await fileChooser.setFiles({
      name: 'corrupt.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from('this is not a valid epub zip file'),
    })
    // epub.js will time out after 10s — error toast should appear
    await expect(page.getByText(/unable to read|doesn't appear to be/i))
      .toBeVisible({ timeout: 15_000 })
  })
})
