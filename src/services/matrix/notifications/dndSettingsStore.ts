import { createLogger } from '@/utils/Logger'
import { clearDndMirrorIfAccountChanged, DND_MIRROR_STORAGE_KEYS, markDndMirrorOwner } from './dndMirror'
import { type DndWindow, type DndWindowInput, isWithinDndWindow } from './dndWindow'

const logger = createLogger('DndSettingsStore')

/** localStorage 镜像值 → 时间戳；非法值视为未配置（null），不猜。 */
function parseStoredDndTimestamp(value: string | null): number | null {
  if (value === null) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 设备本地勿扰时段（DND）的所有者。
 *
 * 独立于 `MatrixNotificationService`：服务只负责账号数据同步的编排，
 * 「内存值 + localStorage 镜像 + 换号作废」这套本地状态收敛在这里，
 * 保证 `getDndSettings` / `setDndSettings` / 通知决策门读到同一份窗口。
 */
export class DndSettingsStore {
  private settings: DndWindow = { enabled: false, startTime: null, endTime: null, updatedAt: 0 }

  /** 当前窗口副本（调用前应先 `load()` 从镜像刷新，跨窗口改动才会生效）。 */
  get(): DndWindow {
    return { ...this.settings }
  }

  /**
   * 从 localStorage 镜像同步水合。
   *
   * 读取前先做账号归属校验：镜像 owner 与当前账号不一致（换账号）时整份作废，
   * 避免上一个账号较新的 `updatedAt` 挡住新账号的服务端值（见 `dndMirror`）。
   * 读取成功后记录当前账号为 owner。
   */
  load(currentUserId: string | null): DndWindow {
    try {
      if (clearDndMirrorIfAccountChanged(currentUserId)) {
        this.settings = { enabled: false, startTime: null, endTime: null, updatedAt: 0 }
        return this.get()
      }

      this.settings = {
        enabled: localStorage.getItem(DND_MIRROR_STORAGE_KEYS.enabled) === 'true',
        startTime: parseStoredDndTimestamp(localStorage.getItem(DND_MIRROR_STORAGE_KEYS.start)),
        endTime: parseStoredDndTimestamp(localStorage.getItem(DND_MIRROR_STORAGE_KEYS.end)),
        updatedAt: parseStoredDndTimestamp(localStorage.getItem(DND_MIRROR_STORAGE_KEYS.updatedAt)) ?? 0
      }
      markDndMirrorOwner(currentUserId)
    } catch (err) {
      logger.warn('读取勿扰时段设置失败:', err)
    }
    return this.get()
  }

  /**
   * 本地镜像里是否曾经写过 DND。
   *
   * 只用于区分「本地从未配置过」（应当采纳服务端的旧 payload）与
   * 「本地有值但旧 payload 没有 updatedAt」（本地赢），见 `syncDndFromAccountData`。
   */
  hasMirror(): boolean {
    try {
      return (
        localStorage.getItem(DND_MIRROR_STORAGE_KEYS.enabled) !== null ||
        localStorage.getItem(DND_MIRROR_STORAGE_KEYS.updatedAt) !== null
      )
    } catch {
      return false
    }
  }

  /**
   * 把勿扰时段（含 `updatedAt`）写入 localStorage 镜像，账号数据水合与用户改动共用。
   *
   * 同时记录 owner uid，供下次读取做换号判定。
   */
  set(settings: DndWindow, currentUserId: string | null): DndWindow {
    this.settings = { ...settings }
    this.writeMirror(currentUserId)
    return this.get()
  }

  /** 直接覆盖内存值（账号数据拉取成功时用），是否落镜像由调用方决定。 */
  replace(settings: DndWindow): DndWindow {
    this.settings = { ...settings }
    return this.get()
  }

  /** 把当前窗口写入 localStorage 镜像（写入失败只记警告）。 */
  writeMirror(currentUserId: string | null): void {
    try {
      localStorage.setItem(DND_MIRROR_STORAGE_KEYS.enabled, this.settings.enabled.toString())
      this.writeMirroredTimestamp(DND_MIRROR_STORAGE_KEYS.start, this.settings.startTime)
      this.writeMirroredTimestamp(DND_MIRROR_STORAGE_KEYS.end, this.settings.endTime)
      this.writeMirroredTimestamp(DND_MIRROR_STORAGE_KEYS.updatedAt, this.settings.updatedAt)
      markDndMirrorOwner(currentUserId)
    } catch (err) {
      logger.warn('写入勿扰时段设置失败:', err)
    }
  }

  /**
   * 用调用方传入的窗口 + 服务打点的 `updatedAt` 构造一份新设置并写入镜像。
   *
   * `updatedAt` 由服务打点，调用方不需要（也不能）伪造。
   */
  applyInput(settings: DndWindowInput, currentUserId: string | null, updatedAt: number = Date.now()): DndWindow {
    return this.set(
      {
        enabled: settings.enabled,
        startTime: settings.startTime,
        endTime: settings.endTime,
        updatedAt
      },
      currentUserId
    )
  }

  /** 当前是否处于勿扰窗口；`now` 可注入，便于测试与纯函数保持一致。 */
  isActive(now: Date = new Date()): boolean {
    return isWithinDndWindow(this.settings, now)
  }

  private writeMirroredTimestamp(key: string, value: number | null): void {
    if (value === null) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, value.toString())
  }
}
