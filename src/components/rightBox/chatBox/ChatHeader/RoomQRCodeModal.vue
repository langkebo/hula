<template>
  <n-modal v-model:show="show" preset="card" :title="t('home.chat_header.group_qr_code')" class="w-[300px]">
    <div class="qr-code-container">
      <canvas ref="qrCanvasRef" width="200" height="200"></canvas>
    </div>
    <div class="qr-code-actions">
      <n-button type="primary" block @click="handleShareQRCode">
        {{ t('home.chat_header.share_qr_code') }}
      </n-button>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { writeImage, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

const props = defineProps<{ roomId: string }>()
const show = defineModel<boolean>('show', { required: true })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const logger = createLogger('RoomQRCodeModal')

const qrCanvasRef = ref<HTMLCanvasElement | null>(null)
const roomUri = computed(() => (props.roomId ? `matrix:room/${props.roomId}` : ''))

watch(show, async (visible) => {
  if (!visible) return
  await nextTick()
  if (!qrCanvasRef.value || !roomUri.value) return

  try {
    const QRCode = (await import('qrcode')).default
    await QRCode.toCanvas(qrCanvasRef.value, roomUri.value, { width: 200 })
  } catch (err) {
    logger.error('Failed to generate QR code:', err)
  }
})

// 优先把二维码图片写入剪贴板，平台不支持写图片时退化为复制房间标识文本。
const writeQrCodeImageToClipboard = async (canvas: HTMLCanvasElement): Promise<boolean> => {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return false
  await writeImage(new Uint8Array(await blob.arrayBuffer()))
  return true
}

const handleShareQRCode = async () => {
  if (!roomUri.value) return

  const canvas = qrCanvasRef.value
  if (canvas) {
    try {
      if (await writeQrCodeImageToClipboard(canvas)) {
        showFeedback(t('home.chat_header.qr_code_copied'), 'success')
        return
      }
    } catch (err) {
      logger.error('Failed to copy QR code image:', err)
    }
  }

  try {
    await writeText(roomUri.value)
    showFeedback(t('home.chat_header.qr_code_link_copied'), 'success')
  } catch (err) {
    logger.error('Failed to copy QR code link:', err)
    showFeedback(t('home.chat_header.qr_code_copy_failed'), 'error')
  }
}
</script>

<style scoped>
.qr-code-container {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px;
}

.qr-code-actions {
  display: flex;
  justify-content: center;
}
</style>
