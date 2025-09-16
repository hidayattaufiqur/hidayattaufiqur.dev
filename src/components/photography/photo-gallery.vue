<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'

interface PicsumPhoto {
  id: string
  author: string
  width: number
  height: number
  url: string
  download_url: string
}

interface ExifMeta {
  cameraMake?: string
  cameraModel?: string
  focalLength?: number
  aperture?: number
  iso?: number
  exposureTime?: string | number
  createdTime?: string
}

interface Photo {
  id: string
  title: string
  src: string
  thumb: string
  lqip?: string
  width: number
  height: number
  exif?: ExifMeta
  altSrc?: string
}

// Deep-link: optional initial album slug must be declared before runtime statements
const props = defineProps<{ initialAlbumSlug?: string | null }>()

const photos = ref<Photo[]>([])
const loading = ref<boolean>(true)
const loadingMore = ref<boolean>(false)
const error = ref<string | null>(null)
const provider = ref<'drive' | 'picsum'>('picsum')
const driveNextPageToken = ref<string | null>(null)
const picsumPage = ref<number>(1)
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)
const selectedIndex = ref<number | null>(null)
const lightboxLoaded = ref<boolean>(false)
const debug = ref<boolean>(false)
const debugPhotoOnlyId = ref<string | null>(null)
const restoredOnce = ref<boolean>(false)
// Track per-image load state for gentle fade-in
const loadedThumbs = ref<Set<string>>(new Set())
function onThumbLoad(id: string) {
  try {
    loadedThumbs.value.add(id)
  }
  catch {
    // ignore
  }
}
function onThumbError(id: string) {
  // Consider errored thumbs as loaded to remove skeleton overlay
  try {
    loadedThumbs.value.add(id)
  }
  catch {
    // ignore
  }
}

// Albums (Drive)
interface DriveAlbum {
  id: string
  name: string
  createdTime?: string
  slug: string
}
const albums = ref<DriveAlbum[]>([])
const selectedAlbumId = ref<string | null>(null)
const albumsLoading = ref<boolean>(false)
const rootFolderIdRef = ref<string | null>(null)

// Aggregate state for "All Photos" (root + subfolders)
interface AggregateState {
  folderIds: string[]
  tokens: Record<string, string | null>
  exhausted: Set<string>
}
const aggregateState = ref<AggregateState | null>(null)

// Per-album cache to avoid refetch and enable instant switches
const albumCache = ref<Record<string, { items: Photo[], nextPageToken: string | null }>>({})
const albumCacheIndex = ref<Record<string, Set<string>>>({})

function cacheAlbumUpdate(id: string, items: Photo[], nextPageToken: string | null) {
  if (!albumCache.value[id])
    albumCache.value[id] = { items: [], nextPageToken: null }
  if (!albumCacheIndex.value[id])
    albumCacheIndex.value[id] = new Set<string>()
  const idx = albumCacheIndex.value[id]
  const dest = albumCache.value[id]
  for (const p of items) {
    if (!idx.has(p.id)) {
      idx.add(p.id)
      dest.items.push(p)
    }
  }
  dest.nextPageToken = nextPageToken
}

// Configurable batching (env-backed with sensible defaults)
const BATCH_SIZE = (() => {
  const n = Number(import.meta.env.PUBLIC_PHOTO_BATCH_SIZE)
  // Default to 5 for fast, progressive loading
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100) : 5
})()
const _PER_FOLDER_PAGE = (() => {
  const n = Number(import.meta.env.PUBLIC_PHOTO_PER_FOLDER_PAGE_SIZE)
  if (Number.isFinite(n) && n > 0)
    return Math.min(Math.floor(n), 50)
  // default: about half of batch, min 2, max 10
  return Math.max(2, Math.min(10, Math.ceil(BATCH_SIZE / 2)))
})()

// Network-aware tuning
function batchSize(): number {
  let n = BATCH_SIZE
  try {
    const nav = navigator as any
    const c = nav?.connection
    if (c?.saveData)
      n = Math.max(3, Math.min(n, 5))
    else if (typeof c?.effectiveType === 'string' && /(slow-)?2g|3g/.test(c.effectiveType))
      n = Math.max(3, Math.min(n, 6))
    else if (!isMobile.value && c?.effectiveType === '4g' && Number(c?.downlink) > 5)
      n = Math.min(n + 3, 12)
  }
  catch {}
  return n
}
function perFolderPage(): number {
  const n = Math.ceil(batchSize() / 2)
  return Math.max(2, Math.min(10, n))
}

// Aggregated fetch concurrency (parallel folders per round)
const AGG_CONCURRENCY = 3

// Auto-load sentinel
const loadMoreSentinel = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null

function hasMoreAvailable(): boolean {
  if (provider.value === 'drive') {
    if (selectedAlbumId.value === '__ALL__')
      return aggregateHasMore()
    return !!driveNextPageToken.value
  }
  return true
}

function maybeAutoLoad() {
  try {
    if (loading.value || loadingMore.value)
      return
    if (!hasMoreAvailable())
      return
    const el = loadMoreSentinel.value
    if (!el)
      return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight || 0
    // mimic rootMargin: 400px
    if (rect.top <= vh + 400)
      loadMore()
  }
  catch {}
}

const selectedPhoto = computed(() =>
  selectedIndex.value != null ? photos.value[selectedIndex.value] : null,
)

function normalizeDateString(s?: string | null): Date | null {
  if (!s)
    return null
  // Handle EXIF-like "YYYY:MM:DD HH:MM:SS"
  if (/^\d{4}:\d{2}:\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s)) {
    const iso = `${s.replace(/^([0-9]{4}):([0-9]{2}):([0-9]{2})\s+/, '$1-$2-$3T')}Z`
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }
  // Try native parsing (RFC 3339, ISO 8601)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const formattedDate = computed(() => {
  const raw = selectedPhoto.value?.exif?.createdTime
  const d = normalizeDateString(raw)
  return d ? d.toLocaleDateString() : ''
})

