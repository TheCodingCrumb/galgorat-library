# PRD: Book Cover Page Flip Model

## Introduction/Overview
Replace the current first-page workaround with a proper physical book model for the Nuxt reader. The reader should start on a first cover, open to an inside cover plus the first content page, continue through normal two-page spreads, and end on inside/back covers without showing broken single-page states.

The current implementation makes page 1 behave like a special content page. This keeps the left edge stable, but visually leaves a large empty right side and requires CSS patches. A real cover model removes the mismatch between physical pages and content pages.

## Goals
- Start the animated reader on a first cover, not directly on content page 1.
- Open to a spread with inside cover on the left and content page 1 on the right.
- Allow each book to configure cover visuals as either image-based covers or text-and-color covers.
- Keep content pages and page labels mapped to the generated book pages only.
- Keep page-turn animation quality unchanged for normal content spreads.
- End with a coherent inside/back cover sequence and no orphaned back-cover page.
- Preserve mobile single-page readability and reduced-motion fallback.

## Execution Settings
Test Command: npm test
Quality Gates:
- npm run build
- npm run test:visual

## User Stories
### US-001: Define a physical book page model with covers
**Description:** As a reader, I want the book to have first, inside, and back covers so that opening and closing the book feels like a real book.

**Acceptance Criteria:**
- [x] Physical pages include first cover, inside front cover, content pages, inside back cover, and back cover.
- [x] Content page indexes remain separate from physical page indexes.
- [x] Content pages are the only pages counted in reader progress labels.
- [x] Odd content-page counts are padded with a blank content-side page before inside back cover.
- [x] Unit tests cover physical-to-content and content-to-physical index mapping.
- [x] The cover state can exist without a visible progress label.

**TDD Plan:**
- Test: Add failing unit tests for physical page generation and index mapping with odd and even content page counts.
- Implementation: Update the physical page helper to generate explicit cover pages and mapping functions without leaking cover pages into content progress.

**Dependencies:** -
**Parallel Group:** model

### US-002: Render covers in the PageFlip component
**Description:** As a reader, I want the animated book to start on a cover and open naturally so that page 1 does not appear as a broken half-spread.

**Acceptance Criteria:**
- [x] Desktop initial state shows a first cover as a single visible page.
- [x] The first cover behaves like a real physical page in PageFlip animation.
- [x] First navigation opens to inside front cover on the left and content page 1 on the right.
- [x] Subsequent navigation opens content spreads without changing existing animation behavior.
- [x] Final physical pages show inside back cover and back cover without allowing a broken orphaned state.
- [x] Cover elements are distinguishable with stable classes and ARIA labels.

**TDD Plan:**
- Test: Add failing Playwright checks for initial cover, first opened spread, and final cover behavior.
- Implementation: Update `BookPageFlip.client.vue` to create cover elements, set `showCover: true`, and translate PageFlip events between physical and content indexes.

**Dependencies:** US-001
**Parallel Group:** reader

### US-003: Keep navigation and progress content-focused
**Description:** As a reader, I want previous/next buttons and progress labels to track story pages, not covers, so that the UI remains clear.

**Acceptance Criteria:**
- [x] Progress labels never mention cover pages.
- [x] No visual progress label is shown while the reader is on a cover state.
- [x] The initial cover state has previous disabled and next enabled.
- [x] Opening from cover advances to content page 1 without counting the cover as page 1.
- [x] At the last content page, the next button remains disabled and does not navigate to back covers.
- [x] Physical gestures may animate cover pages, but button state remains content-focused.
- [x] Keyboard navigation follows the same mapping as button navigation on desktop.

**TDD Plan:**
- Test: Add failing unit and Playwright checks for progress labels, button disabled states, and keyboard navigation at cover boundaries.
- Implementation: Adjust reader/page-flip synchronization so UI state remains content-focused while physical pages can include covers.

**Dependencies:** US-002
**Parallel Group:** navigation

