---
title: "Photography — Drive-backed gallery"
description: Photography gallery that sources images from Google Drive, supports LQIP, handles unsupported formats, and provides an accessible lightbox experience.
tags: [Vue, Node.js, Google Drive API, Performance]
category: web-development
date: 2024-06-01
links:
  - text: Live Gallery
    href: /photography
---

### Problem

Needed a portfolio gallery that loads photos from a public Google Drive folder while avoiding broken images, keeping fast first paint, and supporting a range of formats.

### Role

Full-stack: client-side gallery UI, Google Drive integration, serverless image proxy for unsupported formats, performance tuning and UX polish.

### Approach

- Client-side Drive API (thumbnailLink and alt=media fallbacks) with typed env vars
- Blur-up LQIP placeholders and prioritized thumbnail loading
- IntersectionObserver sentinel and batching with limited concurrency
- Serverless image proxy/resizer to convert HEIC/RAW to web-friendly formats when needed
- SessionStorage caching of folder tree and dedupe by ID

### Impact

Stable gallery with faster perceived load, no broken tiles, and consistent lightbox experience across devices. Improved first-paint and reduced user friction when viewing large albums.

### Artifacts

- Component: `src/components/photography/photo-gallery.vue`
- Pages: `src/pages/photography.astro`, `src/pages/photography/[album].astro`
- Docs: `FEATURES.md`, `TODO.md`
