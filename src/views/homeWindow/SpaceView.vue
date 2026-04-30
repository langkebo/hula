<template>
  <div class="space-view">
    <n-card class="space-view__card" :bordered="false">
      <n-flex vertical :size="18">
        <n-flex align="center" justify="space-between">
          <n-flex align="center" :size="12">
            <svg class="size-20px text-[--hula-color-primary-500]"><use href="#space"></use></svg>
            <div class="space-view__title-group">
              <h1 class="space-view__title">{{ t('space.create') }}</h1>
              <p class="space-view__subtitle">{{ t('space.create_route_hint') }}</p>
            </div>
          </n-flex>

          <n-button quaternary @click="handleClose">
            {{ t('common.cancel') }}
          </n-button>
        </n-flex>

        <CreateSpaceDialog v-model:visible="visible" @created="handleCreated" />
      </n-flex>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import CreateSpaceDialog from '@/components/space/CreateSpaceDialog.vue'
import { buildSpaceWorkbenchRoute } from '@/router/spaceNavigation'
import type { SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'

const { t } = useI18n()
const router = useRouter()
const visible = ref(true)

const handleClose = () => {
  visible.value = false
  void router.replace(buildSpaceWorkbenchRoute())
}

const handleCreated = (space: SpaceInfo) => {
  void router.replace(buildSpaceWorkbenchRoute(space.spaceId))
}
</script>

<style scoped lang="scss">
.space-view {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--hula-space-8) var(--hula-space-6);
  background: radial-gradient(circle at top, var(--hula-color-primary-100), transparent 48%), var(--hula-surface-app);
}

.space-view__card {
  width: min(100%, 640px);
  border-radius: var(--hula-radius-2xl);
  background: var(--hula-surface-panel);
  box-shadow: var(--hula-shadow-md);
}

.space-view__title-group {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-1);
}

.space-view__title {
  margin: 0;
  font-size: var(--hula-font-size-xl);
  font-weight: var(--hula-font-weight-semibold);
  color: var(--hula-text-primary);
}

.space-view__subtitle {
  margin: 0;
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-secondary);
}
</style>
