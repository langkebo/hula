<template>
  <span :class="['mxid-text', { 'mxid-text--mono': isMono }]" :title="fullMxid" data-testid="mxid-text">
    {{ displayText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Matrix MXID 文本展示组件
 *
 * 负责渲染完整 MXID (@username:server.domain)，支持：
 * - 自动截断 + title 悬浮显示全量
 * - 等宽字体选项
 * - 可配置显示 localpart 或完整 MXID
 *
 * 用法示例：
 * ```vue
 * <MxidText :mxid="userId" :showFull="false" />
 * <!-- 显示 @hulatest (截断，悬浮显示 @hulatest:matrix.test) -->
 * ```
 */

const props = withDefaults(
  defineProps<{
    /** 完整 MXID（如 @user:server.name） */
    mxid?: string | null
    /** 是否显示完整 MXID，否则仅显示 localpart */
    showFull?: boolean
    /** 是否使用等宽字体（便于比对） */
    isMono?: boolean
    /** 最大显示长度（字符数），超出则截断 */
    maxLength?: number
  }>(),
  {
    mxid: null,
    showFull: false,
    isMono: false,
    maxLength: 20
  }
)

/**
 * 从 MXID 中提取 localpart（@user:server.name → user）
 */
function extractLocalpart(mxid: string): string {
  if (!mxid) return ''
  const trimmed = mxid.trim()
  if (!trimmed.startsWith('@')) return trimmed
  const withoutAt = trimmed.slice(1)
  const colonIdx = withoutAt.indexOf(':')
  return colonIdx === -1 ? withoutAt : withoutAt.slice(0, colonIdx)
}

/**
 * 从 MXID 中提取 server name（@user:server.name → server.name）
 */
function extractServerName(mxid: string): string {
  if (!mxid) return ''
  const idx = mxid.indexOf(':')
  return idx === -1 ? '' : mxid.slice(idx + 1)
}

/**
 * 显示文本：根据 showFull 决定显示完整 MXID 或仅 localpart
 */
const displayText = computed(() => {
  if (!props.mxid) return ''

  if (props.showFull) {
    const display = props.mxid
    return display.length > props.maxLength ? display.slice(0, props.maxLength - 1) + '\u2026' : display
  } else {
    const localpart = extractLocalpart(props.mxid)
    return localpart.length > props.maxLength ? localpart.slice(0, props.maxLength - 1) + '\u2026' : localpart
  }
})

/**
 * 完整 MXID（用于 title 属性）
 */
const fullMxid = computed(() => props.mxid || '')
</script>

<style scoped lang="scss">
/* ==================== 联邦身份标识 ====================
 * §2.1 — MXID 文本样式
 * 等宽字体便于比对，截断 + title 保证可读性
 * ==================================================== */
.mxid-text {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-identity-mxid-color);
  line-height: 1.2;
}

.mxid-text--mono {
  font-family: var(--tjg-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}
</style>
