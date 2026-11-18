<template>
  <div class="service-row">
    <div class="service-main">
      <div class="service-title">
        <span class="service-name">{{ name }}</span>
        <slot name="tags" />
      </div>
      <p class="service-meta">
        <span v-for="item in meta" :key="item">{{ item }}</span>
      </p>
      <p v-if="errorText" class="service-error">{{ errorText }}</p>
    </div>
    <div class="service-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 外部服务条目（服务列表与客户端列表共用）：只负责排布名称/标签/元信息/操作区，
 * 具体标签与操作按钮由调用方通过插槽提供，避免两处重复同一套栅格样式。
 */
defineProps<{
  name: string
  meta: string[]
  errorText?: string | null | undefined
}>()
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.service-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tjg-space-4);
  width: 100%;
}

.service-main {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1, 4px);
  min-width: 0;
}

.service-title {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  flex-wrap: wrap;
}

.service-name {
  font-size: var(--tjg-font-size-base, 14px);
  font-weight: var(--tjg-font-weight-medium, 500);
  color: var(--tjg-text-primary);
}

.service-meta {
  display: flex;
  gap: var(--tjg-space-4);
  margin: 0;
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-text-secondary);
  flex-wrap: wrap;
}

.service-error {
  margin: 0;
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-status-offline);
  word-break: break-word;
}

.service-actions {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  flex-shrink: 0;
}

@include responsive.down('md') {
  .service-row {
    flex-direction: column;
    align-items: stretch;
  }

  .service-actions {
    justify-content: flex-end;
  }
}
</style>
