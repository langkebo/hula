<template>
  <mobile-layout :title="t('widget.title')" show-back>
    <div class="mobile-widget-manager">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <div v-if="!loading && widgets.length === 0" class="empty">
          <van-empty :description="t('widget.no_widgets')" />
        </div>
        <van-cell-group v-else inset>
          <van-cell
            v-for="w in widgets"
            :key="w.id"
            :title="w.name || w.id"
            :label="`${w.type} · ${w.url}`"
            is-link
            @click="handleOpenWidget(w)">
            <template #right-icon>
              <van-icon name="setting-o" class="row-action" @click.stop="handleEditPermissions(w)" />
              <van-icon name="delete-o" class="row-action danger" @click.stop="handleRemoveWidget(w)" />
            </template>
          </van-cell>
        </van-cell-group>
      </van-pull-refresh>

      <div class="fab">
        <van-button type="primary" round @click="showAddSheet = true">
          <van-icon name="plus" />
          {{ t('widget.add') }}
        </van-button>
      </div>

      <!-- Add widget action sheet -->
      <van-action-sheet v-model:show="showAddSheet" :title="t('widget.add')">
        <div class="add-form">
          <van-cell-group inset>
            <van-field v-model="formData.name" :label="t('widget.name')" :placeholder="t('widget.name_placeholder')" />
            <van-field
              v-model="formData.type"
              is-link
              readonly
              :label="t('widget.type')"
              @click="showTypePicker = true" />
            <van-field v-model="formData.url" :label="t('widget.url')" :placeholder="t('widget.url_placeholder')" />
          </van-cell-group>
          <div class="action">
            <van-button type="primary" block :loading="adding" @click="handleAddWidget">
              {{ t('common.confirm') }}
            </van-button>
          </div>
        </div>
      </van-action-sheet>

      <van-popup v-model:show="showTypePicker" position="bottom">
        <van-picker
          :columns="widgetTypeColumns"
          @confirm="onTypeConfirm"
          @cancel="showTypePicker = false" />
      </van-popup>

      <!-- Permissions action sheet -->
      <van-action-sheet
        v-model:show="showPermissionsSheet"
        :title="selectedWidget?.name || selectedWidget?.id || ''">
        <div class="permissions">
          <van-loading v-if="permissionsLoading" class="loading" />
          <van-empty v-else-if="permissionRows.length === 0" :description="t('widget.no_permissions')" />
          <van-cell-group v-else inset>
            <van-cell
              v-for="row in permissionRows"
              :key="row.userId"
              :title="row.userId"
              :label="row.permissions.join(', ')">
              <template #right-icon>
                <van-icon name="cross" class="row-action danger" @click.stop="handleRemovePermission(row)" />
              </template>
            </van-cell>
          </van-cell-group>

          <van-cell-group inset :title="t('widget.permissions')">
            <van-field
              v-model="newPermission.userId"
              :label="t('widget.name')"
              :placeholder="t('widget.permission_user_placeholder')" />
            <van-field
              :model-value="newPermission.permissions.join(', ')"
              is-link
              readonly
              :label="t('widget.permissions')"
              @click="showPermissionPicker = true" />
          </van-cell-group>
          <div class="action">
            <van-button type="primary" block :loading="savingPermissions" @click="handleAddPermission">
              {{ t('common.add') }}
            </van-button>
          </div>
        </div>
      </van-action-sheet>

      <van-popup v-model:show="showPermissionPicker" position="bottom">
        <van-picker
          :columns="permissionPresetColumns"
          @confirm="onPermissionConfirm"
          @cancel="showPermissionPicker = false" />
      </van-popup>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { showToast, showDialog } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import type { Widget } from '@/services/matrix/widget/MatrixWidgetService'
import { useWidgets, useWidgetPermissions, type PermissionRow } from '@/composables/widget'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileWidgetManager')
const { t } = useI18n()
const route = useRoute()

const roomId = computed(() => (route.params.roomId as string) || (route.query.roomId as string) || '')

const { widgets, loading, mutating: adding, load, create, remove } = useWidgets(() => roomId.value)
const {
  rows: permissionRows,
  loading: permissionsLoading,
  mutating: savingPermissions,
  load: loadPermissions,
  grant: grantPermission,
  revoke: revokePermission
} = useWidgetPermissions()

