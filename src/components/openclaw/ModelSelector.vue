<template>
  <div class="model-selector">
    <n-dropdown trigger="click" :options="modelOptions" @select="handleSelect" placement="top-start">
      <div class="model-selector__trigger">
        <span class="model-selector__current">{{ currentModelName }}</span>
        <svg class="model-selector__arrow">
          <use href="#down-arrow"></use>
        </svg>
      </div>
    </n-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Model {
  id: string
  name: string
  provider?: string
}

const props = defineProps<{
  models: Model[]
  currentModelId?: string
}>()

const emit = defineEmits<(event: 'select', modelId: string) => void>()

const modelOptions = computed(() =>
  props.models.map((model) => ({
    label: model.name,
    key: model.id,
    disabled: false
  }))
)

const currentModelName = computed(() => {
  if (!props.currentModelId) return '选择模型'
  const model = props.models.find((m) => m.id === props.currentModelId)
  return model?.name || props.currentModelId
})

const handleSelect = (key: string) => {
  emit('select', key)
}
</script>

<style scoped>
.model-selector {
  display: inline-block;
}

.model-selector__trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-hover);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.model-selector__trigger:hover {
  background: var(--bg-active);
}

.model-selector__current {
  font-size: 12px;
  color: var(--hula-text-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-selector__arrow {
  width: 12px;
  height: 12px;
  color: var(--hula-text-secondary);
}
</style>
