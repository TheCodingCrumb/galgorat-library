import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    chapters: defineCollection({
      type: 'page',
      source: 'chapters/*.md',
      schema: z.object({
        title: z.string(),
        order: z.number()
      })
    })
  }
})
