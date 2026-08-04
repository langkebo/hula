<template>
  <div
    v-if="enabled"
    data-test="screenshot-watermark"
    class="screenshot-watermark"
    aria-hidden="true">
    <svg class="screenshot-watermark__pattern" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern
          :id="patternId"
          x="0"
          y="0"
          width="200"
          height="120"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-30)">
          <text
            x="20"
            y="60"
            font-size="12"
            fill="currentColor"
            opacity="0.08">
            {{ watermarkText }}
          </text>
          <text
            x="20"
            y="100"
            font-size="10"
            fill="currentColor"
            opacity="0.06">
            {{ timestamp }}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" :fill="`url(#${patternId})`" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  userId: string
  userName: string
  enabled: boolean
}>()

const patternId = `wm-${Math.random().toString(36).slice(2, 9)}`
const timestamp = ref('')

onMounted(() => {
  updateTimestamp()
})

function updateTimestamp() {
  const now = new Date()
  timestamp.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const watermarkText = computed(() => `${props.userName} · ${props.userId}`)
</script>

<style scoped>
.screenshot-watermark {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
  color: var(--tjg-text-primary);
}

.screenshot-watermark__pattern {
  width: 100%;
  height: 100%;
}
</style>
