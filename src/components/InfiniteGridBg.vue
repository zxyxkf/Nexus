<template>
  <div
    class="infinite-grid-bg"
  >
    <svg class="grid-svg grid-svg-base">
      <defs>
        <pattern
          :id="baseId"
          width="40" height="40"
          patternUnits="userSpaceOnUse"
        >
          <path d="M 40 0 L 0 0 0 40" fill="none" :stroke="gridColor" stroke-width="1.5" opacity="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" :fill="`url(#${baseId})`" />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  gridColor: { type: String, default: '#5a6170' },
  showBlobs: { type: Boolean, default: false }
})

const uid = Math.random().toString(36).slice(2, 8)
const baseId = computed(() => `grid-base-${uid}`)
</script>

<style scoped>
.infinite-grid-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.grid-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.grid-svg-base {
  opacity: 0.6;
}
</style>

<!-- Hide in dark mode (non-scoped so it pierces into html.dark) -->
<style>
html.dark .infinite-grid-bg {
  display: none;
}
</style>
