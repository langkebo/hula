import { describe, expect, it } from 'vitest'
import { validateWorkerMessage } from '../workerMessageValidation'

describe('validateWorkerMessage', () => {
  it('rejects non-object messages', () => {
    const result = validateWorkerMessage('not-an-object')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.type).toBe('')
      expect(result.id).toBe('')
    }
  })

  it('rejects a message without a non-empty type', () => {
    const result = validateWorkerMessage({ id: '1', type: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('"type"')
      expect(result.id).toBe('1')
    }
  })

  it('rejects a message without a non-empty id', () => {
    const result = validateWorkerMessage({ type: 'ping', id: 42 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('"id"')
      expect(result.type).toBe('ping')
    }
  })

  it('keeps unknown message types valid at the envelope level', () => {
    const result = validateWorkerMessage({ type: 'does.not.exist', id: '7', payload: { a: 1 } })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.message.type).toBe('does.not.exist')
      expect(result.value.message.id).toBe('7')
    }
  })

  it('does not validate payload for message types without a schema', () => {
    const result = validateWorkerMessage({ type: 'ping', id: '1', payload: { anything: true } })
    expect(result.ok).toBe(true)
  })

  describe('initialize', () => {
    it('requires a non-empty homeserverUrl', () => {
      expect(validateWorkerMessage({ type: 'initialize', id: '1', payload: {} }).ok).toBe(false)
      expect(validateWorkerMessage({ type: 'initialize', id: '1', payload: { homeserverUrl: '' } }).ok).toBe(false)
    })

    it('accepts a valid config and ignores unknown fields', () => {
      const result = validateWorkerMessage({
        type: 'initialize',
        id: '1',
        payload: { homeserverUrl: 'https://hs.example', accessToken: 'token', future: 'ignored' }
      })
      expect(result.ok).toBe(true)
    })

    it('rejects wrong optional field types', () => {
      const result = validateWorkerMessage({
        type: 'initialize',
        id: '1',
        payload: { homeserverUrl: 'https://hs.example', allowInsecureHttp: 'yes' }
      })
      expect(result.ok).toBe(false)
    })
  })

  describe('login', () => {
    it('requires username and string password', () => {
      expect(validateWorkerMessage({ type: 'login', id: '1', payload: { password: 'x' } }).ok).toBe(false)
      expect(validateWorkerMessage({ type: 'login', id: '1', payload: { username: 'u' } }).ok).toBe(false)
    })

    it('accepts a valid login payload', () => {
      expect(validateWorkerMessage({ type: 'login', id: '1', payload: { username: 'u', password: 'p' } }).ok).toBe(true)
    })
  })

  describe('probe handlers', () => {
    const cases = ['getServerVersions', 'getLoginFlows', 'probeCors']
    for (const type of cases) {
      it(`${type} requires baseUrl`, () => {
        expect(validateWorkerMessage({ type, id: '1', payload: {} }).ok).toBe(false)
        expect(validateWorkerMessage({ type, id: '1', payload: { baseUrl: 'https://hs' } }).ok).toBe(true)
      })
    }

    it('probeSlidingSyncEndpoints requires a string array', () => {
      expect(
        validateWorkerMessage({ type: 'probeSlidingSyncEndpoints', id: '1', payload: { baseUrl: 'https://hs' } }).ok
      ).toBe(false)
      expect(
        validateWorkerMessage({
          type: 'probeSlidingSyncEndpoints',
          id: '1',
          payload: { baseUrl: 'https://hs', endpoints: [1, 2] }
        }).ok
      ).toBe(false)
      expect(
        validateWorkerMessage({
          type: 'probeSlidingSyncEndpoints',
          id: '1',
          payload: { baseUrl: 'https://hs', endpoints: ['/_matrix/...'] }
        }).ok
      ).toBe(true)
    })

    it('getCapabilities requires baseUrl and accessToken', () => {
      expect(validateWorkerMessage({ type: 'getCapabilities', id: '1', payload: { baseUrl: 'https://hs' } }).ok).toBe(
        false
      )
      expect(
        validateWorkerMessage({
          type: 'getCapabilities',
          id: '1',
          payload: { baseUrl: 'https://hs', accessToken: 't' }
        }).ok
      ).toBe(true)
    })
  })

  describe('search handlers', () => {
    it('tolerates missing payload for room/event upserts', () => {
      expect(validateWorkerMessage({ type: 'search.upsertRooms', id: '1' }).ok).toBe(true)
      expect(validateWorkerMessage({ type: 'search.upsertEvents', id: '1' }).ok).toBe(true)
    })

    it('rejects non-array rooms/events', () => {
      expect(validateWorkerMessage({ type: 'search.upsertRooms', id: '1', payload: { rooms: 'x' } }).ok).toBe(false)
      expect(validateWorkerMessage({ type: 'search.upsertEvents', id: '1', payload: { events: 3 } }).ok).toBe(false)
    })

    it('rejects arrays with non-object entries', () => {
      expect(validateWorkerMessage({ type: 'search.upsertRooms', id: '1', payload: { rooms: ['x'] } }).ok).toBe(false)
    })

    it('accepts valid rooms/events arrays', () => {
      expect(
        validateWorkerMessage({ type: 'search.upsertRooms', id: '1', payload: { rooms: [{ roomId: 'r' }] } }).ok
      ).toBe(true)
      expect(
        validateWorkerMessage({ type: 'search.upsertEvents', id: '1', payload: { events: [{ eventId: 'e' }] } }).ok
      ).toBe(true)
    })

    it('validates optional string fields for redact/remove', () => {
      expect(validateWorkerMessage({ type: 'search.redactEvent', id: '1', payload: { eventId: 1 } }).ok).toBe(false)
      expect(validateWorkerMessage({ type: 'search.removeRoom', id: '1', payload: { roomId: 1 } }).ok).toBe(false)
      expect(validateWorkerMessage({ type: 'search.redactEvent', id: '1', payload: { eventId: 'e' } }).ok).toBe(true)
      expect(validateWorkerMessage({ type: 'search.removeRoom', id: '1', payload: { roomId: 'r' } }).ok).toBe(true)
    })

    it('validates the search query payload', () => {
      expect(validateWorkerMessage({ type: 'search.query', id: '1', payload: {} }).ok).toBe(false)
      expect(validateWorkerMessage({ type: 'search.query', id: '1', payload: { term: 'a', scope: 'other' } }).ok).toBe(
        false
      )
      expect(validateWorkerMessage({ type: 'search.query', id: '1', payload: { term: 'a', limit: 'x' } }).ok).toBe(
        false
      )
      expect(
        validateWorkerMessage({ type: 'search.query', id: '1', payload: { term: 'a', scope: 'rooms', limit: 5 } }).ok
      ).toBe(true)
    })
  })
})
