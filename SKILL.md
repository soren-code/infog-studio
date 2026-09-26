---
name: infog-studio
description: Production-ready skill for creating responsive social-media infographics and carousels from source content using HTML, CSS, Vanilla JavaScript, inline SVG, and responsive 1:1, 4:5, and 9:16 layouts.
---

# InfoG Studio

## Purpose
InfoG Studio turns source material—documents, notes, spreadsheets, screenshots, images, or structured data—into polished social-media infographics and multi-slide carousels.

The output must be responsive, mobile-first, editable, visually consistent, and exportable.

## Supported Formats

| Ratio | Target |
|---|---:|
| 1:1 | 1080 × 1080 |
| 4:5 | 1080 × 1350 |
| 9:16 | 1080 × 1920 |

Use CSS variables and `aspect-ratio` rather than separate hard-coded layouts.

```css
:root {
  --canvas-ratio: 1 / 1;
  --canvas-width: 1080;
  --canvas-height: 1080;
}
.canvas {
  width: 100%;
  aspect-ratio: var(--canvas-ratio);
}
```

## Core Workflow

1. Analyze the source and identify the main topic, audience, key facts, numbers, steps, examples, comparisons, and visual opportunities.
2. Compress the source into concise social-friendly copy without changing factual meaning.
3. Build a clear content hierarchy.
4. Create a hook for the opening slide.
5. Create educational middle slides.
6. Create a CTA for the final slide.
7. Apply the selected ratio and responsive design system.
8. Add slide numbering.
9. Add inline SVG visualizations where useful.
10. Validate overflow and export behavior.

## Carousel Structure

Default carousel structure:

```text
01 — Hook
02 — Problem / Context
03 — Core Concept
04 — Example / Data
05 — How-To / Steps
06 — Key Takeaway
07 — CTA
```

Adapt the number of slides to the source instead of forcing unnecessary slides.

## Hook Rules

The hook should:
- Grab attention in 1–2 lines.
- Start with a relatable problem, question, mistake, or desired outcome.
- Make the audience recognize the situation immediately.
- Reflect the actual subject.

## CTA Rules

The final slide should summarize the value and provide one clear action such as:
- Save this
- Share this
- Follow for more
- Try it yourself
- Comment with a question
- Bookmark for later

## Slide Numbering

Use automatic numbering such as:

```text
01 / 07
02 / 07
...
07 / 07
```

```js
function slideNumber(index, total) {
  return `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}
```

## Design System

Use CSS custom properties for colors, spacing, typography, radii, and shadows.

```css
:root {
  --bg: #0b1020;
  --surface: #141b2d;
  --text: #f7f9fc;
  --muted: #aab4c5;
  --primary: #7c5cff;
  --secondary: #36d6ae;
  --accent: #ff9d5c;
  --radius-md: 20px;
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 48px;
}
```

Do not scatter arbitrary design values throughout the code.

## Typography

Maintain a clear hierarchy:
- Display headline
- Section headline
- Supporting headline
- Body
- Caption
- Metadata / slide number

Use responsive sizing such as:

```css
.headline {
  font-size: clamp(2rem, 6cqw, 5rem);
  line-height: 0.98;
}
```

Avoid tiny text and excessive copy.

## Layout

Use:
- CSS Grid
- Flexbox
- `aspect-ratio`
- `clamp()`
- Relative units
- Container queries where useful
- Safe-area padding

Avoid absolute positioning as the primary layout system.

Every slide must remain usable at 1:1, 4:5, and 9:16.

## Inline SVG

Use inline SVG for charts, diagrams, arrows, icons, flow diagrams, simple illustrations, and data visualizations.

```html
<svg viewBox="0 0 600 300" role="img" aria-label="Sales trend">
  <path d="..." fill="none" stroke="currentColor" stroke-width="8"/>
</svg>
```

Keep SVG responsive:

```css
.chart svg {
  width: 100%;
  height: auto;
  display: block;
}
```

Charts must communicate an actual insight rather than being decorative.

## Data Visualization

When source data is available:
- Select the simplest suitable chart.
- Label important values.
- Keep units consistent.
- Avoid misleading scaling.
- Highlight the key insight.
- Prefer horizontal bars when category labels are long.
- Use inline SVG for final charts.

## Themes

Support theme switching through CSS variables. Recommended themes:
- Modern
- Corporate
- Editorial
- Minimal

Themes should change design tokens rather than duplicate entire stylesheets.

## Application UI

A browser editor should provide:
- Ratio selector
- Theme selector
- Slide navigation
- Thumbnail preview
- Current slide preview
- Previous/next controls
- Export current PNG
- Export all PNGs
- Download project ZIP
- JSON project loading
- Presentation mode
- Keyboard navigation
- Export progress/status

## Keyboard Controls

Support:
- `ArrowLeft` — previous slide
- `ArrowRight` — next slide
- `Home` — first slide
- `End` — last slide
- `P` — presentation mode
- `Escape` — exit presentation mode

Do not override keyboard input while typing in form fields.

## Presentation Mode

Presentation mode should hide editor controls, expand the active canvas, support keyboard navigation, preserve the selected ratio, and exit with `Escape`.

## PNG Export

Use `html2canvas` for browser PNG rendering.

Recommended dependency:

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
```

