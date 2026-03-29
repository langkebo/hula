<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.sidebar.layout') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.sidebar.show_avatar') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="showAvatar" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.sidebar.show_collapsed') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="showCollapsed" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.sidebar.show_drag') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="showDrag" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.sidebar.show_icons_only') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="showIconsOnly" />
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.sidebar.sort_by') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-radio-group v-model:value="sortBy">
            <n-flex :size="16" vertical>
              <n-radio value="recent">
                <span>{{ t('setting.sidebar.sort_options.recent') }}</span>
              </n-radio>
              <n-radio value="alphabetical">
                <span>{{ t('setting.sidebar.sort_options.alphabetical') }}</span>
              </n-radio>
              <n-radio value="manual">
                <span>{{ t('setting.sidebar.sort_options.manual') }}</span>
              </n-radio>
            </n-flex>
          </n-radio-group>
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.sidebar.list_item_size') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-radio-group v-model:value="listItemSize">
            <n-flex :size="16">
              <n-radio value="small">
                <span>{{ t('setting.sidebar.size_small') }}</span>
              </n-radio>
              <n-radio value="medium">
                <span>{{ t('setting.sidebar.size_medium') }}</span>
              </n-radio>
              <n-radio value="large">
                <span>{{ t('setting.sidebar.size_large') }}</span>
              </n-radio>
            </n-flex>
          </n-radio-group>
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { NSwitch, NRadio, NRadioGroup, NFlex } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const showAvatar = ref(true)
const showCollapsed = ref(true)
const showDrag = ref(true)
const showIconsOnly = ref(false)
const sortBy = ref('recent')
const listItemSize = ref('medium')
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}
</style>
