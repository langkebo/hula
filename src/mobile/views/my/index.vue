<template>
  <div class="flex flex-col overflow-auto h-full">
    <Settings />
    <PersonalInfo :is-show="isShow" />

    <!-- 快捷功能入口（全部接入真实页面） -->
    <MobileQuickActions />

    <!-- 安全与常用设置入口：设备管理 1 跳可达。
         位于首屏以下：用 content-visibility 跳过首帧的布局/绘制，滚动到可视区才渲染。
         contain-intrinsic-size 预留高度，避免滚动条与内容跳变；不支持的 WebView 自动忽略。 -->
    <div class="[content-visibility:auto] [contain-intrinsic-size:auto_240px]">
      <MobileMyEntryList />
    </div>
  </div>
</template>

<script setup lang="ts">
import MobileQuickActions from '#/components/my/MobileQuickActions.vue'
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import Settings from '#/components/my/Settings.vue'
import MobileMyEntryList from './components/MobileMyEntryList.vue'

const isShow = ref(true)
</script>
