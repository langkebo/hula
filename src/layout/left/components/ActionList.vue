<template>
  <div ref="actionList" class="flex-1 mt-20px flex-col-x-center justify-between" data-tauri-drag-region>
    <!-- 上部分操作栏 -->
    <header ref="header" class="flex-col-x-center gap-10px color-[--left-icon-color]">
      <div
        v-for="(item, index) in menuTop"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'top-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        :aria-label="item.title"
        @click="pageJumps(item.url, item.title, item.size, item.window)"
        :title="item.title">
        <!-- 已经打开窗口时展示 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false" aria-hidden="true">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction || item.icon : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} {{ t('home.action.opened') }}</p>
        </n-popover>
        <!-- 该选项有提示时展示 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge" dot :show="item.dot">
              <svg class="size-22px" @click="handleTipShow(item)" aria-hidden="true">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="handleTipShow(item)" class="size-12px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 该选项无提示时展示 -->
        <n-badge v-else :max="99" :value="getMenuBadgeValue(item.url)" :show="getMenuBadgeShow(item.url)">
          <svg class="size-22px" aria-hidden="true">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="text-[var(--text-xs)] text-center">
          {{ item.shortTitle }}
        </p>
      </div>

      <section
        v-if="workspacePlugins.length"
        class="workspace-entry-group"
        :class="showMode === ShowModeEnum.ICON ? 'workspace-entry-group--icon' : 'workspace-entry-group--text'"
        data-test="workspace-entry-group">
        <button
          v-for="item in workspacePlugins"
          :key="item.url"
          type="button"
          :class="[
            'workspace-entry',
            {
              'workspace-entry--active': activeUrl === item.url,
              'workspace-entry--open': openWindowsList.has(item.url),
              'workspace-entry--text': showMode === ShowModeEnum.TEXT,
              'workspace-entry--icon': showMode === ShowModeEnum.ICON
            }
          ]"
          :title="item.title"
          :aria-label="item.title"
          @click="pageJumps(item.url, item.title, item.size, item.window)">
          <span class="workspace-entry__indicator" aria-hidden="true"></span>
          <span class="workspace-entry__surface">
            <n-badge class="workspace-entry__badge" :max="99" :value="item.badge" :show="(item.badge ?? 0) > 0">
              <svg class="workspace-entry__icon">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction || item.icon : item.icon}`"></use>
              </svg>
            </n-badge>
            <span v-if="showMode === ShowModeEnum.TEXT" class="workspace-entry__content">
              <span class="workspace-entry__label">{{ item.shortTitle }}</span>
            </span>
          </span>
        </button>
      </section>

      <div
        v-for="(item, index) in noMiniShowPlugins"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'top-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        :aria-label="item.title"
        @click="pageJumps(item.url, item.title, item.size, item.window)"
        :title="item.title">
        <!-- 已经打开窗口时展示 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false" aria-hidden="true">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction || item.icon : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} {{ t('home.action.opened') }}</p>
        </n-popover>
        <!-- 该选项有提示时展示 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge" dot :show="item.dot">
              <svg class="size-22px" @click="handleTipShow(item)" aria-hidden="true">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="handleTipShow(item)" class="size-12px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 该选项无提示时展示 -->
        <n-popover v-else :show-arrow="false" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge" :show="(item.badge ?? 0) > 0">
              <svg class="size-22px" aria-hidden="true">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction || item.icon : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }}</p>
        </n-popover>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="text-[var(--text-xs)] text-center">
          {{ item.shortTitle }}
        </p>
      </div>

      <!-- (独立)菜单选项 -->
      <div
        :class="showMode === ShowModeEnum.ICON ? 'top-action p-[6px_8px]' : 'top-action w-46px py-4px flex-col-center'">
        <n-popover
          style="padding: 8px; margin-left: 4px; background: var(--tjg-surface-elevated)"
          :show-arrow="false"
          trigger="hover"
          placement="right">
          <template #trigger>
            <svg class="size-22px">
              <use href="#menu"></use>
            </svg>
          </template>
          <div v-if="miniShowPlugins.length">
            <n-flex
              v-for="(item, index) in miniShowPlugins"
              :key="'excess-' + index"
              @click="pageJumps(item.url, item.title, item.size, item.window)"
              class="p-[6px_5px] rounded-4px cursor-pointer hover:bg-[--setting-item-line]"
              :size="5">
              <svg class="size-16px" @click="tipShow = false">
                <use :href="`#${item.icon}`"></use>
              </svg>
              {{ item.title }}
            </n-flex>
          </div>
          <n-flex
            @click="menuShow = true"
            class="p-[6px_5px] rounded-4px cursor-pointer hover:bg-[--setting-item-line]"
            :size="5">
            <svg class="size-16px">
              <use href="#settings"></use>
            </svg>
            <!-- <span class="select-none">插件管理</span> -->
            {{ t('home.action.plugin_manage') }}
          </n-flex>
        </n-popover>
        <p v-if="showMode === ShowModeEnum.TEXT" class="text-[var(--text-xs)] text-center">
          {{ t('home.action.plugin') }}
        </p>
      </div>
    </header>

    <!-- 下部分操作栏 -->
    <footer class="flex-col-x-center mt-10px gap-10px color-[--left-icon-color] select-none">
      <div
        v-for="(item, index) in itemsBottom"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'bottom-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        :aria-label="item.title"
        @click="pageJumps(item.url, item.title, item.size, item.window)"
        :title="item.title">
        <!-- 已经打开窗口时展示 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false" aria-hidden="true">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} {{ t('home.action.opened') }}</p>
        </n-popover>
        <!-- 该选项有提示时展示 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false" aria-hidden="true">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="tipShow = false" class="size-12px cursor-pointer" aria-hidden="true">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 该选项无提示时展示 -->
        <n-badge v-else :max="99" :value="item.badge">
          <svg class="size-22px" aria-hidden="true">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="menu-text text-[var(--text-xs)] text-center">
          {{ item.shortTitle }}
        </p>
      </div>

      <!--  更多选项面板  -->
      <div
        :title="t('home.action.more')"
        :aria-label="t('home.action.more')"
        :class="{ 'bottom-action py-4px': showMode === ShowModeEnum.TEXT }">
        <n-popover
          v-model:show="settingShow"
          style="padding: 0; background: transparent; user-select: none"
          :show-arrow="false"
          trigger="click">
          <template #trigger>
            <svg
              :class="[
                { 'color-[--left-active-hover]': settingShow },
                showMode === ShowModeEnum.ICON ? 'more p-[6px_8px]' : 'w-46px'
              ]"
              class="size-22px relative"
              @click="settingShow = !settingShow">
              <use :href="settingShow ? '#hamburger-button-action' : '#hamburger-button'"></use>
            </svg>
          </template>
          <div class="setting-item">
            <div class="menu-list">
              <div v-for="(item, index) in moreList" :key="index">
                <div class="menu-item" @click="() => item.click()">
                  <svg>
                    <use :href="`#${item.icon}`"></use>
                  </svg>
                  {{ item.label }}
                </div>
              </div>
            </div>
          </div>
        </n-popover>
        <p v-if="showMode === ShowModeEnum.TEXT" class="text-[var(--text-xs)] text-center">
          {{ t('home.action.more') }}
        </p>
      </div>
    </footer>
  </div>

  <DefinePlugins v-model="menuShow" />

  <HomeserverDialog v-model:show="showHomeserverDialog" @save="handleHomeserverSave" />
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import HomeserverDialog from '@/components/common/HomeserverDialog.vue'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { PluginEnum, ShowModeEnum } from '@/enums'
import { useMenuTopStore } from '@/stores/domains/settings/menuTop'
import { usePluginsStore } from '@/stores/domains/settings/plugins'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { useItemsBottom, useMoreList } from '../config.tsx'
import { leftHook } from '../hook.ts'
import DefinePlugins from './definePlugins/index.vue'

