<template>
  <div class="flex flex-col overflow-auto h-full">
    <Settings />
    <PersonalInfo :is-show="isShow" />

    <!-- 快捷功能入口（全部接入真实页面） -->
    <MobileQuickActions />

    <!-- 安全与常用设置入口：设备管理 1 跳可达 -->
    <MobileMyEntryList />
  </div>
</template>

<script setup lang="ts">
import MobileQuickActions from '#/components/my/MobileQuickActions.vue'
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import Settings from '#/components/my/Settings.vue'
import MobileMyEntryList from './components/MobileMyEntryList.vue'

const isShow = ref(true)
</script>
