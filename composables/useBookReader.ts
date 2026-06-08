import { computed, ref, watch, type ComputedRef } from 'vue'

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
  pages: BookPage[]
  warnings: string[]
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

  const canGoPrevious = computed(() => currentIndex.value > 0)
  const canGoNext = computed(() => {
    if (totalPages.value === 0) {
      return false
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

  function goToPage(nextIndex: number) {
    const normalizedIndex = normalizeIndex(nextIndex)

    if (
      normalizedIndex < 0
      || normalizedIndex >= totalPages.value
      || normalizedIndex === currentIndex.value
    ) {
      return
    }

    currentIndex.value = normalizedIndex
  }

  function goNext() {
    if (!canGoNext.value) {
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

    goToPage(isSpreadMode.value && currentIndex.value > 1
      ? currentSpreadStart.value - 2
      : currentIndex.value - 1)
  }

  watch(totalPages, (nextTotal) => {
    if (nextTotal === 0) {
      currentIndex.value = 0
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
    isSpreadMode,
    visiblePages,
    readerProgressLabel,
    canGoPrevious,
    canGoNext,
    goNext,
    goPrevious
  }
}
