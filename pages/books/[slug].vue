<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { type BookPayload, useBookReader } from '~/composables/useBookReader'

const route = useRoute()
const config = useRuntimeConfig()
const slug = computed(() => String(route.params.slug ?? ''))
const bookUrl = computed(() => `${config.app.baseURL}books/${slug.value}/book-pages.json`)
const { data, error } = await useFetch<BookPayload>(bookUrl, {
  server: false,
  default: () => ({ generatedAt: '', pageSize: 'A5', pages: [], warnings: [] })
})

let spreadMediaQuery: MediaQueryList | undefined
let onSpreadMediaChange: ((event: MediaQueryListEvent) => void) | undefined

const pages = computed(() => data.value?.pages ?? [])
const bookTitle = computed(() => data.value?.book?.title ?? 'Livre')
const {
  currentPage,
  isSpreadMode,
  visiblePages,
  readerProgressLabel,
  canGoPrevious,
  canGoNext,
  goNext,
  goPrevious
} = useBookReader(pages)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    goNext()
  }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    goPrevious()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)

  spreadMediaQuery = window.matchMedia('(min-width: 681px)')
  isSpreadMode.value = spreadMediaQuery.matches
  onSpreadMediaChange = (event) => {
    isSpreadMode.value = event.matches
  }
  spreadMediaQuery.addEventListener('change', onSpreadMediaChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (spreadMediaQuery && onSpreadMediaChange) {
    spreadMediaQuery.removeEventListener('change', onSpreadMediaChange)
  }
})
</script>

<template>
  <main class="reader-shell">
    <NuxtLink class="reader-back" to="/" aria-label="Retour catalogue">
      ← Catalogue
    </NuxtLink>

    <section class="reader-frame" :aria-label="`${bookTitle}. ${readerProgressLabel}`" aria-live="polite">
      <div v-if="error" class="reader-state" role="alert">
        Pages introuvables.
      </div>

      <div v-else-if="!currentPage" class="reader-state">
        Chargement.
      </div>

      <div v-else
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

      <nav class="reader-nav" aria-label="Navigation pages">
        <button
          type="button"
          class="nav-button"
          :disabled="!canGoPrevious"
          aria-label="Page precedente"
          @click="goPrevious"
        >
          ←
        </button>
        <button
          type="button"
          class="nav-button"
          :disabled="!canGoNext"
          aria-label="Page suivante"
          @click="goNext"
        >
          →
        </button>
      </nav>
    </section>
  </main>
</template>
