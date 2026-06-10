import { computed, ref, watch, type ComputedRef } from 'vue'
import type { CoverState } from './usePhysicalBookPages'

export interface BookPage {
  pageNumber: number
  chapterTitle: string
  chapterOrder: number
  html: string
}

export interface BookPayload {
  generatedAt: string
  pageSize: 'A5'
  pagePixels?: {
    width: number
    height: number
  }
  book?: {
    slug: string
    title: string
    cover: string | BookCoverConfig
    description: string
  }
  pages: BookPage[]
  warnings: string[]
}

export interface BookCoverConfig {
  image?: string
  frontImage?: string
  backImage?: string
  background?: string
  foreground?: string
  accent?: string
  title?: string
  subtitle?: string
}

export interface VisiblePage {
  key: string
  side: 'single' | 'left' | 'right'
  page?: BookPage
  blank?: boolean
}

export function getSpreadStart(index: number) {
  if (index <= 0) {
    return 0
  }

  return index % 2 === 0 ? index - 1 : index
}

export function getVisiblePagesForIndex(
  pages: readonly BookPage[],
  index: number,
  isSpreadMode: boolean
): VisiblePage[] {
  const page = pages[index]
  if (!page) {
    return []
  }

  if (!isSpreadMode || index === 0) {
    return [{
      key: `page-${page.pageNumber}`,
      side: 'single',
      page
    }]
  }

  const spreadStart = getSpreadStart(index)
  const leftPage = pages[spreadStart]
  if (!leftPage) {
    return []
  }

  const rightPage = pages[spreadStart + 1]

  return [
    {
      key: `page-${leftPage.pageNumber}`,
      side: 'left',
      page: leftPage
    },
    rightPage
      ? {
          key: `page-${rightPage.pageNumber}`,
          side: 'right',
          page: rightPage
        }
      : {
          key: `blank-after-${leftPage.pageNumber}`,
          side: 'right',
          blank: true
        }
  ]
}

export function useBookReader(pages: ComputedRef<readonly BookPage[]>) {
  const currentIndex = ref(0)
  const coverState = ref<CoverState | null>('front')
  const isSpreadMode = ref(false)

  const totalPages = computed(() => pages.value.length)
  const currentPage = computed(() => pages.value[currentIndex.value])
  const currentSpreadStart = computed(() => getSpreadStart(currentIndex.value))
  const visiblePages = computed(() => getVisiblePagesForIndex(
    pages.value,
    currentIndex.value,
    isSpreadMode.value
  ))

  const readerProgressLabel = computed(() => {
    if (coverState.value) {
      return ''
    }

    const visiblePageNumbers = visiblePages.value
      .map((page) => page.page?.pageNumber)
      .filter((pageNumber): pageNumber is number => typeof pageNumber === 'number')

    if (!totalPages.value || visiblePageNumbers.length === 0) {
      return 'Journal sans page chargee'
    }

    return visiblePageNumbers.length === 1
      ? `Page ${visiblePageNumbers[0]} sur ${totalPages.value}`
      : `Pages ${visiblePageNumbers.join(' et ')} sur ${totalPages.value}`
  })

  const canGoPrevious = computed(() => {
    if (coverState.value === 'front') {
      return false
    }

    return currentIndex.value > 0
  })
  const canGoNext = computed(() => {
    if (totalPages.value === 0 || coverState.value === 'back') {
      return false
    }

    if (coverState.value === 'front') {
      return true
    }

    if (!isSpreadMode.value || currentIndex.value === 0) {
      return currentIndex.value < totalPages.value - 1
    }

    return currentSpreadStart.value + 2 < totalPages.value
  })

  function normalizeIndex(index: number) {
    if (!isSpreadMode.value || index <= 0) {
      return index
    }

    return getSpreadStart(index)
  }

  function goToPage(nextIndex: number | null, nextCoverState: CoverState | null = null) {
    if (nextCoverState) {
      coverState.value = nextCoverState
      currentIndex.value = nextCoverState === 'back' && totalPages.value > 0
        ? totalPages.value - 1
        : 0
      return
    }

    if (nextIndex === null) {
      return
    }

    const normalizedIndex = normalizeIndex(nextIndex)

    if (
      normalizedIndex < 0
      || normalizedIndex >= totalPages.value
    ) {
      return
    }

    coverState.value = null

    if (normalizedIndex === currentIndex.value) {
      return
    }

    currentIndex.value = normalizedIndex
  }

  function goNext() {
    if (!canGoNext.value) {
      return
    }

    if (coverState.value === 'front') {
      coverState.value = null
      currentIndex.value = 0
      return
    }

    goToPage(isSpreadMode.value && currentIndex.value > 0
      ? currentSpreadStart.value + 2
      : currentIndex.value + 1)
  }

  function goPrevious() {
    if (!canGoPrevious.value) {
      return
    }

    if (coverState.value === 'back') {
      coverState.value = null
      return
    }

    goToPage(isSpreadMode.value && currentIndex.value > 1
      ? currentSpreadStart.value - 2
      : currentIndex.value - 1)
  }

  watch(totalPages, (nextTotal) => {
    if (nextTotal === 0) {
      currentIndex.value = 0
      coverState.value = null
      return
    }

    if (currentIndex.value >= nextTotal) {
      currentIndex.value = nextTotal - 1
    }
  })

  watch(isSpreadMode, (nextIsSpreadMode) => {
    if (nextIsSpreadMode && currentIndex.value > 0 && currentIndex.value % 2 === 0) {
      currentIndex.value -= 1
    }
  })

  return {
    currentIndex,
    currentPage,
    coverState,
    isSpreadMode,
    visiblePages,
    readerProgressLabel,
    canGoPrevious,
    canGoNext,
    goToPage,
    goNext,
    goPrevious
  }
}
