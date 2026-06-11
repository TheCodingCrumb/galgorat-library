<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { BookCoverConfig, BookPage, VisiblePage } from '~/composables/useBookReader'
import {
  contentIndexToPageFlipIndex,
  getPhysicalBookPages,
  physicalIndexToContentIndex,
  physicalIndexToCoverState,
  type CoverState,
  type PhysicalBookPage
} from '~/composables/usePhysicalBookPages'

interface PageFlipEvent {
  data: number | string | boolean | object | null
}

interface PageFlipInstance {
  destroy: () => void
  flip: (page: number, corner?: 'top' | 'bottom') => void
  getCurrentPageIndex: () => number
  loadFromHTML: (items: HTMLElement[]) => void
  on: (eventName: string, callback: (event: PageFlipEvent) => void) => PageFlipInstance
  turnToPage: (page: number) => void
  update: () => void
}

type PageFlipConstructor = new (
  block: HTMLElement,
  setting: Record<string, number | string | boolean>
) => PageFlipInstance

const props = defineProps<{
  bookCover?: string | BookCoverConfig
  bookTitle: string
  coverState: CoverState | null
  currentIndex: number
  isSpreadMode: boolean
  pages: readonly BookPage[]
  visiblePages: readonly VisiblePage[]
}>()

const emit = defineEmits<{
  pageChange: [index: number | null, coverState?: CoverState | null]
}>()

const flipMount = ref<HTMLElement>()
const pageFlip = shallowRef<PageFlipInstance>()
const prefersReducedMotion = ref(false)

let motionMediaQuery: MediaQueryList | undefined
let onMotionMediaChange: ((event: MediaQueryListEvent) => void) | undefined

const isSingleLayout = computed(() => props.visiblePages.length === 1)
const isCoverLayout = computed(() => props.coverState !== null)
const pageSignature = computed(() => props.pages
  .map((page) => `${page.pageNumber}:${page.chapterTitle}:${page.html.length}`)
  .concat(
    props.isSpreadMode ? 'spread' : 'portrait',
    props.bookTitle,
    JSON.stringify(props.bookCover ?? null)
  )
  .join('|'))
const physicalPages = computed(() => getPhysicalBookPages(props.pages))
const targetPhysicalIndex = computed(() => {
  if (props.coverState === 'front') {
    return 0
  }

  if (props.coverState === 'back') {
    return Math.max(0, physicalPages.value.length - 1)
  }

  return contentIndexToPageFlipIndex(props.currentIndex, props.isSpreadMode)
})
const coverConfig = computed<BookCoverConfig>(() => {
  if (typeof props.bookCover === 'string') {
    return { image: props.bookCover }
  }

  return props.bookCover ?? {}
})

function getCoverImage(kind: 'front' | 'back') {
  return kind === 'front'
    ? coverConfig.value.frontImage ?? coverConfig.value.image
    : coverConfig.value.backImage
}

function getCoverStyle() {
  return {
    '--cover-bg': coverConfig.value.background ?? '#74351f',
    '--cover-fg': coverConfig.value.foreground ?? '#f6efe4',
    '--cover-accent': coverConfig.value.accent ?? '#d8b36a'
  }
}

function createPageElement(page: BookPage) {
  const article = document.createElement('article')
  article.className = 'paper-page paper-page--flip'
  article.setAttribute('aria-label', `Page ${page.pageNumber}`)

  const content = document.createElement('div')
  content.className = 'paper-content'
  content.innerHTML = page.html

  article.appendChild(content)
  return article
}

