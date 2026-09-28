# Responsive Social Infographic Studio

Production-ready browser-based infographic/carousel studio built with:

- HTML
- CSS
- Vanilla JavaScript
- CSS variables
- CSS aspect-ratio
- Inline SVG-ready architecture
- html2canvas for PNG export
- JSZip for ZIP generation

## Supported formats

- 1:1 — 1080 × 1080
- 4:5 — 1080 × 1350
- 9:16 — 1080 × 1920

## Features

- Responsive aspect-ratio switching
- Multi-slide carousel preview
- Thumbnail navigation
- Hook/CTA slide architecture
- Automatic slide numbering
- Keyboard navigation
- Presentation mode
- Current-slide PNG export
- Batch PNG export
- ZIP project packaging
- Theme switching
- JSON project loading

## Run

Open `index.html` in a modern browser.

The default export dependencies are loaded from jsDelivr:

- html2canvas 1.4.1
- JSZip 3.10.1

For fully offline production use, download and vendor those libraries into an `assets/` directory and replace the CDN script URLs.

## JSON project format

```json
{
  "projectName": "my-carousel",
  "topic": "My Topic",
  "ratio": "4:5",
  "theme": "modern",
  "slides": [
    {
      "type": "hook",
      "layout": "hero",
      "kicker": "CATEGORY",
      "title": "Your hook",
      "subtitle": "Supporting statement",
      "swipe": "SWIPE →"
    }
  ]
}
```

## Important export note

For reliable PNG export, use same-origin/local images or images with appropriate CORS headers. Fonts must be available before export.

## Recommended production deployment

For production, serve the folder over HTTPS rather than relying on `file://`, especially when using uploaded assets, fonts, or external resources.

## Usage

Upload a source file or image, then ask InfoG Studio to transform it into a responsive infographic or carousel.

Example:

> Create a 7-slide Instagram carousel from the uploaded source.
> Use 4:5 format, add a strong hook on the first slide and a CTA on the last slide.
