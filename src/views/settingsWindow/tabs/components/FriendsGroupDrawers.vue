<template>
  <n-drawer :show="showCreate" placement="right" :width="380" @update:show="emit('update:showCreate', $event)">
    <n-drawer-content :title="t('setting.friends.groups.create_title')" closable>
      <n-form>
        <n-form-item :label="t('setting.friends.groups.name_label')">
          <n-input
            :value="newGroupName"
            :placeholder="t('setting.friends.groups.name_placeholder')"
            @update:value="emit('update:newGroupName', $event)" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <n-button @click="emit('update:showCreate', false)">{{ t('setting.common.cancel') }}</n-button>
          <n-button type="primary" @click="emit('create')">
            {{ t('setting.friends.groups.create_confirm') }}
          </n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>

  <n-drawer :show="showEdit" placement="right" :width="380" @update:show="emit('update:showEdit', $event)">
    <n-drawer-content :title="t('setting.friends.groups.edit_title')" closable>
      <n-form>
        <n-form-item :label="t('setting.friends.groups.name_label')">
          <n-input
            :value="editGroupName"
            :placeholder="t('setting.friends.groups.edit_placeholder')"
            @update:value="emit('update:editGroupName', $event)" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <n-button @click="emit('update:showEdit', false)">{{ t('setting.common.cancel') }}</n-button>
          <n-button type="primary" @click="emit('save')">{{ t('setting.common.save') }}</n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { NButton, NDrawer, NDrawerContent, NForm, NFormItem, NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'FriendsGroupDrawers' })

defineProps<{
  showCreate: boolean
  showEdit: boolean
  newGroupName: string
  editGroupName: string
}>()

const emit = defineEmits<{
  'update:showCreate': [value: boolean]
  'update:showEdit': [value: boolean]
  'update:newGroupName': [value: string]
  'update:editGroupName': [value: string]
  create: []
  save: []
}>()

const { t } = useI18n()
</script>
