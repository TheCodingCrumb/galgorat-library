import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function getBookRoutes() {
  const booksDir = join(process.cwd(), 'content/books')
  if (!existsSync(booksDir)) {
    return []
  }

  return readdirSync(booksDir)
    .filter((entry) => statSync(join(booksDir, entry)).isDirectory())
    .map((slug) => `/books/${slug}`)
}

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  modules: ['@nuxt/content'],
  css: ['~/assets/css/main.css'],
  ssr: true,
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      title: 'Galgorat Library',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=5' },
        { name: 'description', content: 'Livre Markdown pagine en pages A5 statiques.' }
      ]
    }
  },
  nitro: {
    prerender: {
      routes: ['/', ...getBookRoutes()]
    }
  },
  experimental: {
    appManifest: false
  },
  typescript: {
    strict: true
  }
})
