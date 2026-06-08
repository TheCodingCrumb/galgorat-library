# Galgorat Library

Nuxt 3 static site for a Markdown book rendered as deterministic A5 pages.

## Content

Add chapters in `content/chapters/*.md`.

Required frontmatter:

```yaml
---
title: "Chapter title"
order: 1
---
```

Each Markdown file starts on a new A5 page. Pagination runs at build time with Playwright/Chromium and writes `public/book-pages.json`.

## Commands

```bash
nvm use
npm install
npx playwright install chromium
npm run paginate
npm run dev
npm test
npm run generate
npm run test:visual
```

Local preview uses `/`.

Later GitHub Pages project deploy can set `NUXT_APP_BASE_URL=/galgorat-library/`.

`npm run dev` serves the generated static site on `http://localhost:3000`.
Use `npm run dev:nuxt` only when Nuxt hot reload is needed.
