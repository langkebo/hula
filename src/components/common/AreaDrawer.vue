<template>
  <NDrawer
    v-model:show="showModel"
    class="rounded-t-20px! overflow-hidden"
    position="bottom"
    round
    placement="bottom"
    default-height="350px">
    <VantArea
      :area-list="areaList"
      @scroll-into="onScrollInto"
      @cancel="onCancel"
      @change="onChange"
      @confirm="onConfirm"
      v-model="valueModel">
      <template #cancel>
        <n-button strong secondary round>
          {{ t('components.common.cancel') }}
        </n-button>
      </template>

      <template #confirm>
        <n-button strong secondary round type="success">
          {{ t('components.common.confirm') }}
        </n-button>
      </template>
    </VantArea>
  </NDrawer>
</template>

<script setup lang="ts">
import { areaList as list } from '@vant/area-data'
import { NDrawer } from 'naive-ui'
import { type AreaList, Area as VantArea } from 'vant'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const logger = createLogger('AreaDrawer')

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

const showModel = defineModel<boolean>('show')
const valueModel = defineModel<string>('value')

const { areaList = list } = defineProps<Props>()

const { t } = useI18n()

const onScrollInto = () => {
  logger.debug('into')
  invokeSilently('trigger_haptic_feedback')
}
</script>
