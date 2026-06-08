import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'

export async function loadChapters(contentDir = 'content/chapters') {
  let entries
  try {
    entries = await fs.readdir(contentDir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing content directory: ${contentDir}`)
    }
    throw error
  }

  const chapters = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue
    }

    const filePath = path.join(contentDir, entry.name)
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = matter(raw)
    const title = parsed.data.title
    const order = parsed.data.order

    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new Error(`${filePath}: frontmatter title required`)
    }
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      throw new Error(`${filePath}: frontmatter order required`)
    }

    chapters.push({
      slug: entry.name.replace(/\.md$/, ''),
      filePath,
      title: title.trim(),
      order,
      body: parsed.content.trim()
    })
  }

  if (chapters.length === 0) {
    throw new Error(`No Markdown chapters found in ${contentDir}`)
  }

  chapters.sort((left, right) => {
    if (left.order === right.order) {
      return left.slug.localeCompare(right.slug)
    }
    return left.order - right.order
  })

  const seenOrders = new Set()
  for (const chapter of chapters) {
    if (seenOrders.has(chapter.order)) {
      throw new Error(`Duplicate chapter order: ${chapter.order}`)
    }
    seenOrders.add(chapter.order)
  }

  return chapters
}

export function mapChaptersToPages(pages) {
  return pages.reduce((mapping, page) => {
    const key = String(page.chapterOrder)
    if (!mapping[key]) {
      mapping[key] = []
    }
    mapping[key].push(page.pageNumber)
    return mapping
  }, {})
}
