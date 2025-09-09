import { readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import ttf2woff2 from 'ttf2woff2'

async function ensureWoff2() {
  const ttfPath = path.resolve('public/fonts/0xProto.ttf')
  const woff2Path = path.resolve('public/fonts/0xProtoNerdFontMono.woff2')
  try {
    const s = await stat(woff2Path)
    if (s.size > 0) {
      console.log('WOFF2 already present, size:', s.size)
      return
    }
  } catch {}
  try {
    const ttf = await readFile(ttfPath)
    const w2 = ttf2woff2(ttf)
    await writeFile(woff2Path, w2)
    console.log('Generated WOFF2 from TTF at', woff2Path)
  } catch (e) {
    console.error('Failed to generate WOFF2:', e)
  }
}

ensureWoff2()

