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
            <div v-for="(item, index) in visibleMenu" :key="getMenuItemProp(item, 'label')">
              <!-- 禁止的菜单选项需要禁止点击事件  -->
              <div
                v-if="isMenuItemDisabled(item)"
                :id="`menu-item-${index}`"
                class="menu-item-disabled"
                role="menuitem"
                aria-disabled="true"
                @click.prevent="$event.preventDefault()">
                <div class="menu-item-content">
                  <svg aria-hidden="true"><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                  <p class="h-24px">{{ getMenuItemProp(item, 'label') }}</p>
                </div>
              </div>
              <div
                :id="`menu-item-${index}`"
                class="menu-item"
                :class="{ 'menu-item-danger': isDangerousItem(item), 'menu-item-focused': focusedIndex === index }"
                role="menuitem"
                :tabindex="focusedIndex === index ? 0 : -1"
                :aria-haspopup="shouldShowArrow(item) ? 'menu' : undefined"
                :aria-expanded="shouldShowArrow(item) ? showSubmenu && focusedIndex === index : undefined"
                v-else
                @click="handleClick(item)"
                @mouseenter="handleMouseEnter(item, index)"
                @mouseleave="handleMouseLeave">
                <div class="menu-item-content">
                  <svg aria-hidden="true"><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                  <p class="h-24px">{{ getMenuItemProp(item, 'label') }}</p>
                  <svg v-if="shouldShowArrow(item)" class="arrow-icon" aria-hidden="true">
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
                :key="getMenuItemProp(item, 'label')">
                <svg aria-hidden="true"><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
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
              v-for="item in visibleMenu"
              :key="getMenuItemProp(item, 'label')"
              :aria-disabled="isMenuItemDisabled(item)"
              class="w-45px h-45px flex justify-center items-center"
              :class="{ 'opacity-50': isMenuItemDisabled(item) }">
              <div class="flex w-45px flex-col active:bg-[--tjg-menu-hover] justify-center items-center max-h-45px">
                <svg class="w-18px w-18px" aria-hidden="true">
                  <use :href="`#${getMenuItemProp(item, 'icon')}`"></use>
                </svg>
                <p class="h-24px text-12px">{{ getMenuItemProp(item, 'label') }}</p>
                <svg v-if="shouldShowArrow(item)" class="arrow-icon w-18px w-18px" aria-hidden="true">
                  <use href="#right"></use>
                </svg>
              </div>
            </div>
            <!-- 移动端专属扩展项（如失败/本地消息的删除） -->
            <div
              role="button"
              tabindex="0"
              :aria-label="getMenuItemProp(item, 'label')"
              @click="handleClick(item)"
              @keydown.enter.prevent="handleClick(item)"
              @keydown.space.prevent="handleClick(item)"
              v-for="item in mobileSpecialMenu"
              :key="`special-${getMenuItemProp(item, 'label')}`"
              class="w-45px h-45px flex justify-center items-center"
              :class="getMenuItemProp(item, 'icon') === 'delete' ? 'text-[--tjg-color-danger-500]' : ''">
              <div class="flex w-45px flex-col active:bg-[--tjg-menu-hover] justify-center items-center max-h-45px">
                <svg class="w-18px" aria-hidden="true"><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                <p class="h-24px text-12px">{{ getMenuItemProp(item, 'label') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 二级菜单 -->
        <div
          v-if="showSubmenu && activeSubmenu"
          :ref="setSubmenuEl"
          class="context-submenu"
          role="menu"
          :style="submenuPosition"
          @keydown="handleSubmenuKeydown">
          <div class="menu-list">
            <div
              v-for="(subItem, subIndex) in activeSubmenu"
              :key="subIndex"
              class="menu-item"
              role="menuitem"
              :tabindex="focusedSubIndex === subIndex ? 0 : -1"
              :class="{
                'menu-item-danger': isDangerousItem(subItem),
                'menu-item-focused': focusedSubIndex === subIndex
              }"
              @keydown.enter.prevent
              @keydown.space.prevent>
              <div class="menu-item-content" @click="handleSubItemClick(subItem)">
                <svg class="check-icon" aria-hidden="true">
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
import { useContextMenuController } from '@/composables/common/useContextMenuController'
import type { ContextMenuItem, MenuContent, ReactionEmoji } from '@/composables/common/useContextMenuTypes'
import ContextMenuEmoji from './ContextMenuEmoji.vue'

type Props = {
  content?: MenuContent
  menu?: ContextMenuItem[] | undefined
  emoji?: ReactionEmoji[]
  specialMenu?: ContextMenuItem[] | undefined
}

const props = withDefaults(defineProps<Props>(), {
  content: () => ({}),
  menu: () => [],
  emoji: () => [],
  specialMenu: () => []
})

const emit = defineEmits(['select', 'reply-emoji', 'menu-show'])

const ContextMenuRef = useTemplateRef<HTMLElement>('ContextMenuRef')
const menuRef = useTemplateRef<HTMLElement>('menuRef')

const {
  isMobileRef,
  showAllEmojis,
  visibleMenu,
  visibleSpecialMenu,
  mobileSpecialMenu,
  showMenu,
  handleContextMenu,
  pos,
  emojiMenuPosition,
  handleSize,
  handleClick,
  handleReplyEmoji,
  getMenuItemProp,
  isDangerousItem,
  isMenuItemDisabled,
  showSubmenu,
  activeSubmenu,
  submenuPosition,
  setSubmenuEl,
  focusedSubIndex,
  handleMouseEnter,
  handleMouseLeave,
  handleSubItemClick,
  shouldShowArrow,
  handleSubmenuKeydown,
  focusedIndex,
  handleMenuKeydown,
  handleBeforeEnter,
  handleEnter
} = useContextMenuController({
  props,
  contextMenuRef: ContextMenuRef,
  menuRef,
  onSelect: (item) => emit('select', item),
  onReplyEmoji: (item) => emit('reply-emoji', item),
  onMenuShow: (show) => emit('menu-show', show)
})

// 暴露 show(event) 供外部手动触发（好友列表/会话列表右键），与 slot 包裹自动触发互补。
defineExpose({ show: handleContextMenu })
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/variable.scss' as *;
@use '@/styles/scss/mixins/liquid-glass' as *;

/* 右键菜单表面：subtle 材质 + 统一阴影/边框/字号（阶段 B4） */
@mixin context-glass-surface($position: fixed) {
  position: $position;
  @include liquid-glass-subtle;
  border-radius: 6px;
  color: var(--tjg-text-primary);
  box-shadow: var(--tjg-shadow-floating-menu);
  z-index: 999;
  width: fit-content;
  font-size: 14px;
  line-height: 1.8;
  white-space: nowrap;
  overflow: hidden;
}

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

/* 材质由外层 .context-menu（context-glass-surface）统一提供，内层不再叠加第二次模糊 */
@mixin menu-list {
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
        animation: twinkle var(--tjg-motion-duration-slow) ease-in-out;
      }
    }
  }
}

.context-menu {
  @include context-glass-surface;

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
  @include context-glass-surface;
  z-index: 1000;

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
