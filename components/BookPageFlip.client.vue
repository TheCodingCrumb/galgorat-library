<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { BookPage, VisiblePage } from '~/composables/useBookReader'

interface PageFlipEvent {
  data: number | string | boolean | object | null
}

interface PageFlipInstance {
  destroy: () => void
  flip: (page: number, corner?: 'top' | 'bottom') => void
  getCurrentPageIndex: () => number
  loadFromHTML: (items: HTMLElement[]) => void
  on: (eventName: string, callback: (event: PageFlipEvent) => void) => PageFlipInstance
  update: () => void
}

type PageFlipConstructor = new (
  block: HTMLElement,
  setting: Record<string, number | string | boolean>
) => PageFlipInstance

const props = defineProps<{
  currentIndex: number
  pages: readonly BookPage[]
  visiblePages: readonly VisiblePage[]
}>()

const emit = defineEmits<{
  pageChange: [index: number]
}>()

const flipMount = ref<HTMLElement>()
const pageFlip = shallowRef<PageFlipInstance>()
const prefersReducedMotion = ref(false)

let motionMediaQuery: MediaQueryList | undefined
let onMotionMediaChange: ((event: MediaQueryListEvent) => void) | undefined

const isSingleLayout = computed(() => props.visiblePages.length === 1)
const pageSignature = computed(() => props.pages
  .map((page) => `${page.pageNumber}:${page.chapterTitle}:${page.html.length}`)
  .join('|'))

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

function createBlankPageElement(lastPageNumber: number) {
  const article = document.createElement('article')
  article.className = 'paper-page paper-page--flip paper-page--blank'
  article.setAttribute('aria-label', 'Page blanche')
  article.dataset.blank = 'true'

  const label = document.createElement('span')
  label.className = 'sr-only'
  label.textContent = `Page blanche apres page ${lastPageNumber}`

  article.appendChild(label)
  return article
}

function getFlipPages() {
  const pages = props.pages.map(createPageElement)

  if (pages.length > 1 && pages.length % 2 === 0) {
    pages.push(createBlankPageElement(props.pages[props.pages.length - 1].pageNumber))
  }

  return pages
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
    startPage: props.currentIndex,
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
    const nextIndex = Number(event.data)

    if (Number.isInteger(nextIndex)) {
      emit('pageChange', nextIndex)
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

  if (instance.getCurrentPageIndex() !== props.currentIndex) {
    instance.flip(props.currentIndex, 'top')
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

</script>

<template>
  <div
    v-if="prefersReducedMotion"
    class="book-spread"
    :class="{ 'book-spread--single': visiblePages.length === 1 }"
  >
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
  </div>

  <div
    v-else
    class="book-flip"
    :class="{ 'book-flip--single': isSingleLayout }"
  >
    <div ref="flipMount" class="page-flip-mount" />
  </div>
</template>
