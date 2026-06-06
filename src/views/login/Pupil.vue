<template>
  <div
    ref="pupilRef"
    class="pupil-dot"
    :style="pupilStyle"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  size: { type: Number, default: 12 },
  maxDistance: { type: Number, default: 5 },
  pupilColor: { type: String, default: '#2D2D2D' },
  forceLookX: { type: Number, default: undefined },
  forceLookY: { type: Number, default: undefined }
})

const mouseX = ref(0)
const mouseY = ref(0)
const pupilRef = ref(null)

function onMouseMove(e) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}

onMounted(() => window.addEventListener('mousemove', onMouseMove))
onUnmounted(() => window.removeEventListener('mousemove', onMouseMove))

const pupilStyle = computed(() => {
  let x = 0, y = 0
  if (props.forceLookX !== undefined && props.forceLookY !== undefined) {
    x = props.forceLookX
    y = props.forceLookY
  } else if (pupilRef.value) {
    const rect = pupilRef.value.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = mouseX.value - cx
    const dy = mouseY.value - cy
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), props.maxDistance)
    const angle = Math.atan2(dy, dx)
    x = Math.cos(angle) * dist
    y = Math.sin(angle) * dist
  }
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    backgroundColor: props.pupilColor,
    borderRadius: '50%',
    transform: `translate(${x}px, ${y}px)`,
    transition: 'transform 0.1s ease-out'
  }
})
</script>
