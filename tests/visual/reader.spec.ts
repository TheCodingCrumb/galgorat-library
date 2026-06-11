import { expect, test } from '@playwright/test'

test('renders A5 page and visible controls', async ({ page }, testInfo) => {
  await page.goto('/books/galgorat')

  const papers = page.locator('.paper-page:visible')
  await expect(papers).toHaveCount(1)
  if (testInfo.project.name === 'desktop') {
    await expect(page.locator('.book-flip')).toHaveClass(/book-flip--cover-state/)
    await expect(page.locator('.book-flip')).not.toHaveClass(/book-flip--first-page/)
  }
  await expect(papers.first()).toHaveClass(/paper-page--front-cover/)
  await expect(papers.first()).toHaveAttribute('aria-label', /Couverture Galgorat Library/)
  await expect(page.locator('.nav-button')).toHaveCount(2)
  await expect(page.locator('.reader-nav')).toHaveClass(/reader-nav--sr-only/)
  const navBox = await page.locator('.reader-nav').boundingBox()
  expect(navBox).not.toBeNull()
  expect(navBox!.width).toBeLessThanOrEqual(1)
  expect(navBox!.height).toBeLessThanOrEqual(1)
  await expect(page.locator('.reader-count')).toHaveCount(0)
  await expect(page.locator('.paper-footer')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/\d+\s*\/\s*\d+/)

  const box = await papers.first().boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs((box!.width / box!.height) - (148 / 210))).toBeLessThan(0.02)
})

test('desktop navigation opens a two-page journal spread', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop spread behavior.')

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/books/galgorat')

  const firstPageBox = await page.locator('.paper-page:visible').boundingBox()
  expect(firstPageBox).not.toBeNull()

  await page.locator('.paper-page--front-cover:visible').click({ position: { x: 500, y: 720 } })
  await page.waitForTimeout(900)

  const papers = page.locator('.paper-page:visible')
  await expect(papers).toHaveCount(2)
  await expect(papers.first()).toHaveClass(/paper-page--inside-cover/)
  await expect(papers.nth(1)).toContainText('Ouverture')
  await expect(page.locator('body')).not.toContainText(/\d+\s*\/\s*\d+/)

  const openedContentPageBox = await papers.nth(1).boundingBox()
  expect(openedContentPageBox).not.toBeNull()
  expect(Math.abs(openedContentPageBox!.x - firstPageBox!.x)).toBeLessThanOrEqual(2)

  const checks = await papers.evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect()
    const content = node.querySelector('.paper-content')
    return {
      ratio: box.width / box.height,
      overflow: content
        ? content.scrollHeight > content.clientHeight || content.scrollWidth > content.clientWidth
        : false
    }
  }))

  for (const check of checks) {
    expect(Math.abs(check.ratio - (148 / 210))).toBeLessThan(0.03)
    expect(check.overflow).toBe(false)
  }

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)
  await expect(page.locator('.paper-page:visible').first()).toContainText(/L.archive basse/)
  await expect(page.locator('.paper-page:visible').nth(1)).toContainText('La carte fendue')

  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(900)
  await expect(page.locator('.paper-page:visible').first()).toHaveClass(/paper-page--inside-cover/)
  await expect(page.locator('.paper-page:visible').nth(1)).toContainText('Ouverture')

  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(900)
  await expect(page.locator('.paper-page--front-cover:visible')).toHaveCount(1)
})

test('mobile navigation keeps a single readable page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile single-page behavior.')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/books/galgorat')

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)

  await expect(page.locator('.paper-page:visible')).toHaveCount(1)
  await expect(page.locator('.paper-page:visible')).toContainText('Ouverture')
})

test('keyboard navigation and reduced motion keep reader usable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Keyboard navigation is a desktop behavior.')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/books/galgorat')
  await expect(page.locator('.paper-page--front-cover:visible')).toHaveCount(1)

  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.paper-page:visible')).toHaveCount(1)
  await expect(page.locator('.paper-page:visible')).toContainText('Ouverture')

  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.paper-page:visible')).toHaveCount(1)
  await expect(page.locator('.paper-page--front-cover:visible')).toHaveCount(1)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.paper-page--back-cover:visible')).toHaveCount(1)
})

test('last spread remains stable at the end of the book', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop end-spread behavior.')

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/books/galgorat')

  await expect(page.locator('.paper-page--front-cover:visible')).toHaveCount(1)

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)
  await expect(page.locator('.paper-page:visible').nth(1)).toContainText('Ouverture')

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)
  await expect(page.locator('.paper-page:visible').first()).toContainText(/L.archive basse/)

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)

  const papers = page.locator('.paper-page:visible')
  await expect(papers).toHaveCount(2)
  await expect(papers.first()).toContainText(/Le serment du passeur/)
  await expect(papers.nth(1)).toContainText(/L.encre des ruines/)

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)
  await expect(page.locator('.paper-page:visible')).toHaveCount(1)
  await expect(page.locator('.paper-page--back-cover:visible')).toHaveCount(1)
})

test('catalog links to the generated book route', async ({ page }) => {
  await page.goto('/')

  const book = page.getByRole('link', { name: /Ouvrir Galgorat Library/ })
  await expect(book).toBeVisible()
  await expect(book.locator('img')).toHaveAttribute('src', '/covers/galgorat.svg')

  await book.click()
  await expect(page).toHaveURL(/\/books\/galgorat$/)
  await expect(page.locator('.paper-page:visible')).toHaveCount(1)
})