function formatExposure(exp?: string | number): string | undefined {
  if (exp == null)
    return undefined
  // If it's already a fraction string like 1/250
  if (typeof exp === 'string') {
    const s = exp.trim()
    if (s.includes('/'))
      return s.endsWith('s') ? s : `${s}s`
    const n = Number(s)
    if (!Number.isFinite(n) || n <= 0)
      return s
    if (n >= 1) {
      const val = n < 10 ? n.toFixed(1) : Math.round(n).toString()
      return `${val.replace(/\.0$/, '')}s`
    }
    const denom = Math.round(1 / n)
    return `1/${denom}s`
  }
  // Number
  const n = exp
  if (!Number.isFinite(n) || n <= 0)
    return undefined
  if (n >= 1) {
    const val = n < 10 ? n.toFixed(1) : Math.round(n).toString()
    return `${val.replace(/\.0$/, '')}s`
  }
  const denom = Math.round(1 / n)
  return `1/${denom}s`
}

// UI visibility (auto-hide on idle)
const showUI = ref<boolean>(true)
let hideUITimer: number | undefined
const cleanMode = ref<boolean>(false)

const showChrome = computed(() => showUI.value && !cleanMode.value)

function pokeUI() {
  showUI.value = true
  if (hideUITimer)
    window.clearTimeout(hideUITimer)
  hideUITimer = window.setTimeout(() => {
    showUI.value = false
  }, 2200)
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

interface DriveFolder {
  id: string
  name: string
  createdTime?: string
  mimeType?: string
  shortcutDetails?: {
    targetId?: string
    targetMimeType?: string
  }
}

async function fetchDriveAlbums(apiKey: string, rootFolderId: string) {
  albumsLoading.value = true
  try {
    rootFolderIdRef.value = rootFolderId
    // Try cache
    const cacheKey = `pg_albums_${rootFolderId}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached)
      albums.value = JSON.parse(cached) as DriveAlbum[]

    const base = 'https://www.googleapis.com/drive/v3/files'
    // Include real folders and shortcuts to folders so albums can be organized via Drive shortcuts
    const q = encodeURIComponent(`'${rootFolderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/vnd.google-apps.shortcut') and trashed=false`)
    const fields = encodeURIComponent('files(id,name,createdTime,mimeType,shortcutDetails(targetId,targetMimeType))')
    const orderBy = encodeURIComponent('name')
    const url = `${base}?q=${q}&fields=${fields}&orderBy=${orderBy}&pageSize=100&key=${apiKey}`
    const res = await fetch(url)
    if (!res.ok)
      throw new Error(`Drive HTTP ${res.status}`)
    const json = (await res.json()) as { files?: DriveFolder[] }
    const seen = new Set<string>()
    const list = (json.files || [])
      // Map shortcuts-to-folder to their target folder ID; ignore non-folder shortcuts
      .map((f) => {
        const isShortcutToFolder
          = f.mimeType === 'application/vnd.google-apps.shortcut'
          && f.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder'
        const albumId = isShortcutToFolder ? (f.shortcutDetails?.targetId || f.id) : f.id
        return {
          id: albumId,
          name: f.name || 'Album',
          createdTime: f.createdTime,
          slug: slugify(f.name || albumId),
        }
      })
      // Filter out invalid/undefined ids and de-duplicate by id (in case multiple shortcuts point to the same folder)
      .filter((a) => {
        if (!a.id)
          return false
        if (seen.has(a.id))
          return false
        seen.add(a.id)
        return true
      })
    // Sort albums by name (A→Z), but push an album named exactly "etc" to the end
    const isEtc = (x: { name?: string, slug: string }) => {
      const nm = (x.name || '').trim().toLowerCase()
      return nm === 'etc' || x.slug === 'etc'
    }
    list.sort((a, b) => {
      const ae = isEtc(a)
      const be = isEtc(b)
      if (ae && be)
        return 0
      if (ae)
        return 1
      if (be)
        return -1
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    })
    albums.value = [{ id: '__ALL__', name: 'All Photos', createdTime: undefined, slug: 'all' }, ...list]
    sessionStorage.setItem(cacheKey, JSON.stringify(albums.value))

    // If deep-link slug present, select it
    if (props.initialAlbumSlug) {
      const match = albums.value.find(a => a.slug === props.initialAlbumSlug)
      if (match)
        selectedAlbumId.value = match.id
    }
  }
  finally {
    albumsLoading.value = false
  }
}

// Zoom/Pan state for lightbox
const scale = ref<number>(1)
const tx = ref<number>(0)
const ty = ref<number>(0)
const isPanning = ref<boolean>(false)
let panStartX = 0
let panStartY = 0
let panStartTx = 0
let panStartTy = 0
const minScale = 1
const maxScale = 4
const zoomStep = 0.25

// Pinch-to-zoom (multi-pointer)
const pointers = new Map<number, { x: number, y: number }>()
const initialPinchDistance = ref<number | null>(null)
const initialPinchScale = ref<number>(1)

function distance(a: { x: number, y: number }, b: { x: number, y: number }) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function resetZoom() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

function toggleClean() {
  cleanMode.value = !cleanMode.value
}

function zoomIn() {
  scale.value = Math.min(maxScale, +(scale.value + zoomStep).toFixed(2))
}

function zoomOut() {
  scale.value = Math.max(minScale, +(scale.value - zoomStep).toFixed(2))
  if (scale.value === 1) {
    tx.value = 0
    ty.value = 0
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.deltaY < 0)
    zoomIn()
  else zoomOut()
}

function onPointerDown(e: PointerEvent) {
  // Track pointer for pinch
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) {
    const [p1, p2] = Array.from(pointers.values())
    initialPinchDistance.value = distance(p1, p2)
    initialPinchScale.value = scale.value
  }
  // Enable panning for single pointer when zoomed
  if (scale.value > 1 && pointers.size === 1) {
    isPanning.value = true
    panStartX = e.clientX
    panStartY = e.clientY
    panStartTx = tx.value
    panStartTy = ty.value
  }
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  // Update tracked pointer position
  if (pointers.has(e.pointerId))
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  // Handle pinch scale when two pointers active
  if (pointers.size >= 2 && initialPinchDistance.value) {
    const [p1, p2] = Array.from(pointers.values())
    const d = distance(p1, p2)
    if (d > 0) {
      const next = initialPinchScale.value * (d / initialPinchDistance.value)
      scale.value = Math.min(maxScale, Math.max(minScale, +next.toFixed(2)))
    }
    return
  }

  // Single-pointer pan
  if (isPanning.value) {
    const dx = e.clientX - panStartX
    const dy = e.clientY - panStartY
    tx.value = panStartTx + dx
    ty.value = panStartTy + dy
  }
}

function onPointerUp(e: PointerEvent) {
  // Remove from pointer tracking
  pointers.delete(e.pointerId)
  if (pointers.size < 2)
    initialPinchDistance.value = null
  // End pan on pointer up
  isPanning.value = false
  ;(e.target as Element).releasePointerCapture?.(e.pointerId)
}

function onDblClick() {
  if (scale.value === 1)
    scale.value = 2
  else resetZoom()
}

// Lightbox image load fallback: if primary src fails, try altSrc via Drive API
const triedAlt = ref<Set<string>>(new Set())
function onLightboxImgError() {
  const idx = selectedIndex.value
  if (idx == null)
    return
  const p = photos.value[idx]
  if (!p)
    return
  debugLog('lightbox image error', { id: p.id, src: p.src, altSrc: (p as any).altSrc })
  if (triedAlt.value.has(p.id)) {
    // Final fallback: open in Drive if available and close lightbox
    const url = (p as any).openUrl as string | undefined
    if (url)
      window.open(url, '_blank', 'noopener,noreferrer')
    closeLightbox()
    return
  }
  if (p.altSrc) {
    triedAlt.value.add(p.id)
    photos.value[idx] = { ...p, src: p.altSrc }
  }
}

function mergeUniquePhotos(existing: Photo[], incoming: Photo[]): Photo[] {
  const byId = new Map<string, Photo>()
  for (const p of existing)
    byId.set(p.id, p)
  for (const p of incoming)
    byId.set(p.id, p)
  const all = Array.from(byId.values())
  all.sort((a, b) => {
    const da = normalizeDateString(a.exif?.createdTime || '')?.getTime() || 0
    const db = normalizeDateString(b.exif?.createdTime || '')?.getTime() || 0
    return db - da
  })
  return all
}

// Append-only merge that preserves current order and filters duplicates
function appendUniquePhotos(existing: Photo[], incoming: Photo[]): Photo[] {
  if (!incoming?.length)
    return existing
  const seen = new Set(existing.map(p => p.id))
  const toAppend: Photo[] = []
  for (const p of incoming) {
    if (!seen.has(p.id)) {
      seen.add(p.id)
      toAppend.push(p)
    }
  }
  if (!toAppend.length)
    return existing
  return existing.concat(toAppend)
}

async function fetchPhotos(opts?: { background?: boolean }) {
  const background = !!opts?.background
  try {
    // Prefer Google Drive provider if configured, otherwise fallback
    const apiKey = import.meta.env.PUBLIC_GOOGLE_API_KEY
    const folderId = import.meta.env.PUBLIC_GOOGLE_DRIVE_FOLDER_ID || '1FU8vQo156hzrPVK71zrwN74V0CiBRY5r'

    if (apiKey && folderId) {
      provider.value = 'drive'
      // Kick off albums fetch immediately (non-blocking)
      const albumsPromise = fetchDriveAlbums(apiKey, folderId).catch(() => {})

      // Default to All Photos view; render first pixels ASAP
      selectedAlbumId.value = '__ALL__'

      // For the root /photography page (no slug), fetch first page from root folder
      // to render quickly while the deeper aggregate crawl starts in the background.
      const doEarlyRoot = !props.initialAlbumSlug
      if (doEarlyRoot) {
        try {
          const { items } = await fetchDrivePhotos(
            apiKey,
            folderId,
            undefined,
            Math.max(batchSize(), 30),
          )
          if (items.length)
            photos.value = items
        }
        catch {}
      }

      // Start aggregated crawl in background and progressively merge results
      ;(async () => {
        try {
          await fetchDriveAllInit(apiKey, folderId, false)
          const fresh = await fetchDriveAllBatch(apiKey, batchSize())
          if (fresh.length)
            photos.value = mergeUniquePhotos(photos.value, fresh)
          driveNextPageToken.value = aggregateHasMore() ? 'more' as any : null
        }
        catch (e) {
          // Preserve existing fallback below if nothing was loaded yet
          if (!photos.value.length)
            error.value = (e as any)?.message || 'Failed to load photos'
        }
      })()

      // Await albums; if deep-link slug requested, load that album explicitly
      await albumsPromise
      if (props.initialAlbumSlug) {
        const match = albums.value.find(a => a.slug === props.initialAlbumSlug)
        if (match) {
          selectedAlbumId.value = match.id
          const cached = albumCache.value[match.id]
          if (cached?.items?.length) {
            photos.value = cached.items
            driveNextPageToken.value = cached.nextPageToken
          }
          else {
            const { items, nextPageToken } = await fetchDrivePhotos(apiKey, match.id, undefined, Math.max(batchSize(), 30))
            photos.value = items
            driveNextPageToken.value = nextPageToken || null
            cacheAlbumUpdate(match.id, items, nextPageToken || null)
          }
        }
      }

      // Do not set an error here; background aggregate/album fetches may still populate.
    }
    else {
      provider.value = 'picsum'
      picsumPage.value = 1
      photos.value = await fetchPicsum(picsumPage.value)
    }
  }
  catch (e: any) {
    error.value = e?.message || 'Failed to load photos'
    // Fallback to Picsum if Drive fetch failed
    if (!photos.value.length) {
      try {
        provider.value = 'picsum'
        picsumPage.value = 1
        photos.value = await fetchPicsum(picsumPage.value)
        error.value = null
      }
      catch {}
    }
  }
  finally {
    if (!background)
      loading.value = photos.value.length === 0
    // After first paint, attempt an auto-load if sentinel is already near viewport
    try {
      await nextTick()
      maybeAutoLoad()
    }
    catch {}
  }
}

async function fetchPicsum(page = 1): Promise<Photo[]> {
  const res = await fetch(`https://picsum.photos/v2/list?limit=30&page=${page}`)
  if (!res.ok)
    throw new Error(`HTTP ${res.status}`)
  const data: PicsumPhoto[] = await res.json()
  return data.map((p) => {
    // Compute sizes to preserve original aspect ratio for masonry
    const thumbW = 400
    const thumbH = Math.max(1, Math.round((thumbW * p.height) / p.width))
    const fullW = 1600
    const fullH = Math.max(1, Math.round((fullW * p.height) / p.width))
    const lqW = 24
    const lqH = Math.max(1, Math.round((lqW * p.height) / p.width))
    return {
      id: p.id,
      title: p.author || `Picsum #${p.id}`,
      width: p.width,
      height: p.height,
      lqip: `https://picsum.photos/id/${p.id}/${lqW}/${lqH}`,
      thumb: `https://picsum.photos/id/${p.id}/${thumbW}/${thumbH}`,
      src: `https://picsum.photos/id/${p.id}/${fullW}/${fullH}`,
    }
  })
}

interface DriveFile {
  id: string
  name?: string
  description?: string
  createdTime?: string
  thumbnailLink?: string
  mimeType?: string
  webViewLink?: string
  webContentLink?: string
  imageMediaMetadata?: {
    width?: number
    height?: number
    time?: string
    cameraMake?: string
    cameraModel?: string
    exposureTime?: string
    aperture?: number
    focalLength?: number
    isoSpeed?: number
  }
}

function sizeVariant(url: string, size: number): string {
  if (!url)
    return url
  // Replace only the numeric part after '=s' and preserve all other params
  // Example: ...=s220?resourcekey=abc -> ...=s1600?resourcekey=abc
  if (/=s\d+/.test(url))
    return url.replace(/=s\d+/, `=s${size}`)
  return url
}

function extractResourceKey(...urls: Array<string | undefined>): string | undefined {
  for (const u of urls) {
    if (!u)
      continue
    try {
      const parsed = new URL(u)
      const rk = parsed.searchParams.get('resourceKey') || parsed.searchParams.get('resourcekey')
      if (rk)
        return rk
    }
    catch {}
  }
  return undefined
}

/* eslint-disable no-console */
function debugLog(...args: any[]) {
  if (debug.value)
    console.debug('[photography]', ...args)
}
/* eslint-enable no-console */

async function fetchDrivePhotos(apiKey: string, folderId: string, pageToken?: string, pageSize = 50): Promise<{ items: Photo[], nextPageToken?: string }> {
  const base = 'https://www.googleapis.com/drive/v3/files'
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`)
  const fields = encodeURIComponent('nextPageToken,files(id,name,description,createdTime,thumbnailLink,mimeType,webViewLink,webContentLink,imageMediaMetadata)')
  const orderBy = encodeURIComponent('createdTime desc')
  const size = Math.max(1, Math.min(50, Math.floor(pageSize)))
  const url = `${base}?q=${q}&fields=${fields}&orderBy=${orderBy}&pageSize=${size}${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Drive HTTP ${res.status}`)
  const json = (await res.json()) as { files?: DriveFile[], nextPageToken?: string }
  const files = json.files || []

  const supported = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  const items = files.map((f) => {
    // Build URLs: use googleusercontent thumbnail as a reliable image host
    const hasThumb = !!f.thumbnailLink
    const isSupported = f.mimeType ? supported.has(f.mimeType) : true
    const thumb = hasThumb
      ? sizeVariant(f.thumbnailLink!, 600)
      : (isSupported ? `https://drive.google.com/uc?export=download&id=${f.id}` : '')
    const src = hasThumb
      ? sizeVariant(f.thumbnailLink!, 1600)
      : (isSupported ? `https://drive.google.com/uc?export=download&id=${f.id}` : '')
    const lqip = hasThumb ? sizeVariant(f.thumbnailLink!, 24) : undefined

    const width = f.imageMediaMetadata?.width || 1600
    const height = f.imageMediaMetadata?.height || 1200
    const exif: ExifMeta = {
      cameraMake: f.imageMediaMetadata?.cameraMake,
      cameraModel: f.imageMediaMetadata?.cameraModel,
      focalLength: f.imageMediaMetadata?.focalLength,
      aperture: f.imageMediaMetadata?.aperture,
      iso: f.imageMediaMetadata?.isoSpeed,
      exposureTime: f.imageMediaMetadata?.exposureTime,
      createdTime: f.imageMediaMetadata?.time || f.createdTime,
    }
    const baseTitle = f.description?.trim() || f.name || 'Photo'
    const title = baseTitle.replace(/\.[^/.]+$/, '')
    const rk = extractResourceKey(f.webViewLink, f.thumbnailLink)
    const photo = {
      id: f.id,
      title,
      src,
      thumb,
      lqip,
      width,
      height,
      exif,
      altSrc: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${apiKey}${rk ? `&resourceKey=${encodeURIComponent(rk)}` : ''}`,
      openUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    } as Photo & { unsupported?: boolean, openUrl?: string }

    if (!hasThumb && !isSupported) {
      photo.unsupported = true
      photo.openUrl = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`
    }
    if (debug.value && (!debugPhotoOnlyId.value || debugPhotoOnlyId.value === f.id)) {
      debugLog('drive file normalized', {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        hasThumb,
        isSupported,
        createdTime: f.createdTime,
        thumbBuilt: photo.thumb,
        srcBuilt: photo.src,
        altSrc: photo.altSrc,
        webViewLink: f.webViewLink,
        thumbnailLink: f.thumbnailLink,
        resourceKey: rk,
      })
    }
    return photo
  })
  return { items, nextPageToken: json.nextPageToken }
}

