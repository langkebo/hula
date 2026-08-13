import { describe, expect, it } from 'vitest'
import { CRYPTO } from '../crypto'

describe('CRYPTO', () => {
  it('room keys endpoints', () => {
    expect(CRYPTO.ROOM_KEYS_RECOVER).toBe('/room_keys/recover')
    expect(CRYPTO.ROOM_KEYS_REQUEST).toBe('/room_keys/request')
  })

  it('verification endpoints built on PREFIX_V1', () => {
    expect(CRYPTO.VERIFY_START).toBe('/_matrix/client/v1/keys/device_signing/verify_start')
    expect(CRYPTO.QR_CODE_SHOW).toBe('/_matrix/client/v1/keys/qr_code/show')
    expect(CRYPTO.QR_CODE_SCAN).toBe('/_matrix/client/v1/keys/qr_code/scan')
  })
})