### US-004: Update styling for cover and inside-cover pages
**Description:** As a reader, I want covers and inside covers to look intentional so that they read as book structure, not missing content.

**Acceptance Criteria:**
- [x] First and back covers use a distinct cover style from content paper.
- [x] Covers support either configured images or configured text and colors.
- [x] If no image is configured, the fallback cover renders title text on configured colors.
- [x] Inside covers use a quiet blank-paper style.
- [x] Page 1 content no longer needs a special shadow/radius workaround.
- [x] Mobile cover layout remains single-page and readable.
- [x] Reduced-motion fallback renders content pages correctly and does not depend on PageFlip cover internals.

**TDD Plan:**
- Test: Add failing visual assertions for cover classes, first-opened spread, and absence of the previous first-page workaround class.
- Implementation: Replace the first-page special CSS with explicit cover/inside-cover styling and keep existing paper styles for content pages.

**Dependencies:** US-002
**Parallel Group:** styling

### US-005: Validate visual stability across start, middle, and end
**Description:** As a maintainer, I want regression tests around the start and end of the book so that future animation changes do not reintroduce broken states.

**Acceptance Criteria:**
- [x] Playwright verifies desktop initial cover, first opened spread, normal middle spread, final content spread, and final cover behavior.
- [x] Playwright verifies mobile initial cover and first content page after navigation.
- [x] Existing content overflow and A5 ratio checks still pass for content pages.
- [x] Browser inspection confirms no sudden horizontal content jump when opening from cover to page 1.
- [x] Build-generated JSON files are not committed when only timestamps change.

**TDD Plan:**
- Test: Add failing visual tests for start/middle/end transitions before implementation is accepted.
- Implementation: Update tests and reader behavior until `npm test`, `npm run build`, and `npm run test:visual` pass without generated timestamp diffs.

**Dependencies:** US-003, US-004
**Parallel Group:** validation

## Functional Requirements
- The PageFlip page list must include physical pages in this order: first cover, inside front cover, content pages, optional blank page, inside back cover, back cover.
- The system must maintain explicit conversion between physical page indexes and content page indexes.
- Book cover configuration must support image-based covers and text-and-color covers.
- Cover configuration must allow defaults so books without explicit cover settings still render intentional covers.
- The public reader composable must continue exposing content-focused state: current content index, visible content pages, progress label, and button enabled states.
- The PageFlip component must translate physical `flip` events into content page changes without emitting cover indexes as content indexes.
- The first cover must behave like a physical page in the flip animation, not like a static overlay.
- Desktop initial state must not show content page 1 as a left-only spread with an empty right slot.
- The visual progress label must be hidden on cover states to preserve a casual journal feel.
- The next button must stay disabled at the last content page and must not advance to the back cover sequence.
- Mobile must remain one visible page at a time.
- Reduced-motion mode must keep the existing simple content spread behavior and must not require animated covers.
- Cover and inside-cover pages must have stable CSS classes for visual tests and future styling.
- The implementation must remove first-page-only shadow/radius workaround styles once explicit covers are in place.

## Non-Goals
- Designing final production cover artwork.
- Adding a book table of contents.
- Changing pagination or generated content HTML.
- Replacing `page-flip` with another animation library.
- Reworking catalog or generated book data schema beyond what is required for title/cover display already available.

## Success Metrics
- First screen reads visually as a closed book cover, not a content page floating in a double-width empty spread.
- Opening the book shows inside front cover plus content page 1.
- Cover states show no visual progress label.
- Middle page-turn animation remains visually unchanged.
- The next button remains disabled at the last content page.
- End of book has no broken orphaned back-cover state through physical gestures.
- `npm test`, `npm run build`, and `npm run test:visual` pass.
- Visual tests cover start, middle, and end book states on desktop and mobile.

## Open Questions
- None.

## Decisions
- Covers must be configurable per book as image covers or text-and-color covers.
- Covers must behave like physical PageFlip pages in animation.
- The next button stays disabled at the last content page.
- Cover states show no visual progress label.
