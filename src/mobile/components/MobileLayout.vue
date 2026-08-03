<template>
  <div class="mobile-layout">
    <div class="mobile-container" :class="{ 'with-background': props.backgroundImage }">
      <!-- iOS Status Bar -->
      <div class="ios-statusbar">
        <span class="status-time">9:41</span>
        <div class="dynamic-island"></div>
        <div class="statusbar-right">
          <svg class="w-16px h-16px signal-icon" viewBox="0 0 24 24" fill="none">
            <path d="M2 18h2v2H2v-2zm4-4h2v6H6v-6zm4-4h2v10h-2V10zm4-4h2v14h-2V6zm4-2h2v18h-2V4z" fill="currentColor" />
          </svg>
          <span>5G</span>
          <div class="battery">
            <div class="battery-body">
              <div class="battery-level" style="width: 100%"></div>
            </div>
            <div class="battery-cap"></div>
          </div>
        </div>
      </div>

      <!-- Header Slot -->
      <div v-if="$slots.header" class="mobile-header">
        <slot name="header"></slot>
      </div>

      <!-- Content Slot -->
      <div class="mobile-content">
        <slot></slot>
      </div>

      <!-- Footer Slot -->
      <div v-if="$slots.footer" class="mobile-footer">
        <slot name="footer"></slot>
      </div>

      <!-- Home Indicator -->
      <div class="home-indicator"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MobileLayoutProps {
  /** 背景图片URL */
  backgroundImage?: string
}

const props = withDefaults(defineProps<MobileLayoutProps>(), {
  backgroundImage: ''
})
</script>

<style scoped lang="scss">
.mobile-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background: var(--hula-surface-app);
}

.mobile-container {
  width: 375px;
  height: 812px;
  background: var(--hula-surface-deepest);
  border-radius: 42px;
  overflow: hidden;
  box-shadow:
    var(--hula-shadow-panel),
    0 0 0 11px #1a1a1a,
    0 0 0 12px #2a2a2a;
  position: relative;
  display: flex;
  flex-direction: column;
}

.ios-statusbar {
  height: 44px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  background: var(--hula-surface-dark-mid);
  color: var(--hula-text-primary);
  position: relative;
}

.status-time {
  min-width: 36px;
}

.dynamic-island {
  position: absolute;
  top: 11px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 32px;
  background: #000;
  border-radius: 18px;
  z-index: 100;
}

.statusbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.signal-icon {
  color: var(--hula-text-primary);
}

.battery {
  display: flex;
  align-items: center;
  gap: 2px;
}

.battery-body {
  width: 22px;
  height: 11px;
  border: 1px solid var(--hula-text-primary);
  border-radius: 2px;
  padding: 1px;
  position: relative;
}

.battery-level {
  height: 100%;
  background: var(--hula-text-primary);
  border-radius: 1px;
}

.battery-cap {
  width: 2px;
  height: 5px;
  background: var(--hula-text-primary);
  border-radius: 0 1px 1px 0;
}

.mobile-header {
  flex-shrink: 0;
}

.mobile-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mobile-footer {
  flex-shrink: 0;
}

.home-indicator {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 130px;
  height: 4px;
  background: #fff;
  border-radius: 2px;
  opacity: 0.4;
  z-index: 50;
}

/* Mobile responsive: full width on actual mobile devices */
@media (max-width: 375px) {
  .mobile-layout {
    padding: 0;
  }

  .mobile-container {
    width: 100%;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }

  .home-indicator {
    display: none;
  }
}
</style>
