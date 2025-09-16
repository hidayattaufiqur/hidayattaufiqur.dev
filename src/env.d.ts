/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GOOGLE_API_KEY?: string
  readonly PUBLIC_GOOGLE_DRIVE_FOLDER_ID?: string
  readonly PUBLIC_PHOTO_BATCH_SIZE?: string
  readonly PUBLIC_PHOTO_PER_FOLDER_PAGE_SIZE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
