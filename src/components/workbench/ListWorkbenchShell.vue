<template>
  <div class="list-workbench-shell h-full flex flex-col">
    <slot name="toolbar" />

    <div class="list-workbench-shell__body min-h-0 flex flex-1">
      <div class="list-workbench-shell__list min-w-0 flex-1">
        <slot />
      </div>

      <slot name="detail" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.list-workbench-shell {
  /* TJG 原型：房间列表面板背景对齐 center-bg-color */
  background: var(--center-bg-color);
}
</style>