// List direct child folders and folder shortcuts under a parent
async function fetchDriveChildFolders(apiKey: string, parentId: string, pageToken?: string): Promise<{ folders: DriveFolder[], nextPageToken?: string }> {
  const base = 'https://www.googleapis.com/drive/v3/files'
  const q = encodeURIComponent(`'${parentId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/vnd.google-apps.shortcut') and trashed=false`)
  const fields = encodeURIComponent('nextPageToken,files(id,name,createdTime,mimeType,shortcutDetails(targetId,targetMimeType))')
  const url = `${base}?q=${q}&fields=${fields}&orderBy=createdTime desc&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Drive HTTP ${res.status}`)
  const json = (await res.json()) as { files?: DriveFolder[], nextPageToken?: string }
  return { folders: json.files || [], nextPageToken: json.nextPageToken }
}

// Recursively gather all folder IDs including root, following folder shortcuts
async function listAllFolderIds(apiKey: string, rootId: string): Promise<string[]> {
  // Try cached tree first (session)
  const cacheKey = `pg_tree_${rootId}`
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      const list = JSON.parse(cached) as string[]
      if (Array.isArray(list) && list.length)
        return list
    }
  }
  catch {}
  const result: string[] = []
  const queue: string[] = [rootId]
  const visited = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id))
      continue
    visited.add(id)
    result.push(id)
    let token: string | undefined
    do {
      const { folders, nextPageToken } = await fetchDriveChildFolders(apiKey, id, token)
      token = nextPageToken
      for (const f of folders) {
        const isShortcutToFolder = f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder'
        const nextId = isShortcutToFolder ? (f.shortcutDetails?.targetId || f.id) : f.id
        if (nextId && !visited.has(nextId))
          queue.push(nextId)
      }
    } while (token)
  }
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(result))
  }
  catch {}
  return result
}

