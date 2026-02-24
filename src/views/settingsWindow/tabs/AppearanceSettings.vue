<template>
  <div class="appearance-settings">
    <div class="settings-section">
      <h3 class="section-title">主题</h3>
      <div class="theme-options">
        <div
          v-for="theme in themeOptions"
          :key="theme.value"
          class="theme-option"
          :class="{ 'theme-option-active': currentTheme === theme.value }"
          @click="handleThemeChange(theme.value)"
        >
          <div class="theme-preview" :class="theme.previewClass">
            <div class="preview-sidebar" />
            <div class="preview-content" />
          </div>
          <span class="theme-label">{{ theme.label }}</span>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">字体设置</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">字体</span>
          <span class="setting-desc">选择界面显示字体</span>
        </div>
        <n-select
          v-model:value="fontFamily"
          :options="fontOptions"
          style="width: 150px"
          @update:value="handleFontChange"
        />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">字体大小</span>
          <span class="setting-desc">调整界面字体大小</span>
        </div>
        <div class="font-size-control">
          <n-slider
            v-model:value="fontSize"
            :min="12"
            :max="20"
            :step="1"
            style="width: 120px"
            @update:value="handleFontSizeChange"
          />
          <span class="font-value">{{ fontSize }}px</span>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">界面效果</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">窗口阴影</span>
          <span class="setting-desc">为窗口添加阴影效果</span>
        </div>
        <n-switch v-model:value="windowShadow" @update:value="handleShadowChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">模糊效果</span>
          <span class="setting-desc">启用窗口模糊背景</span>
        </div>
        <n-switch v-model:value="blurEffect" @update:value="handleBlurChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">消息气泡</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">气泡样式</span>
          <span class="setting-desc">选择消息气泡显示样式</span>
        </div>
        <n-switch v-model:value="bubbleStyle" @update:value="handleBubbleStyleChange">
          <template #checked>圆角</template>
          <template #unchecked>方角</template>
        </n-switch>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NSlider, NSwitch, NDivider, NSelect, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'

defineOptions({
  name: 'AppearanceSettings'
})

const message = useMessage()
const settingStore = useSettingStore()
const { themes, page } = storeToRefs(settingStore)

const themeOptions = [
  { value: 'light', label: '亮色', previewClass: 'preview-light' },
  { value: 'dark', label: '暗色', previewClass: 'preview-dark' },
  { value: 'os', label: '跟随系统', previewClass: 'preview-auto' }
]

const fontOptions = [
  { label: '默认字体', value: 'PingFang' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '苹方', value: 'PingFang SC' },
  { label: '思源黑体', value: 'Source Han Sans' }
]

const currentTheme = computed(() => {
  return themes.value.pattern === 'os' ? 'os' : themes.value.content
})

const fontFamily = ref(page.value.fonts || 'PingFang')
const fontSize = ref(14)
const windowShadow = ref(page.value.shadow ?? true)
const blurEffect = ref(page.value.blur ?? true)
const bubbleStyle = ref(true)

onMounted(() => {
  const savedFontSize = localStorage.getItem('hula-font-size')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize, 10)
    applyFontSize(fontSize.value)
  }
  
  const savedBubbleStyle = localStorage.getItem('hula-bubble-style')
  if (savedBubbleStyle !== null) {
    bubbleStyle.value = savedBubbleStyle === 'true'
  }
})

function handleThemeChange(theme: string) {
  settingStore.toggleTheme(theme)
  message.success('主题已切换')
}

function handleFontChange(value: string) {
  settingStore.page.fonts = value
  document.documentElement.style.setProperty('--font-family', value)
  message.success('字体已更改')
}

function handleFontSizeChange(value: number) {
  applyFontSize(value)
  localStorage.setItem('hula-font-size', value.toString())
  message.success(`字体大小已调整为 ${value}px`)
}

function applyFontSize(size: number) {
  document.documentElement.style.setProperty('--font-size-base', `${size}px`)
}

function handleShadowChange(value: boolean) {
  settingStore.page.shadow = value
  message.success(value ? '已启用窗口阴影' : '已禁用窗口阴影')
}

function handleBlurChange(value: boolean) {
  settingStore.page.blur = value
  message.success(value ? '已启用模糊效果' : '已禁用模糊效果')
}

function handleBubbleStyleChange(value: boolean) {
  localStorage.setItem('hula-bubble-style', value.toString())
  message.success(value ? '已切换为圆角气泡' : '已切换为方角气泡')
}
</script>

<style scoped>
.appearance-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.theme-options {
  display: flex;
  gap: 16px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.theme-option:hover {
  border-color: rgba(24, 144, 255, 0.3);
}

.theme-option-active {
  border-color: #1890ff;
}

.theme-preview {
  width: 80px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  overflow: hidden;
  margin-bottom: 8px;
}

.preview-light {
  background-color: #f5f5f5;
}

.preview-light .preview-sidebar {
  background-color: #e8e8e8;
}

.preview-light .preview-content {
  background-color: #fff;
}

.preview-dark {
  background-color: #1a1a1a;
}

.preview-dark .preview-sidebar {
  background-color: #2a2a2a;
}

.preview-dark .preview-content {
  background-color: #333;
}

.preview-auto {
  background: linear-gradient(135deg, #f5f5f5 50%, #1a1a1a 50%);
}

.preview-sidebar {
  width: 20px;
  height: 100%;
}

.preview-content {
  flex: 1;
  margin: 4px;
  border-radius: 4px;
}

.theme-label {
  font-size: 12px;
  color: #666;
}

:deep(.dark) .theme-label {
  color: #aaa;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.font-size-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.font-value {
  font-size: 12px;
  color: #666;
  min-width: 36px;
}
</style>
