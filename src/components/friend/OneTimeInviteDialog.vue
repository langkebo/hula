<template>
  <n-modal
    :show="show"
    preset="card"
    class="one-time-invite-dialog"
    :title="t('friend.one_time_invite.title')"
    @update:show="emit('update:show', $event)">
    <div class="one-time-invite-dialog__body">
      <!--
        能力边界必须写在最上面：单次 + 带外 + 时效能兑现，
        「发起者永远不知道对方身份」不能兑现（房间成员表在 claim 后仍暴露双方 MXID）。
      -->
      <p class="one-time-invite-dialog__lede">
        {{ t('friend.one_time_invite.boundary') }}
      </p>

      <section class="one-time-invite-dialog__section">
        <n-button type="primary" :loading="creating" data-test="ot-invite-create" @click="handleCreate">
          {{ created ? t('friend.one_time_invite.regenerate') : t('friend.one_time_invite.generate') }}
        </n-button>

        <div v-if="created" class="one-time-invite-dialog__result">
          <n-input :value="created.deep_link" readonly data-test="ot-invite-link" />
          <div class="one-time-invite-dialog__meta">
            <span data-test="ot-invite-remaining">{{ remainingText }}</span>
            <n-button size="small" data-test="ot-invite-copy" @click="handleCopy">
              {{ t('friend.one_time_invite.copy') }}
            </n-button>
          </div>
          <p class="one-time-invite-dialog__hint">{{ t('friend.one_time_invite.share_hint') }}</p>
        </div>
      </section>

      <n-divider class="m-0" />

      <section class="one-time-invite-dialog__section">
        <span class="one-time-invite-dialog__label">{{ t('friend.one_time_invite.claim_label') }}</span>
        <n-input
          v-model:value="claimInput"
          :placeholder="t('friend.one_time_invite.claim_placeholder')"
          data-test="ot-invite-claim-input" />
        <n-button
          :disabled="!claimToken || claiming"
          :loading="claiming"
          data-test="ot-invite-claim"
          @click="handleClaim">
          {{ t('friend.one_time_invite.claim_action') }}
        </n-button>
        <p v-if="claimTokenInvalid" class="one-time-invite-dialog__error" data-test="ot-invite-invalid">
          {{ t('friend.one_time_invite.invalid_link') }}
        </p>
      </section>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NDivider, NInput, NModal } from 'naive-ui'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import {
  type OneTimeInviteCreated,
  synapseOneTimeInviteService
} from '@/services/matrix/extensions/SynapseOneTimeInviteExtensionService'
import {
  extractInviteToken,
  formatInviteRemaining,
  remainingInviteMs
} from '@/services/matrix/invites/oneTimeInviteLink'

defineOptions({ name: 'OneTimeInviteDialog' })

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'claimed', roomId: string | null): void
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const creating = ref(false)
const claiming = ref(false)
const created = ref<OneTimeInviteCreated | null>(null)
const claimInput = ref('')
const claimTokenInvalid = ref(false)
const now = ref(Date.now())

/** 剩余有效期：15s 刷新一次，过期后显示"已过期"而不是负数 */
const remainingText = computed(() => {
  if (!created.value) return ''
  const remaining = remainingInviteMs(created.value.expires_at, now.value)
  if (remaining <= 0) return t('friend.one_time_invite.expired')
  const { hours, minutes } = formatInviteRemaining(remaining)
  return hours > 0
    ? t('friend.one_time_invite.remaining_hm', { hours, minutes })
    : t('friend.one_time_invite.remaining_m', { minutes })
})

const ticker = setInterval(() => {
  now.value = Date.now()
}, 15_000)
onUnmounted(() => clearInterval(ticker))

const claimToken = computed(() => extractInviteToken(claimInput.value))

async function handleCreate(): Promise<void> {
  if (creating.value) return
  creating.value = true
  claimTokenInvalid.value = false
  try {
    created.value = await synapseOneTimeInviteService.create()
    now.value = Date.now()
  } catch {
    showFeedback(t('friend.one_time_invite.create_failed'), 'error')
  } finally {
    creating.value = false
  }
}

async function handleCopy(): Promise<void> {
  if (!created.value) return
  try {
    await navigator.clipboard.writeText(created.value.deep_link)
    showFeedback(t('friend.one_time_invite.copied'), 'success')
  } catch {
    // 剪贴板不可用（无权限 / 非安全上下文）时不要假装成功
    showFeedback(t('friend.one_time_invite.copy_failed'), 'error')
  }
}

async function handleClaim(): Promise<void> {
  const token = claimToken.value
  if (!token) {
    claimTokenInvalid.value = props.show
    return
  }
  claiming.value = true
  try {
    const result = await synapseOneTimeInviteService.claim(token)
    showFeedback(t('friend.one_time_invite.claim_success'), 'success')
    emit('claimed', result.room_id)
    emit('update:show', false)
    claimInput.value = ''
  } catch (err) {
    // 已用过 / 已过期 / 不存在 —— 后端用 403/400/404 区分，这里统一给可读文案
    showFeedback(err instanceof Error && err.message ? err.message : t('friend.one_time_invite.claim_failed'), 'error')
  } finally {
    claiming.value = false
  }
}
</script>

<style scoped lang="scss">
.one-time-invite-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 420px;
}

.one-time-invite-dialog__lede {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--tjg-text-tertiary);
}

.one-time-invite-dialog__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.one-time-invite-dialog__result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.one-time-invite-dialog__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.one-time-invite-dialog__label {
  font-size: 13px;
  color: var(--tjg-text-secondary);
}

.one-time-invite-dialog__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tjg-text-tertiary);
}

.one-time-invite-dialog__error {
  margin: 0;
  font-size: 12px;
  color: var(--tjg-color-danger-500);
}
</style>
