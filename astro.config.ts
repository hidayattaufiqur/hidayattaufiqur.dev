import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import UnoCSS from 'unocss/astro'
import vue from '@astrojs/vue'

export default defineConfig({
  output: 'static',

  // Restore Astro <=6 HTML-aware whitespace handling. Astro 7 changed the
  // default to 'jsx', which collapses spaces between inline elements
  // (e.g. `<b>Cum Laude</b> in ...`) that wrap across source lines.
  compressHTML: true,

  site: 'https://astro-theme-vitesse.netlify.app/',
  server: {
    port: 1977,
  },
  integrations: [
    mdx(),
    sitemap(),
    UnoCSS({
      injectReset: true,
    }),
    vue(),
  ],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light-default',
        dark: 'github-dark-default',
      },
      wrap: true,
    },
  },
  vite: {
    server: {
      watch: {
        ignored: ['**/.direnv/**', '**/node_modules/**', '**/dist/**'],
      },
    },
  },
})
