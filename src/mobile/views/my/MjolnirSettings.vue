<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_mjolnir.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_mjolnir.room_bans') }}</div>

          <van-cell-group inset>
            <div v-if="roomBans.length > 0">
              <van-swipe-cell v-for="(ban, index) in roomBans" :key="'room-' + index">
                <van-cell :title="ban.entity" :label="ban.reason || t('mobile_mjolnir.no_reason')" />
                <template #right>
                  <van-button
                    square
                    type="danger"
                    :text="t('mobile_mjolnir.remove')"
                    class="h-full"
                    @click="removeBan('room', index)" />
                </template>
              </van-swipe-cell>
            </div>
            <van-cell v-else :title="t('mobile_mjolnir.empty')" />
          </van-cell-group>

          <van-button size="small" plain type="primary" @click="showAddRoomBan = true">
            {{ t('mobile_mjolnir.add_room_ban') }}
          </van-button>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_mjolnir.user_bans') }}</div>

          <van-cell-group inset>
            <div v-if="userBans.length > 0">
              <van-swipe-cell v-for="(ban, index) in userBans" :key="'user-' + index">
                <van-cell :title="ban.entity" :label="ban.reason || t('mobile_mjolnir.no_reason')" />
                <template #right>
                  <van-button
                    square
                    type="danger"
                    :text="t('mobile_mjolnir.remove')"
                    class="h-full"
                    @click="removeBan('user', index)" />
                </template>
              </van-swipe-cell>
            </div>
            <van-cell v-else :title="t('mobile_mjolnir.empty')" />
          </van-cell-group>

          <van-button size="small" plain type="primary" @click="showAddUserBan = true">
            {{ t('mobile_mjolnir.add_user_ban') }}
          </van-button>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_mjolnir.server_bans') }}</div>

          <van-cell-group inset>
            <div v-if="serverBans.length > 0">
              <van-swipe-cell v-for="(ban, index) in serverBans" :key="'server-' + index">
                <van-cell :title="ban.entity" :label="ban.reason || t('mobile_mjolnir.no_reason')" />
                <template #right>
                  <van-button
                    square
                    type="danger"
                    :text="t('mobile_mjolnir.remove')"
                    class="h-full"
                    @click="removeBan('server', index)" />
                </template>
              </van-swipe-cell>
            </div>
            <van-cell v-else :title="t('mobile_mjolnir.empty')" />
          </van-cell-group>

          <van-button size="small" plain type="primary" @click="showAddServerBan = true">
            {{ t('mobile_mjolnir.add_server_ban') }}
          </van-button>
        </div>
      </div>

      <van-popup v-model:show="showAddRoomBan" position="bottom" round :style="{ padding: '16px' }">
        <div class="text-16px font-bold mb-12px">{{ t('mobile_mjolnir.add_room_ban') }}</div>
        <van-field v-model="newRoomBan.entity" :label="t('mobile_mjolnir.entity')" :placeholder="'#room:example.com'" />
        <van-field v-model="newRoomBan.reason" :label="t('mobile_mjolnir.reason')" :placeholder="t('mobile_mjolnir.reason_placeholder')" />
        <div class="flex gap-8px mt-12px">
          <van-button block @click="showAddRoomBan = false">{{ t('mobile_mjolnir.cancel') }}</van-button>
          <van-button block type="primary" @click="addBan('room')">{{ t('mobile_mjolnir.add') }}</van-button>
        </div>
      </van-popup>

      <van-popup v-model:show="showAddUserBan" position="bottom" round :style="{ padding: '16px' }">
        <div class="text-16px font-bold mb-12px">{{ t('mobile_mjolnir.add_user_ban') }}</div>
        <van-field v-model="newUserBan.entity" :label="t('mobile_mjolnir.entity')" :placeholder="'@user:example.com'" />
        <van-field v-model="newUserBan.reason" :label="t('mobile_mjolnir.reason')" :placeholder="t('mobile_mjolnir.reason_placeholder')" />
        <div class="flex gap-8px mt-12px">
          <van-button block @click="showAddUserBan = false">{{ t('mobile_mjolnir.cancel') }}</van-button>
          <van-button block type="primary" @click="addBan('user')">{{ t('mobile_mjolnir.add') }}</van-button>
        </div>
      </van-popup>

      <van-popup v-model:show="showAddServerBan" position="bottom" round :style="{ padding: '16px' }">
        <div class="text-16px font-bold mb-12px">{{ t('mobile_mjolnir.add_server_ban') }}</div>
        <van-field v-model="newServerBan.entity" :label="t('mobile_mjolnir.entity')" :placeholder="'example.com'" />
        <van-field v-model="newServerBan.reason" :label="t('mobile_mjolnir.reason')" :placeholder="t('mobile_mjolnir.reason_placeholder')" />
        <div class="flex gap-8px mt-12px">
          <van-button block @click="showAddServerBan = false">{{ t('mobile_mjolnir.cancel') }}</van-button>
          <van-button block type="primary" @click="addBan('server')">{{ t('mobile_mjolnir.add') }}</van-button>
        </div>
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { showToast, showDialog } from 'vant'

const { t } = useI18n()

interface BanEntry {
  entity: string
  reason: string
}

const roomBans = ref<BanEntry[]>([])
const userBans = ref<BanEntry[]>([])
const serverBans = ref<BanEntry[]>([])

const showAddRoomBan = ref(false)
const showAddUserBan = ref(false)
const showAddServerBan = ref(false)

const newRoomBan = reactive({ entity: '', reason: '' })
const newUserBan = reactive({ entity: '', reason: '' })
const newServerBan = reactive({ entity: '', reason: '' })

onMounted(() => {
  loadBanLists()
})

function loadBanLists() {
  try {
    const saved = localStorage.getItem('hula-mjolnir-ban-lists')
    if (saved) {
      const parsed = JSON.parse(saved)
      roomBans.value = parsed.room || []
      userBans.value = parsed.user || []
      serverBans.value = parsed.server || []
    }
  } catch {
    // ignore
  }
}

function saveBanLists() {
  localStorage.setItem(
    'hula-mjolnir-ban-lists',
    JSON.stringify({
      room: roomBans.value,
      user: userBans.value,
      server: serverBans.value
    })
  )
}

function addBan(type: 'room' | 'user' | 'server') {
  const banMap = {
    room: { list: roomBans, form: newRoomBan, show: showAddRoomBan },
    user: { list: userBans, form: newUserBan, show: showAddUserBan },
    server: { list: serverBans, form: newServerBan, show: showAddServerBan }
  }

  const target = banMap[type]
  if (!target.form.entity.trim()) {
    showToast(t('mobile_mjolnir.entity_required'))
    return
  }

  target.list.value.push({ entity: target.form.entity.trim(), reason: target.form.reason.trim() })
  target.form.entity = ''
  target.form.reason = ''
  target.show.value = false
  saveBanLists()
  showToast(t('mobile_mjolnir.added'))
}

function removeBan(type: 'room' | 'user' | 'server', index: number) {
  showDialog({
    title: t('mobile_mjolnir.confirm_remove'),
    message: t('mobile_mjolnir.confirm_remove_message')
  }).then(() => {
    const listMap = { room: roomBans, user: userBans, server: serverBans }
    listMap[type].value.splice(index, 1)
    saveBanLists()
    showToast(t('mobile_mjolnir.removed'))
  })
}
</script>
