import type { BookPage } from './useBookReader'

export type CoverState = 'front' | 'back'

export type PhysicalPageKind =
  | 'front-cover'
  | 'inside-front'
  | 'content'
  | 'blank-after-content'
  | 'inside-back'
  | 'back-cover'

export interface PhysicalBookPage {
  key: string
  kind: PhysicalPageKind
  contentIndex?: number
  page?: BookPage
}

export function getPhysicalBookPages(pages: readonly BookPage[]): PhysicalBookPage[] {
  if (pages.length === 0) {
    return []
  }

  const physicalPages: PhysicalBookPage[] = [
    {
      key: 'front-cover',
      kind: 'front-cover'
    },
    {
      key: 'inside-front',
      kind: 'inside-front'
    }
  ]

  for (let index = 0; index < pages.length; index += 1) {
    physicalPages.push({
      key: `content-${pages[index].pageNumber}`,
      kind: 'content',
      contentIndex: index,
      page: pages[index]
    })
  }

  if (pages.length % 2 === 1) {
    physicalPages.push({
      key: 'blank-after-content',
      kind: 'blank-after-content'
    })
  }

  physicalPages.push(
    {
      key: 'inside-back',
      kind: 'inside-back'
    },
    {
      key: 'back-cover',
      kind: 'back-cover'
    }
  )

  return physicalPages
}

export function contentIndexToPhysicalIndex(contentIndex: number) {
  return Math.max(0, contentIndex) + 2
}

export function contentIndexToPageFlipIndex(contentIndex: number, isSpreadMode: boolean) {
  const physicalIndex = contentIndexToPhysicalIndex(contentIndex)

  if (!isSpreadMode) {
    return physicalIndex
  }

  return physicalIndex % 2 === 0 ? physicalIndex - 1 : physicalIndex
}

export function physicalIndexToContentIndex(
  physicalIndex: number,
  pageCount: number,
  isSpreadMode: boolean
): number | null {
  if (pageCount <= 0) {
    return null
  }

  if (isSpreadMode && physicalIndex === 1) {
    return 0
  }

  const contentIndex = physicalIndex - 2
  if (contentIndex >= 0 && contentIndex < pageCount) {
    return contentIndex
  }

  return null
}

export function physicalIndexToCoverState(
  physicalIndex: number,
  pageCount: number,
  isSpreadMode: boolean
): CoverState | null {
  if (pageCount <= 0 || physicalIndex <= 0) {
    return pageCount > 0 && physicalIndex === 0 ? 'front' : null
  }

  if (!isSpreadMode && physicalIndex === 1) {
    return 'front'
  }

  const firstBackStateIndex = 2 + pageCount
  if (physicalIndex >= firstBackStateIndex) {
    return 'back'
  }

  return null
}
