<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" border :hidden-right="true" room-name="群成员" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 gap-15px py-15px px-20px">
          <van-form @submit="handleSubmit" class="flex flex-wrap gap-10px">
            <div class="flex flex-1">
              <van-field
                v-model="formData.keyword"
                placeholder="搜索"
                class="text-center border-none w-full rounded-10px"
                :spellcheck="false" />
            </div>
          </van-form>

          <div class="relative flex flex-1">
            <div ref="measure" class="flex absolute w-full h-full top-0 left-0 z-1"></div>
            <div class="absolute z-10 w-full overflow-y-auto" :style="{ height: virtualScrollerHeight + 'px' }">
              <div v-if="filteredList.length === 0" class="flex w-full justify-center mt-20px">无数据</div>
              <div v-else>
                <div
                  v-for="item in filteredList"
                  :key="item.uid"
                  @click="toFriendInfo(item.uid)"
                  class="flex items-start"
                  style="height: 52px">
                  <div class="flex items-center gap-10px">
                    <img
                      class="w-42px h-42px rounded-full object-cover flex-shrink-0"
                      :src="AvatarUtils.getAvatarUrl(item.avatar)"
                      @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                    <span class="line-clamp-1">
                      {{ item.name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/Logger'
import { useDebounceFn } from '@vueuse/core'
import type { UserItem } from '@/services/types'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { toFriendInfoPage } from '@/utils/RouterUtils'

const logger = createLogger('GroupChatMember')
const measure = ref(null)

const virtualScrollerHeight = ref(0)

defineOptions({
  name: 'mobileGroupChatMember'
})

const groupStore = useGroupStore()

const formData = ref({
  keyword: ''
})

const filteredList = ref<UserItem[]>([])

onMounted(() => {
  filteredList.value = groupStore.memberList

  if (measure.value) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        virtualScrollerHeight.value = entry.contentRect.height
        logger.debug('高度：', virtualScrollerHeight.value)
      }
    })
    observer.observe(measure.value)

    onBeforeUnmount(() => {
      observer.disconnect()
    })
  }
})

const toFriendInfo = (uid: string) => toFriendInfoPage(uid)

const search = useDebounceFn(() => {
  const kw = formData.value.keyword.trim().toLowerCase()

  if (!kw) {
    filteredList.value = groupStore.memberList
    return
  }

  filteredList.value = groupStore.memberList.filter((item) => {
    return (
      item.name?.toLowerCase().includes(kw) ||
      item.account?.toLowerCase().includes(kw) ||
      item.myName?.toLowerCase().includes(kw)
    )
  })
}, 300)

const handleSubmit = (e: Event) => {
  e.preventDefault()
  search()
}

watch(() => formData.value.keyword, search)
</script>

<style scoped></style>
