<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  messages: string[]
  typeSpeed?: number // ms per character when typing
  deleteSpeed?: number // ms per character when deleting
  pauseTime?: number // ms to pause at end of word
  betweenPause?: number // ms pause after deleting before next word
  loop?: boolean
  ariaLabel?: string
  respectReducedMotion?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  typeSpeed: 60,
  deleteSpeed: 30,
  pauseTime: 1400,
  betweenPause: 500,
  loop: true,
  ariaLabel: 'Rotating fun facts',
  respectReducedMotion: true,
})

const displayText = ref('')
const liveRegionText = ref('')
const index = ref(0)
const charIndex = ref(0)
const isDeleting = ref(false)
let timer: number | null = null
let mql: MediaQueryList | null = null
const prefersReduced = ref(false)

const currentMessage = computed(() => props.messages[index.value] ?? '')

function schedule(nextDelay: number) {
  if (timer)
    window.clearTimeout(timer)
  timer = window.setTimeout(tick, nextDelay)
}

function tick() {
  if (prefersReduced.value) {
    // Reduced motion: no typing effect, just rotate full messages slowly
    displayText.value = currentMessage.value
    liveRegionText.value = currentMessage.value
    if (timer)
      window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const next = index.value + 1
      if (next >= props.messages.length) {
        if (!props.loop)
          return
        index.value = 0
      }
      else {
        index.value = next
      }
      displayText.value = currentMessage.value
      liveRegionText.value = currentMessage.value
      tick()
    }, props.pauseTime + props.betweenPause + 500)
    return
  }
  const msg = currentMessage.value
  if (!msg)
    return

  if (isDeleting.value)
    charIndex.value = Math.max(0, charIndex.value - 1)
  else
    charIndex.value = Math.min(msg.length, charIndex.value + 1)

  displayText.value = msg.slice(0, charIndex.value)
  // Keep SR updates less noisy by only announcing full message
  if (!isDeleting.value && charIndex.value === msg.length)
    liveRegionText.value = msg

  if (!isDeleting.value && charIndex.value === msg.length) {
    isDeleting.value = true
    schedule(props.pauseTime)
    return
  }

  if (isDeleting.value && charIndex.value === 0) {
    isDeleting.value = false
    // Move to next message
    const next = index.value + 1
    if (next >= props.messages.length) {
      if (!props.loop)
        return
      index.value = 0
    }
    else {
      index.value = next
    }
    // small pause between rotations before typing next
    schedule(props.betweenPause)
    return
  }

  schedule(isDeleting.value ? props.deleteSpeed : props.typeSpeed)
}

onMounted(() => {
  if (props.respectReducedMotion && typeof window !== 'undefined' && 'matchMedia' in window) {
    mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => {
      prefersReduced.value = !!mql?.matches
      if (timer)
        window.clearTimeout(timer)
      // reset state
      displayText.value = ''
      charIndex.value = 0
      isDeleting.value = false
      // if reduced, show full text immediately
      if (prefersReduced.value) {
        displayText.value = currentMessage.value
        liveRegionText.value = currentMessage.value
        tick()
      }
      else {
        schedule(props.typeSpeed)
      }
    }
    // initial
    handler()
    mql.addEventListener?.('change', handler)
    // @ts-expect-error older browsers
    mql.addListener?.(handler)
    return
  }
  // Start typing from empty
  displayText.value = ''
  charIndex.value = 0
  isDeleting.value = false
  schedule(props.typeSpeed)
})

onBeforeUnmount(() => {
  if (timer)
    window.clearTimeout(timer)
  if (mql) {
    const noop = () => {}
    // best-effort remove
    // @ts-expect-error older browsers
    mql.removeEventListener?.('change', noop)
    // @ts-expect-error older browsers
    mql.removeListener?.(noop)
  }
})

// Restart animation if messages change
watch(() => props.messages, () => {
  if (timer)
    window.clearTimeout(timer)
  index.value = 0
  charIndex.value = 0
  isDeleting.value = false
  displayText.value = ''
  schedule(props.typeSpeed)
})
</script>

<template>
  <span
    class="tt-wrapper inline-block whitespace-normal break-words max-w-full overflow-hidden font-bold font-mono"
    role="status"
    :aria-label="ariaLabel"
    aria-live="polite"
  >
    <span>{{ displayText }}<span
      class="ml-1 w-px h-[1em] inline-block align-[-0.125em] bg-orange-500/90 animate-caret"
      aria-hidden="true"
    /></span>
  </span>
  <noscript>
    <span class="inline-block font-bold">{{ messages[0] || '' }}</span>
  </noscript>
  <!-- Hidden live region for better SR announcements -->
  <span class="sr-only" aria-live="polite">{{ liveRegionText }}</span>
  <!-- Note: parent can style via wrapper classes -->
</template>

<style scoped>
/* Ensure font, wrapping and prevent overflow on small screens */
.tt-wrapper {
  font-family: '0xProto Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', 'Courier New', monospace;
  overflow-wrap: anywhere;
}
@keyframes caret-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}
.animate-caret {
  animation: caret-blink 1s step-end infinite;
}
</style>
