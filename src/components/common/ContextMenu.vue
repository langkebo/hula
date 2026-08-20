<template>
  <div ref="ContextMenuRef">
    <slot></slot>
    <Teleport to="body">
      <transition-group @beforeEnter="handleBeforeEnter" @enter="handleEnter">
        <!-- emoji表情菜单 -->
        <ContextMenuEmoji
          :emoji="emoji"
          :show-menu="showMenu"
          :menu-position="emojiMenuPosition"
          v-model:showAll="showAllEmojis"
          @reply-emoji="handleReplyEmoji" />

        <!-- 普通右键菜单 -->
        <div
          v-if="!isMobileRef && showMenu && !(emoji && emoji.length > 0 && showAllEmojis)"
          ref="menuRef"
          class="context-menu select-none"
          tabindex="0"
          role="menu"
          :aria-activedescendant="focusedIndex >= 0 ? `menu-item-${focusedIndex}` : undefined"
          @keydown="handleMenuKeydown"
          :style="{
            left: `${pos.posX}px`,
            top: `${pos.posY}px`
          }">
          <div
            v-resize="handleSize"
            v-if="(visibleMenu && visibleMenu.length > 0) || (visibleSpecialMenu && visibleSpecialMenu.length > 0)"
            class="menu-list">
            <div v-for="(item, index) in visibleMenu" :key="index">
              <!-- 禁止的菜单选项需要禁止点击事件  -->
              <div
                v-if="item.disabled"
                :id="`menu-item-${index}`"
                class="menu-item-disabled"
                role="menuitem"
                aria-disabled="true"
                @click.prevent="$event.preventDefault()">
                <div class="menu-item-content">
                  <svg><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                  <p class="h-24px">{{ getMenuItemProp(item, 'label') }}</p>
                </div>
              </div>
              <div
                :id="`menu-item-${index}`"
                class="menu-item"
                :class="{ 'menu-item-danger': isDangerousItem(item), 'menu-item-focused': focusedIndex === index }"
                role="menuitem"
                :tabindex="focusedIndex === index ? 0 : -1"
                v-else
                @click="handleClick(item)"
                @mouseenter="handleMouseEnter(item, index)"
                @mouseleave="handleMouseLeave">
                <div class="menu-item-content">
                  <svg><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                  <p class="h-24px">{{ getMenuItemProp(item, 'label') }}</p>
                  <svg v-if="shouldShowArrow(item)" class="arrow-icon">
                    <use href="#right"></use>
                  </svg>
                </div>
              </div>
            </div>
            <!-- 判断是否有特别的菜单项才需要分割线 -->
            <div v-if="visibleSpecialMenu.length > 0" class="flex-col-y-center gap-6px" role="separator">
              <!-- 分割线（只有当常规菜单存在时才显示） -->
              <div
                v-if="visibleMenu && visibleMenu.length > 0"
                class="h-1px bg-[--tjg-border-default] m-[2px_8px]"></div>
              <div
                @click="handleClick(item)"
                :id="`menu-item-${visibleMenu.length + index}`"
                class="menu-item"
                :class="{
                  'menu-item-danger': isDangerousItem(item),
                  'menu-item-focused': focusedIndex === visibleMenu.length + index
                }"
                role="menuitem"
                :tabindex="focusedIndex === visibleMenu.length + index ? 0 : -1"
                v-for="(item, index) in visibleSpecialMenu"
                :key="index">
                <svg><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                <p class="h-24px">{{ getMenuItemProp(item, 'label') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 移动端菜单 -->
        <div
          v-if="isMobileRef && showMenu && !(emoji && emoji.length > 0 && showAllEmojis)"
          class="context-menu select-none"
          :style="{
            left: `${pos.posX}px`,
            top: `${pos.posY}px`
          }">
          <div
            v-resize="handleSize"
            v-if="(visibleMenu && visibleMenu.length > 0) || (visibleSpecialMenu && visibleSpecialMenu.length > 0)"
            class="max-w-70vw grid grid-cols-5 gap-5px h-auto!">
            <div
              role="button"
              tabindex="0"
              :aria-label="getMenuItemProp(item, 'label')"
              @click="handleClick(item)"
              @keydown.enter.prevent="handleClick(item)"
              @keydown.space.prevent="handleClick(item)"
              v-for="(item, index) in visibleMenu"
              :key="index"
              class="w-45px h-45px flex justify-center items-center">
              <div class="flex w-45px flex-col active:bg-[--tjg-menu-hover] justify-center items-center max-h-45px">
                <svg class="w-18px w-18px"><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                <p class="h-24px text-12px">{{ getMenuItemProp(item, 'label') }}</p>
                <svg v-if="shouldShowArrow(item)" class="arrow-icon w-18px w-18px">
                  <use href="#right"></use>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- 二级菜单 -->
        <div v-if="showSubmenu && activeSubmenu" class="context-submenu" :style="submenuPosition">
          <div class="menu-list">
            <div
              v-for="(subItem, subIndex) in activeSubmenu"
              :key="subIndex"
              class="menu-item"
              role="menuitem"
              tabindex="-1"
              :class="{ 'menu-item-danger': isDangerousItem(subItem) }">
              <div
                class="menu-item-content"
                @click="handleSubItemClick(subItem)"
                @keydown.enter.prevent="handleSubItemClick(subItem)"
                @keydown.space.prevent="handleSubItemClick(subItem)">
                <svg class="check-icon">
                  <use :href="`#${getMenuItemProp(subItem, 'icon')}`"></use>
                </svg>
                <p class="h-24px">{{ getMenuItemProp(subItem, 'label') }}</p>
              </div>
            </div>
          </div>
        </div>
      </transition-group>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useContextMenu } from '@/composables/common/useContextMenu'