const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const { addListener } = useTauriListener()
const globalStore = useGlobalStore()
const pluginsStore = usePluginsStore()
const { showMode } = storeToRefs(useSettingStore())
const { menuTop } = storeToRefs(useMenuTopStore())
const itemsBottom = useItemsBottom()
const { plugins } = storeToRefs(pluginsStore)
const { t } = useI18n()
const unreadReady = computed(() => globalStore.unreadReady)
const messageUnreadCount = computed(() => globalStore.messageUnreadCount)
// const headerRef = useTemplateRef('header')
// const actionListRef = useTemplateRef('actionList')
//const { } = toRefs(getCurrentInstance) // 所有菜单的外层div
const menuShow = ref(false)
const { moreList, showHomeserverDialog, handleHomeserverSave } = useMoreList()
const WORKBENCH_PLUGIN_URLS = new Set(['roomList', 'space'])
// 显示在菜单的插件
const activePlugins = computed(() => {
  return plugins.value.filter((i) => i.isAdd)
})
const workspacePlugins = computed(() => {
  return activePlugins.value.filter((item) => WORKBENCH_PLUGIN_URLS.has(item.url))
})
// 显示在菜单外的插件
const noMiniShowPlugins = computed(() => {
  return activePlugins.value.filter((item) => !item.miniShow && !WORKBENCH_PLUGIN_URLS.has(item.url))
})
// 显示在菜单内的插件
const miniShowPlugins = computed(() => {
  return activePlugins.value.filter((item) => item.miniShow && !WORKBENCH_PLUGIN_URLS.has(item.url))
})
const { activeUrl, openWindowsList, settingShow, tipShow, pageJumps } = leftHook()

const handleTipShow = (item: { dot?: boolean }) => {
  tipShow.value = false
  item.dot = false
}

const unreadApplyCount = computed(() => {
  return globalStore.contactUnreadCount
})

