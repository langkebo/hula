<template>
  <van-popup v-model:show="showModel" class="rounded-t-20px! overflow-hidden" position="bottom" round>
    <van-area
      v-model="valueModel"
      :area-list="areaList"
      :cancel-button-text="t('components.common.cancel')"
      :confirm-button-text="t('components.common.confirm')"
      @cancel="onCancel"
      @change="onChange"
      @confirm="onConfirm" />
  </van-popup>
</template>

<script setup lang="ts">
import { areaList as list } from '@vant/area-data'
import type { AreaList } from 'vant'
import { useI18n } from 'vue-i18n'

interface AreaProps {
  areaList?: AreaList
}

interface Events {
  // biome-ignore lint/suspicious/noExplicitAny: Vant Area event callbacks pass through arbitrary payloads; callers define their own signatures.
  onChange?: ((...args: any[]) => any) | undefined
  // biome-ignore lint/suspicious/noExplicitAny: see above
  'onUpdate:modelValue'?: ((...args: any[]) => any) | undefined
  // biome-ignore lint/suspicious/noExplicitAny: see above
  onCancel?: ((...args: any[]) => any) | undefined
  // biome-ignore lint/suspicious/noExplicitAny: see above
  onConfirm?: ((...args: any[]) => any) | undefined
}

type Props = AreaProps & Events

const showModel = defineModel<boolean>('show', { default: false })
const valueModel = defineModel<string>('value', { default: '' })

const { areaList = list } = defineProps<Props>()

const { t } = useI18n()
</script>
