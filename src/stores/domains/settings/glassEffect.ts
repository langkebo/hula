/**
 * 液态玻璃效果偏好与性能档位联动（docs/UI优化方案-v2.4.md §7.1）
 *
 * 职责边界：
 * - 只保存**用户偏好**（mode / intensity / advancedRefraction），持久化到 localStorage；
 * - `tier` 是运行期性能判级结果，**不持久化**，由启动流程通过 `syncTier()` 写入，
 *   避免把某台设备的硬件结论带到另一台设备；
 * - 不写 DOM：`html.low-perf` / `html.medium-perf` 仍由 `applyPerformanceTier()` 负责，
 *   本 store 只在模块顶层之外读取档位（禁止在模块顶层访问 document）。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import { detectPerformanceTier, type PerformanceTier } from '@/utils/performanceTier'

/** 玻璃开关策略：auto 跟随档位、on 强制开启、off 完全关闭 */
export type GlassMode = 'auto' | 'on' | 'off'

/** 强度映射到的模糊 token（组件只消费 token，不自行拼 blur(px)） */
export type GlassBlurToken = '--tjg-glass-blur-soft' | '--tjg-glass-blur-medium' | '--tjg-glass-blur-strong'

/** 默认开关策略 */
export const DEFAULT_GLASS_MODE: GlassMode = 'auto'

/** 默认强度 */
export const DEFAULT_GLASS_INTENSITY = 0.8

/** 强度低于该值使用 soft 模糊 */
export const GLASS_INTENSITY_SOFT_MAX = 0.5

/** 强度低于该值使用 medium 模糊，其余使用 strong */
export const GLASS_INTENSITY_MEDIUM_MAX = 0.85

/**
 * 把 0-1 的强度映射到模糊 token。
 *
 * 非法输入（NaN / Infinity）按默认强度处理；越界值先夹取到 [0, 1]。
 */
export function resolveBlurToken(intensity: number): GlassBlurToken {
  const normalized = Number.isFinite(intensity) ? Math.min(Math.max(intensity, 0), 1) : DEFAULT_GLASS_INTENSITY

  if (normalized < GLASS_INTENSITY_SOFT_MAX) return '--tjg-glass-blur-soft'
  if (normalized < GLASS_INTENSITY_MEDIUM_MAX) return '--tjg-glass-blur-medium'
  return '--tjg-glass-blur-strong'
}

export const useGlassEffectStore = defineStore(
  StoresEnum.GLASS_EFFECT,
  () => {
    const mode = ref<GlassMode>(DEFAULT_GLASS_MODE)
    const intensity = ref(DEFAULT_GLASS_INTENSITY)
    const advancedRefraction = ref(false)
    /** 运行期性能档位；默认 high，启动时由 syncTier() 覆盖 */
    const tier = ref<PerformanceTier>('high')

    /** 是否允许使用 backdrop-filter：用户关闭玻璃或低性能档一律不允许 */
    const allowBackdrop = computed(() => mode.value !== 'off' && tier.value !== 'low')

    /** 折射增强三重门：用户显式开启 + high 档 + auto 模式 */
    const allowAdvancedRefraction = computed(
      () => advancedRefraction.value && tier.value === 'high' && mode.value === 'auto'
    )

    /** 当前强度对应的模糊 token */
    const blurToken = computed(() => resolveBlurToken(intensity.value))

    /** 同步性能档位（启动流程与运行期降级钩子调用） */
    function syncTier(next: PerformanceTier = detectPerformanceTier()): void {
      tier.value = next
    }

    /** 恢复默认偏好；档位属于运行期状态，刻意不重置 */
    function reset(): void {
      mode.value = DEFAULT_GLASS_MODE
      intensity.value = DEFAULT_GLASS_INTENSITY
      advancedRefraction.value = false
    }

    return {
      mode,
      intensity,
      advancedRefraction,
      tier,
      allowBackdrop,
      allowAdvancedRefraction,
      blurToken,
      syncTier,
      reset
    }
  },
  {
    persist: {
      pick: ['mode', 'intensity', 'advancedRefraction']
    }
  }
)