For production/offline use, vendor dependencies locally.

```js
const canvas = await html2canvas(slideElement, {
  backgroundColor: null,
  scale: 2,
  useCORS: true
});
```

The final export dimensions must correspond to the selected target ratio, not the browser viewport.

## Batch Export

Export deterministic filenames:

```text
slide-01.png
slide-02.png
slide-03.png
```

Wait for fonts and images before rendering and show progress such as `Exporting 3 / 7...`.

## ZIP Export

Use `JSZip`.

Recommended dependency:

```html
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
```

The ZIP must contain real, usable source files—not placeholders.

Recommended structure:

```text
infog-studio/
├── SKILL.md
├── README.md
├── manifest.json
├── index.html
├── styles.css
├── script.js
└── assets/
    ├── fonts/
    ├── images/
    └── vendor/
```

## JSON Projects

Support loading and saving structured projects.

```json
{
  "name": "My Infographic",
  "ratio": "4:5",
  "theme": "modern",
  "slides": [
    {
      "type": "hook",
      "title": "Your headline",
      "body": "Supporting copy"
    },
    {
      "type": "content",
      "title": "Key concept",
      "body": "Explanation"
    },
    {
      "type": "cta",
      "title": "Save this guide",
      "body": "Follow for more"
    }
  ]
}
```

Validate imported JSON and handle malformed files gracefully.

## Accessibility

Use semantic HTML, meaningful SVG `aria-label`s, adequate contrast, keyboard navigation, visible focus states, and alternative text for meaningful images. Mark decorative SVGs with `aria-hidden="true"`.

## QA

Before export check:
- Canvas and ratio exist.
- Slide count and numbering are correct.
- Hook and CTA exist for carousel projects.
- No horizontal or vertical overflow.
- No clipped or overlapping text.
- Charts fit.
- Images and fonts load.
- Footer and slide numbers remain visible.
- CTA remains visible.
- Minimum readable font size is maintained.
- PNG dimensions are correct.
- Editor controls are not captured.

## Source Analysis

When source files are supplied:
1. Extract the content.
2. Identify the core educational message.
3. Remove repetition.
4. Convert long explanations into concise slide copy.
5. Identify data suitable for visualization.
6. Create logical slide progression.
7. Produce a hook.
8. Produce a CTA.
9. Preserve factual meaning.
10. Never fabricate missing information.

## Content Density

A slide should communicate one primary idea.

Prefer:

```text
1 strong headline
1 short explanation
1 visual
1 supporting callout
```

If content is too dense, create additional slides instead of shrinking typography excessively.

## Component Architecture

Prefer reusable components:

```text
App
├── Toolbar
├── RatioSelector
├── ThemeSelector
├── SlideNavigator
├── ThumbnailRail
├── SlideCanvas
│   ├── HookSlide
│   ├── ContentSlide
│   ├── ChartSlide
│   ├── StepsSlide
│   └── CTASlide
└── ExportManager
```

Keep rendering logic separate from export logic where practical.

## Dependency Policy

Recommended stack:
- HTML5
- CSS3
- Vanilla JavaScript
- Inline SVG
- html2canvas
- JSZip

Avoid unnecessary frameworks or build systems unless explicitly requested.

## Error Handling

Errors must be clear and actionable. Never silently fail.

Examples:

```text
Unable to export this slide. Check that all images have loaded and try again.
```

```text
The project JSON is invalid. Please verify the file format.
```

## Naming

Technical short name:

```text
infog-studio
```

User-facing name:

```text
InfoG Studio
```

Recommended title:

```text
InfoG Studio — Responsive Social Infographic Builder
```

## Final Output Expectations

When creating an InfoG Studio project, produce a responsive, editable, production-oriented result. Use the selected ratio system, inline SVG where appropriate, automatic slide numbering, hook/CTA structure, preview/navigation, PNG export, and ZIP packaging when requested. Ensure packaged files contain complete working source code rather than placeholders.
