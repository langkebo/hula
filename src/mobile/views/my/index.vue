<template>
  <div class="flex flex-col overflow-auto h-full">
    <Settings />
    <PersonalInfo :is-show="isShow"></PersonalInfo>
  </div>
</template>

<script setup lang="ts">
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import Settings from '#/components/my/Settings.vue'

const isShow = ref(true)
</script>

<style lang="scss" scoped></style>