// Initialize aggregated fetch for "All Photos"
async function fetchDriveAllInit(apiKey: string, rootId: string, populate: boolean = true) {
  // Build folder list and reset aggregate state
  const folderIds = await listAllFolderIds(apiKey, rootId)
  aggregateState.value = {
    folderIds,
    tokens: Object.fromEntries(folderIds.map(id => [id, null])),
    exhausted: new Set<string>(),
  }
  if (populate) {
    // Load initial batch
    const items = await fetchDriveAllBatch(apiKey, batchSize())
    photos.value = items
  }
  // Determine if there is more to load
  driveNextPageToken.value = aggregateHasMore() ? 'more' as any : null
}

// Load next chunk across folders; aim for at least `target` items
async function fetchDriveAllBatch(apiKey: string, target = batchSize()): Promise<Photo[]> {
  if (!aggregateState.value)
    return []
  const { folderIds, tokens, exhausted } = aggregateState.value
  const batch: Photo[] = []
  // Limited-concurrency round-robin across folders
  let cursor = 0
  while (batch.length < target) {
    const candidates: string[] = []
    let scanned = 0
    while (candidates.length < AGG_CONCURRENCY && scanned < folderIds.length) {
      const idx = (cursor + scanned) % folderIds.length
      const fid = folderIds[idx]
      if (!exhausted.has(fid))
        candidates.push(fid)
      scanned += 1
    }
    if (!candidates.length)
      break
    const results = await Promise.all(
      candidates.map(fid => fetchDrivePhotos(apiKey, fid, tokens[fid] || undefined, perFolderPage())),
    )
    results.forEach((res, i) => {
      const fid = candidates[i]
      if (res.items.length)
        batch.push(...res.items)
      // update per-album cache for fast switches later
      cacheAlbumUpdate(fid, res.items, res.nextPageToken || null)
      tokens[fid] = res.nextPageToken || null
      if (!res.nextPageToken)
        exhausted.add(fid)
    })
    cursor = (cursor + candidates.length) % folderIds.length
  }
  // Global sort by created time desc if available
  batch.sort((a, b) => {
    const da = normalizeDateString(a.exif?.createdTime || '')?.getTime() || 0
    const db = normalizeDateString(b.exif?.createdTime || '')?.getTime() || 0
    return db - da
  })
  return batch
}