import { useContextMenuItem } from '@/composables/common/useContextMenuItem'
import { useContextMenuNavigation } from '@/composables/common/useContextMenuNavigation'
import { useContextMenuPosition } from '@/composables/common/useContextMenuPosition'
import { useContextMenuSubmenu } from '@/composables/common/useContextMenuSubmenu'
import type { ContextMenuItem, MenuContent, ReactionEmoji } from '@/composables/common/useContextMenuTypes'
import { useViewport } from '@/composables/common/useViewport'
import { isMobile } from '@/utils/PlatformConstants'
import ContextMenuEmoji from './ContextMenuEmoji.vue'

type Props = {
  content?: MenuContent
  menu?: ContextMenuItem[]
  emoji?: ReactionEmoji[]
  specialMenu?: ContextMenuItem[]
}

const props = withDefaults(defineProps<Props>(), {
  content: () => ({}),
  menu: () => [],
  emoji: () => [],
  specialMenu: () => []
})

const isMobileRef = computed(() => isMobile())
const showAllEmojis = ref(false)

const visibleMenu = computed(() => {
  return props.menu?.filter((item) => {
    if (typeof item.visible === 'function') {
      return item.visible(props.content)
    }
    return true
  })
})

const visibleSpecialMenu = computed(() => {
  return props.specialMenu?.filter((item) => {
    if (typeof item.visible === 'function') {
      return item.visible(props.content)
    }
    return true
  })
})

const isNull = computed(() => props.menu === void 0)
const ContextMenuRef = useTemplateRef('ContextMenuRef')
const emit = defineEmits(['select', 'reply-emoji', 'menu-show'])
const { x, y, showMenu, handleContextMenu } = useContextMenu(ContextMenuRef, isNull)

// 暴露 show(event) 供外部手动触发（好友列表/会话列表右键），与 slot 包裹自动触发互补。
defineExpose({ show: handleContextMenu })

watch(
  () => showMenu.value,
  (newVal) => {
    emit('menu-show', newVal)
  },
  { immediate: true }
)

const { vw, vh } = useViewport()
const contentRef = computed(() => props.content)

function handleClick(item: ContextMenuItem) {
  nextTick(() => {
    showMenu.value = false
    emit('select', item)
  })
}

function handleReplyEmoji(item: ReactionEmoji) {
  if (!item) return
  nextTick(() => {
    showMenu.value = false
    emit('reply-emoji', item)
  })
}

const { getMenuItemProp, isDangerousItem } = useContextMenuItem(contentRef)

const emojiCount = computed(() => props.emoji.length)
const { pos, emojiMenuPosition, handleSize } = useContextMenuPosition({
  x,
  y,
  vw,
  vh,
  showAllEmojis,
  emojiCount
})

const {
  showSubmenu,
  activeSubmenu,
  submenuPosition,
  handleMouseEnter,
  handleMouseLeave,
  handleSubItemClick,
  shouldShowArrow,
  resetSubmenu
} = useContextMenuSubmenu({ content: contentRef, vw, vh })

const { focusedIndex, menuRef, handleMenuKeydown, focusMenu, resetNavigation } = useContextMenuNavigation({
  visibleMenu,
  visibleSpecialMenu,
  showMenu,
  onSelect: handleClick
})

watch(
  () => showMenu.value,
  (newVal) => {
    if (!newVal) {
      resetSubmenu()
      showAllEmojis.value = false
      resetNavigation()
    } else {
      focusMenu()
    }
  }
)

const handleBeforeEnter = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = '0'
}

const handleEnter = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = 'auto'
  const h = element.clientHeight
  element.style.height = '0'
  requestAnimationFrame(() => {
    element.style.height = `${h}px`
  })
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/variable.scss' as *;

@mixin menu-item {
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 10px;
  svg {
    width: 16px;
    height: 16px;
  }
  .menu-item-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

@mixin menu-list {
  -webkit-backdrop-filter: blur(10px);
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  .menu-item {
    @include menu-item();
    display: flex;
    align-items: center;
    &:hover,
    &.menu-item-focused {
      background-color: var(--tjg-menu-hover);
      svg {
        animation: twinkle 0.3s ease-in-out;
      }
    }
  }
}

.context-menu {
  @include menu-item-style();

  .menu-list {
    @include menu-list();
    width: max-content;
    .menu-item-disabled {
      @include menu-item();
      color: var(--tjg-text-disabled);
      svg {
        color: var(--tjg-text-disabled);
      }
    }
  }
}

.menu-item-danger {
  color: var(--tjg-color-danger-500);
  svg {
    color: var(--tjg-color-danger-500);
  }
}

.context-submenu {
  position: fixed;
  z-index: 1000;
  @include menu-item-style();

  .menu-list {
    @include menu-list();
    min-width: 120px;
  }
}

.menu-item {
  .menu-item-content {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    column-gap: 12px;
    width: max-content;
    position: relative;
    svg {
      flex-shrink: 0;
      min-width: 16px;
    }
    p {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .arrow-icon {
      position: static;
      justify-self: end;
      width: 12px;
      height: 12px;
      color: var(--tjg-text-primary);
    }

    .check-icon {
      width: 14px;
      height: 14px;
    }
  }
}
</style>