function createCoverPageElement(kind: 'front-cover' | 'back-cover') {
  const coverKind = kind === 'front-cover' ? 'front' : 'back'
  const image = getCoverImage(coverKind)
  const article = document.createElement('article')
  article.className = `paper-page paper-page--flip paper-page--cover paper-page--${kind}`
  article.setAttribute(
    'aria-label',
    kind === 'front-cover'
      ? `Couverture ${props.bookTitle}`
      : `Quatrieme de couverture ${props.bookTitle}`
  )
  Object.assign(article.style, getCoverStyle())

  if (image) {
    const coverImage = document.createElement('img')
    coverImage.className = 'paper-cover-image'
    coverImage.src = image
    coverImage.alt = ''
    article.appendChild(coverImage)
  } else {
    const title = document.createElement('strong')
    title.className = 'paper-cover-title'
    title.textContent = coverConfig.value.title ?? props.bookTitle
    article.appendChild(title)

    const subtitle = coverConfig.value.subtitle
    if (subtitle) {
      const subtitleElement = document.createElement('span')
      subtitleElement.className = 'paper-cover-subtitle'
      subtitleElement.textContent = subtitle
      article.appendChild(subtitleElement)
    }
  }

  return article
}

function createBlankPageElement(kind: 'inside-front' | 'blank-after-content' | 'inside-back') {
  const article = document.createElement('article')
  article.className = [
    'paper-page',
    'paper-page--flip',
    'paper-page--blank',
    kind === 'inside-front' || kind === 'inside-back'
      ? 'paper-page--inside-cover'
      : 'paper-page--blank-content'
  ].join(' ')
  article.setAttribute(
    'aria-label',
    kind === 'inside-front'
      ? 'Interieur couverture avant'
      : kind === 'inside-back'
        ? 'Interieur couverture arriere'
        : 'Page blanche'
  )
  article.dataset.blank = kind

  const label = document.createElement('span')
  label.className = 'sr-only'
  label.textContent = article.getAttribute('aria-label') ?? 'Page blanche'

  article.appendChild(label)
  return article
}

function createPhysicalPageElement(physicalPage: PhysicalBookPage) {
  if (physicalPage.kind === 'content' && physicalPage.page) {
    return createPageElement(physicalPage.page)
  }

  if (physicalPage.kind === 'front-cover' || physicalPage.kind === 'back-cover') {
    return createCoverPageElement(physicalPage.kind)
  }

  return createBlankPageElement(physicalPage.kind)
}

function getFlipPages() {
  return physicalPages.value.map(createPhysicalPageElement)
}

function destroyFlip() {
  const instance = pageFlip.value
  pageFlip.value = undefined

  if (instance) {
    instance.destroy()
  }

  flipMount.value?.replaceChildren()
}

async function mountFlip() {
  if (!flipMount.value || prefersReducedMotion.value || props.pages.length === 0) {
    return
  }

  destroyFlip()

  const host = document.createElement('div')
  host.className = 'page-flip-host'
  flipMount.value.appendChild(host)

  const module = await import('page-flip') as { PageFlip: PageFlipConstructor }
  const instance = new module.PageFlip(host, {
    width: 560,
    height: 795,
    size: 'stretch',
    minWidth: 280,
    maxWidth: 560,
    minHeight: 398,
    maxHeight: 795,
    startPage: targetPhysicalIndex.value,
    drawShadow: true,
    flippingTime: 720,
    usePortrait: true,
    startZIndex: 1,
    autoSize: true,
    maxShadowOpacity: 0.45,
    showCover: true,
    mobileScrollSupport: true,
    clickEventForward: true,
    useMouseEvents: true,
    swipeDistance: 40,
    showPageCorners: true,
    disableFlipByClick: false
  })

  instance.on('flip', (event) => {
    const physicalIndex = Number(event.data)

    if (Number.isInteger(physicalIndex)) {
      const nextCoverState = physicalIndexToCoverState(
        physicalIndex,
        props.pages.length,
        props.isSpreadMode
      )

      if (nextCoverState) {
        emit('pageChange', null, nextCoverState)
        return
      }

      const contentIndex = physicalIndexToContentIndex(
        physicalIndex,
        props.pages.length,
        props.isSpreadMode
      )

      if (contentIndex !== null) {
        emit('pageChange', contentIndex)
      }
    }
  })

  instance.loadFromHTML(getFlipPages())
  pageFlip.value = instance
}

