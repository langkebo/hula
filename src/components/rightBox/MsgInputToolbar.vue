<template>
  <!-- 桌面端工具栏 -->
  <div
    class="flex-shrink-0 px-2 py-1 flex items-center gap-2 border-t border-[--tjg-border-layout-divider]">
    <!-- 位置共享 -->
    <n-tooltip trigger="hover">
      <template #trigger>
        <n-button quaternary size="small" @click="$emit('showLocationModal')">
          <template #icon>
            <svg class="w-18px h-18px">
              <use href="#location"></use>
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('message.location.share') || '位置共享' }}
    </n-tooltip>

    <!-- Beacon 信标 -->
    <n-tooltip trigger="hover">
      <template #trigger>
        <n-button quaternary size="small" @click="$emit('handleBeaconClick')">
          <template #icon>
            <svg class="w-18px h-18px">
              <use href="#signal"></use>
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('message.beacon.share') || '发送信标' }}
    </n-tooltip>

    <!-- 文件上传 -->
    <n-tooltip trigger="hover">
      <template #trigger>
        <n-button quaternary size="small" @click="$emit('handleFileUploadClick')">
          <template #icon>
            <svg class="w-18px h-18px">
              <use href="#image"></use>
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('editor.upload_file') || '上传文件' }}
    </n-tooltip>
  </div>

  <!-- 桌面端发送按钮 -->
  <div
    class="flex-shrink-0 max-h-52px p-4px pr-12px border-t border-[--tjg-border-layout-divider] flex justify-end mb-4px">
    <n-button-group size="small">
      <n-button
        type="primary"
        :disabled="isAIMode && isAIStreaming ? false : disabledSend"
        class="w-65px"
        @click="$emit('handleDesktopSend')">
        {{ isAIMode && isAIStreaming ? '停止思考' : t('editor.send') }}
      </n-button>
      <n-button type="primary" class="p-[0_6px]">
        <template #icon>
          <n-popselect
            v-model:show="arrowLocal"
            v-model:value="chatKeyLocal"
            :options="sendOptions"
            trigger="click"
            placement="top-end">
            <svg @click="arrowLocal = true" v-if="!arrowLocal" class="w-22px h-22px mt-2px outline-none">
              <use href="#down"></use>
            </svg>
            <svg @click="arrowLocal = false" v-else class="w-22px h-22px mt-2px outline-none">
              <use href="#up"></use>
            </svg>
            <template #action>
              <n-flex
                justify="center"
                align="center"
                :size="4"
                class="text-(12px [--tjg-text-tertiary]) cursor-default tracking-1 select-none">
                <i18n-t keypath="editor.send_or_newline">
                  <template #send>
                    <span v-if="chatKeyLocal !== 'Enter'">
                      {{ isMac() ? MacOsKeyEnum['⌘'] : WinKeyEnum.CTRL }}
                    </span>
                    <svg class="size-12px">
                      <use href="#Enter"></use>
                    </svg>
                  </template>
                  <template #newline>
                    <n-flex align="center" :size="0">
                      {{ isMac() ? MacOsKeyEnum['⇧'] : WinKeyEnum.SHIFT }}
                      <svg class="size-12px">
                        <use href="#Enter"></use>
                      </svg>
                    </n-flex>
                  </template>
                </i18n-t>
              </n-flex>
            </template>
          </n-popselect>
        </template>
      </n-button>
    </n-button-group>
  </div>
</template>

<script setup lang="ts">
import { I18nT, useI18n } from 'vue-i18n'
import { MacOsKeyEnum, WinKeyEnum } from '@/enums'
import { isMac } from '@/utils/PlatformConstants'

const props = defineProps<{
  disabledSend: boolean
  isAIMode: boolean
  isAIStreaming: boolean
  arrow: boolean
  chatKey: string
  sendOptions: { label: string; value: string }[]
}>()

const emit = defineEmits<{
  (event: 'update:arrow', value: boolean): void
  (event: 'update:chatKey', value: string): void
  (event: 'showLocationModal'): void
  (event: 'handleBeaconClick'): void
  (event: 'handleFileUploadClick'): void
  (event: 'handleDesktopSend'): void
}>()

const { t } = useI18n()

const arrowLocal = computed({
  get: () => props.arrow,
  set: (v: boolean) => emit('update:arrow', v)
})

const chatKeyLocal = computed({
  get: () => props.chatKey,
  set: (v: string) => emit('update:chatKey', v)
})
</script>
