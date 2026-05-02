import { describe, expect, it } from 'vitest'
import {
  andThen,
  Err,
  fromNullable,
  getOrElse,
  isErr,
  isOk,
  map,
  mapErr,
  Ok,
  tryCatch,
  tryCatchSync,
  unwrap,
  unwrapOrElse
} from '../Result'

describe('Result', () => {
  describe('Ok / Err', () => {
    it('creates a success result', () => {
      const result = Ok(42)
      expect(result).toEqual({ ok: true, value: 42 })
    })

    it('creates an error result', () => {
      const err = new Error('boom')
      const result = Err(err)
      expect(result).toEqual({ ok: false, error: err })
    })
  })

  describe('isOk / isErr', () => {
    it('isOk narrows success branch', () => {
      const result = Ok('hi')
      expect(isOk(result)).toBe(true)
      expect(isErr(result)).toBe(false)
    })

    it('isErr narrows error branch', () => {
      const result = Err(new Error('x'))
      expect(isErr(result)).toBe(true)
      expect(isOk(result)).toBe(false)
    })
  })

  describe('fromNullable', () => {
    it('returns Ok for non-null values', () => {
      expect(fromNullable(0, new Error('x'))).toEqual(Ok(0))
      expect(fromNullable('', new Error('x'))).toEqual(Ok(''))
      expect(fromNullable({ a: 1 }, new Error('x'))).toEqual(Ok({ a: 1 }))
    })

    it('returns Err for null or undefined', () => {
      const err = new Error('missing')
      expect(fromNullable(null, err)).toEqual(Err(err))
      expect(fromNullable(undefined, err)).toEqual(Err(err))
    })
  })

  describe('tryCatch', () => {
    it('captures resolved value as Ok', async () => {
      const result = await tryCatch(async () => 'ok')
      expect(result).toEqual(Ok('ok'))
    })

    it('captures thrown error as Err', async () => {
      const result = await tryCatch(async () => {
        throw new Error('fail')
      })
      expect(isErr(result)).toBe(true)
      if (isErr(result)) expect(result.error).toBeInstanceOf(Error)
    })

    it('applies mapError when provided', async () => {
      const result = await tryCatch(
        async () => {
          throw new Error('original')
        },
        (e) => `mapped:${(e as Error).message}`
      )
      expect(result).toEqual(Err('mapped:original'))
    })
  })

  describe('tryCatchSync', () => {
    it('captures returned value as Ok', () => {
      expect(tryCatchSync(() => 7)).toEqual(Ok(7))
    })

    it('captures thrown error', () => {
      const result = tryCatchSync(() => {
        throw new Error('fail')
      })
      expect(isErr(result)).toBe(true)
    })
  })

  describe('map / mapErr', () => {
    it('map transforms Ok values', () => {
      expect(map(Ok(2), (n) => n * 3)).toEqual(Ok(6))
    })

    it('map leaves Err untouched', () => {
      const err = Err(new Error('x'))
      expect(map(err, (n: number) => n * 3)).toBe(err)
    })

    it('mapErr transforms Err values', () => {
      expect(mapErr(Err('a'), (e) => e.toUpperCase())).toEqual(Err('A'))
    })

    it('mapErr leaves Ok untouched', () => {
      const ok = Ok(1)
      expect(mapErr(ok, (e: string) => e.toUpperCase())).toBe(ok)
    })
  })

  describe('andThen', () => {
    it('chains Ok results', () => {
      const result = andThen(Ok(2), (n) => Ok(n + 1))
      expect(result).toEqual(Ok(3))
    })

    it('short-circuits on Err', () => {
      const err = Err(new Error('x'))
      const result = andThen(err, (n: number) => Ok(n + 1))
      expect(result).toBe(err)
    })

    it('propagates inner Err', () => {
      const inner = Err(new Error('inner'))
      const result = andThen(Ok(2), () => inner)
      expect(result).toBe(inner)
    })
  })

  describe('getOrElse / unwrap / unwrapOrElse', () => {
    it('getOrElse returns value when Ok', () => {
      expect(getOrElse(Ok(5), 99)).toBe(5)
    })

    it('getOrElse returns default when Err', () => {
      expect(getOrElse<number, Error>(Err(new Error('x')), 99)).toBe(99)
    })

    it('unwrap returns value when Ok', () => {
      expect(unwrap(Ok(5))).toBe(5)
    })

    it('unwrap throws when Err', () => {
      const err = new Error('boom')
      expect(() => unwrap(Err(err))).toThrow(err)
    })

    it('unwrapOrElse returns Ok value as-is', () => {
      expect(unwrapOrElse(Ok(5), () => 0)).toBe(5)
    })

    it('unwrapOrElse calls fn with error on Err', () => {
      const result = unwrapOrElse(Err('bad'), (e) => `recovered:${e}`)
      expect(result).toBe('recovered:bad')
    })
  })
})
