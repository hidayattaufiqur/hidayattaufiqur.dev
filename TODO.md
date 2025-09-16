# TODO

## Pending

- Handle unsupported Google Drive images in gallery lightbox
  - Add an image proxy/resizer to serve non-renderable formats (e.g., HEIC/RAW) as web-friendly JPEG/WEBP.
  - Options:
    - Cloud Function / Vercel/Netlify Function: fetch Drive `webContentLink` or `uc?export=download&id=...`, convert, cache, and return image bytes with proper CORS.
    - Use a media CDN (e.g., Cloudinary/Imgix) with Drive import and on-the-fly format conversion.
  - Update provider to detect unsupported MIME types and route through the proxy instead of linking out to Drive.
  - Keep thumbnails and lightbox URLs consistent (`thumb` ~600w, `src` ~1600w) with cache headers.

- Tweak clear-display UI (optional)
  - Make arrow opacity configurable; consider 30–60% range.
  - Optionally add a subtle hint on first entry into clear-display.

- Remove debug overlay once Drive originals are stable (keep console logs behind `?debug=1`).

## Completed

- Categorized albums from Drive folder structure
  - Implemented album fetch from Drive subfolders with a filter UI; deep-link added at `/photography/[album]`.
  - Cached album listing; ordered by `createdTime desc`.

- Remove mobile infinite scrolling
  - Replaced with explicit “Load more” button on mobile and persisted scroll/page state on back navigation.
