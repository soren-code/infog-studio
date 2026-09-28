---
name: "infog-studio"
description: Create responsive social-media infographics and multi-slide carousels (Instagram, LinkedIn, Facebook, Stories/Reels covers) from documents, data, images, or notes, as HTML/CSS/vanilla JS with inline SVG in 1:1, 4:5, or 9:16, with PNG, batch ZIP, and source-project export that actually saves inside Claude Artifacts. Use this skill whenever the user asks for an infographic, carousel, social-media slides, a shareable visual from content or data, or PNG/ZIP export or download of slides, and whenever an InfoG Studio artifact shows "File downloads aren't available for this artifact", even if they do not name the skill.
---

# InfoG Studio

## Purpose

InfoG Studio is a production-oriented workflow for transforming source content into polished, mobile-first social-media infographics and multi-slide carousel designs.

Prioritize:
- Clear information hierarchy
- Strong visual storytelling
- Mobile readability
- Responsive aspect ratios
- Consistent design tokens
- Accurate content transformation
- Export-ready output

Treat the task as a complete infographic production workflow, not ordinary HTML generation.

## 1. Supported Formats

Support:

| Ratio | Target size | Typical use |
|---|---:|---|
| 1:1 | 1080 × 1080 | Square social post |
| 4:5 | 1080 × 1350 | Portrait feed post |
| 9:16 | 1080 × 1920 | Story / vertical post |

Use CSS variables and `aspect-ratio`. Do not create three unrelated hard-coded layouts.

```css
:root {
  --canvas-ratio: 1 / 1;
}
.infographic-canvas {
  aspect-ratio: var(--canvas-ratio);
  width: 100%;
}
```

Changing the ratio must preserve content hierarchy while adapting spacing, typography, charts, and layout.

## 2. Input Handling

Accept:
- Uploaded source files
- Uploaded images
- User-provided text
- Structured data
- PDF/document content when available
- Existing HTML/CSS/JS projects

First extract:
1. Main topic
2. Audience
3. Key facts
4. Important numbers
5. Headline ideas
6. Supporting points
7. Examples
8. Steps/workflow
9. CTA opportunities
10. Visual/chart opportunities

Do not invent factual information not present in the source unless explicitly requested.

## 3. Content Compression

Convert source material into concise infographic-friendly content.

Prefer:
- Short headlines
- 1–2 sentence explanations
- Bullets
- Numbered steps
- Data callouts
- Comparisons
- Before/After structures
- Charts
- Diagrams
- Icon-supported explanations

Avoid dense paragraphs, tiny typography, unnecessary repetition, and decorative clutter.

Each slide should communicate one primary idea.

## 4. Carousel Structure

Unless the user specifies another structure:

### Slide 1 — HOOK / COVER
Include a topic/category label, attention-grabbing hook, main title, short supporting line, and a strong visual/callout.

The hook should normally address a relatable problem, create curiosity, and communicate a benefit without being misleading.

### Middle Slides — CONTENT
Use logical educational progression such as:
- Problem → Solution
- Before → After
- Step-by-step
- Concept → Example
- Data → Chart
- Mistake → Fix
- Comparison
- Checklist
- Framework

### Final Slide — CTA
End with a clear action such as save, share, follow, try, or comment. Include a short recap when useful.

## 5. Slide Numbering

Every carousel slide should automatically display numbering, for example:

```text
01 / 07
02 / 07
...
07 / 07
```

Update numbering automatically when slides are added or removed.

## 6. Visual Design System

Use reusable CSS design tokens:

```css
:root {
  --color-bg: #0e1623;
  --color-surface: #141e2e;
  --color-text: #f4f7fb;
  --color-muted: #aeb9c9;
  --color-accent: #29d17f;
  --radius-md: 16px;
  --radius-lg: 24px;
}
```

Support themes such as:
- Modern
- Corporate
- Editorial
- Minimal

Change themes through tokens instead of duplicating layouts.

## 7. Typography

Use professional sans-serif typography. Prioritize headline, supporting text, data/callout, body copy, and metadata.

Use responsive sizing such as:

```css
font-size: clamp(...);
```

Use `clamp()` for page chrome (controls, preview layout). Inside a slide, size type in `cqw` with no px floors so the preview and the exported PNG match (section 14).

Keep text readable on mobile.

## 8. Responsive Layout

Use mobile-first:
- CSS Grid
- Flexbox
- `aspect-ratio`
- CSS variables
- `clamp()`
- Container queries where useful
- Relative spacing
- Safe margins

The same content must adapt between 1:1, 4:5, and 9:16 without clipping or overlapping.

## 9. Reusable Components

Build reusable components for:
- Headers and footers
- Slide numbers
- Cards
- Callouts
- Badges
- Steps
- Timelines
- Comparisons
- Before/After panels
- Tables
- Charts
- Diagrams
- Icons
- CTA blocks

