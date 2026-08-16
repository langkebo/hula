<template>
  <Teleport to="body">
    <Transition name="rj-drawer-fade">
      <div
        v-if="show"
        class="rj-drawer-overlay"
        @click.self="handleClose"
        @keydown.esc="handleClose">
        <Transition name="rj-drawer-slide" appear>
          <aside
            v-if="show"
            class="rj-drawer"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            :style="{ width }">
            <header class="rj-drawer__header">
              <span class="rj-drawer__title">{{ title }}</span>
              <button type="button" class="rj-drawer__close" :aria-label="t('common.close')" @click="handleClose">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </header>

            <div class="rj-drawer__body">
              <slot />
            </div>

            <footer v-if="$slots.footer" class="rj-drawer__footer">
              <slot name="footer" />
            </footer>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    show: boolean
    title: string
    width?: string
  }>(),
  {
    width: '480px'
  }
)

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()

const handleClose = () => {
  emit('update:show', false)
}
</script>

<style scoped lang="scss">
.rj-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1001;
  background: var(--tjg-overlay-mask-default);
  display: flex;
  justify-content: flex-end;
}

.rj-drawer {
  max-width: 90vw;
  height: 100%;
  background: var(--tjg-surface-panel);
  border-left: 1px solid var(--tjg-border-default);
  box-shadow: var(--tjg-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rj-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--tjg-border-muted);
  flex-shrink: 0;
}

.rj-drawer__title {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.rj-drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--tjg-radius-sm);
  background: transparent;
  color: var(--tjg-text-secondary);
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }
}

.rj-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.rj-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--tjg-border-muted);
  flex-shrink: 0;
}

.rj-drawer-fade-enter-active,
.rj-drawer-fade-leave-active {
  transition: opacity var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
}

.rj-drawer-fade-enter-from,
.rj-drawer-fade-leave-to {
  opacity: 0;
}

.rj-drawer-slide-enter-active,
.rj-drawer-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.rj-drawer-slide-enter-from,
.rj-drawer-slide-leave-to {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .rj-drawer-fade-enter-active,
  .rj-drawer-fade-leave-active,
  .rj-drawer-slide-enter-active,
  .rj-drawer-slide-leave-active {
    transition: none;
  }
}
</style>
