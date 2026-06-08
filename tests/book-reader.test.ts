import { computed, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  getSpreadStart,
  getVisiblePagesForIndex,
  useBookReader,
  type BookPage
} from '../composables/useBookReader'

const bookPages: BookPage[] = [
  { pageNumber: 1, chapterTitle: 'One', chapterOrder: 1, html: '<p>One</p>' },
  { pageNumber: 2, chapterTitle: 'Two', chapterOrder: 2, html: '<p>Two</p>' },
  { pageNumber: 3, chapterTitle: 'Three', chapterOrder: 3, html: '<p>Three</p>' }
]

describe('getSpreadStart', () => {
  it('keeps the cover alone, then aligns indexes to left pages', () => {
    expect([0, 1, 2, 3, 4].map(getSpreadStart)).toEqual([0, 1, 1, 3, 3])
  })
})

describe('getVisiblePagesForIndex', () => {
  it('renders a single page outside spread mode', () => {
    expect(getVisiblePagesForIndex(bookPages, 1, false)).toMatchObject([
      { key: 'page-2', side: 'single', page: bookPages[1] }
    ])
  })

  it('renders a spread and pads the final right page when needed', () => {
    expect(getVisiblePagesForIndex(bookPages, 1, true)).toMatchObject([
      { key: 'page-2', side: 'left', page: bookPages[1] },
      { key: 'page-3', side: 'right', page: bookPages[2] }
    ])

    expect(getVisiblePagesForIndex(bookPages.slice(0, 2), 1, true)).toMatchObject([
      { key: 'page-2', side: 'left', page: bookPages[1] },
      { key: 'blank-after-2', side: 'right', blank: true }
    ])
  })
})

describe('useBookReader', () => {
  it('moves by one page on mobile and by spreads on desktop', async () => {
    const pages = ref(bookPages)
    const reader = useBookReader(computed(() => pages.value))

    reader.goNext()
    expect(reader.currentPage.value).toEqual(bookPages[1])
    expect(reader.readerProgressLabel.value).toBe('Page 2 sur 3')

    reader.isSpreadMode.value = true
    await nextTick()

    expect(reader.visiblePages.value).toHaveLength(2)
    expect(reader.readerProgressLabel.value).toBe('Pages 2 et 3 sur 3')
    expect(reader.canGoNext.value).toBe(false)
  })

  it('keeps the current index valid when generated pages change', async () => {
    const pages = ref(bookPages)
    const reader = useBookReader(computed(() => pages.value))

    reader.goNext()
    reader.goNext()
    expect(reader.currentPage.value).toEqual(bookPages[2])

    pages.value = []
    await nextTick()

    expect(reader.currentIndex.value).toBe(0)
    expect(reader.currentPage.value).toBeUndefined()
    expect(reader.readerProgressLabel.value).toBe('Journal sans page chargee')
  })
})
