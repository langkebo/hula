<template>
  <div class="homeserver-wrap">
    <label class="sr-only" for="login-homeserver">{{ t('login.input.homeserver.placeholder') }}</label>
    <n-input
      size="large"
      v-model:value="homeserverUrl"
      type="text"
      :placeholder="t('login.input.homeserver.placeholder')"
      :title="t('login.input.homeserver.toggle_title')"
      v-bind="statusBind"
      :input-props="{
        id: 'login-homeserver',
        name: 'homeserver',
        autocomplete: 'url',
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
        'aria-invalid': showError ? 'true' : 'false',
        'aria-describedby': describedBy
      }"
      @blur="handleBlur"
      clearable>
      <template #prefix>
        <svg
          class="size-16px color-[--tjg-text-secondary] flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
          <line x1="7" y1="17" x2="7.01" y2="17" />
        </svg>
      </template>
      <template #suffix>
        <button
          type="button"
          class="login-homeserver-toggle"
          :title="t('login.input.homeserver.toggle_title')"
          :aria-label="t('login.input.homeserver.toggle_title')"
          :aria-expanded="showServerAdvanced"
          @click="showServerAdvanced = !showServerAdvanced">
          <svg
            class="w-14px h-14px transition-transform duration-200"
            :class="{ 'rotate-180': showServerAdvanced }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </template>
    </n-input>
    <transition name="server-advanced">
      <div v-if="showServerAdvanced" id="login-homeserver-hint" class="homeserver-hint">
        <svg
          class="size-11px flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>{{ t('login.input.homeserver.advanced_hint') }}</span>
      </div>
    </transition>
    <p v-if="showError" id="login-homeserver-error" class="homeserver-error" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { isPotentialHomeserverInput, normalizeHttpUrl } from '@/services/backend'

const { t } = useI18n()
const homeserverUrl = defineModel<string>('homeserverUrl', { required: true })
const showServerAdvanced = ref(false)
const touched = ref(false)

const errorMessage = computed(() => {
  const value = homeserverUrl.value.trim()
  if (!value) {
    return t('login.server_config.homeserver_empty')
  }
  return isPotentialHomeserverInput(value) ? '' : t('login.server_config.homeserver_invalid')
})

const showError = computed(() => touched.value && !!errorMessage.value)

const statusBind = computed(() => (showError.value ? { status: 'error' as const } : {}))

const describedBy = computed(() => {
  const ids = [showServerAdvanced.value ? 'login-homeserver-hint' : '', showError.value ? 'login-homeserver-error' : '']
  return ids.filter(Boolean).join(' ') || undefined
})

/** 失焦时校验：非法地址只提示不改写，合法地址补齐协议后写回 */
const handleBlur = () => {
  touched.value = true
  if (errorMessage.value) {
    return
  }
  homeserverUrl.value = normalizeHttpUrl(homeserverUrl.value)
}
</script>

<style scoped>
/* homeserver-wrap 仅作为输入框 + 折叠提示的容器 */
.homeserver-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 4px;
}

.homeserver-wrap :deep(.n-input) {
  width: 100%;
}

.login-homeserver-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  color: var(--tjg-text-secondary);
}

.login-homeserver-toggle:focus-visible {
  outline: 2px solid var(--tjg-color-primary-500);
  outline-offset: 1px;
}

.homeserver-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 14px;
  /* 叠在登录页玻璃底上，tertiary 约 4.4:1，低于 AA 4.5:1；提升到 secondary */
  color: var(--tjg-text-secondary);
  text-align: left;
}

.homeserver-error {
  padding: 0 4px;
  margin: 0;
  font-size: 11px;
  line-height: 14px;
  color: var(--tjg-color-danger-600);
  text-align: left;
}

.server-advanced-enter-active,
.server-advanced-leave-active {
  transition:
    opacity 0.25s ease,
    max-height 0.25s ease;
  overflow: hidden;
  max-height: 60px;
}

.server-advanced-enter-from,
.server-advanced-leave-to {
  opacity: 0;
  max-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .server-advanced-enter-active,
  .server-advanced-leave-active {
    transition: none;
  }
  .rotate-180 {
    transition: none;
  }
}
</style>