async function syncCurrentPage() {
  await nextTick()

  const instance = pageFlip.value
  if (!instance || prefersReducedMotion.value) {
    return
  }

  instance.update()

  const currentPhysicalIndex = instance.getCurrentPageIndex()
  const currentCoverState = physicalIndexToCoverState(
    currentPhysicalIndex,
    props.pages.length,
    props.isSpreadMode
  )
  const currentContentIndex = physicalIndexToContentIndex(
    currentPhysicalIndex,
    props.pages.length,
    props.isSpreadMode
  )

  if (
    currentCoverState !== props.coverState
    || (!props.coverState && currentContentIndex !== props.currentIndex)
  ) {
    if (!props.isSpreadMode && Math.abs(currentPhysicalIndex - targetPhysicalIndex.value) > 1) {
      instance.turnToPage(targetPhysicalIndex.value)
      return
    }

    instance.flip(targetPhysicalIndex.value, 'top')
  }
}

onMounted(() => {
  motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = motionMediaQuery.matches
  onMotionMediaChange = (event) => {
    prefersReducedMotion.value = event.matches
  }
  motionMediaQuery.addEventListener('change', onMotionMediaChange)

  void mountFlip()
})

onBeforeUnmount(() => {
  if (motionMediaQuery && onMotionMediaChange) {
    motionMediaQuery.removeEventListener('change', onMotionMediaChange)
  }

  destroyFlip()
})

watch(prefersReducedMotion, async (isReduced) => {
  if (isReduced) {
    destroyFlip()
    return
  }

  await nextTick()
  await mountFlip()
})

watch(pageSignature, async () => {
  await nextTick()
  await mountFlip()
})

watch(() => props.currentIndex, () => {
  void syncCurrentPage()
})

watch(() => props.coverState, () => {
  void syncCurrentPage()
})

</script>

<template>
  <div
    v-if="prefersReducedMotion"
    class="book-spread"
    :class="{ 'book-spread--single': visiblePages.length === 1 }"
  >
    <article
      v-if="coverState === 'front'"
      class="paper-page paper-page--cover paper-page--front-cover"
      :style="getCoverStyle()"
      :aria-label="`Couverture ${bookTitle}`"
    >
      <img
        v-if="getCoverImage('front')"
        class="paper-cover-image"
        :src="getCoverImage('front')"
        alt=""
      >
      <template v-else>
        <strong class="paper-cover-title">{{ coverConfig.title ?? bookTitle }}</strong>
        <span v-if="coverConfig.subtitle" class="paper-cover-subtitle">
          {{ coverConfig.subtitle }}
        </span>
      </template>
    </article>
    <article
      v-else-if="coverState === 'back'"
      class="paper-page paper-page--cover paper-page--back-cover"
      :style="getCoverStyle()"
      :aria-label="`Quatrieme de couverture ${bookTitle}`"
    >
      <img
        v-if="getCoverImage('back')"
        class="paper-cover-image"
        :src="getCoverImage('back')"
        alt=""
      >
      <template v-else>
        <strong class="paper-cover-title">{{ coverConfig.title ?? bookTitle }}</strong>
        <span v-if="coverConfig.subtitle" class="paper-cover-subtitle">
          {{ coverConfig.subtitle }}
        </span>
      </template>
    </article>
    <template v-else>
      <article
        v-for="visiblePage in visiblePages"
        :key="visiblePage.key"
        class="paper-page"
        :class="[
          `paper-page--${visiblePage.side}`,
          { 'paper-page--blank': visiblePage.blank }
        ]"
        :aria-label="visiblePage.blank ? 'Page blanche' : `Page ${visiblePage.page?.pageNumber}`"
      >
        <div
          v-if="visiblePage.page"
          class="paper-content"
          v-html="visiblePage.page.html"
        />
        <span v-else class="sr-only">Page blanche</span>
      </article>
    </template>
  </div>

  <div
    v-else
    class="book-flip"
    :class="{
      'book-flip--single': isSingleLayout,
      'book-flip--cover-state': isCoverLayout
    }"
  >
    <div ref="flipMount" class="page-flip-mount" />
  </div>
</template>
