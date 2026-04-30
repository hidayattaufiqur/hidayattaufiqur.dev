<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import siteConfig from '@/site-config'
import { getLinkTarget } from '@/utils/link'

type ActionCategory = 'Navigate' | 'Social' | 'Contact'

interface ActionItem {
  id: string
  label: string
  href?: string
  description?: string
  icon?: string
  category: ActionCategory
  external?: boolean
}

const isOpen = ref(false)
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const navActions = computed<ActionItem[]>(() => (siteConfig.header.navLinks || []).map(link => ({
  id: `nav-${link.text}`,
  label: link.text,
  href: link.href,
  description: 'Navigate',
  icon: 'i-ri-compass-3-line',
  category: 'Navigate' as const,
  external: link.href.startsWith('http'),
})))

const socialActions = computed<ActionItem[]>(() => (siteConfig.socialLinks || []).map(link => ({
  id: `social-${link.text}`,
  label: link.text,
  href: link.href,
  description: 'Social',
  icon: link.icon || 'i-ri-external-link-line',
  category: 'Social' as const,
  external: true,
})))

const contactActions = computed<ActionItem[]>(() => [
  {
    id: 'contact-email',
    label: siteConfig.email,
    href: `mailto:${siteConfig.email}`,
    description: 'Email',
    icon: 'i-ri-mail-line',
    category: 'Contact' as const,
  },
  {
    id: 'contact-resume',
    label: 'Open Resume',
    href: siteConfig.header?.navLinks?.find(link => link.text.toLowerCase() === 'resume')?.href,
    description: 'Resume',
    icon: 'i-ri-file-list-3-line',
    category: 'Contact' as const,
    external: true,
  },
].filter(action => !!action.href))

const actions = computed<ActionItem[]>(() => [
  ...navActions.value,
  ...socialActions.value,
  ...contactActions.value,
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return actions.value
  return actions.value.filter(action =>
    action.label.toLowerCase().includes(q)
    || (action.description ? action.description.toLowerCase().includes(q) : false),
  )
})

function openPalette() {
  isOpen.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function closePalette() {
  isOpen.value = false
  query.value = ''
}

function handleSelect(action: ActionItem) {
  closePalette()
  if (action.href) {
    const target = action.external ? '_blank' : getLinkTarget(action.href)
    window.open(action.href, target || '_self')
  }
}

function onGlobalKey(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  const meta = event.metaKey || event.ctrlKey
  if (meta && (key === 'k' || key === 'p')) {
    event.preventDefault()
    openPalette()
    return
  }
  if (key === 'escape' && isOpen.value)
    closePalette()
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
})

watch(isOpen, (value) => {
  if (value)
    document.body.classList.add('overflow-hidden')
  else
    document.body.classList.remove('overflow-hidden')
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="palette-mask fixed inset-0 z-999 flex items-start justify-center p-4 sm:p-10" role="dialog" aria-modal="true" aria-label="Quick navigation palette" @click.self="closePalette">
      <div class="w-full max-w-2xl rounded-2xl bg-white/80 dark:bg-[#0e131b]/90 backdrop-blur border border-white/30 dark:border-white/10 shadow-lg ring-1 ring-black/5 dark:ring-white/5">
        <div class="flex items-center gap-3 border-b border-white/40 dark:border-white/10 px-4 sm:px-5 py-3">
          <i class="i-ri-command-line text-xl text-[#555555] dark:text-[#bbbbbb]" aria-hidden="true" />
          <input
            ref="inputRef"
            v-model="query"
            type="search"
            inputmode="search"
            placeholder="Jump to a page, social, or email (⌘/Ctrl + K)"
            class="w-full bg-transparent outline-none text-base placeholder:opacity-60"
          >
          <button type="button" class="text-sm opacity-70 hover:opacity-100 transition-opacity" aria-label="Close command palette" @click="closePalette">
            Esc
          </button>
        </div>
        <div class="max-h-[60vh] overflow-y-auto p-2 sm:p-3">
          <template v-if="filtered.length">
            <button
              v-for="action in filtered" :key="action.id"
              class="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              type="button"
              :aria-label="`Go to ${action.label}`"
              @click="handleSelect(action)"
            >
              <span class="w-9 h-9 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-lg" aria-hidden="true">
                <i :class="action.icon || 'i-ri-compass-3-line'" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-base font-semibold truncate">
                  {{ action.label }}
                </div>
                <div class="text-sm opacity-70 truncate">
                  {{ action.description || action.category }}
                </div>
              </div>
              <span class="text-xs uppercase tracking-wide opacity-60">{{ action.category }}</span>
            </button>
          </template>
          <div v-else class="px-4 py-8 text-center opacity-70">
            No matches. Try another keyword.
          </div>
        </div>
        <div class="px-4 sm:px-5 py-3 text-xs flex flex-wrap gap-3 opacity-70 border-t border-white/40 dark:border-white/10">
          <span class="kbd-chip">⌘/Ctrl + K</span>
          <span class="kbd-chip">⌘/Ctrl + P</span>
          <span class="kbd-chip">Esc</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.palette-mask {
  background: radial-gradient(circle at center, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.35));
}

.kbd-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.06);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

html.dark .kbd-chip {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}
</style>
