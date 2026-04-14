<template>
  <n-card title="同步过滤器" :bordered="false">
    <template #header-extra>
      <n-tag v-if="currentFilterId" type="success" size="small">
        已启用
      </n-tag>
    </template>

    <n-space vertical :size="16">
      <n-alert type="info">
        同步过滤器可以优化同步性能，减少带宽消耗，提升大规模房间场景下的响应速度。
      </n-alert>

      <n-radio-group v-model:value="selectedPreset" @update:value="handlePresetChange">
        <n-space vertical>
          <n-radio
            v-for="preset in presets"
            :key="preset.id"
            :value="preset.id">
            <n-space align="center">
              <span>{{ preset.name }}</span>
              <n-text depth="3" style="font-size: 12px">
                {{ preset.description }}
              </n-text>
            </n-space>
          </n-radio>
        </n-space>
      </n-radio-group>

      <n-collapse>
        <n-collapse-item title="高级设置" name="advanced">
          <n-form :model="customFilter" label-placement="left" label-width="120px">
            <n-form-item label="时间线限制">
              <n-input-number
                v-model:value="customFilter.room!.timeline!.limit"
                :min="10"
                :max="500"
                :step="10">
                <template #suffix>条消息</template>
              </n-input-number>
            </n-form-item>

            <n-form-item label="状态事件">
              <n-switch v-model:value="customFilter.room!.state!.lazy_load_members" />
              <n-text depth="3" style="margin-left: 8px">
                懒加载成员（推荐开启）
              </n-text>
            </n-form-item>

            <n-form-item label="在线状态">
              <n-input-number
                v-model:value="customFilter.presence!.limit"
                :min="0"
                :max="100">
                <template #suffix>条</template>
              </n-input-number>
            </n-form-item>
          </n-form>

          <n-button @click="applyCustomFilter" :loading="loading">
            应用自定义过滤器
          </n-button>
        </n-collapse-item>
      </n-collapse>

      <n-descriptions v-if="currentFilterId" :column="1" label-placement="left">
        <n-descriptions-item label="当前过滤器">
          {{ currentFilterId }}
        </n-descriptions-item>
        <n-descriptions-item label="过滤器名称">
          {{ currentFilterName }}
        </n-descriptions-item>
      </n-descriptions>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { matrixFilterService, type SyncFilterConfig, type FilterPreset } from '@/services/matrix/MatrixFilterService'
import { useMessage } from 'naive-ui'

const message = useMessage()

const presets = ref<FilterPreset[]>([])
const selectedPreset = ref('default')
const currentFilterId = ref<string | null>(null)
const currentFilterName = ref('')
const loading = ref(false)

const customFilter = ref<SyncFilterConfig>({
  room: {
    state: {
      lazy_load_members: true
    },
    timeline: {
      limit: 50
    },
    ephemeral: {
      limit: 50
    }
  },
  presence: {
    limit: 0
  }
})

onMounted(() => {
  presets.value = matrixFilterService.getPresets()
  currentFilterId.value = matrixFilterService.getCurrentFilterId()
  currentFilterName.value = matrixFilterService.getCurrentFilterName()
  customFilter.value = matrixFilterService.getDefaultFilter()
})

async function handlePresetChange(presetId: string): Promise<void> {
  loading.value = true

  try {
    const filterId = await matrixFilterService.applyPreset(presetId)
    currentFilterId.value = filterId
    currentFilterName.value = `hula-${presetId}`
    message.success(`已应用过滤器: ${presets.value.find((p) => p.id === presetId)?.name}`)
  } catch (error) {
    message.error(`应用过滤器失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function applyCustomFilter(): Promise<void> {
  loading.value = true

  try {
    const filterId = await matrixFilterService.createFilter(customFilter.value)
    currentFilterId.value = filterId
    currentFilterName.value = 'custom'
    message.success('自定义过滤器已应用')
  } catch (error) {
    message.error(`应用自定义过滤器失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}
</script>