Keep styling consistent throughout the carousel.

## 10. Inline SVG

Use inline SVG for charts, diagrams, icons, arrows, and data visualization.

SVG should be responsive, scalable, lightweight, and consistent with design tokens.

```html
<svg viewBox="0 0 400 220" role="img" aria-label="Sales chart">
  ...
</svg>
```

Do not use SVG when simple HTML/CSS is more appropriate.

## 11. Charts and Data

Use the simplest chart that communicates the source data:
- Horizontal bar
- Vertical bar
- Line
- Donut
- Progress
- Timeline
- Comparison

For mobile layouts, prioritize clear labels and adequate spacing.

Never fabricate data. If source data is insufficient, request it or clearly label an illustrative example when the user permits one.

## 12. Before / After Layout

For transformation content, use a two-panel layout:

```text
BEFORE  →  AFTER
Raw data   Result
```

Use clear labels, connector arrows, consistent cards, and mobile-safe spacing.

For Excel content, use compact spreadsheet mock-ups when useful.

## 13. Excel/Data Visualization

When appropriate, use:
- Thin gridlines
- Header row
- Alternating rows
- One highlighted cell/column
- Rounded container
- Subtle shadow
- Optional cell references such as A1, B1

For transformations, show raw data → resulting chart. If a horizontal bar chart is requested, do not substitute a vertical bar chart.

## 14. Export System

**The root cause to design around.** A published Claude Artifact runs in a sandboxed frame where `<a download>`, blob-URL clicks, FileSaver, and `saveAs` silently do nothing; the host reports "File downloads aren't available for this artifact." Saving a file there is a runtime capability, and it exists only if the page **declares it when published**. Both halves are required, and fixing button code alone never works:

1. **Declare it.** Call the `Artifact` tool with `action: "capabilities"` first (required before using any capability), then publish with `capabilities: {"downloads": true}`.
2. **Use it.** Paste `assets/export-runtime.js` from this skill, verbatim, into the page and call it from the buttons. Do not hand-write download code; the runtime already handles the capability, fallbacks, batch ZIPs, and honest status wording.

Read `references/export-and-publishing.md` before building, publishing, or repairing any export feature. It holds the publish steps, environment matrix, error-code behaviour, and a troubleshooting table. To repair an artifact built with the old skill, follow its section 3.

### Page contract

- Blocks: `<style id="infog-styles">`, then `<script id="infog-export">` (the runtime), then `<script id="infog-app">`.
- Each slide's canvas carries `data-infog-canvas`. Hide inactive slides with a wrapper (`hidden` on the parent), never on the canvas itself.
- Theme and ratio tokens live on `<html>` (`data-ratio="1:1|4:5|9:16"`, `data-theme`, variables on `:root`). Slide styles use plain class selectors that need no preview ancestor.
- `.infographic-canvas` sets `container-type: inline-size`, and everything inside a slide is sized in `cqw` with no px floors, so the 360px preview and the 1080px PNG match.
- Images are `data:` URIs. Containers the app renders into carry `data-infog-dynamic`; add one `<div data-infog-status>` for results and errors.

These exist because the export renders an off-screen clone of the canvas at the exact target size; the reference explains each one.

### Wiring

```js
const exporter = InfoGExport.create({
  name: project.name,
  getActiveIndex: () => state.index,
  getProject: () => project            // optional: adds project.json to the source ZIP
});
pngBtn.onclick = () => exporter.exportCurrentPNG();
zipBtn.onclick = () => exporter.exportAllZip();
srcBtn.onclick = () => exporter.exportProjectZip();
```

Target size comes from `data-ratio`: 1080 × 1080, 1080 × 1350, 1080 × 1920. Output is exact pixels regardless of screen density.

### What the runtime guarantees (do not undo it)

Save order: downloads capability, then Web Share with a File (touch devices only), then `<a download>` (top-level pages only), then an on-page Save panel with preview, Download, Open, Share, and Copy image. The user is never left without a way to get the file.

- A declined save reads "Save cancelled." and is not retried.
- Report success only when the capability said `saved` or the share resolved. Anchor and panel paths say "Download requested" or "Ready", never "downloaded".
- Only one save prompt can be open at a time, so exports never loop per-slide saves; see section 15.

## 15. Batch PNG Export

"Export all" produces one ZIP containing `slide-01.png`, `slide-02.png`, `slide-03.png`, and so on (wider padding past 99 slides), saved with a single prompt. Progress reads `Exporting 3 / 7...` and then `Packing ZIP...`. Per-slide saving in a loop is a bug: each save needs viewer confirmation, so the second one is rate limited.

## 16. ZIP Export

Offer two ZIPs, both produced by the runtime:

