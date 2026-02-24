<template>
  <UserMenuDesktop v-if="isDesktop" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotData" :key="name">
      <slot :name="name" v-bind="slotData" />
    </template>
  </UserMenuDesktop>
  <UserMenuMobile v-else v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotData" :key="name">
      <slot :name="name" v-bind="slotData" />
    </template>
  </UserMenuMobile>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { usePlatform } from '@/composables/usePlatform'

defineOptions({
  name: 'UserMenu'
})

const { isDesktop } = usePlatform()

const UserMenuDesktop = defineAsyncComponent(() =>
  import('./UserMenuDesktop.vue')
)

const UserMenuMobile = defineAsyncComponent(() =>
  import('./UserMenuMobile.vue')
)
</script>
