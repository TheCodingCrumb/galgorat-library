import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('generated book payload shape', () => {
  it('contains stable chapter and page metadata when generated', async () => {
    const raw = await fs.readFile('public/books/galgorat/book-pages.json', 'utf8')
    const payload = JSON.parse(raw)

    expect(payload.book).toMatchObject({
      slug: 'galgorat',
      title: 'Galgorat Library'
    })
    expect(payload.pageSize).toBe('A5')
    expect(payload.pages.length).toBeGreaterThanOrEqual(5)
    expect(payload.pages[0]).toMatchObject({
      pageNumber: 1,
      chapterTitle: 'Ouverture',
      chapterOrder: 1
    })
    expect(payload.pages.every((page, index) => page.pageNumber === index + 1)).toBe(true)
  })
})
