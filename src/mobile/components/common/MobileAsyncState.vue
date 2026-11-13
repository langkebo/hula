<template>
  <slot v-if="state === 'ready'" />
  <div
    v-else
    class="w-full flex-1 flex items-center justify-center"
    :style="{ minHeight }"
    :data-test="testId ? `${testId}-${state}` : `async-state-${state}`">
    <div v-if="state === 'loading'" class="flex flex-col items-center gap-8px">
      <van-loading size="24px" />
      <span class="text-[length:var(--tjg-font-size-md)] text-[--tjg-text-tertiary]">
        {{ loadingText || t('common.loading') }}
      </span>
    </div>
    <slot v-else-if="state === 'empty'" name="empty">
      <van-empty :description="emptyText || t('common.empty')" />
    </slot>
    <van-empty v-else :description="errorText || t('common.load_failed')">
      <p v-if="errorDetail" class="mt-4px text-[length:var(--tjg-font-size-sm)] text-[--tjg-text-tertiary] break-all">
        {{ errorDetail }}
      </p>
      <van-button
        size="small"
        type="primary"
        plain
        class="mt-12px"
        data-test="async-state-retry"
        @click="emit('retry')">
        {{ t('common.retry') }}
      </van-button>
    </van-empty>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'MobileAsyncState' })

withDefaults(
  defineProps<{
    /** 四态：就绪时才渲染默认插槽 */
    state: 'loading' | 'error' | 'empty' | 'ready'
    /** 错误说明，缺省用通用文案 */
    errorText?: string
    /** 错误明细（原始原因），仅错误态渲染 */
    errorDetail?: string
    /** 空态说明，缺省用通用文案 */
    emptyText?: string
    /** 加载中文案，缺省用 common.loading */
    loadingText?: string
    /** 非就绪态的最小高度 */
    minHeight?: string
    /** 覆盖根节点 data-test（保持既有测试选择器） */
    testId?: string
  }>(),
  {
    errorText: '',
    errorDetail: '',
    emptyText: '',
    loadingText: '',
    minHeight: '200px',
    testId: ''
  }
)

const emit = defineEmits<(e: 'retry') => void>()

const { t } = useI18n()
</script>
