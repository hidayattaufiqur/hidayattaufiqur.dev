<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

// --- Types ---

interface HeadingData {
  id: string
  text: string
  level: number
  element: HTMLElement
}

// --- Props ---

const props = withDefaults(
  defineProps<{
    /**
     * CSS selector to find headings.
     * Defaults to common blog content wrappers and explicit [data-toc] elements.
     */
    selector?: string
  }>(),
  {
    selector:
      'article h2, article h3, article h4, .prose h2, .prose h3, .prose h4, [data-toc]',
  },
)

// --- State ---

const headings = ref<HeadingData[]>([])
const activeId = ref<string | null>(null)
const hoveredId = ref<string | null>(null)
const isExpanded = ref(false)
const progress = ref(0)

// --- Computed ---

const activeHeading = computed(() => headings.value.find(h => h.id === activeId.value))

// True when the active heading is a sub-heading (not top-level in this doc)
const isPillSubHeading = computed(() =>
  activeHeading.value ? getIndentLevel(activeHeading.value.level) > 0 : false,
)

// The nearest top-level ancestor of the active heading
const parentHeading = computed(() => {
  if (!activeHeading.value)
    return null
  const activeIndex = headings.value.findIndex(h => h.id === activeHeading.value!.id)
  for (let i = activeIndex - 1; i >= 0; i--) {
    if (getIndentLevel(headings.value[i].level) === 0)
      return headings.value[i]
  }
  return null
})

const minLevel = computed(() => {
  if (headings.value.length === 0)
    return 1
  return Math.min(...headings.value.map(h => h.level))
})

// Progress circle values
const circleSize = 24
const strokeWidth = 2.5
const radius = (circleSize - strokeWidth) / 2
const circumference = 2 * Math.PI * radius
const strokeOffset = computed(() => circumference - (progress.value / 100) * circumference)

// Dynamic island styles
const islandStyle = computed(() => ({
  width: isExpanded.value ? '340px' : '280px',
  height: isExpanded.value ? '400px' : '52px',
  borderRadius: isExpanded.value ? '24px' : '26px',
}))

// --- Methods ---

function getIndentLevel(level: number): number {
  return Math.max(0, level - minLevel.value)
}

function getIndentPadding(level: number): string {
  return `${getIndentLevel(level) * 14 + 12}px`
}

function getHeadingFontSize(level: number): string {
  return getIndentLevel(level) === 0 ? '14px' : '13px'
}

function getItemColor(level: number, isActive: boolean, isHovered: boolean): string {
  if (isActive)
    return 'var(--island-text)'
  if (isHovered)
    return 'var(--island-text-85)'
  return getIndentLevel(level) === 0 ? 'var(--island-text-60)' : 'var(--island-text-38)'
}

function getItemBg(isActive: boolean, isHovered: boolean): string {
  if (isActive)
    return 'var(--island-active-bg)'
  if (isHovered)
    return 'var(--island-hover-bg)'
  return 'transparent'
}

function getTopMargin(level: number, index: number): string {
  return getIndentLevel(level) === 0 && index > 0 ? '6px' : '0'
}

function scrollToHeading(heading: HeadingData) {
  const yOffset = -80
  const y = heading.element.getBoundingClientRect().top + window.scrollY + yOffset
  window.scrollTo({ top: y, behavior: 'smooth' })
  isExpanded.value = false
}

function handleIslandClick() {
  if (!isExpanded.value)
    isExpanded.value = true
}

function closeMenu(e: Event) {
  e.stopPropagation()
  isExpanded.value = false
}

// --- Lifecycle & Scroll ---

let scrollHandler: (() => void) | null = null

onMounted(() => {
  // Slight delay ensures CMS/Markdown hydration is complete
  setTimeout(() => {
    const elements = Array.from(document.querySelectorAll(props.selector)) as HTMLElement[]

    const validHeadings = elements
      .filter(el => !el.hasAttribute('data-toc-ignore'))
      .map((el, index) => {
        if (!el.id) {
          const generatedId
            = el.textContent
              ?.toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w-]/g, '') || `toc-heading-${index}`
          el.id = generatedId
        }

        const depthAttr = el.getAttribute('data-toc-depth')
        let level = 2

        if (depthAttr) {
          level = Number.parseInt(depthAttr, 10)
        }
        else {
          const tagName = el.tagName.toUpperCase()
          if (tagName.startsWith('H') && tagName.length === 2) {
            level = Number.parseInt(tagName[1], 10)
          }
        }

        const text = el.getAttribute('data-toc-title') || el.textContent || 'Section'

        return { id: el.id, text, level, element: el }
      })

    // Sort by DOM order
    validHeadings.sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )

    headings.value = validHeadings

    nextTick(() => handleScroll())
  }, 100)

  scrollHandler = () => handleScroll()
  window.addEventListener('scroll', scrollHandler, { passive: true })
})

