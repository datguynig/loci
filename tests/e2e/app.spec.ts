import { test, expect, type Page } from '@playwright/test'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_EPUB = path.join(__dirname, '../fixtures/test.epub')
const LONG_TEST_EPUB = path.join(__dirname, '../fixtures/long-test.epub')

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
      name: 'not-an-epub.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an epub'),
    })
    await expect(page.getByText("This file doesn't appear to be a valid EPUB")).toBeVisible()
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
    await expect(page.getByLabel('Font size sm')).toBeVisible()
    await expect(page.getByLabel('Font size xl')).toBeVisible()
    await expect(page.getByLabel('Scroll layout')).toBeVisible()
    await expect(page.getByLabel('Two page layout')).toBeVisible()
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
    await expect(page.getByLabel('Scroll layout')).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('Two page layout').click()
    await expect(page.getByLabel('Two page layout')).toHaveAttribute('aria-pressed', 'true')
  })

  test('spread mode enables page or chapter transport scope', async ({ page }) => {
    await page.getByLabel('Two page layout').click()
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
    await page.getByLabel('Two page layout').click()
    await page.getByLabel('Next page').click()
    await page.waitForTimeout(400)
    await page.getByLabel('Previous page').click()
    await page.waitForTimeout(400)
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
})

// ─── Reader: Font Size ─────────────────────────────────────────────────────

test.describe('Font size controls', () => {
  test.beforeEach(async ({ page }) => {
    await loadEpub(page)
    await waitForBookReady(page)
  })

  test('starts with md as the active font size', async ({ page }) => {
    await expect(page.getByLabel('Font size md')).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking XL font size marks it as active', async ({ page }) => {
    await page.getByLabel('Font size xl').click()
    await expect(page.getByLabel('Font size xl')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Font size md')).toHaveAttribute('aria-pressed', 'false')
  })

  test('+ keyboard shortcut increases font size', async ({ page }) => {
    await expect(page.getByLabel('Font size md')).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('+')
    await expect(page.getByLabel('Font size lg')).toHaveAttribute('aria-pressed', 'true')
  })

  test('- keyboard shortcut decreases font size', async ({ page }) => {
    await page.keyboard.press('+')
    await page.keyboard.press('-')
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
