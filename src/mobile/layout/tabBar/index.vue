<template>
  <div class="tab-bar-wrap" :class="{ 'tab-bar-wrap--vertical': vertical }">
    <!-- 材质层与内容分离：避免 TjGlass 的 overflow:hidden 裁掉角标与选中态阴影 -->
    <TjGlass variant="panel" tone="tabbar" class="tab-bar-glass" />
    <nav
      class="tab-bar flex items-end"
      :class="vertical ? 'flex-col justify-around' : 'justify-around'"
      :aria-label="t('mobile_tabbar.aria_label')">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :data-testid="item.testId"
        :aria-label="item.label"
        :aria-current="route.path === item.path ? 'page' : undefined"
        class="tab-item flex flex-col items-center no-underline relative min-h-48px justify-center"
        :class="[
          vertical ? 'w-full' : 'flex-1',
          route.path === item.path ? 'color-[--tjg-color-primary-500]' : 'text-[--tjg-text-tertiary]'
        ]"
        @click="handleNavigate(item.path)">
        <van-badge
          class="flex flex-col w-full flex-1 relative items-center justify-center"
          :offset="[-6, 6]"
          color="var(--tjg-color-danger-500)"
          :content="getUnReadCount(item) || ''"
          :max="99">
          <span class="tab-item__icon">
            <svg class="w-24px h-24px">
              <use :href="`#${route.path === item.path ? item.actionIcon : item.icon}`"></use>
            </svg>
          </span>
          <span class="tab-item__label">{{ item.label }}</span>
        </van-badge>
      </RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { startRenderSample } from '@/utils/AppHarness'
import { type MobileNavItem, resolveNavItems } from './navItems'

const props = withDefaults(
  defineProps<{
    /** 横屏时启用垂直布局（侧边栏模式） */
    vertical?: boolean
  }>(),
  { vertical: false }
)

const { t } = useI18n()
const route = useRoute()
const globalStore = useGlobalStore()

const getUnReadCount = (item: MobileNavItem) => {
  if (item.unreadKey === 'messageUnreadCount') {
    return globalStore.messageUnreadCount
  }
  if (item.unreadKey === 'contactUnreadCount') {
    return globalStore.contactUnreadCount
  }
  return 0
}

const handleNavigate = (path: string) => {
  if (path === '/mobile/space') {
    startRenderSample('mobile-space-view', {
      route: path,
      meta: { source: 'tab-bar' }
    })
  }
}

const navItems = computed(() => resolveNavItems(t))
</script>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.tab-bar-wrap {
  position: relative;
  isolation: isolate;
  /* 透明容器，让页面上滑内容透到玻璃标签栏下方 */
  background: transparent;
}

/* 材质层：模糊 / 染色 / 投影沿用 .tjg-glass--tabbar 的设计值，
   通过叠加 .tj-glass 压过 TjGlass 内置 panel 底色（含深色覆写） */
.tab-bar-wrap .tab-bar-glass.tj-glass {
  position: absolute;
  inset: 0;
  z-index: 0;
  border: 0;
  border-radius: var(--tjg-radius-2xl) var(--tjg-radius-2xl) 0 0;
  background: var(--tjg-glass-tabbar-bg);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-strong));
  backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-strong));
  box-shadow: var(--tjg-glass-shadow-strong), var(--tjg-glass-inner-highlight);
  @include backdrop-blur-fallback;
}

@media (prefers-reduced-transparency: reduce) {
  .tab-bar-wrap .tab-bar-glass.tj-glass {
    background: var(--tjg-surface-elevated);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

/* 中配设备：strong 档模糊降为 medium 档 */
html.medium-perf .tab-bar-wrap .tab-bar-glass.tj-glass {
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-medium)) saturate(var(--tjg-glass-saturate-strong));
  backdrop-filter: blur(var(--tjg-glass-blur-medium)) saturate(var(--tjg-glass-saturate-strong));
}

.tab-bar {
  position: relative;
  z-index: 1;
  min-height: 62px;
  padding-top: 6px;
  padding-bottom: var(--safe-area-inset-bottom, 0px);
}

.tab-item {
  gap: 2px;
  min-width: 44px;
  /* 触摸热区 >= 48x48px，配合 min-h-48px 确保可点击区域 */
  min-height: 48px;
  font-size: var(--tjg-font-size-2xs);
  /* 安全区统一由 .tab-bar 承担，item 不再重复叠加 */
  padding-bottom: 0;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* 选中态：图标托在玻璃胶囊上，形成清晰的层级焦点 */
.tab-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 30px;
  border-radius: var(--tjg-radius-full);
  transition:
    background-color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-enter),
    box-shadow var(--tjg-motion-duration-normal) var(--tjg-motion-ease-enter);
}

.tab-item[aria-current='page'] .tab-item__icon {
  background-color: var(--tjg-glass-tint-strong);
  box-shadow:
    inset 0 0 0 1px var(--tjg-glass-border-color),
    var(--tjg-glass-inner-highlight),
    var(--tjg-glass-shadow-soft);
}

.tab-item__label {
  line-height: 1.2;
  transition: color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);
}

.tab-item[aria-current='page'] .tab-item__label {
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .tab-item__icon,
  .tab-item__label {
    transition: none;
  }
}

/* 横屏垂直布局（侧边栏模式） */
.tab-bar-wrap--vertical {
  width: 72px;
  height: 100%;
  display: flex;
  flex-direction: row;
  padding-left: var(--safe-area-inset-left, 0px);
  padding-bottom: 0;

  /* 垂直模式贴合屏幕左缘：圆角只留右侧 */
  .tab-bar-glass.tj-glass {
    border-radius: 0 var(--tjg-radius-2xl) var(--tjg-radius-2xl) 0;
  }

  /* 需 !important：覆盖 Vant Tabbar 的横向 flex 默认值 */
  .tab-bar {
    height: 100%;
    width: 100%;
    flex-direction: column !important;
    /* 横屏安全区改由 padding-left 承担，底部不再叠加安全区 */
    padding-bottom: 0;
  }

  .tab-item {
    padding-bottom: 0;
    padding-top: var(--safe-area-inset-top, 0);
  }
}
</style>