const getMenuBadgeValue = (url: string) => {
  if (url === 'message') return messageUnreadCount.value
  if (url === 'friendsList') return unreadApplyCount.value
  return undefined
}

const getMenuBadgeShow = (url: string) => {
  if (!unreadReady.value) return false
  if (url === 'message') return messageUnreadCount.value > 0
  if (url === 'friendsList') return unreadApplyCount.value > 0
  return false
}

const startResize = () => {
  window.dispatchEvent(new Event('resize'))
}

const handleResize = async (e: Event) => {
  const windowHeight = (e.target as Window).innerHeight
  const menuDivHeight = showMode.value === ShowModeEnum.TEXT ? 46 : 34
  const spaceHeight = 10
  const newMenuHeight = menuDivHeight + spaceHeight
  const headerTopHeight = 120
  const bottomPadding = 15
  const randomHeight = 3 // 插件菜单的高度比其他菜单高2.66666666667
  const staticMenuNum = 2
  const workspaceEntryCount = workspacePlugins.value.length
  const menuNum = Math.floor(
    (windowHeight -
      (menuTop.value.length +
        workspaceEntryCount +
        noMiniShowPlugins.value.length +
        itemsBottom.value.length +
        staticMenuNum) *
        menuDivHeight -
      (menuTop.value.length +
        workspaceEntryCount +
        noMiniShowPlugins.value.length +
        itemsBottom.value.length +
        staticMenuNum -
        1) *
        spaceHeight -
      headerTopHeight -
      bottomPadding -
      randomHeight) /
      newMenuHeight
  )
  if (menuNum < 0) {
    noMiniShowPlugins.value.map((i, index) => {
      if (index >= noMiniShowPlugins.value.length + menuNum) {
        pluginsStore.updatePlugin({ ...i, miniShow: true })
      }
    })
  } else if (menuNum >= 0 && miniShowPlugins.value.length > 0) {
    miniShowPlugins.value.map((i, index) => {
      if (index < menuNum) {
        pluginsStore.updatePlugin({ ...i, miniShow: false })
      }
    })
  }
}

/** 调整主界面高度 */
const setHomeHeight = () => {
  invokeSilently('set_height', { height: showMode.value === ShowModeEnum.TEXT ? 505 : 423 })
}

onMounted(async () => {
  // 初始化窗口高度
  setHomeHeight()

  // 监听窗口大小变化事件，处理菜单收起
  window.addEventListener('resize', handleResize)

  // 触发一次resize事件，调整插件菜单的显示
  startResize()

  // 监听自定义事件，处理设置中菜单显示模式切换和添加插件后，导致高度变化，需重新调整插件菜单显示
  if (appWindow) {
    await addListener(
      appWindow.listen('startResize', () => {
        startResize()
      }),
      'startResize'
    )
  }

  if (tipShow.value) {
    menuTop.value.filter((item) => {
      if (item.state !== PluginEnum.BUILTIN) {
        item.dot = true
      }
    })
  }
  /** 十秒后关闭提示 */
  setTimeout(() => {
    tipShow.value = false
  }, 5000)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>
<style lang="scss" scoped>
@use '../style';

.setting-item {
  left: 24px;
  bottom: -40px;
}

.workspace-entry-group {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 4px 0;
}

.workspace-entry-group--icon {
  align-items: center;
  gap: 6px;
}

.workspace-entry-group--text {
  gap: 4px;
}

.workspace-entry {
  position: relative;
  display: flex;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--left-icon-color);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    color 0.2s ease;
}

.workspace-entry:focus-visible {
  outline: none;
}

.workspace-entry__indicator {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 18px;
  border-radius: 999px;
  background: var(--left-active-hover);
  opacity: 0;
  transform: translateY(-50%) scaleY(0.4);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.workspace-entry__surface {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 12px;
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease;
}

.workspace-entry__badge {
  display: inline-flex;
  flex-shrink: 0;
}

.workspace-entry:hover .workspace-entry__surface,
.workspace-entry:focus-visible .workspace-entry__surface {
  background: var(--left-bg-hover);
  color: var(--left-active-hover);
}

.workspace-entry--active .workspace-entry__surface {
  background: var(--left-active-bg-color);
  color: var(--left-active-icon-color);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--left-active-hover) 16%, transparent);
}

.workspace-entry--open:not(.workspace-entry--active) .workspace-entry__surface {
  color: var(--left-win-icon-color);
}

.workspace-entry--active .workspace-entry__indicator {
  opacity: 1;
  transform: translateY(-50%) scaleY(1);
}

.workspace-entry--icon {
  justify-content: center;
}

.workspace-entry--icon .workspace-entry__surface {
  justify-content: center;
  width: auto;
  padding: 8px;
}

.workspace-entry--icon .workspace-entry__indicator {
  left: 2px;
}

.workspace-entry--text .workspace-entry__surface {
  padding-left: 12px;
}

.workspace-entry__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.workspace-entry__content {
  display: flex;
  min-width: 0;
  flex: 1;
}

.workspace-entry__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}
</style>