onUnmounted(() => {
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler)
  }
})

function handleScroll() {
  let currentActiveId: string | null = null
  for (const heading of headings.value) {
    const top = heading.element.getBoundingClientRect().top
    if (top <= 120) {
      currentActiveId = heading.id
    }
    else {
      break
    }
  }

  if (!currentActiveId && headings.value.length > 0) {
    currentActiveId = headings.value[0].id
  }

  activeId.value = currentActiveId

  const total = document.documentElement.scrollHeight - window.innerHeight
  progress.value = total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 0
}
</script>

<template>
  <slot />

  <!-- Backdrop Blur Overlay -->
  <Transition name="backdrop">
    <div
      v-if="isExpanded"
      class="fixed inset-0 z-9998 backdrop-blur-[4px]"
      style="background-color: rgba(0, 0, 0, 0.2)"
      @click="isExpanded = false"
    />
  </Transition>

  <!-- Dynamic Island Wrapper -->
  <div class="island-wrapper">
    <div
      class="relative overflow-hidden shadow-2xl island-shell"
      :style="{
        ...islandStyle,
        cursor: isExpanded ? 'default' : 'pointer',
      }"
      @click="handleIslandClick"
    >
      <!-- CLOSED PILL CONTENT -->
      <div
        class="absolute inset-0 flex items-center gap-3 px-4 sm:px-5"
        :class="isExpanded ? 'pill-hidden' : 'pill-visible'"
      >
        <!-- Dot for top-level, chevron for sub-heading -->
        <div
          v-if="!isPillSubHeading"
          class="h-2 w-2 shrink-0 rounded-full island-dot"
        />
        <span
          v-else
          class="shrink-0 text-[13px] leading-none island-text"
          style="opacity: 0.45; font-weight: 300"
        >›</span>

        <div class="relative flex h-full flex-1 flex-col justify-center overflow-hidden text-left">
          <!-- Parent section label (only for sub-headings) -->
          <Transition name="slide-text" mode="out-in">
            <span
              v-if="isPillSubHeading && parentHeading"
              :key="`parent-${parentHeading?.id || ''}`"
              class="block w-full overflow-hidden text-ellipsis whitespace-nowrap island-parent-label"
            >
              {{ parentHeading.text }}
            </span>
          </Transition>
          <!-- Active heading text -->
          <Transition name="slide-text" mode="out-in">
            <span
              :key="activeId || 'empty'"
              class="block w-full overflow-hidden text-ellipsis whitespace-nowrap island-text"
              :class="isPillSubHeading ? 'island-pill-sub' : 'island-pill-top'"
            >
              {{ activeHeading?.text || 'Contents' }}
            </span>
          </Transition>
        </div>

        <!-- Progress Circle -->
        <svg :width="circleSize" :height="circleSize" class="-rotate-90 shrink-0">
          <circle
            :cx="circleSize / 2"
            :cy="circleSize / 2"
            :r="radius"
            fill="none"
            class="progress-track"
            :stroke-width="strokeWidth"
          />
          <circle
            :cx="circleSize / 2"
            :cy="circleSize / 2"
            :r="radius"
            fill="none"
            class="progress-fill"
            :stroke-width="strokeWidth"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeOffset"
            stroke-linecap="round"
          />
        </svg>
      </div>

      <!-- EXPANDED MENU CONTENT -->
      <div
        class="absolute inset-0 flex flex-col"
        :class="isExpanded ? 'menu-visible' : 'menu-hidden'"
      >
        <div class="flex shrink-0 items-center justify-between px-6 pb-3 pt-5">
          <span class="text-[11px] font-semibold tracking-[0.08em] island-label">
            TABLE OF CONTENTS
          </span>
          <button
            class="island-close-btn"
            @click="closeMenu"
          >
            <span class="i-carbon-close block h-5 w-5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
          <div class="flex flex-col gap-0.5">
            <button
              v-for="(h, index) in headings"
              :key="h.id"
              class="group flex w-full shrink-0 cursor-pointer items-center rounded-lg border-none py-2 pr-3 text-left transition-all duration-300 ease-out toc-item"
              :class="activeId === h.id ? 'font-medium' : ''"
              :style="{
                paddingLeft: getIndentPadding(h.level),
                marginTop: getTopMargin(h.level, index),
                fontSize: getHeadingFontSize(h.level),
                color: getItemColor(h.level, activeId === h.id, hoveredId === h.id),
                backgroundColor: getItemBg(activeId === h.id, hoveredId === h.id),
              }"
              @mouseenter="hoveredId = h.id"
              @mouseleave="hoveredId = null"
              @click.stop="scrollToHeading(h)"
            >
              <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap transition-transform duration-300 group-hover:translate-x-1">
                {{ h.text }}
              </span>

              <div
                class="ml-3 h-1.5 w-1.5 shrink-0 rounded-full island-dot transition-all duration-300 ease-out"
                :style="{
                  transform: activeId === h.id ? 'scale(1)' : 'scale(0)',
                  opacity: activeId === h.id ? 1 : 0,
                }"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* ---- Theme Variables (non-scoped so :root matches correctly) ---- */