function aggregateHasMore(): boolean {
  if (!aggregateState.value)
    return false
  const { folderIds, exhausted } = aggregateState.value
  return exhausted.size < folderIds.length
}

async function fetchDriveAllMore(apiKey: string): Promise<Photo[]> {
  if (!aggregateState.value)
    return []
  const more = await fetchDriveAllBatch(apiKey, batchSize())
  // After loading, decide if more is available
  driveNextPageToken.value = aggregateHasMore() ? 'more' as any : null
  return more
}

function openLightbox(index: number) {
  selectedIndex.value = index
  lightboxLoaded.value = false
  document.documentElement.style.overflow = 'hidden'
  document.documentElement.classList.add('lb-open')
  resetZoom()
  pokeUI()
}

function closeLightbox() {
  selectedIndex.value = null
  document.documentElement.style.overflow = ''
  document.documentElement.classList.remove('lb-open')
}

function showPrev() {
  if (!photos.value.length || selectedIndex.value == null)
    return
  selectedIndex.value = (selectedIndex.value - 1 + photos.value.length) % photos.value.length
  lightboxLoaded.value = false
}

function showNext() {
  if (!photos.value.length || selectedIndex.value == null)
    return
  selectedIndex.value = (selectedIndex.value + 1) % photos.value.length
  lightboxLoaded.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (selectedIndex.value == null)
    return
  if (e.key === 'Escape')
    closeLightbox()
  if (e.key === 'ArrowLeft')
    showPrev()
  if (e.key === 'ArrowRight')
    showNext()
  if (e.key === '+' || e.key === '=')
    zoomIn()
  if (e.key === '-' || e.key === '_')
    zoomOut()
}

onMounted(() => {
  // Enable debug mode if ?debug=1; optionally restrict to a photo id via ?debugId=
  try {
    const params = new URLSearchParams(location.search)
    debug.value = params.get('debug') === '1'
    debugPhotoOnlyId.value = params.get('debugId') || null
  }
  catch {}
  const restored = restoreState()
  // Always refresh; if we restored, do it in background to avoid flicker
  fetchPhotos({ background: restored })
  if (restored)
    loading.value = false
  if (restored) {
    restoredOnce.value = true
    window.setTimeout(() => {
      restoredOnce.value = false
    }, 400)
  }
  window.addEventListener('keydown', onKeydown)
  // Setup IntersectionObserver for auto-loading next batch
  try {
    io = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry?.isIntersecting)
        return
      if (loadingMore.value || loading.value)
        return
      if (hasMoreAvailable())
        loadMore()
    }, { root: null, rootMargin: '400px', threshold: 0.01 })
    nextTick(() => {
      if (loadMoreSentinel.value)
        io?.observe(loadMoreSentinel.value)
      // Also perform a manual check in case the sentinel is already visible
      maybeAutoLoad()
    })
  }
  catch {}
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  saveState()
  try {
    io?.disconnect()
    io = null
  }
  catch {}
})

watch([photos, selectedAlbumId], () => {
  // Clear any stale error once photos exist and persist state
  if (photos.value.length > 0) {
    error.value = null
    loading.value = false
  }
  saveState()
})

