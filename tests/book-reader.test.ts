import { computed, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  getSpreadStart,
  getVisiblePagesForIndex,
  useBookReader,
  type BookPage
} from '../composables/useBookReader'
import {
  contentIndexToPageFlipIndex,
  contentIndexToPhysicalIndex,
  getPhysicalBookPages,
  physicalIndexToContentIndex,
  physicalIndexToCoverState
} from '../composables/usePhysicalBookPages'

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
  it('starts on the cover without a progress label', () => {
    const pages = ref(bookPages)
    const reader = useBookReader(computed(() => pages.value))

    expect(reader.coverState.value).toBe('front')
    expect(reader.readerProgressLabel.value).toBe('')
    expect(reader.canGoPrevious.value).toBe(false)
    expect(reader.canGoNext.value).toBe(true)
  })

  it('moves by one page on mobile and by spreads on desktop', async () => {
    const pages = ref(bookPages)
    const reader = useBookReader(computed(() => pages.value))

    reader.goNext()
    expect(reader.coverState.value).toBeNull()
    expect(reader.currentPage.value).toEqual(bookPages[0])
    expect(reader.readerProgressLabel.value).toBe('Page 1 sur 3')

    reader.goNext()
    expect(reader.currentPage.value).toEqual(bookPages[1])
    expect(reader.readerProgressLabel.value).toBe('Page 2 sur 3')

    reader.isSpreadMode.value = true
    await nextTick()

    expect(reader.visiblePages.value).toHaveLength(2)
    expect(reader.readerProgressLabel.value).toBe('Pages 2 et 3 sur 3')
    expect(reader.canGoNext.value).toBe(true)
  })

  it('can return to the front cover from the first content page', () => {
    const pages = ref(bookPages)
    const reader = useBookReader(computed(() => pages.value))

    reader.goNext()
    expect(reader.coverState.value).toBeNull()
    expect(reader.currentPage.value).toEqual(bookPages[0])
    expect(reader.canGoPrevious.value).toBe(true)

    reader.goPrevious()
    expect(reader.coverState.value).toBe('front')
    expect(reader.currentIndex.value).toBe(0)
    expect(reader.readerProgressLabel.value).toBe('')
  })

  it('can advance from the last content page to the back cover', () => {
    const pages = ref(bookPages)
    const reader = useBookReader(computed(() => pages.value))

    reader.goNext()
    reader.goNext()
    reader.goNext()
    expect(reader.currentPage.value).toEqual(bookPages[2])
    expect(reader.canGoNext.value).toBe(true)

    reader.goNext()
    expect(reader.coverState.value).toBe('back')
    expect(reader.currentIndex.value).toBe(2)
    expect(reader.readerProgressLabel.value).toBe('')
    expect(reader.canGoNext.value).toBe(false)
  })

  it('keeps the current index valid when generated pages change', async () => {
    const pages = ref(bookPages)
    const reader = useBookReader(computed(() => pages.value))

    reader.goNext()
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

describe('physical book pages', () => {
  it('creates cover, content, padding, and back-cover physical pages', () => {
    expect(getPhysicalBookPages(bookPages).map((page) => page.kind)).toEqual([
      'front-cover',
      'inside-front',
      'content',
      'content',
      'content',
      'blank-after-content',
      'inside-back',
      'back-cover'
    ])

    expect(getPhysicalBookPages(bookPages.slice(0, 2)).map((page) => page.kind)).toEqual([
      'front-cover',
      'inside-front',
      'content',
      'content',
      'inside-back',
      'back-cover'
    ])
  })

  it('maps content indexes separately from physical page indexes', () => {
    expect([0, 1, 2].map((index) => contentIndexToPhysicalIndex(index)))
      .toEqual([2, 3, 4])
    expect([0, 1, 2].map((index) => contentIndexToPageFlipIndex(index, true)))
      .toEqual([1, 3, 3])
    expect([0, 1, 2].map((index) => contentIndexToPageFlipIndex(index, false)))
      .toEqual([2, 3, 4])

    expect([0, 1, 2, 3, 4, 5, 6, 7].map((index) => physicalIndexToContentIndex(
      index,
      bookPages.length,
      true
    )))
      .toEqual([null, 0, 0, 1, 2, null, null, null])
  })

  it('identifies cover physical states without counting them as content', () => {
    expect(physicalIndexToCoverState(0, bookPages.length, true)).toBe('front')
    expect(physicalIndexToCoverState(1, bookPages.length, true)).toBeNull()
    expect(physicalIndexToCoverState(1, bookPages.length, false)).toBe('front')
    expect(physicalIndexToCoverState(5, bookPages.length, true)).toBe('back')
    expect(physicalIndexToCoverState(6, bookPages.length, true)).toBe('back')
    expect(physicalIndexToCoverState(7, bookPages.length, true)).toBe('back')
  })
})
