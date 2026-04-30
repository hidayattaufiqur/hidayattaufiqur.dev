# TODO

## Pending

- None — all pending photography/Drive tasks completed. (Updated 2026-04-21)

## Completed

- Categorized albums from Drive folder structure
  - Implemented album fetch from Drive subfolders with a filter UI; deep-link added at `/photography/[album]`.
  - Cached album listing; ordered by `createdTime desc`.

- Remove mobile infinite scrolling
  - Replaced with explicit “Load more” button on mobile and persisted scroll/page state on back navigation.

- Handle unsupported Google Drive images in gallery lightbox
  - Added an image proxy/resizer to serve non-renderable formats (e.g., HEIC/RAW) as web-friendly JPEG/WEBP.
  - Implemented a serverless image proxy that fetches Drive `webContentLink` / `uc?export=download&id=...`, converts, caches, and returns image bytes with proper CORS. Thumbnails (~600w) and lightbox sources (~1600w) are served consistently with cache headers.

- Tweak clear-display UI
  - Arrow opacity made configurable (default range 30–60%) and a subtle first-entry hint was added.

- Remove debug overlay
  - Debug overlay removed; debug logs remain available behind `?debug=1`.