// Load more handler (mobile button)
async function loadMore() {
  if (loading.value || loadingMore.value)
    return
  loadingMore.value = true
  try {
    if (provider.value === 'drive') {
      const apiKey = import.meta.env.PUBLIC_GOOGLE_API_KEY
      if (!apiKey)
        return
      const activeId = selectedAlbumId.value || '__ALL__'
      if (activeId === '__ALL__') {
        // If state was restored without aggregate metadata, initialize it without repopulating photos
        if (!aggregateState.value) {
          const folderId = rootFolderIdRef.value || import.meta.env.PUBLIC_GOOGLE_DRIVE_FOLDER_ID!
          await fetchDriveAllInit(apiKey, folderId, false)
        }
        const more = await fetchDriveAllMore(apiKey)
        if (more.length)
          photos.value = appendUniquePhotos(photos.value, more)
      }
      else {
        const { items, nextPageToken } = await fetchDrivePhotos(apiKey, activeId, driveNextPageToken.value || undefined, Math.max(batchSize(), 30))
        if (items.length)
          photos.value = appendUniquePhotos(photos.value, items)
        driveNextPageToken.value = nextPageToken || null
        cacheAlbumUpdate(activeId, items, nextPageToken || null)
      }
    }
    else {
      picsumPage.value += 1
      const more = await fetchPicsum(picsumPage.value)
      if (more.length)
        photos.value = appendUniquePhotos(photos.value, more)
    }
  }
  finally {
    loadingMore.value = false
    saveState()
    // Ensure sentinel is (re)observed after DOM updates
    try {
      await nextTick()
      if (loadMoreSentinel.value) {
        io?.unobserve(loadMoreSentinel.value)
        io?.observe(loadMoreSentinel.value)
      }
    }
    catch {}
  }
}

// Change album handler
async function changeAlbum(id: string) {
  if (selectedAlbumId.value === id)
    return
  selectedAlbumId.value = id
  // Reset gallery state for new album
  photos.value = []
  // Reset loaded state for animations
  loadedThumbs.value = new Set()
  driveNextPageToken.value = null
  aggregateState.value = null
  loading.value = true
  try {
    const apiKey = import.meta.env.PUBLIC_GOOGLE_API_KEY
    if (apiKey) {
      if (id === '__ALL__') {
        const folderId = rootFolderIdRef.value || import.meta.env.PUBLIC_GOOGLE_DRIVE_FOLDER_ID!
        await fetchDriveAllInit(apiKey, folderId)
      }
      else {
        const cached = albumCache.value[id]
        if (cached?.items?.length) {
          photos.value = cached.items
          driveNextPageToken.value = cached.nextPageToken
        }
        else {
          const { items, nextPageToken } = await fetchDrivePhotos(apiKey, id, undefined, Math.max(batchSize(), 30))
          photos.value = items
          driveNextPageToken.value = nextPageToken || null
          cacheAlbumUpdate(id, items, nextPageToken || null)
        }
      }
    }
  }
  finally {
    // Keep skeleton visible until first photos are present
    loading.value = photos.value.length === 0
    await nextTick()
    window.scrollTo({ top: 0 })
    saveState()
  }
}

// Persist and restore state for back navigation
interface PersistState {
  provider: 'drive' | 'picsum'
  photos: Photo[]
  driveNextPageToken: string | null
  picsumPage: number
  selectedAlbumId: string | null
  scrollY: number
}

function stateKey() {
  return `pg_state_${location.pathname}`
}

function saveState() {
  try {
    const s: PersistState = {
      provider: provider.value,
      photos: photos.value,
      driveNextPageToken: driveNextPageToken.value,
      picsumPage: picsumPage.value,
      selectedAlbumId: selectedAlbumId.value,
      scrollY: window.scrollY,
    }
    sessionStorage.setItem(stateKey(), JSON.stringify(s))
  }
  catch {}
}

function restoreState(): boolean {
  try {
    const raw = sessionStorage.getItem(stateKey())
    if (!raw)
      return false
    const s = JSON.parse(raw) as PersistState
    provider.value = s.provider
    photos.value = s.photos || []
    driveNextPageToken.value = s.driveNextPageToken
    picsumPage.value = s.picsumPage
    selectedAlbumId.value = s.selectedAlbumId
    nextTick(() => {
      window.scrollTo({ top: s.scrollY || 0 })
    })
    return photos.value.length > 0
  }
  catch {
    return false
  }
}
</script>

