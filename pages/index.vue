<script setup lang="ts">
import { computed } from 'vue'

interface CatalogBook {
  slug: string
  title: string
  cover: string
  description: string
  pageCount: number
}

interface CatalogPayload {
  generatedAt: string
  books: CatalogBook[]
}

const config = useRuntimeConfig()
const catalogUrl = `${config.app.baseURL}books.json`
const { data, error } = await useFetch<CatalogPayload>(catalogUrl, {
  server: false,
  default: () => ({ generatedAt: '', books: [] })
})

const books = computed(() => data.value?.books ?? [])
</script>

<template>
  <main class="catalog-shell">
    <section class="catalog-frame" aria-labelledby="catalog-title">
      <div class="catalog-heading">
        <p class="catalog-kicker">Bibliotheque</p>
        <h1 id="catalog-title">Galgorat Library</h1>
      </div>

      <div v-if="error" class="catalog-state" role="alert">
        Catalogue introuvable.
      </div>

      <div v-else-if="books.length === 0" class="catalog-state">
        Catalogue vide.
      </div>

      <div v-else class="book-grid" aria-label="Livres disponibles">
        <NuxtLink
          v-for="book in books"
          :key="book.slug"
          class="book-card"
          :to="`/books/${book.slug}`"
          :aria-label="`Ouvrir ${book.title}`"
        >
          <img
            class="book-card__cover"
            :src="book.cover"
            :alt="`Couverture ${book.title}`"
            width="480"
            height="680"
          >
          <span class="book-card__body">
            <span class="book-card__title">{{ book.title }}</span>
            <span v-if="book.description" class="book-card__description">
              {{ book.description }}
            </span>
            <span class="book-card__meta">{{ book.pageCount }} pages</span>
          </span>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
