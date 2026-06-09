import fs from 'node:fs/promises'
import MarkdownIt from 'markdown-it'
import { chromium } from 'playwright'
import { loadBooks, loadChapters } from './content-loader.mjs'

const PAGE_WIDTH = '148mm'
const PAGE_HEIGHT = '210mm'
const CONTENT_WIDTH_PX = 424
const CONTENT_HEIGHT_PX = 674

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function paragraphChunks(text) {
  return [{
    kind: 'paragraph',
    splittable: true,
    words: text.split(/\s+/).filter(Boolean),
    htmlFromPart: (words) => `<p>${md.renderInline(words.join(' '))}</p>`
  }]
}

function codeChunks(text, language = '') {
  return [{
    kind: 'code',
    splittable: true,
    lines: text.replace(/\n$/, '').split('\n'),
    htmlFromPart: (lines) => {
      const className = language ? ` class="language-${escapeHtml(language)}"` : ''
      return `<pre><code${className}>${escapeHtml(lines.join('\n'))}</code></pre>`
    }
  }]
}

function htmlChunk(html, kind = 'block', splittable = false) {
  return { kind, splittable, html }
}

function tokensToChunks(tokens) {
  const chunks = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]

    if (token.type === 'heading_open' && next?.type === 'inline') {
      chunks.push(htmlChunk(`<${token.tag}>${md.renderInline(next.content)}</${token.tag}>`, 'heading'))
      index += 2
      continue
    }

    if (token.type === 'paragraph_open' && next?.type === 'inline') {
      const hasOnlyImage = next.children?.length === 1 && next.children[0].type === 'image'
      if (hasOnlyImage) {
        chunks.push(htmlChunk(`<p>${md.renderInline(next.content)}</p>`, 'image'))
      } else {
        chunks.push(...paragraphChunks(next.content))
      }
      index += 2
      continue
    }

    if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      const tag = token.type === 'bullet_list_open' ? 'ul' : 'ol'
      const listItems = []
      index += 1
      while (index < tokens.length && tokens[index].type !== `${tag === 'ul' ? 'bullet' : 'ordered'}_list_close`) {
        if (tokens[index].type === 'list_item_open') {
          const itemParts = []
          index += 1
          while (index < tokens.length && tokens[index].type !== 'list_item_close') {
            if (tokens[index].type === 'inline') {
              itemParts.push(md.renderInline(tokens[index].content))
            } else if (tokens[index].type === 'fence' || tokens[index].type === 'code_block') {
              itemParts.push(`<pre><code>${escapeHtml(tokens[index].content)}</code></pre>`)
            }
            index += 1
          }
          listItems.push(`<li>${itemParts.join('')}</li>`)
        }
        index += 1
      }
      for (const item of listItems) {
        chunks.push(htmlChunk(`<${tag}>${item}</${tag}>`, 'list-item'))
      }
      continue
    }

    if (token.type === 'blockquote_open') {
      const parts = []
      index += 1
      while (index < tokens.length && tokens[index].type !== 'blockquote_close') {
        if (tokens[index].type === 'inline') {
          parts.push(`<p>${md.renderInline(tokens[index].content)}</p>`)
        }
        index += 1
      }
      chunks.push(htmlChunk(`<blockquote>${parts.join('')}</blockquote>`, 'quote'))
      continue
    }

    if (token.type === 'fence' || token.type === 'code_block') {
      chunks.push(...codeChunks(token.content, token.info.trim().split(/\s+/)[0] || ''))
      continue
    }

    if (token.type === 'hr') {
      chunks.push(htmlChunk('<hr>', 'rule'))
    }
  }

  return chunks
}

function renderMeasurementHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: ${PAGE_WIDTH} ${PAGE_HEIGHT}; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; }
    #page {
      width: ${PAGE_WIDTH};
      height: ${PAGE_HEIGHT};
      padding: 16mm 18mm;
      color: #211b16;
      background: #fbf4e8;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 15px;
      line-height: 1.62;
      overflow: hidden;
    }
    #content { height: ${CONTENT_HEIGHT_PX}px; overflow: hidden; }
    #content > *:first-child { margin-top: 0; }
    h1, h2, h3 { margin: 0 0 .65em; line-height: 1.15; }
    h1 { font-size: 1.65em; }
    h2 { font-size: 1.28em; }
    h3 { font-size: 1.08em; }
    p, ul, ol, blockquote, pre { margin: 0 0 .95em; }
    ul, ol { padding-left: 1.4em; }
    blockquote { padding-left: 1em; border-left: 3px solid #b79976; color: #51473d; }
    code { font-family: Consolas, monospace; font-size: .86em; background: rgba(86,62,40,.12); padding: .1em .24em; border-radius: 4px; }
    pre { max-width: 100%; overflow: hidden; white-space: pre-wrap; word-break: break-word; padding: .8em; border: 1px solid #d5c3ab; background: rgba(255,255,255,.34); }
    pre code { padding: 0; background: transparent; }
    img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; margin: 0 auto .95em; }
  </style>
</head>
<body>
  <main id="page"><article id="content"></article></main>
</body>
</html>`
}

async function createMeasurer() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 })
  await page.setContent(renderMeasurementHtml(), { waitUntil: 'load' })
  await page.evaluateHandle('document.fonts.ready')

  return {
    browser,
    async fits(htmlParts) {
      return page.evaluate(async ({ html, height }) => {
        const content = document.querySelector('#content')
        content.innerHTML = html
        await Promise.all(Array.from(content.querySelectorAll('img')).map((image) => {
          if (image.complete) return Promise.resolve()
          return new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true })
            image.addEventListener('error', resolve, { once: true })
          })
        }))
        return content.scrollHeight <= height
      }, { html: htmlParts.join(''), height: CONTENT_HEIGHT_PX })
    }
  }
}

async function splitChunkToFit(measurer, existingHtml, chunk) {
  const sourceParts = chunk.kind === 'code' ? chunk.lines : chunk.words
  let low = 1
  let high = sourceParts.length
  let best = 0

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const html = chunk.htmlFromPart(sourceParts.slice(0, middle))
    if (await measurer.fits([...existingHtml, html])) {
      best = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  if (best === 0) {
    return { headHtml: '', tailChunk: chunk }
  }

  const remaining = sourceParts.slice(best)
  return {
    headHtml: chunk.htmlFromPart(sourceParts.slice(0, best)),
    tailChunk: remaining.length
      ? {
          ...chunk,
          words: chunk.kind === 'paragraph' ? remaining : undefined,
          lines: chunk.kind === 'code' ? remaining : undefined
        }
      : null
  }
}

async function paginateChapter(measurer, chapter, startPageNumber, warnings) {
  const tokens = md.parse(chapter.body, {})
  const chunks = tokensToChunks(tokens)
  const pages = []
  let currentHtml = []
  let queue = [...chunks]

  function flushPage() {
    pages.push({
      pageNumber: startPageNumber + pages.length,
      chapterTitle: chapter.title,
      chapterOrder: chapter.order,
      html: currentHtml.join('')
    })
    currentHtml = []
  }

  while (queue.length > 0) {
    const chunk = queue.shift()
    const chunkHtml = chunk.html ?? chunk.htmlFromPart(chunk.kind === 'code' ? chunk.lines : chunk.words)

    if (await measurer.fits([...currentHtml, chunkHtml])) {
      currentHtml.push(chunkHtml)
      continue
    }

    if (currentHtml.length > 0) {
      flushPage()
      queue.unshift(chunk)
      continue
    }

    if (chunk.splittable) {
      const split = await splitChunkToFit(measurer, currentHtml, chunk)
      if (split.headHtml) {
        currentHtml.push(split.headHtml)
        flushPage()
      }
      if (split.tailChunk) {
        queue.unshift(split.tailChunk)
      }
      continue
    }

    warnings.push(`${chapter.filePath}: ${chunk.kind} block too tall for one A5 page`)
    currentHtml.push(chunkHtml)
    flushPage()
  }

  if (currentHtml.length > 0 || pages.length === 0) {
    flushPage()
  }

  return pages
}

async function paginateBook(measurer, book) {
  const chapters = await loadChapters(book.chaptersDir)
  const warnings = []
  const pages = []

  for (const chapter of chapters) {
    const chapterPages = await paginateChapter(measurer, chapter, pages.length + 1, warnings)
    pages.push(...chapterPages)
  }

  return {
    generatedAt: new Date().toISOString(),
    pageSize: 'A5',
    pagePixels: {
      width: CONTENT_WIDTH_PX,
      height: CONTENT_HEIGHT_PX
    },
    book: {
      slug: book.slug,
      title: book.title,
      cover: book.cover,
      description: book.description
    },
    pages,
    warnings
  }
}

async function main() {
  const books = await loadBooks()
  const measurer = await createMeasurer()
  const catalog = []

  try {
    await fs.mkdir('public/books', { recursive: true })

    for (const book of books) {
      const payload = await paginateBook(measurer, book)
      const bookOutputDir = `public/books/${book.slug}`

      await fs.mkdir(bookOutputDir, { recursive: true })
      await fs.writeFile(`${bookOutputDir}/book-pages.json`, `${JSON.stringify(payload, null, 2)}\n`)

      catalog.push({
        slug: book.slug,
        title: book.title,
        cover: book.cover,
        description: book.description,
        pageCount: payload.pages.length
      })

      for (const warning of payload.warnings) {
        console.warn(`WARN ${warning}`)
      }
      console.log(`Paginated ${book.slug}: ${payload.pages.length} pages`)
    }
  } finally {
    await measurer.browser.close()
  }

  await fs.mkdir('public', { recursive: true })
  await fs.writeFile('public/books.json', `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    books: catalog
  }, null, 2)}\n`)
  console.log(`Generated catalog with ${catalog.length} books`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
