import { describe, expect, it } from 'vitest'
import { parseCommandError, translateTauriError } from '../tauriErrorTranslator'

describe('parseCommandError', () => {
  it('解析纯错误码', () => {
    expect(parseCommandError('ADMIN_NOT_LOGGED_IN')).toEqual({ code: 'ADMIN_NOT_LOGGED_IN' })
  })

  it('解析错误码与详情', () => {
    expect(parseCommandError('UPLOAD_SOURCE_MISSING: /tmp/a.txt')).toEqual({
      code: 'UPLOAD_SOURCE_MISSING',
      detail: '/tmp/a.txt'
    })
  })

  it('普通错误文案不当作错误码', () => {
    expect(parseCommandError('something went wrong')).toBeNull()
    expect(parseCommandError('网络连接失败')).toBeNull()
  })
})

describe('translateTauriError', () => {
  it('已登记错误码翻译为当前语言文案', () => {
    expect(translateTauriError('ADMIN_NOT_LOGGED_IN')).toBe('登录状态已失效，请重新登录')
  })

  it('详情按 detail 插值', () => {
    expect(translateTauriError('UPLOAD_SOURCE_MISSING: /tmp/a.txt')).toBe('上传源文件不存在: /tmp/a.txt')
  })

  it('未登记错误码原样返回', () => {
    expect(translateTauriError('UNKNOWN_CODE_XYZ')).toBe('UNKNOWN_CODE_XYZ')
  })

  it('普通错误文案原样返回', () => {
    expect(translateTauriError('something went wrong')).toBe('something went wrong')
  })
})
