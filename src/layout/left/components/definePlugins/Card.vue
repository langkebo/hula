<template>
  <div>
    <n-scrollbar style="max-height: 280px">
      <n-flex :size="26" class="z-10 p-[18px_18px_36px_18px] box-border w-full">
        <template v-for="(plugin, index) in allPlugins" :key="index">
          <Transition name="state-change" mode="out-in">
            <!-- 未安装和下载中状态 -->
            <n-flex
              v-if="plugin.state === PluginEnum.NOT_INSTALLED || plugin.state === PluginEnum.DOWNLOADING"
              vertical
              justify="center"
              align="center"
              :size="8"
              :class="{ 'filter-shadow': settingStore.pageShadowEnabled }"
              class="box bg-[--plugin-bg-color]">
              <svg class="size-38px color-[--hula-text-quaternary]">
                <use :href="`#${plugin.icon}`"></use>
              </svg>
              <p class="text-[var(--text-xs)] text-[--hula-text-secondary]">{{ plugin.title }}</p>

              <!-- 在下载中进度条 -->
              <n-flex
                @click="handleState(plugin)"
                class="relative rounded-22px border-(1px solid [--hula-color-info-500])"
                :class="[
                  plugin.state === PluginEnum.DOWNLOADING ? 'downloading' : 'bg-[--progress-bg] size-fit p-[4px_8px]'
                ]">
                <div
                  :style="{
                    width: plugin.state === PluginEnum.DOWNLOADING ? `${plugin?.progress * 0.8}px` : 'auto'
                  }"
                  :class="[
                    plugin?.progress < 100 ? 'rounded-l-24px rounded-r-0' : 'rounded-24px',
                    plugin?.progress > 0 ? 'h-18px border-(1px solid transparent)' : 'h-20px'
                  ]"
                  v-if="plugin.state === PluginEnum.DOWNLOADING"
                  class="bg-[--hula-color-info-400]">
                  <p class="absolute-center text-[var(--text-xs)] text-[--hula-color-info-500]">
                    {{ plugin?.progress }}%
                  </p>
                </div>

                <p v-else class="text-[var(--text-xs)] text-[--hula-color-info-500] text-center">
                  {{ t('home.plugins.actions.install') }}
                </p>
              </n-flex>

              <!-- 闪光效果 -->
              <div class="flash"></div>
            </n-flex>

            <!-- 可卸载状态或内置插件状态 -->
            <n-flex
              v-else
              vertical
              justify="center"
              align="center"
              :size="8"
              class="box"
              :class="[
                plugin.state === PluginEnum.BUILTIN
                  ? 'built'
                  : plugin.state === PluginEnum.UNINSTALLING
                    ? 'unload'
                    : 'colorful',
                {
                  'filter-shadow': settingStore.pageShadowEnabled
                }
              ]">
              <svg class="size-38px color-[--hula-text-secondary]">
                <use :href="`#${plugin.iconAction || plugin.icon}`"></use>
              </svg>
              <p class="text-[var(--text-xs)] text-[--hula-text-secondary]">{{ plugin.title }}</p>

              <n-flex
                v-if="plugin.state === PluginEnum.UNINSTALLING"
                class="relative rounded-22px border-(1px solid [--hula-color-danger-500]) bg-[--hula-color-danger-100] p-[4px_8px]">
                <p class="text-[var(--text-xs)] text-[--hula-color-danger-500] text-center">
                  {{ t('home.plugins.status.uninstalling') }}
                </p>
              </n-flex>

              <n-flex
                v-if="plugin.state === PluginEnum.BUILTIN"
                class="relative rounded-22px border-(1px solid [--hula-text-tertiary]) bg-[--hula-surface-subtle] size-fit p-[4px_8px]">
                <p class="text-[var(--text-xs)] text-[--hula-text-tertiary] text-center">
                  {{ t('home.plugins.status.builtin') }}
                </p>
              </n-flex>

              <n-flex
                v-if="plugin.state === PluginEnum.INSTALLED"
                class="relative rounded-22px border-(1px solid [--hula-color-info-500]) bg-[--hula-color-info-100] p-[4px_8px]">
                <p class="text-[var(--text-xs)] text-[--hula-color-info-500] text-center">{{ plugin.version }}</p>
              </n-flex>

              <!-- 闪光效果 -->
              <div class="flash"></div>

              <Transition>
                <svg
                  v-if="plugin.isAdd && plugin.state !== PluginEnum.BUILTIN"
                  class="absolute color-[--hula-text-secondary] left-2px top-2px size-14px">
                  <use href="#notOnTop"></use>
                </svg>
              </Transition>

              <!-- 插件操作 -->
              <n-popover
                v-if="plugin.state === PluginEnum.INSTALLED || index === isCurrently"
                :show="isCurrently === index"
                style="padding: 0"
                :show-arrow="false"
                trigger="click"
                placement="bottom">
                <template #trigger>
                  <svg
                    @click.stop="isCurrently = index"
                    class="absolute color-[--hula-text-secondary] right-0 top-0 size-18px rotate-90">
                    <use href="#more"></use>
                  </svg>
                </template>

                <div class="action-item">
                  <div class="menu-list">
                    <div v-if="!plugin.isAdd" @click="handleAdd(plugin)" class="menu-item">
                      <svg class="color-[--hula-color-info-500]">
                        <use href="#add"></use>
                      </svg>
                      <p class="text-[--hula-color-info-500]">{{ t('home.plugins.actions.pin') }}</p>
                    </div>
                    <div v-else @click="handleDelete(plugin)" class="menu-item">
                      <svg class="color-[--hula-color-danger-500]">
                        <use href="#reduce"></use>
                      </svg>
                      <p class="text-[--hula-color-danger-500]">{{ t('home.plugins.actions.unpin') }}</p>
                    </div>
                    <div @click="handleUnload(plugin)" class="menu-item">
                      <svg>
                        <use href="#delete"></use>
                      </svg>
                      <p>{{ t('home.plugins.actions.uninstall') }}</p>
                    </div>
                  </div>
                </div>
              </n-popover>
            </n-flex>
          </Transition>
        </template>
      </n-flex>
    </n-scrollbar>
  </div>
