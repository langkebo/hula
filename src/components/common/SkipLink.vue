<template>
  <a
    href="#"
    class="skip-link"
    data-test="skip-link"
    @focus="isVisible = true"
    @blur="isVisible = false"
    @click.prevent="activate"
    @keydown.enter.prevent="activate"
    @keydown.space.prevent="activate">
    {{ label }}
  </a>
</template>

<script setup lang="ts">
/**
 * SkipLink — 键盘跳转链接（a11y D2/G7）
 *
 * 常态视觉隐藏（移出视口顶部），:focus 时滑入可见。
 * 点击/Enter/Space 触发：聚焦目标元素 + scrollIntoView。
 *
 * 用法：`<SkipLink target="#chat-main" :label="t('common.skip_to_chat')" />`
 * 目标容器需声明 `id` 与 `tabindex="-1"` 以接收焦点。
 */
interface Props {
  /** 目标元素的 CSS 选择器，例如 "#chat-main" */
  target: string
  /** 链接显示文案（已翻译） */
  label: string
}

const props = defineProps<Props>()

const isVisible = ref(false)

const activate = () => {
  if (typeof document === 'undefined') return
  const el = document.querySelector<HTMLElement>(props.target)
  if (!el) return
  // tabindex="-1" 的元素可通过 programmatic focus 获焦
  el.focus()
  el.scrollIntoView({ block: 'start', behavior: 'auto' })
}
</script>

<style scoped>
.skip-link {
  position: fixed;
  top: -40px;
  left: 8px;
  z-index: 10000;
  padding: 8px 16px;
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-color-primary-600);
  color: var(--tjg-text-inverse);
  font-size: 13px;
  line-height: 1.4;
  text-decoration: none;
  transition: top 0.15s ease;
}

.skip-link:focus,
.skip-link:focus-visible {
  top: 8px;
  outline: 2px solid var(--tjg-text-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .skip-link {
    transition: none;
  }
}
</style>
