# Export and publishing reference

Read this before building, repairing, or publishing any InfoG Studio page that has PNG / ZIP / download buttons.

## Contents
1. Why "File downloads aren't available for this artifact." happens
2. Publish procedure (declare + use)
3. Repairing an artifact built with the old skill
4. Page contract
5. What the runtime does in each environment
6. `downloads` error codes and the runtime's response
7. Troubleshooting
8. Testing and what is not covered

---

## 1. Why the error happens

A published Claude Artifact is a hosted page shown in a sandboxed frame. In that frame:

- `<a download>` clicks, `URL.createObjectURL` + click, FileSaver, and `saveAs` are inert.
- The host answers the attempt with "File downloads aren't available for this artifact."

Saving a file from such a page is a **runtime capability** named `downloads`. It exists only when the page:

1. **declares** it when published (`capabilities: {"downloads": true}`), and
2. **calls** it: `const downloads = await claude.use("downloads"); await downloads.save({filename, data})`.

Old InfoG Studio pages did neither, so every PNG/ZIP button hit the inert `<a download>` path. Rewriting the button code without republishing with the capability still fails, because `claude.use("downloads")` returns `null` for pages that did not declare it.

The viewer sees a confirmation (final filename and size) and may decline. That prompt is by design; mention it to the user so it does not look like a bug.

## 2. Publish procedure

1. Call `Artifact` with `action: "capabilities"`. It is required before using any capability, and it confirms `downloads` is available to this user. If `downloads` is not listed, tell the user exports will use the on-page Save panel instead, and continue.
2. Build one self-contained `.html` file in `/mnt/user-data/outputs/` following the page contract (section 4), with `assets/export-runtime.js` pasted verbatim into `<script id="infog-export">`.
3. Publish with `Artifact` (`action: "publish"`) and `capabilities: {"downloads": true}`. A non-empty `capabilities` object is a full declaration, so restate every capability the page needs. Omitting `capabilities` on a republish carries the stored declaration forward.
4. Do **not** also call `present_files` for the published page. The publish card is the delivery.
5. Updating in place: publish again with `url` set to the artifact's link. Do not create a second artifact.
6. One line to the user: exports ask for a save confirmation, and if their browser blocks it the page shows a Save panel with Download / Open / Share.

If the `Artifact` tool is not available (Claude Code, Cowork, API), the runtime still works: `claude` is undefined so it uses Web Share (touch), `<a download>` (top-level page), or the Save panel. Deliver the HTML with `present_files`.

## 3. Repairing an artifact built with the old skill

1. `Artifact` `action: "read"` with the artifact's link; the files land under `/mnt/user-data/outputs/artifacts/`.
2. Delete the old export code (any `saveAs`, `<a download>`, `URL.createObjectURL` helpers, per-slide save loops).
3. Add the markers from the page contract, paste the runtime into `<script id="infog-export">`, and wire the buttons to `exportCurrentPNG()`, `exportAllZip()`, `exportProjectZip()`.
4. Remove any `<script src>` tags for html2canvas / JSZip (the runtime loads them) and any host outside the allowed list.
5. Publish with `url` (same artifact) and `capabilities: {"downloads": true}`.

## 4. Page contract

The runtime relies on these conventions. Each exists for a reason found in testing.

| Convention | Why |
|---|---|
| `<style id="infog-styles">`, `<script id="infog-export">` (runtime, first), `<script id="infog-app">` | The source ZIP rebuilds `styles.css` and `script.js` from these blocks. |
| Each slide's canvas element has `data-infog-canvas` | Default slide lookup for export. |
| Hide inactive slides with a **wrapper** (`hidden` on the parent), never on the canvas | The export clones the canvas into an off-screen stage; a hidden class on the canvas itself would render blank. |
| Theme and ratio tokens live on `<html>` (`data-ratio="1:1\|4:5\|9:16"`, `data-theme`, variables on `:root`) | The clone is appended to `<body>`, so tokens set on a preview wrapper are lost. |
| Slide styles use plain class selectors, not selectors that need a preview ancestor (`.preview .slide`) | Same reason: the clone has no preview ancestor. |
| `.infographic-canvas { container-type: inline-size }` and every size inside a slide in `cqw` (no px floors in `clamp()`) | Preview (about 360px) and export (1080px) then look identical. A px floor makes text relatively larger in the preview than in the PNG. |
| Images as `data:` URIs only | The page CSP blocks remote images; cross-origin images taint the canvas. |
| Containers the app script renders into carry `data-infog-dynamic`; one `<div data-infog-status>` for messages | Source ZIP starts those containers empty; the status region is where results and errors show (`role=status`, `aria-live=polite`). |

Wiring:

```js
const exporter = InfoGExport.create({
  name: project.name,                 // drives filenames: <slug>-slides.zip, <slug>-project.zip
  getActiveIndex: () => state.index,  // which slide "Export PNG" renders
  getProject: () => project           // optional: adds project.json to the source ZIP
});
pngBtn.onclick = () => exporter.exportCurrentPNG();
zipBtn.onclick = () => exporter.exportAllZip();
srcBtn.onclick = () => exporter.exportProjectZip();
```

