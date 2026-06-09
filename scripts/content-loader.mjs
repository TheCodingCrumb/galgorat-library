import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'

export async function loadBooks(contentRoot = 'content/books') {
  let entries
  try {
    entries = await fs.readdir(contentRoot, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing books directory: ${contentRoot}`)
    }
    throw error
  }

  const books = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const slug = entry.name
    const bookDir = path.join(contentRoot, slug)
    const manifestPath = path.join(bookDir, 'book.json')
    let manifest

    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(`${manifestPath}: book manifest required`)
      }
      throw new Error(`${manifestPath}: invalid book manifest`)
    }

    const title = manifest.title
    const cover = manifest.cover
    const order = manifest.order ?? 0

    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new Error(`${manifestPath}: title required`)
    }
    if (typeof cover !== 'string' || cover.trim().length === 0) {
      throw new Error(`${manifestPath}: cover required`)
    }
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      throw new Error(`${manifestPath}: order must be a number`)
    }

    books.push({
      slug,
      title: title.trim(),
      cover: cover.trim(),
      description: typeof manifest.description === 'string' ? manifest.description.trim() : '',
      order,
      chaptersDir: path.join(bookDir, 'chapters')
    })
  }

  if (books.length === 0) {
    throw new Error(`No books found in ${contentRoot}`)
  }

  books.sort((left, right) => {
    if (left.order === right.order) {
      return left.slug.localeCompare(right.slug)
    }
    return left.order - right.order
  })

  return books
}

export async function loadBook(slug, contentRoot = 'content/books') {
  const books = await loadBooks(contentRoot)
  const book = books.find((candidate) => candidate.slug === slug)
  if (!book) {
    throw new Error(`Unknown book: ${slug}`)
  }
  return book
}

export async function loadChapters(contentDir) {
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
