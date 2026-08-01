import { vi } from 'vitest'

vi.mock('colorthief', () => ({
  default: class Colorthief {
    getColor = vi.fn()
    getPalette = vi.fn()
  }
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'encryption.device_verify_dialog.fingerprint_unavailable': '无法获取指纹',
        'encryption.verify_success': '设备验证成功',
        'encryption.restore_success': '恢复成功',
        'encryption.restore_backup_failed': '恢复失败',
        'encryption.device_verify_dialog.load_fingerprint_failed': '获取设备密钥失败',
        'encryption.device_verify_dialog.verify_failed': '验证失败',
        'encryption.recovery_key_required': '请输入恢复密钥',
        'encryption.backup_restore_dialog.restore_result_success': `成功恢复 ${params?.imported || 0} 个密钥`,
        'encryption.backup_restore_dialog.restore_result_failed': '恢复失败，请检查密钥是否正确',
        'encryption.backup_setup_dialog.dialog_title_show_key': '保存恢复密钥',
        'encryption.backup_setup_dialog.dialog_title_success': '设置完成',
        'encryption.backup_setup_dialog.copy_success': '已复制到剪贴板',
        'encryption.backup_setup_dialog.copy_failed': '复制失败',
        'encryption.backup_setup_dialog.copy_manual': '复制失败，请手动复制',
        'encryption.backup_setup_dialog.verify_success': '安全备份验证成功',
        'encryption.backup_setup_dialog.verify_failed': '验证备份失败',
        'encryption.backup_setup_dialog.create_failed': '创建安全备份失败，请稍后重试',
        'encryption.backup_setup_dialog.key_mismatch': '密钥不匹配，请重新输入',
        'encryption.backup_setup_dialog.backup_verify_failed': '备份验证失败，请重试',
        'encryption.backup.copy_success': '恢复密钥已复制到剪贴板',
        'encryption.backup.download_success': '恢复密钥已下载',
        'setting.burn_after_read.formats.seconds': `${params?.count}秒`,
        'setting.burn_after_read.formats.minutes': `${params?.count}分钟`,
        'setting.burn_after_read.formats.hours': `${params?.count}小时`,
        'setting.burn_after_read.formats.days': `${params?.count}天`
      }
      return translations[key] || key
    },
    locale: { value: 'zh-CN' }
  }),
  createI18n: vi.fn()
}))

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock Tauri plugin-log
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

// Mock Tauri plugin-clipboard-manager
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: vi.fn(),
  readImage: vi.fn(),
  writeText: vi.fn(),
  writeImage: vi.fn()
}))

// Mock Tauri plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readDir: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn().mockResolvedValue(undefined)
}))