Options you may pass: `getSlides` (default `[data-infog-canvas]`), `getTarget` (default from `data-ratio`: 1080x1080, 1080x1350, 1080x1920), `onStatus` (default writes to `[data-infog-status]`), `preload: false`.

Label the buttons for what they do ("Export PNG", "Export all (ZIP)", "Source project (ZIP)"). Keep them 44px tall for touch.

## 5. What the runtime does in each environment

| Where the page runs | `downloads` | Result |
|---|---|---|
| Published artifact in the claude.ai viewer, capability declared | available | Viewer confirms, file saved (browser download, iOS share sheet, or Android file write). Status: "Saved <file>." |
| Same, viewer declines | available | "Save cancelled." No fallback is attempted. |
| Artifact opened in its own tab (top-level) | null | `<a download>`: a real browser download. Status says "Download requested" with an Open / Save button, because the result of an anchor download cannot be observed. |
| Chat artifact preview (unpublished; different runtime, no `claude.use`) | null | Save panel: image preview (press-and-hold / right-click to save), Download, Open in new tab, Share (touch), Copy image. |
| Framed page without the capability | null | Web Share on touch devices, otherwise the Save panel. |
| Source ZIP opened from disk | none | `<a download>`. |

The runtime never says "downloaded" unless the capability reported `saved` or `navigator.share` resolved.

## 6. `downloads` error codes and the runtime's response

| Code | Runtime behaviour |
|---|---|
| `declined` | Status "Save cancelled." Stop. Never auto-retry. |
| `rate_limited` | "A save prompt is already open. Answer it, then try again." The runtime also ignores clicks while an export is running. |
| `too_large` | "That file is too large to save here. Export fewer slides at a time." |
| `extension_not_enabled` | ZIP is on the platform's second extension list and can be switched off per view. The runtime stops and says to export slides one at a time as PNG. No fallback chain. |
| `unavailable`, `not_granted`, `capability_*`, `bad_request`, `transform_error`, anything unknown | Logged, then falls through to Web Share / anchor / Save panel so the user is never stuck. |

**Batch exports are one ZIP, not N saves.** Each save asks for confirmation and only one prompt may be open, so a loop of per-slide saves gets rate limited. Slides are rendered into a single ZIP (`slide-01.png` ...) and saved once.

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "File downloads aren't available for this artifact." | Page uses `<a download>`/FileSaver, or was published without the capability | Sections 2 and 3 |
| `claude.use("downloads")` is `null` in a published page | `capabilities` not declared on publish, or the page is open top-level | Republish with `capabilities: {"downloads": true}`; top-level pages use the anchor path, which is expected |
| Blank or partly empty PNG | Canvas hidden by its own class; tokens on a wrapper; px floors in `clamp()`; remote image | Page contract, section 4 |
| PNG text looks different from preview | px sizes inside slides | Use `cqw` |
| Error mentions "same-origin document" | Strictly sandboxed frame; html2canvas cannot open its clone frame | The runtime adds "Open the artifact in its own browser tab and export from there." Tell the user the same |
| "ZIP export failed. Check dependency/network access" | CDN blocked or offline | Runtime tries cdnjs then jsDelivr. Check the page has no other host; for offline use vendor the libraries |
| Web Share silently skipped on phone | User activation expired while rendering, or frame lacks the `web-share` permission | Expected. The runtime falls through to the Save panel, which has a fresh Share button |
| ZIP save refused, PNG works | `extension_not_enabled` for ZIP in this view | Use single-slide PNG export |

## 8. Testing and what is not covered

Tests live in `scripts/` and were run against this runtime when it was written (19 unit tests, 24 real-Chromium checks, all passing):

- `scripts/test-export-runtime.cjs`: jsdom + stubs. Save cascade, error codes, share/anchor/panel selection, batch ZIP contents, source ZIP contents, CDN fallback order, and a guard that the runtime source contains no literal script-tag or comment-open sequences (either would break an inlined page).
- `scripts/e2e-browser-check.cjs`: headless Chromium with real html2canvas and JSZip. Exact 1080-pixel dimensions at every ratio (also with devicePixelRatio 2), real pixels, hidden-wrapper slides, one prompt for the batch ZIP, source ZIP running standalone, Save panel in a same-origin sandboxed frame, actionable error in a strict sandbox.

Run the unit tests after any edit to `assets/export-runtime.js`; run the e2e check after touching rendering (`buildStage`, `renderSlideToBlob`).

Not covered: the real claude.ai confirmation prompt (mocked from the published type definitions), iOS and Android share behaviour, and loading the libraries from the live CDNs (the sandbox where this was built blocks those hosts; html2canvas 1.4.1 on cdnjs was confirmed from the cdnjs listing, and jsDelivr is the fallback for both libraries). After first publishing a page, click each export button once in the real viewer.