- **Slides ZIP** (`exportAllZip`): `<slug>-slides.zip` with the PNGs above.
- **Source ZIP** (`exportProjectZip`): `<slug>-project.zip`, a runnable project rebuilt from the page: `index.html`, `styles.css`, `script.js`, `manifest.json`, `README.md`, `.gitignore`, `assets/`, plus `project.json` when `getProject` is supplied. There are never placeholder files, so keep the `infog-styles` and `infog-app` blocks accurate; they become `styles.css` and `script.js`.

When delivering the repository as files (bash plus `present_files`) instead of from the page, use the full tree: `SKILL.md`, `README.md`, `LICENSE`, `.gitignore`, `manifest.json`, `index.html`, `styles.css`, `script.js`, `assets/`. A published page cannot see `SKILL.md` or `LICENSE`, so they appear only in the file deliverable. The ZIP must be reconstructable and runnable from what it contains.

## 17. Dependency Strategy

Published pages may load scripts only from `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `cdn.tailwindcss.com`, and `code.jquery.com`. Other hosts (unpkg, esm.sh) are blocked and fail silently, and remote images are blocked too. The runtime lazily loads html2canvas 1.4.1 and JSZip 3.10.1 from cdnjs with jsDelivr as fallback, so do not add your own script tags for them, and keep versions pinned.

For fully offline projects, vendor both files under `assets/vendor/` and document the strategy in `README.md` (the source ZIP's README already does).

## 18. Preview System

Provide:
- Main slide preview
- Slide thumbnails
- Previous/Next navigation
- Active slide indicator
- Slide count
- Presentation mode when useful

Keyboard support:
- `ArrowLeft` → previous
- `ArrowRight` → next
- `Home` → first
- `End` → last
- `P` → presentation mode
- `Escape` → exit presentation mode

Keep controls touch-friendly.

## 19. JSON Project Loading

Support structured project data when useful:

```json
{
  "name": "My Infographic",
  "ratio": "square",
  "theme": "modern",
  "slides": []
}
```

Validate imported JSON and handle malformed input without crashing.

## 20. Quality Assurance

Before finalizing, check:

### Content
- No missing text
- No accidental duplication
- No fabricated facts
- Correct spelling
- Correct numbers

### Layout
- No overflow
- No clipping
- No overlapping elements
- Safe margins
- Clear hierarchy

### Responsive
Test:
- 1:1
- 4:5
- 9:16

### Export
Verify:
- The publish call declares `capabilities: {"downloads": true}`, and the page contains the unmodified runtime with no hand-written download code
- PNG generation and target dimensions (1080 wide; height by ratio)
- Slide numbering and filenames (`slide-01.png` ...)
- Batch export makes one ZIP and one save prompt
- Save panel appears when the capability is missing
- After editing `assets/export-runtime.js`, run `scripts/test-export-runtime.cjs`; after touching rendering, run `scripts/e2e-browser-check.cjs` (run instructions are in each file's header)

### Visual
Check:
- Contrast
- Alignment
- Spacing
- Typography
- Chart readability
- Icon consistency

## 21. Accessibility

Where practical:
- Use semantic HTML
- Add useful `aria-label` values to meaningful SVG graphics
- Maintain sufficient contrast
- Do not communicate important information through color alone
- Use clear button labels
- Keep controls keyboard accessible

## 22. Performance

Prefer lightweight CSS, inline SVG, minimal JavaScript, reusable components, lazy thumbnail rendering, and selective re-rendering.

Avoid unnecessarily large raster assets, excessive DOM nesting, and repeated expensive canvas renders.

## 23. Error Handling

Errors must be visible and actionable.

Examples:

```text
PNG export failed. Try again after the slide finishes rendering.
```

```text
ZIP export failed. Check dependency/network access and try again.
```

```text
Invalid project JSON.
```

Show messages in the `[data-infog-status]` region (the runtime does this). Do not silently fail and do not report successful download when only a Blob URL was created.

## 24. Naming

Use:

```text
infog-studio
```

for repository/package naming.

Use:

```text
InfoG Studio
```

as the human-readable product name.

Recommended project files:

```text
SKILL.md
README.md
LICENSE
.gitignore
manifest.json
index.html
styles.css
script.js
```

## 25. Output Expectations

When creating an infographic:
1. Understand the source.
2. Build the content hierarchy.
3. Select a slide structure.
4. Generate the visual design.
5. Apply the selected ratio.
6. Validate the layout.
7. Produce export-ready HTML/CSS/JS.
8. Provide PNG/ZIP export when requested, using the runtime in `assets/export-runtime.js`.
9. Publish with `capabilities: {"downloads": true}` (see section 14); for a page the user wants as a file, present the file instead.

When creating a complete project, deliver a runnable project rather than only a code fragment.

When creating a Claude Skill, provide a complete `SKILL.md` following this specification.

## Core Principle

InfoG Studio should behave like a **production infographic design system**, not merely a code generator.

Balance:

**Content clarity + Visual hierarchy + Responsive layout + Export reliability + Mobile usability.**
