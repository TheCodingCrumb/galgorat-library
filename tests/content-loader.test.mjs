import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBooks, loadChapters, mapChaptersToPages } from '../scripts/content-loader.mjs'

async function makeBookRoot(books) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'galgorat-books-'))

  await Promise.all(Object.entries(books).map(async ([slug, manifest]) => {
    const bookDir = path.join(root, slug)
    await fs.mkdir(path.join(bookDir, 'chapters'), { recursive: true })
    await fs.writeFile(path.join(bookDir, 'book.json'), JSON.stringify(manifest))
  }))

  return root
}

async function makeChapterDir(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'galgorat-content-'))
  const chapterDir = path.join(root, 'chapters')
  await fs.mkdir(chapterDir, { recursive: true })

  await Promise.all(Object.entries(files).map(([name, content]) => {
    return fs.writeFile(path.join(chapterDir, name), content)
  }))

  return chapterDir
}

describe('loadChapters', () => {
  it('sorts chapters by frontmatter order', async () => {
    const chapterDir = await makeChapterDir({
      'second.md': '---\ntitle: Second\norder: 2\n---\n\nBody',
      'first.md': '---\ntitle: First\norder: 1\n---\n\nBody'
    })

    const chapters = await loadChapters(chapterDir)

    expect(chapters.map((chapter) => chapter.title)).toEqual(['First', 'Second'])
  })

  it('rejects missing metadata', async () => {
    const chapterDir = await makeChapterDir({
      'broken.md': '---\ntitle: Broken\n---\n\nBody'
    })

    await expect(loadChapters(chapterDir)).rejects.toThrow('frontmatter order required')
  })

  it('rejects duplicate orders', async () => {
    const chapterDir = await makeChapterDir({
      'a.md': '---\ntitle: A\norder: 1\n---\n\nA',
      'b.md': '---\ntitle: B\norder: 1\n---\n\nB'
    })

    await expect(loadChapters(chapterDir)).rejects.toThrow('Duplicate chapter order')
  })
})

describe('loadBooks', () => {
  it('sorts books by manifest order', async () => {
    const bookRoot = await makeBookRoot({
      beta: { title: 'Beta', cover: '/covers/beta.svg', order: 2 },
      alpha: { title: 'Alpha', cover: '/covers/alpha.svg', order: 1 }
    })

    const books = await loadBooks(bookRoot)

    expect(books.map((book) => book.slug)).toEqual(['alpha', 'beta'])
    expect(books[0]).toMatchObject({
      title: 'Alpha',
      chaptersDir: path.join(bookRoot, 'alpha', 'chapters')
    })
  })

  it('rejects books without cover metadata', async () => {
    const bookRoot = await makeBookRoot({
      broken: { title: 'Broken', order: 1 }
    })

    await expect(loadBooks(bookRoot)).rejects.toThrow('cover required')
  })
})

describe('mapChaptersToPages', () => {
  it('maps chapter orders to generated page numbers', () => {
    expect(mapChaptersToPages([
      { chapterOrder: 1, pageNumber: 1 },
      { chapterOrder: 1, pageNumber: 2 },
      { chapterOrder: 2, pageNumber: 3 }
    ])).toEqual({
      1: [1, 2],
      2: [3]
    })
  })
})