<template>
  <section>
    <div class="mb-6">
      <h1 class="text-title">
        Photography
      </h1>
      <p class="text-main opacity-80 mt-2">
        Light, places, and the quiet moments in between.
      </p>
    </div>

    <!-- Sticky album filter bar (Drive only) -->
    <div v-if="provider === 'drive' && albums.length" class="filter-bar mb-3">
      <div class="filter-inner">
        <button
          v-for="al in albums"
          :key="al.id"
          class="px-3 py-1 rounded-full border border-main text-sm whitespace-nowrap mr-2"
          :class="selectedAlbumId === al.id ? 'bg-black/10 dark:bg-white/10' : 'opacity-80 hover:opacity-100'"
          :aria-pressed="selectedAlbumId === al.id"
          :aria-label="`Show album ${al.name}`"
          @click="changeAlbum(al.id)"
        >
          {{ al.name }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="masonry">
      <div v-for="n in Math.max(batchSize(), 6)" :key="`skel-first-${n}`" class="masonry-item w-full">
        <div class="rounded-lg skel aspect-[4/3]" aria-hidden="true" />
      </div>
    </div>
    <!-- Subtle status line while preparing first photos (Drive) -->
    <div v-if="loading && provider === 'drive'" class="text-center text-main opacity-70 mt-2 text-sm" role="status" aria-live="polite">
      <span class="inline-flex items-center gap-2">
        <span class="dot dot-1" aria-hidden="true" />
        <span class="dot dot-2" aria-hidden="true" />
        <span class="dot dot-3" aria-hidden="true" />
        Preparing photos…
      </span>
    </div>
    <div v-else-if="error" class="py-16 text-center text-red-6">
      {{ error }}
    </div>

    <div v-else class="masonry" :class="{ 'restore-fade': restoredOnce }">
      <template v-for="(p, i) in photos" :key="p.id">
        <button
          v-if="!p.unsupported"
          class="masonry-item group relative w-full rounded-lg bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-teal-5 hover:shadow-md transition-shadow"
          aria-label="Open photo in lightbox"
          @click="openLightbox(i)"
        >
          <div class="tile rounded-lg overflow-hidden" :style="{ aspectRatio: `${p.width} / ${p.height}` }">
            <!-- Per-tile skeleton overlay until image loads -->
            <div
              v-if="!loadedThumbs.has(p.id)"
              class="absolute inset-0 rounded-lg skel"
              aria-hidden="true"
            />
            <img v-if="p.lqip" :src="p.lqip" class="lqip" aria-hidden="true" :class="loadedThumbs.has(p.id) ? 'lqip-off' : ''">
            <img
              :src="p.thumb"
              :alt="`Photo: ${p.title}`"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102 thumb-fade"
              :loading="i < 2 ? 'eager' : 'lazy'"
              :fetchpriority="i < 2 ? 'high' : 'auto'"
              decoding="async"
              referrerpolicy="no-referrer"
              :width="p.width"
              :height="p.height"
              :class="loadedThumbs.has(p.id) ? 'thumb-on' : 'thumb-off'"
              :style="{ transitionDelay: `${Math.min(i, 10) * 25}ms` }"
              @load="onThumbLoad(p.id)"
              @error="onThumbError(p.id)"
            >
          </div>
        </button>
        <a
          v-else
          class="masonry-item group relative w-full rounded-lg bg-black/5 dark:bg-white/5 hover:shadow-md transition-shadow block no-underline"
          :href="p.openUrl"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open photo in Google Drive"
        >
          <div class="tile rounded-lg overflow-hidden" :style="{ aspectRatio: `${Math.max(p.width || 4, 1)} / ${Math.max(p.height || 3, 1)}` }">
            <div
              v-if="!loadedThumbs.has(p.id)"
              class="absolute inset-0 rounded-lg skel"
              aria-hidden="true"
            />
          </div>
          <div class="w-full flex items-center justify-center text-center p-6 text-main">
            <div>
              <div class="i-ri-image-2-line text-3xl opacity-70 mb-2" />
              <div class="text-sm font-600 mb-1">{{ p.title }}</div>
              <div class="text-xs opacity-70">Unsupported format · Open in Drive</div>
            </div>
          </div>
        </a>
      </template>
      <!-- Skeleton placeholders while loading next batch -->
      <template v-if="loadingMore">
        <div v-for="n in batchSize()" :key="`skel-${n}`" class="masonry-item w-full">
          <div class="rounded-lg skel aspect-[4/3]" aria-hidden="true" />
        </div>
      </template>

      <!-- Auto-load sentinel -->
      <div ref="loadMoreSentinel" class="masonry-item w-full h-8" aria-hidden="true" />

      <!-- Load more button (all devices) -->
      <div class="masonry-item w-full text-center py-6 opacity-80">
        <button
          v-if="(provider === 'drive' && driveNextPageToken) || provider === 'picsum'"
          class="px-4 py-2 rounded border border-main hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Load more photos"
          :disabled="loadingMore"
          @click="loadMore"
        >
          <span v-if="loadingMore">Loading…</span>
          <span v-else>Load more</span>
        </button>
      </div>
    </div>

    <!-- Lightbox -->
    <div
      v-if="selectedPhoto"
      class="fixed inset-0 z-999 bg-black/90 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Photo lightbox"
      @click="closeLightbox"
      @mousemove="pokeUI"
      @touchstart="pokeUI"
    >
      <div class="relative max-w-6xl w-full mx-auto" @click.stop>
        <div
          class="viewer relative overflow-hidden flex items-center justify-center rounded-md shadow-lg bg-black/20"
          style="max-height: 85vh; max-width: 96vw; margin: 0 auto; touch-action: none;"
          @wheel.passive="false"
          @wheel="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @dblclick="onDblClick"
        >
          <!-- Blurred placeholder overlay until main image loads -->
          <div class="lb-layer" :class="lightboxLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'">
            <img
              v-if="selectedPhoto.lqip || selectedPhoto.thumb"
              :src="selectedPhoto.lqip || selectedPhoto.thumb"
              alt=""
              class="lb-lqip"
              aria-hidden="true"
              draggable="false"
              referrerpolicy="no-referrer"
            >
          </div>
          <img
            :key="selectedPhoto.id"
            :src="selectedPhoto.src"
            :alt="`Photo: ${selectedPhoto.title}`"
            class="select-none lb-img"
            :class="[isPanning ? 'transition-none cursor-grabbing' : 'transition-transform duration-75 cursor-grab', lightboxLoaded ? 'opacity-100' : 'opacity-0']"
            :style="{
              'transform': `translate(${tx}px, ${ty}px) scale(${scale})`,
              'transform-origin': 'center center',
              'max-height': '85vh',
              'max-width': '96vw',
              'object-fit': 'contain',
            }"
            draggable="false"
            referrerpolicy="no-referrer"
            fetchpriority="high"
            decoding="async"
            @load="lightboxLoaded = true"
            @error="onLightboxImgError"
          >
        </div>
        <!-- Top bar: controls and close -->
        <div
          class="absolute top-2 left-2 right-2 flex justify-between items-center"
          :class="showChrome ? 'opacity-100' : 'opacity-0 pointer-events-none'"
          style="transition: opacity .2s ease;"
        >
          <div class="flex gap-2">
            <button aria-label="Zoom out" class="ctrl" @click="zoomOut">
              <span class="i-ri-zoom-out-line text-lg md:text-xl" />
            </button>
            <button aria-label="Reset zoom" class="ctrl text-xs md:text-base" @click="resetZoom">
              1:1
            </button>
            <button aria-label="Zoom in" class="ctrl" @click="zoomIn">
              <span class="i-ri-zoom-in-line text-lg md:text-xl" />
            </button>
            <button aria-label="Enter clear display" class="ctrl" @click="toggleClean">
              <span class="i-ri-fullscreen-fill text-lg md:text-xl" />
            </button>
          </div>
          <button aria-label="Close" class="ctrl" @click="closeLightbox">
            <span class="i-ri-close-line text-2xl" />
          </button>
        </div>

        <!-- Exit clear display: always visible in clean mode -->
        <button
          v-if="cleanMode"
          aria-label="Exit clear display"
          class="ctrl absolute top-2 right-2 z-1001"
          @click="toggleClean"
        >
          <span class="i-ri-fullscreen-exit-fill text-lg md:text-xl" />
        </button>

        <!-- Side arrows -->
        <button
          aria-label="Previous photo"
          class="side-nav left-2"
          :class="cleanMode ? 'opacity-40' : (showUI ? 'opacity-100' : 'opacity-0 pointer-events-none')"
          @click="showPrev"
        >
          <span class="i-ri-arrow-left-s-line text-2xl" />
        </button>
        <button
          aria-label="Next photo"
          class="side-nav right-2"
          :class="cleanMode ? 'opacity-40' : (showUI ? 'opacity-100' : 'opacity-0 pointer-events-none')"
          @click="showNext"
        >
          <span class="i-ri-arrow-right-s-line text-2xl" />
        </button>

        <!-- Bottom caption with EXIF chips -->
        <div
          class="caption"
          :class="showChrome ? 'opacity-100' : 'opacity-0 pointer-events-none'"
        >
          <div class="caption-inner">
            <div class="caption-top">
              <div class="caption-title truncate">
                {{ selectedPhoto.title }}
              </div>
              <div v-if="formattedDate" class="caption-date">
                {{ formattedDate }}
              </div>
            </div>
            <div v-if="selectedPhoto.exif" class="caption-chips md:flex hidden">
              <span v-if="selectedPhoto.exif.cameraMake || selectedPhoto.exif.cameraModel" class="chip">
                <span class="i-ri-camera-2-line mr-1" />{{ selectedPhoto.exif.cameraMake }} {{ selectedPhoto.exif.cameraModel }}
              </span>
              <span v-if="selectedPhoto.exif.focalLength" class="chip">
                <span class="i-ri-focus-2-line mr-1" />{{ selectedPhoto.exif.focalLength }}mm
              </span>
              <span v-if="selectedPhoto.exif.aperture" class="chip">
                <span class="i-ri-blur-off-line mr-1" />f/{{ selectedPhoto.exif.aperture }}
              </span>
              <span v-if="selectedPhoto.exif.exposureTime" class="chip">
                <span class="i-ri-timer-line mr-1" />{{ formatExposure(selectedPhoto.exif.exposureTime) }}
              </span>
              <span v-if="selectedPhoto.exif.iso" class="chip">
                <span class="i-ri-sun-line mr-1" />ISO {{ selectedPhoto.exif.iso }}
              </span>
              <span v-if="formattedDate" class="chip">
                <span class="i-ri-calendar-line mr-1" />{{ formattedDate }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug panel -->
    <div v-if="debug" class="fixed bottom-2 left-2 z-1000 text-xs p-2 rounded bg-black/70 text-white max-w-80 whitespace-pre-wrap" aria-hidden="true">
      <div>debug: on</div>
      <div>provider: {{ provider }}</div>
      <div>album: {{ selectedAlbumId }}</div>
      <div>photos: {{ photos.length }} | next: {{ driveNextPageToken }}</div>
      <div v-if="selectedPhoto">
        sel: {{ selectedPhoto.id }}
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Masonry layout using CSS columns */
.masonry {
  column-gap: 1rem; /* base gap */
  columns: 1;
}

@media (min-width: 480px) {
  .masonry {
    columns: 2;
  }
}

@media (min-width: 768px) {
  .masonry {
    columns: 2;
    column-gap: 1.25rem; /* md: gap-5 */
  }
}

@media (min-width: 1024px) {
  .masonry {
    columns: 2;
  }
}

@media (min-width: 1280px) {
  .masonry {
    columns: 3;
  }
}

.masonry-item {
  break-inside: avoid;
  display: inline-block;
  width: 100%;
  margin-bottom: 1rem; /* sync with base gap */
}

/* Gentle fade-in for thumbnails */
.thumb-fade {
  will-change: opacity, transform, filter;
  transition:
    opacity 320ms ease,
    transform 320ms ease,
    filter 420ms ease;
}
.thumb-off {
  opacity: 0;
  transform: translateY(4px);
  filter: blur(2px);
}
.thumb-on {
  opacity: 1;
  transform: translateY(0);
  filter: none;
}

/* LQIP placeholder */
.lqip {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(10px);
  transform: scale(1.02);
  opacity: 0.6;
  transition: opacity 300ms ease;
}
.thumb-on ~ .lqip,
.tile .lqip.lqip-off {
  opacity: 0;
}

/* Short fade on restore */
@keyframes fadeInShort {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.restore-fade {
  animation: fadeInShort 0.25s ease both;
}

.ctrl {
  /* prettier-ignore */
  --at-apply: px-2 py-1 md:px-3 md:py-2 rounded bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/15;
}

.side-nav {
  /* prettier-ignore */
  --at-apply: absolute top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/15;
}

.caption {
  --at-apply: absolute left-0 right-0 bottom-0 text-white transition-opacity;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0));
}

