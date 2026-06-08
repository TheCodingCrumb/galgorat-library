import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadChapters, mapChaptersToPages } from '../scripts/content-loader.mjs'

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