:root {
  --island-bg: #ffffff;
  --island-border: rgba(0, 0, 0, 0.1);
  --island-text: #1a1a1a;
  --island-muted-stroke: #d1d5db;
  --island-muted-label: #555555;
  --island-active-bg: rgba(26, 26, 26, 0.1);
  --island-hover-bg: rgba(26, 26, 26, 0.06);
  --island-text-85: rgba(26, 26, 26, 0.85);
  --island-text-60: rgba(26, 26, 26, 0.75);
  --island-text-38: rgba(26, 26, 26, 0.58);
}

html.dark {
  --island-bg: #161b22;
  --island-border: rgba(255, 255, 255, 0.1);
  --island-text: #e6edf3;
  --island-muted-stroke: #30363d;
  --island-muted-label: #8b949e;
  --island-active-bg: rgba(230, 237, 243, 0.1);
  --island-hover-bg: rgba(230, 237, 243, 0.05);
  --island-text-85: rgba(230, 237, 243, 0.85);
  --island-text-60: rgba(230, 237, 243, 0.6);
  --island-text-38: rgba(230, 237, 243, 0.38);
}
</style>

<style scoped>
/* ---- Layout ---- */
.island-wrapper {
  position: fixed;
  bottom: 30px;
  left: 50%;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: island-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes island-slide-up {
  from {
    opacity: 0;
    transform: translate(-50%, 50px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* ---- Island Shell ---- */
.island-shell {
  background-color: var(--island-bg);
  color: var(--island-text);
  border: 1px solid var(--island-border);
  transition:
    width 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ---- Theming helpers ---- */
.island-dot {
  background-color: var(--island-text);
}

.island-text {
  color: var(--island-text);
}

/* Pill text variants */
.island-pill-top {
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
}

.island-pill-sub {
  font-size: 13px;
  font-weight: 400;
  line-height: 1;
}

/* Parent section context label */
.island-parent-label {
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--island-muted-label);
  line-height: 1;
  margin-bottom: 3px;
}

.island-label {
  color: var(--island-muted-label);
}

.island-close-btn {
  color: var(--island-muted-label);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.island-close-btn:hover {
  color: var(--island-text);
  opacity: 1;
}

.progress-track {
  stroke: var(--island-muted-stroke);
}

.progress-fill {
  stroke: var(--island-text);
  transition: stroke-dashoffset 0.15s ease-out;
}

/* ---- TOC item states ---- */
.toc-item {
  background: transparent;
  border: none;
  width: 100%;
}

/* ---- Pill (closed) state ---- */
.pill-visible {
  opacity: 1;
  transform: scale(1);
  filter: blur(0px);
  transition:
    opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s,
    filter 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s;
}

.pill-hidden {
  opacity: 0;
  transform: scale(0.95);
  filter: blur(4px);
  pointer-events: none;
  transition:
    opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ---- Menu (expanded) state ---- */
.menu-visible {
  opacity: 1;
  transform: scale(1);
  transition:
    opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s;
}

.menu-hidden {
  opacity: 0;
  transform: scale(1.05);
  pointer-events: none;
  transition:
    opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ---- Backdrop transitions ---- */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* ---- Active heading text slide ---- */
.slide-text-enter-active,
.slide-text-leave-active {
  transition:
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-text-enter-from {
  opacity: 0;
  transform: translateY(15px);
}

.slide-text-leave-to {
  opacity: 0;
  transform: translateY(-15px);
}
</style>
