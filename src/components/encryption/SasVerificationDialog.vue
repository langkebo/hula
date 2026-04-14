<template>
  <n-modal :show="show" @update:show="emit('update:show', $event)" preset="card" :title="t('verification.title', '设备验证')" style="width: 420px">
    <div v-if="phase === 'requesting'" class="verification-phase">
      <n-spin size="large" />
      <p class="text-center mt-12px">{{ t('verification.requesting', '正在发送验证请求...') }}</p>
    </div>

    <div v-else-if="phase === 'waiting'" class="verification-phase">
      <div class="text-center">
        <svg class="size-48px mb-12px"><use href="#clock"></use></svg>
        <p>{{ t('verification.waiting', '等待对方接受验证...') }}</p>
        <p class="text-(12px #909090)">{{ t('verification.waiting_hint', '请在对方设备上确认验证请求') }}</p>
      </div>
    </div>

    <div v-else-if="phase === 'sas-emoji'" class="verification-phase">
      <p class="text-center mb-16px">{{ t('verification.compare_emoji', '请确认双方看到的表情一致') }}</p>
      <div class="emoji-grid">
        <div v-for="(emoji, index) in sasEmojis" :key="index" class="emoji-item">
          <span class="emoji">{{ emoji.emoji }}</span>
          <span class="description text-(10px #909090)">{{ emoji.description }}</span>
        </div>
      </div>
      <n-flex justify="center" :size="12" class="mt-16px">
        <n-button type="primary" @click="handleConfirm">{{ t('verification.confirm', '一致') }}</n-button>
        <n-button @click="handleDeny">{{ t('verification.deny', '不一致') }}</n-button>
      </n-flex>
    </div>

    <div v-else-if="phase === 'sas-decimal'" class="verification-phase">
      <p class="text-center mb-16px">{{ t('verification.compare_numbers', '请确认双方看到的数字一致') }}</p>
      <div class="decimal-display">
        <span v-for="(num, index) in sasDecimals" :key="index" class="decimal-segment">
          {{ num }}
        </span>
      </div>
      <n-flex justify="center" :size="12" class="mt-16px">
        <n-button type="primary" @click="handleConfirm">{{ t('verification.confirm', '一致') }}</n-button>
        <n-button @click="handleDeny">{{ t('verification.deny', '不一致') }}</n-button>
      </n-flex>
    </div>

    <div v-else-if="phase === 'verified'" class="verification-phase">
      <div class="text-center">
        <svg class="size-48px mb-12px color-#52c41a"><use href="#check-circle"></use></svg>
        <p>{{ t('verification.verified', '验证成功！') }}</p>
        <p class="text-(12px #909090)">{{ t('verification.verified_hint', '此设备已验证，可以安全地发送加密消息') }}</p>
      </div>
    </div>

    <div v-else-if="phase === 'cancelled'" class="verification-phase">
      <div class="text-center">
        <svg class="size-48px mb-12px color-#f5222d"><use href="#x-circle"></use></svg>
        <p>{{ t('verification.cancelled', '验证已取消') }}</p>
      </div>
    </div>

    <div v-else-if="phase === 'error'" class="verification-phase">
      <div class="text-center">
        <svg class="size-48px mb-12px color-#f5222d"><use href="#alert-triangle"></use></svg>
        <p>{{ t('verification.error', '验证失败') }}</p>
        <p class="text-(12px #909090)">{{ errorMessage }}</p>
      </div>
    </div>

    <template #footer>
      <n-flex justify="end">
        <n-button
          v-if="phase === 'waiting'"
          type="error"
          secondary
          @click="handleCancel"
        >
          {{ t('verification.cancel', '取消验证') }}
        </n-button>
        <n-button @click="handleClose">
          {{ t('common.close', '关闭') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import matrixVerificationService from '@/services/matrix/MatrixVerificationService'

type VerificationPhase = 'requesting' | 'waiting' | 'sas-emoji' | 'sas-decimal' | 'verified' | 'cancelled' | 'error'

interface SasEmoji {
  emoji: string
  description: string
}

const props = defineProps<{
  show: boolean
  userId: string
  deviceId?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'verified'): void
  (e: 'cancelled'): void
}>()

const { t } = useI18n()
const message = useMessage()

const visible = ref(props.show)
const phase = ref<VerificationPhase>('requesting')
const sasEmojis = ref<SasEmoji[]>([])
const sasDecimals = ref<string[]>([])
const errorMessage = ref('')
const transactionId = ref('')

watch(
  () => props.show,
  (val) => {
    visible.value = val
    if (val) startVerification()
  }
)

watch(visible, (val) => emit('update:show', val))

async function startVerification() {
  phase.value = 'requesting'
  try {
    const request = await matrixVerificationService.requestVerification(props.userId, ['m.sas.v1'])
    if (request) {
      transactionId.value = request.transactionId
      phase.value = 'waiting'
    }
  } catch (err) {
    phase.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
}

function handleConfirm() {
  phase.value = 'verified'
  message.success(t('verification.verified', '验证成功！'))
  emit('verified')
}

function handleDeny() {
  handleCancel()
}

async function handleCancel() {
  if (transactionId.value) {
    try {
      await matrixVerificationService.cancelVerification(transactionId.value)
    } catch {
      // ignore cancel errors
    }
  }
  phase.value = 'cancelled'
  emit('cancelled')
}

function handleClose() {
  if (phase.value === 'waiting') {
    handleCancel()
  }
  visible.value = false
}
</script>

<style scoped lang="scss">
.verification-phase {
  padding: 16px 0;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  max-width: 320px;
  margin: 0 auto;
}

.emoji-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  .emoji {
    font-size: 32px;
    line-height: 1;
  }
}

.decimal-display {
  display: flex;
  gap: 16px;
  justify-content: center;

  .decimal-segment {
    font-size: 28px;
    font-weight: bold;
    font-family: monospace;
    padding: 4px 12px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.05);

    :deep(.dark) & {
      background: rgba(255, 255, 255, 0.05);
    }
  }
}
</style>
