// scripts/gen-photo-manifest.js
// Build-time snapshot of the public Google Drive photography library.
// Writes src/data/photography-manifest.json, consumed by the Vue gallery for
// instant first paint (no client-side Drive API round trip before the first
// thumbnails render). Regenerated on every `npm run build`.
//
// On failure (no creds, no network, API error) it writes an EMPTY manifest and
// exits 0 so the build still succeeds; the gallery then falls back to its
// live client-side fetch (pre-change behavior).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outFile = path.join(rootDir, 'src', 'data', 'photography-manifest.json')
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files'
const FETCH_TIMEOUT_MS = 15000
// How many photos to snapshot for the "All Photos" aggregate view.
const MANIFEST_BATCH = (() => {
  const n = Number(process.env.PUBLIC_PHOTO_MANIFEST_BATCH)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100) : 24
})()
// First page size fetched per album folder (album-switch instant preview).
const PER_FOLDER = 12
const CONCURRENCY = 3

// --- tiny .env loader (node --env-file is not used by npm run build) ---
async function loadEnv() {
  try {
    const raw = await readFile(path.join(rootDir, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const eq = line.indexOf('=')
      if (eq <= 0)
        continue
      const key = line.slice(0, eq).trim()
      if (/^[A-Z_]\w*$/i.test(key) && !(key in process.env))
        process.env[key] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  catch { /* no .env: rely on ambient env */ }
}

// --- shared helpers (mirror photo-gallery.vue exactly) ---
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function sizeVariant(url, size) {
  if (!url)
    return url
  if (/=s\d+/.test(url))
    return url.replace(/=s\d+/, `=s${size}`)
  return url
}

function extractResourceKey(...urls) {
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

function normalizeDateString(s) {
  if (!s)
    return null
  if (/^\d{4}:\d{2}:\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s)) {
    const iso = `${s.replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T')}Z`
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// --- Drive API helpers ---
async function driveGet(url, apiKey) {
  const sep = url.includes('?') ? '&' : '?'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${url}${sep}key=${encodeURIComponent(apiKey)}`, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
    })
    if (!res.ok)
      throw new Error(`Drive HTTP ${res.status}`)
    return await res.json()
  }
  finally {
    clearTimeout(timer)
  }
}

// Albums: direct child folders + folder shortcuts under root (mirrors fetchDriveAlbums)
async function fetchAlbums(apiKey, rootFolderId) {
  const q = encodeURIComponent(`'${rootFolderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/vnd.google-apps.shortcut') and trashed=false`)
  const fields = encodeURIComponent('files(id,name,createdTime,mimeType,shortcutDetails(targetId,targetMimeType))')
  const url = `${DRIVE_BASE}?q=${q}&fields=${fields}&orderBy=${encodeURIComponent('name')}&pageSize=100`
  const json = await driveGet(url, apiKey)
  const seen = new Set()
  const list = (json.files || [])
    .map((f) => {
      const isShortcutToFolder = f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder'
      const albumId = isShortcutToFolder ? (f.shortcutDetails?.targetId || f.id) : f.id
      return { id: albumId, name: f.name || 'Album', createdTime: f.createdTime, slug: slugify(f.name || albumId) }
    })
    .filter((a) => {
      if (!a.id || seen.has(a.id))
        return false
      seen.add(a.id)
      return true
    })
  const isEtc = x => (x.name || '').trim().toLowerCase() === 'etc' || x.slug === 'etc'
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
  return [{ id: '__ALL__', name: 'All Photos', createdTime: undefined, slug: 'all' }, ...list]
}

// Child folders of a folder (mirrors fetchDriveChildFolders)
async function fetchChildFolders(apiKey, parentId, pageToken) {
  const q = encodeURIComponent(`'${parentId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/vnd.google-apps.shortcut') and trashed=false`)
  const fields = encodeURIComponent('nextPageToken,files(id,name,createdTime,mimeType,shortcutDetails(targetId,targetMimeType))')
  const url = `${DRIVE_BASE}?q=${q}&fields=${fields}&orderBy=${encodeURIComponent('createdTime desc')}&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`
  const json = await driveGet(url, apiKey)
  return { folders: json.files || [], nextPageToken: json.nextPageToken }
}

// All folder ids under root incl. root, following folder shortcuts (mirrors listAllFolderIds)
async function listAllFolderIds(apiKey, rootId) {
  const queue = [rootId]
  const visited = new Set()
  const result = []
  while (queue.length) {
    const id = queue.shift()
    if (visited.has(id))
      continue
    visited.add(id)
    result.push(id)
    let token
    do {
      const { folders, nextPageToken } = await fetchChildFolders(apiKey, id, token)
      token = nextPageToken
      for (const f of folders) {
        const isShortcutToFolder = f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder'
        const nextId = isShortcutToFolder ? (f.shortcutDetails?.targetId || f.id) : f.id
        if (nextId && !visited.has(nextId))
          queue.push(nextId)
      }
    } while (token)
  }
  return result
}

// First page of images in a folder, normalized to the gallery's Photo shape.
// Kept slim: src/altSrc are derived at runtime (sizeVariant on thumb); full
// EXIF is included so lightbox chips work on the very first click.
async function fetchFolderPhotos(apiKey, folderId, pageSize = PER_FOLDER) {
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`)
  const fields = encodeURIComponent('files(id,name,description,createdTime,thumbnailLink,mimeType,webViewLink,imageMediaMetadata)')
  const url = `${DRIVE_BASE}?q=${q}&fields=${fields}&orderBy=${encodeURIComponent('createdTime desc')}&pageSize=${Math.max(1, Math.min(50, Math.floor(pageSize)))}`
  const json = await driveGet(url, apiKey)
  const supported = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  return (json.files || []).map((f) => {
    const hasThumb = !!f.thumbnailLink
    const isSupported = f.mimeType ? supported.has(f.mimeType) : true
    const thumb = hasThumb
      ? sizeVariant(f.thumbnailLink, 600)
      : (isSupported ? `https://drive.google.com/uc?export=download&id=${f.id}` : '')
    const lqip = hasThumb ? sizeVariant(f.thumbnailLink, 24) : undefined
    const baseTitle = f.description?.trim() || f.name || 'Photo'
    const title = baseTitle.replace(/\.[^/.]+$/, '')
    const rk = extractResourceKey(f.webViewLink, f.thumbnailLink)
    const photo = {
      id: f.id,
      title,
      thumb,
      lqip,
      width: f.imageMediaMetadata?.width || 1600,
      height: f.imageMediaMetadata?.height || 1200,
      exif: {
        cameraMake: f.imageMediaMetadata?.cameraMake,
        cameraModel: f.imageMediaMetadata?.cameraModel,
        focalLength: f.imageMediaMetadata?.focalLength,
        aperture: f.imageMediaMetadata?.aperture,
        iso: f.imageMediaMetadata?.isoSpeed,
        exposureTime: f.imageMediaMetadata?.exposureTime,
        createdTime: f.imageMediaMetadata?.time || f.createdTime,
      },
      openUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      unsupported: !hasThumb && !isSupported,
      // resourceKey travels in the thumb URL; the gallery re-derives altSrc
      // from it on demand. Kept off the wire to slim the payload.
      _resourceKey: rk || null,
    }
    return photo
  })
}

// Limited-concurrency map over an array (RAM-conscious: no extra deps).
async function mapLimit(items, limit, fn) {
  const results = Array.from({ length: items.length })
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

function emptyManifest(rootFolderId) {
  return {
    generatedAt: null,
    rootFolderId: rootFolderId || '',
    albums: [],
    allPhotos: [],
    byAlbum: {},
  }
}

async function main() {
  await loadEnv()
  const apiKey = process.env.PUBLIC_GOOGLE_API_KEY
  const rootFolderId = process.env.PUBLIC_GOOGLE_DRIVE_FOLDER_ID
  await mkdir(path.dirname(outFile), { recursive: true })

  if (!apiKey || !rootFolderId) {
    console.warn('[gen-photo-manifest] no PUBLIC_GOOGLE_API_KEY / PUBLIC_GOOGLE_DRIVE_FOLDER_ID, writing empty manifest')
    await writeFile(outFile, `${JSON.stringify(emptyManifest(null), null, 2)}\n`)
    return
  }

  try {
    const albums = await fetchAlbums(apiKey, rootFolderId)
    const folderIds = await listAllFolderIds(apiKey, rootFolderId)
    const realAlbums = albums.filter(a => a.id !== '__ALL__')

    // First page of photos per folder, limited concurrency.
    const photoLists = await mapLimit(folderIds, CONCURRENCY, fid => fetchFolderPhotos(apiKey, fid))

    // "All Photos": merge across folders, sort by created time desc, cap.
    const allPhotos = photoLists
      .flat()
      .sort((a, b) => {
        const da = normalizeDateString(a.exif?.createdTime || '')?.getTime() || 0
        const db = normalizeDateString(b.exif?.createdTime || '')?.getTime() || 0
        return db - da
      })
      .slice(0, MANIFEST_BATCH)
      .map(stripRuntimeOnly)

    // Per-album snapshots (unsupported items kept so their Drive cards render).
    const byAlbum = {}
    for (const al of realAlbums) {
      const idx = folderIds.indexOf(al.id)
      const items = idx >= 0 ? (photoLists[idx] || []) : []
      if (items.length)
        byAlbum[al.id] = items.slice(0, PER_FOLDER).map(stripRuntimeOnly)
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      rootFolderId,
      albums,
      allPhotos,
      byAlbum,
    }
    await writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`[gen-photo-manifest] wrote ${outFile}`)
    console.log(`[gen-photo-manifest] ${albums.length} albums, ${Object.keys(byAlbum).length} folders, ${allPhotos.length} all-photos, ${Object.values(byAlbum).reduce((n, l) => n + l.length, 0)} album photos`)
  }
  catch (e) {
    // Degrade gracefully: build continues, gallery falls back to live fetch.
    console.warn('[gen-photo-manifest] failed, writing empty manifest:', e?.message || e)
    await writeFile(outFile, `${JSON.stringify(emptyManifest(rootFolderId), null, 2)}\n`)
  }
}

// Drop fields that are only useful at runtime (never sent to the client twice).
function stripRuntimeOnly(p) {
  const { _resourceKey, ...rest } = p
  return rest
}

main()
