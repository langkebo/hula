<script setup lang="ts">
/**
 * 设置分组容器组件
 * 用于组织设置项的分组显示
 */
import { computed } from 'vue'
import { NDivider, NCollapse, NCollapseItem } from 'naive-ui'

interface Props {
  title?: string
  description?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  divider?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  collapsible: false,
  defaultExpanded: true,
  divider: true
})

const expandedNames = computed(() => (props.defaultExpanded ? ['content'] : []))
</script>

<template>
  <div class="settings-group">
    <template v-if="collapsible">
      <n-collapse :default-expanded-names="expandedNames">
        <n-collapse-item name="content">
          <template #header>
            <div class="settings-group-header">
              <span class="settings-group-title">{{ title }}</span>
              <span v-if="description" class="settings-group-description">{{ description }}</span>
            </div>
          </template>
          <div class="settings-group-content">
            <slot></slot>
          </div>
        </n-collapse-item>
      </n-collapse>
    </template>
    <template v-else>
      <div v-if="title" class="settings-group-header">
        <span class="settings-group-title">{{ title }}</span>
        <span v-if="description" class="settings-group-description">{{ description }}</span>
      </div>
      <div class="settings-group-content">
        <slot></slot>
      </div>
    </template>
    <n-divider v-if="divider" class="settings-group-divider" />
  </div>
</template>

<style scoped>
.settings-group {
  margin-bottom: 16px;
}

.settings-group-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
}

.settings-group-description {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.settings-group-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
}

.settings-group-divider {
  margin: 16px 0;
}
</style>
