import { expect, test } from '@playwright/test'

test('renders A5 page and visible controls', async ({ page }) => {
  await page.goto('/books/galgorat')

  const papers = page.locator('.paper-page:visible')
  await expect(papers).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Page precedente' })).toBeVisible()
  await expect(page.locator('.reader-count')).toHaveCount(0)
  await expect(page.locator('.paper-footer')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/\d+\s*\/\s*\d+/)

  const overflow = await papers.first().locator('.paper-content').evaluate((node) => {
    return node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth
  })
  expect(overflow).toBe(false)

  const box = await papers.first().boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs((box!.width / box!.height) - (148 / 210))).toBeLessThan(0.02)
})

test('desktop navigation opens a two-page journal spread', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/books/galgorat')

  await page.getByRole('button', { name: 'Page suivante' }).click()

  const papers = page.locator('.paper-page:visible')
  await expect(papers).toHaveCount(2)
  await expect(papers.first()).toContainText(/L.archive basse/)
  await expect(papers.nth(1)).toContainText('La carte fendue')
  await expect(page.locator('body')).not.toContainText(/\d+\s*\/\s*\d+/)

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
})

test('mobile navigation keeps a single readable page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/books/galgorat')

  await page.getByRole('button', { name: 'Page suivante' }).click()

  await expect(page.locator('.paper-page:visible')).toHaveCount(1)
  await expect(page.locator('.paper-page:visible')).toContainText(/L.archive basse/)
})

test('keyboard navigation and reduced motion keep reader usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/books/galgorat')

  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.paper-page:visible')).toHaveCount(2)
  await expect(page.locator('.paper-page:visible').first()).toContainText(/L.archive basse/)

  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.paper-page:visible')).toHaveCount(1)
  await expect(page.locator('.paper-page:visible')).toContainText('Ouverture')
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