</template>
<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { cloneDeep } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { PluginEnum } from '@/enums'
import { usePluginsList } from '@/layout/left/config.tsx'
import { usePluginsStore } from '@/stores/domains/settings/plugins'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useTimerManager } from '@/utils/TimerManager'

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const settingStore = useSettingStore()
const pluginsStore = usePluginsStore()
const pluginsList = usePluginsList()
const timerManager = useTimerManager()
const { plugins } = storeToRefs(pluginsStore)
const isCurrently = ref(-1)
const allPlugins = ref([] as STO.Plugins<PluginEnum>[])
const pluginsLists = ref<STO.Plugins<PluginEnum>[]>(cloneDeep(pluginsList.value))

// 同步插件状态
const syncPlugins = (list: STO.Plugins<PluginEnum>[]) =>
  list.map((item: STO.Plugins<PluginEnum>) => {
    const matched = plugins.value.find((z: STO.Plugins<PluginEnum>) => z.url === item.url)
    return matched
      ? {
          ...item,
          state: matched.state,
          isAdd: matched.isAdd
        }
      : item
  })

const handleState = (plugin: STO.Plugins<PluginEnum>) => {
  if (plugin.state === PluginEnum.INSTALLED) return
  plugin.state = PluginEnum.DOWNLOADING
  const interval = timerManager.setInterval(() => {
    if (plugin.progress < 100) {
      plugin.progress += 50
    } else {
      timerManager.clearInterval(interval)
      plugin.state = PluginEnum.INSTALLED
      plugin.progress = 0
      pluginsStore.addPlugin(plugin)
    }
  }, 500)
}

const handleUnload = (plugin: STO.Plugins<PluginEnum>) => {
  plugin.state = PluginEnum.UNINSTALLING
  timerManager.setTimeout(() => {
    handleDelete(plugin)
    plugin.state = PluginEnum.NOT_INSTALLED
    plugin.progress = 0
    pluginsStore.removePlugin(plugin)
  }, 2000)
}

const handleDelete = (p: STO.Plugins<PluginEnum>) => {
  const plugin = plugins.value.find((i) => i.url === p.url)
  if (plugin) {
    timerManager.setTimeout(() => {
      pluginsStore.updatePlugin({ ...plugin, isAdd: false })
      p.isAdd = false
      emitTo(appWindow.label, 'startResize')
    }, 300)
  }
}

const handleAdd = (p: STO.Plugins<PluginEnum>) => {
  const plugin = plugins.value.find((i) => i.url === p.url)
  if (plugin) {
    timerManager.setTimeout(() => {
      pluginsStore.updatePlugin({ ...plugin, isAdd: true })
      p.isAdd = true
      emitTo(appWindow.label, 'startResize')
    }, 300)
  }
}

const closeMenu = (event: Event) => {
  const e = event.target as HTMLInputElement
  if (!e.matches('.action-item')) {
    isCurrently.value = -1
  }
}

watch(
  pluginsList,
  (latest) => {
    pluginsLists.value = cloneDeep(latest)
    allPlugins.value = syncPlugins(pluginsLists.value)
  },
  { immediate: false }
)

onMounted(() => {
  allPlugins.value = syncPlugins(pluginsLists.value)
  window.addEventListener('click', closeMenu, true)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  timerManager.clearAll()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/variable.scss' as *;
.box {
  @apply relative select-none custom-shadow cursor-pointer size-fit w-100px h-100px rounded-8px overflow-hidden;
  transition: all 0.3s ease-in-out;

  &.state-change-enter-active,
  &.state-change-leave-active {
    transition: all 0.3s ease-in-out;
  }

  &.state-change-enter-from,
  &.state-change-leave-to {
    opacity: 0;
    transform: scale(0.9);
  }

  .flash {
    position: absolute;
    left: -130%;
    top: 0;
    width: 100px;
    height: 100px;
    background-image: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0));
    transform: skew(-30deg);
    pointer-events: none;
  }

  &:hover .flash {
    left: 130%;
    transition: all 0.8s ease-in-out;
  }
}

.downloading {
  width: 80px;
  background: var(--progress-bg);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.action-item {
  @include menu-item-style();
  left: -80px;
  @include menu-list();
}

.colorful {
  background-image: linear-gradient(45deg, #a8edea 0%, #fed6e3 100%);
}

.built {
  background-image: linear-gradient(-20deg, #e9defa 0%, #fbfcdb 100%);
}

.unload {
  background-image: linear-gradient(to top, #feada6 0%, #f5efef 100%);
}

.filter-shadow {
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.2));
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
