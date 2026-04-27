<template>
  <div v-if="visible" class="privacy-overlay" :style="overlayStyle">
    <div class="privacy-overlay__watermark" :style="watermarkStyle">
      <span v-for="i in watermarkCount" :key="i" class="privacy-overlay__watermark-text">
        {{ watermarkText }}
      </span>
    </div>
    <div v-if="showBlockMessage" class="privacy-overlay__block-message">
      <svg class="privacy-overlay__icon">
        <use href="#shield"></use>
      </svg>
      <span>此聊天受保护，禁止截图</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { CSSProperties } from 'vue'

const props = defineProps<{
  visible?: boolean
  watermarkText?: string
  showBlockMessage?: boolean
}>()

const watermarkCount = ref(20)

const overlayStyle = computed<CSSProperties>(() => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: props.visible ? 'none' : 'none',
  zIndex: 9999
}))

const watermarkStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gridTemplateRows: 'repeat(auto-fill, minmax(100px, 1fr))',
  gap: '10px',
  padding: '20px',
  transform: 'rotate(-30deg)',
  opacity: 0.03,
  overflow: 'hidden'
}))

onMounted(() => {
  calculateWatermarkCount()
  window.addEventListener('resize', calculateWatermarkCount)
})

onUnmounted(() => {
  window.removeEventListener('resize', calculateWatermarkCount)
})

function calculateWatermarkCount() {
  const width = window.innerWidth
  const height = window.innerHeight
  watermarkCount.value = Math.ceil((width * height) / 20000)
}
</script>

<style scoped>
.privacy-overlay {
  background: transparent;
}

.privacy-overlay__watermark {
  width: 100%;
  height: 100%;
}

.privacy-overlay__watermark-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--hula-text-tertiary);
  white-space: nowrap;
  user-select: none;
}

.privacy-overlay__block-message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 32px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  color: white;
  pointer-events: none;
}

.privacy-overlay__icon {
  width: 48px;
  height: 48px;
  color: #ff4757;
}

.privacy-overlay__block-message span {
  font-size: 14px;
  white-space: nowrap;
}
</style>
