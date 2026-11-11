import { describe, expect, it } from 'vitest'
import { mapMobileRtcCallProps } from '@/router/routes/mobile'

describe('mobileRtcCallProps', () => {
  it('maps the query sent by callers into page props', () => {
    const props = mapMobileRtcCallProps({
      remoteUserId: 'user-a',
      roomId: '!room:server',
      callType: '2',
      isIncoming: 'true',
      callId: 'call-1'
    })

    expect(props).toEqual({
      callId: 'call-1',
      roomId: '!room:server',
      isVideo: true,
      isIncoming: true,
      remoteUser: { userId: 'user-a' }
    })
  })

  it('treats numeric callType as video and missing isIncoming as outgoing', () => {
    const props = mapMobileRtcCallProps({ callType: 2, roomId: '!room:server' })

    expect(props.isVideo).toBe(true)
    expect(props.isIncoming).toBe(false)
    expect(props.callId).toBe('')
    expect(props.remoteUser).toBeUndefined()
  })

  it('maps audio calls and array query values', () => {
    const props = mapMobileRtcCallProps({ callType: ['1'], isIncoming: ['true'] })

    expect(props.isVideo).toBe(false)
    expect(props.isIncoming).toBe(true)
  })

  it('falls back to empty strings for missing keys', () => {
    expect(mapMobileRtcCallProps({})).toEqual({
      callId: '',
      roomId: '',
      isVideo: false,
      isIncoming: false,
      remoteUser: undefined
    })
  })
})
