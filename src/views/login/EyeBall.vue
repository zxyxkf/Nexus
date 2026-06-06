<template>
  <div
    ref="eyeRef"
    class="eye-ball"
    :style="eyeStyle"
  >
    <Pupil
      v-if="!isBlinking"
      :size="pupilSize"
      :max-distance="maxDistance"
      :pupil-color="pupilColor"
      :force-look-x="forceLookX"
      :force-look-y="forceLookY"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Pupil from './Pupil.vue'

const props = defineProps({
  size: { type: Number, default: 48 },
  pupilSize: { type: Number, default: 16 },
  maxDistance: { type: Number, default: 10 },
  eyeColor: { type: String, default: '#fff' },
  pupilColor: { type: String, default: '#2D2D2D' },
  isBlinking: { type: Boolean, default: false },
  forceLookX: { type: Number, default: undefined },
  forceLookY: { type: Number, default: undefined }
})

const eyeRef = ref(null)

const eyeStyle = computed(() => ({
  width: `${props.size}px`,
  height: props.isBlinking ? '2px' : `${props.size}px`,
  backgroundColor: props.eyeColor,
  borderRadius: '50%',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s'
}))
</script>