.tile {
  position: relative;
  width: 100%;
}

/* Lightbox layers */
.lb-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 220ms ease;
}
.lb-lqip {
  max-height: 85vh;
  max-width: 96vw;
  object-fit: contain;
  filter: blur(14px);
  transform: scale(1.02);
  opacity: 0.75;
}
.lb-img {
  transition: opacity 220ms ease;
}

.caption-inner {
  /* prettier-ignore */
  --at-apply: max-w-6xl mx-auto w-full px-3 py-2 md:px-4 md:py-3;
}

.caption-top {
  --at-apply: flex items-center justify-between gap-2;
}

.caption-title {
  /* prettier-ignore */
  --at-apply: text-xs md:text-base font-600 drop-shadow;
}

.caption-date {
  --at-apply: text-xs opacity-90;
}

.caption-chips {
  --at-apply: mt-2 flex flex-wrap gap-2 opacity-95;
}

.chip {
  /* prettier-ignore */
  --at-apply: text-2xs md:text-sm px-2 py-0.5 md:py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15;
}

/* Skeleton shimmer for loading placeholders */
.skel {
  position: relative;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.06);
}
:where(.dark) .skel {
  background: rgba(255, 255, 255, 0.06);
}
.skel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0),
    rgba(255, 255, 255, 0.35),
    rgba(255, 255, 255, 0)
  );
  transform: translateX(-100%);
  animation: skel-shimmer 1.2s ease-in-out infinite;
}

@keyframes skel-shimmer {
  100% {
    transform: translateX(100%);
  }
}

/* Subtle dots loader for Drive prepare state */
.dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: currentColor;
  opacity: 0.35;
  animation: dotPulse 1.2s ease-in-out infinite;
}
.dot-1 {
  animation-delay: 0ms;
}
.dot-2 {
  animation-delay: 120ms;
}
.dot-3 {
  animation-delay: 240ms;
}

@keyframes dotPulse {
  0%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  50% {
    opacity: 0.85;
    transform: translateY(-2px);
  }
}
</style>

<style>
/* Filter bar (non-sticky, no background) */
.filter-bar {
}
.filter-bar .filter-inner {
  max-width: 72rem; /* ~max-w-6xl */
  margin: 0 auto;
  width: 100%;
  padding: 0.25rem 0.75rem;
  display: flex;
  overflow-x: auto;
}
/* No background or blur to keep it simple and consistent */

/* Global override: make header nav links white while lightbox is open (desktop only) */
@media (min-width: 768px) {
  html.lb-open #header a[nav-link] {
    color: #fff !important;
    opacity: 1 !important;
  }
}
</style>