const refreshing = ref(false)
const showAddSheet = ref(false)
const showTypePicker = ref(false)
const showPermissionsSheet = ref(false)
const showPermissionPicker = ref(false)
const selectedWidget = ref<Widget | null>(null)

const formData = reactive({ name: '', type: 'custom', url: '' })
const newPermission = reactive<{ userId: string; permissions: string[] }>({
  userId: '',
  permissions: ['read']
})

const widgetTypeColumns = computed(() => [
  { text: t('widget.type_custom'), value: 'custom' },
  { text: t('widget.type_jitsi'), value: 'jitsi' },
  { text: t('widget.type_etherpad'), value: 'etherpad' },
  { text: t('widget.type_poll'), value: 'poll' }
])

const permissionPresetColumns = computed(() => [
  { text: t('widget.permission_read'), value: 'read' },
  { text: t('widget.permission_write'), value: 'write' },
  { text: t('widget.permission_admin'), value: 'admin' }
])

const onRefresh = async () => {
  refreshing.value = true
  try {
    await load()
  } finally {
    refreshing.value = false
  }
}

const onTypeConfirm = ({ selectedOptions }: { selectedOptions: Array<{ value: string }> }) => {
  formData.type = selectedOptions[0]?.value || 'custom'
  showTypePicker.value = false
}

const onPermissionConfirm = ({ selectedOptions }: { selectedOptions: Array<{ value: string }> }) => {
  if (selectedOptions[0]?.value) {
    newPermission.permissions = [selectedOptions[0].value]
  }
  showPermissionPicker.value = false
}

const handleAddWidget = async () => {
  if (!formData.name || !formData.url) {
    showToast(t('widget.name_required'))
    return
  }
  const result = await create({ widgetType: formData.type, url: formData.url, name: formData.name })
  if (result) {
    showToast(t('widget.add_success'))
    showAddSheet.value = false
    formData.name = ''
    formData.type = 'custom'
    formData.url = ''
  } else {
    showToast(t('widget.add_failed'))
  }
}

const handleOpenWidget = (w: Widget) => {
  window.open(w.url, '_blank')
}

const handleRemoveWidget = async (w: Widget) => {
  try {
    await showDialog({
      title: t('widget.remove_confirm_title'),
      message: t('widget.remove_confirm_content', { name: w.name || w.id }),
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return
  }
  const ok = await remove(w.id)
  showToast(ok ? t('widget.remove_success') : t('widget.remove_failed'))
}

const handleEditPermissions = async (w: Widget) => {
  selectedWidget.value = w
  showPermissionsSheet.value = true
  newPermission.userId = ''
  newPermission.permissions = ['read']
  await loadPermissions(w.id)
}

const handleAddPermission = async () => {
  if (!selectedWidget.value) return
  const userId = newPermission.userId.trim()
  if (!userId) {
    showToast(t('widget.permission_user_required'))
    return
  }
  const ok = await grantPermission(selectedWidget.value.id, userId, newPermission.permissions)
  if (ok) {
    showToast(t('widget.permission_added'))
    newPermission.userId = ''
    newPermission.permissions = ['read']
  } else {
    showToast(t('widget.permission_add_failed'))
  }
}

const handleRemovePermission = async (row: PermissionRow) => {
  if (!selectedWidget.value) return
  try {
    await showDialog({
      title: t('widget.permission_remove_confirm_title'),
      message: t('widget.permission_remove_confirm_content', { user: row.userId }),
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return
  }
  const ok = await revokePermission(selectedWidget.value.id, row.userId)
  showToast(ok ? t('widget.permission_removed') : t('widget.permission_remove_failed'))
}

if (roomId.value) {
  load().catch((err) => logger.error('[MobileWidgetManager] initial load failed', err))
}
</script>

<style scoped lang="scss">
.mobile-widget-manager {
  position: relative;
  min-height: 100%;

  .empty {
    padding: 60px 0;
  }

  .fab {
    position: fixed;
    right: 16px;
    bottom: 24px;
    z-index: 10;
  }

  .row-action {
    font-size: 20px;
    margin-left: 12px;
    color: var(--text-color-secondary);

    &.danger {
      color: var(--van-danger-color, #ee0a24);
    }
  }

  .add-form,
  .permissions {
    padding: 16px 0 32px;
  }

  .action {
    padding: 16px;
  }

  .loading {
    padding: 40px 0;
    text-align: center;
  }
}
</style>
