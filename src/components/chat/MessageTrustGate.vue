<template>
  <!--
    F-1 信任门禁：**视觉降级，不是安全边界**。

    内容在客户端已经解密并进入 DOM，这里的 `blur` 只降低「肩窥 / 误读」成本，
    挡不住 DevTools 或改一行 CSS。所以：
    - 文案只说「点击显示」，不说「已保护 / 已隐藏」；
    - `pointer-events: none` 是为了让被遮住的部分不可点、不可选（避免误触链接 / 菜单），
      不是访问控制。

    未命中门禁时**不产生任何额外 DOM**（直接渲染 slot），保证默认观感与改造前一致。
  -->
  <div v-if="masked" class="trust-gate" data-test="trust-gate">
    <div v-if="warnPlaintext" class="trust-gate__warning" role="note">
      <span>{{ t('chat.encryption.trust_gate_plaintext_in_encrypted_room') }}</span>
    </div>

    <div class="trust-gate__content trust-gate__content--blurred">
      <slot />
    </div>

    <button
      type="button"
      class="trust-gate__reveal"
      data-test="trust-gate-reveal"
      :aria-label="t('chat.encryption.trust_gate_reveal')"
      @click.stop="reveal">
      <span>{{ t('chat.encryption.trust_gate_reveal') }}</span>
    </button>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTrustGatePolicy } from '@/composables/encryption/useTrustGatePolicy'
import type { MessageTrustLevel } from '@/services/matrix/crypto/messageTrustCache'

const props = defineProps<{
  /** 该消息的信任级（来自 `useMessageTrust`） */
  trustLevel: MessageTrustLevel
}>()

const { t } = useI18n()
const { shouldMask, shouldWarnPlaintextInEncryptedRoom } = useTrustGatePolicy()

/**
 * 用户是否手动展开过。
 *
 * ⚠️ 必须随 `trustLevel` 复位：虚拟列表会复用组件实例，否则上一条展开过的消息
 * 会把下一条也带成展开态（与 P0-3 的缓存残留同一类 bug）。
 */
const revealed = ref(false)

const masked = computed(() => !revealed.value && shouldMask(props.trustLevel))
const warnPlaintext = computed(() => shouldWarnPlaintextInEncryptedRoom(props.trustLevel))

watch(
  () => props.trustLevel,
  () => {
    revealed.value = false
  }
)

/** 展开。刻意**不**持久化「已展开」：那等于把门禁永久关掉。 */
function reveal(): void {
  revealed.value = true
}
</script>

<style scoped lang="scss">
.trust-gate {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trust-gate__warning {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--tjg-color-danger-500);
  background: var(--tjg-color-danger-100);
}

.trust-gate__content--blurred {
  filter: blur(6px);
  user-select: none;
  pointer-events: none;
}

.trust-gate__reveal {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 4px 10px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--tjg-text-secondary);
  background: var(--tjg-surface-panel);
  cursor: pointer;

  &:hover {
    color: var(--tjg-color-primary-500);
  }
}
</style>
