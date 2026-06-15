import { describe, expect, it } from 'vitest'
import { Err, err, Ok, ok, type Result } from '@/common/result'

describe('Result', () => {
  describe('Ok', () => {
    it('ok() creates Ok success result', () => {
      const result = ok(42)
      expect(result).toBeInstanceOf(Ok)
      expect(result.isOk()).toBe(true)
      expect(result.isErr()).toBe(false)
    })

    it('Ok stores value correctly', () => {
      const result = ok('hello')
      expect((result as Ok<string, Error>).value).toBe('hello')
    })

    it('Ok stores object value correctly', () => {
      const obj = { name: 'test', count: 1 }
      const result = ok(obj)
      expect((result as Ok<typeof obj, Error>).value).toEqual({ name: 'test', count: 1 })
    })

    it('Ok stores null value', () => {
      const result = ok<null>(null)
      expect(result.isOk()).toBe(true)
      expect((result as Ok<null, Error>).value).toBeNull()
    })

    it('Ok stores undefined value', () => {
      const result = ok<undefined>(undefined)
      expect(result.isOk()).toBe(true)
      expect((result as Ok<undefined, Error>).value).toBeUndefined()
    })

    it('Ok stores array value', () => {
      const arr = [1, 2, 3]
      const result = ok(arr)
      expect((result as Ok<number[], Error>).value).toEqual([1, 2, 3])
    })

    it('Ok type guard works in conditional', () => {
      const result: Result<string> = ok('data')
      if (result.isOk()) {
        expect(result.value).toBe('data')
      }
    })
  })

  describe('Err', () => {
    it('err() creates Err failure result', () => {
      const error = new Error('something went wrong')
      const result = err(error)
      expect(result).toBeInstanceOf(Err)
      expect(result.isOk()).toBe(false)
      expect(result.isErr()).toBe(true)
    })

    it('Err stores error correctly', () => {
      const error = new Error('test error')
      const result = err(error)
      expect((result as Err<unknown, Error>).error).toBe(error)
      expect((result as Err<unknown, Error>).error.message).toBe('test error')
    })

    it('Err stores custom error type', () => {
      const customErr = { code: 500, reason: 'Internal Error' }
      const result = err(customErr)
      expect((result as unknown as Err<unknown, Error>).error).toEqual({ code: 500, reason: 'Internal Error' })
    })

    it('Err stores null-like error', () => {
      const result = err<unknown, null>(null)
      expect(result.isErr()).toBe(true)
      expect((result as Err<unknown, null>).error).toBeNull()
    })

    it('Err type guard works in conditional', () => {
      const result: Result<number> = err(new Error('fail'))
      if (result.isErr()) {
        expect(result.error).toBeDefined()
      }
    })

    it('Err with string error', () => {
      const result = err('error string')
      expect((result as Err<unknown, string>).error).toBe('error string')
    })
  })

  describe('Result discriminated union', () => {
    it('handles both Ok and Err branches', () => {
      function handleResult<T, E>(r: Result<T, E>): string {
        if (r.isOk()) {
          return `ok: ${String(r.value)}`
        }
        return `err: ${(r as Err<T, E>).error}`
      }

      expect(handleResult(ok('yes'))).toBe('ok: yes')
      expect(handleResult(err('no'))).toBe('err: no')
    })

    it('supports pattern matching with switch-like logic', () => {
      const success: Result<number> = ok(100)
      const failure: Result<number> = err(new Error('bad'))

      const unwrap = <T>(r: Result<T>): T | null => {
        if (r.isOk()) return r.value
        return null
      }

      expect(unwrap(success)).toBe(100)
      expect(unwrap(failure)).toBeNull()
    })

    it('unwraps value from Ok', () => {
      const result = ok('value')
      if (result.isOk()) {
        expect(result.value).toBe('value')
      }
    })

    it('reads error from Err', () => {
      const result = err(new Error('failed'))
      if (result.isErr()) {
        expect(result.error.message).toBe('failed')
      }
    })
  })

  describe('edge cases', () => {
    it('ok with 0 value', () => {
      const result = ok(0)
      expect(result.isOk()).toBe(true)
      expect((result as Ok<number, Error>).value).toBe(0)
    })

    it('ok with empty string', () => {
      const result = ok('')
      expect(result.isOk()).toBe(true)
      expect((result as Ok<string, Error>).value).toBe('')
    })

    it('ok with false value', () => {
      const result = ok(false)
      expect(result.isOk()).toBe(true)
      expect((result as Ok<boolean, Error>).value).toBe(false)
    })

    it('err with Error instance', () => {
      const result = err(new Error('oops'))
      expect(result).toBeInstanceOf(Err)
    })

    it('Result type accepts generic params', () => {
      const success: Result<{ id: number; name: string }> = ok({ id: 1, name: 'test' })
      const failure: Result<{ id: number; name: string }, Error> = err(new Error('fail'))

      expect(success.isOk()).toBe(true)
      expect(failure.isErr()).toBe(true)
    })

    it('large number of Ok/Err creations does not throw', () => {
      for (let i = 0; i < 1000; i++) {
        const result = i % 2 === 0 ? ok(i) : err(new Error(String(i)))
        expect(result.isOk() || result.isErr()).toBe(true)
      }
    })
  })

  describe('map', () => {
    it('maps Ok value', () => {
      const result = ok(5).map((x) => x * 2)
      expect(result.isOk()).toBe(true)
      expect((result as Ok<number, Error>).value).toBe(10)
    })

    it('maps Ok to different type', () => {
      const result = ok(42).map((x) => `value: ${x}`)
      expect(result.isOk()).toBe(true)
      expect((result as Ok<string, Error>).value).toBe('value: 42')
    })

    it('map passes through Err unchanged', () => {
      const error = new Error('fail')
      const result = err<number>(error).map((x) => x * 2)
      expect(result.isErr()).toBe(true)
      expect((result as Err<unknown, Error>).error).toBe(error)
    })

    it('map can be chained', () => {
      const result = ok(2)
        .map((x) => x + 3)
        .map((x) => x * 10)
      expect(result.isOk()).toBe(true)
      expect((result as Ok<number, Error>).value).toBe(50)
    })
  })

  describe('flatMap', () => {
    it('flatMap Ok with Ok return', () => {
      const result = ok(5).flatMap((x) => ok(x * 2))
      expect(result.isOk()).toBe(true)
      expect((result as Ok<number, Error>).value).toBe(10)
    })

    it('flatMap Ok with Err return', () => {
      const result = ok(5).flatMap(() => err<number>(new Error('converted')))
      expect(result.isErr()).toBe(true)
      expect((result as Err<number, Error>).error.message).toBe('converted')
    })

    it('flatMap passes through Err', () => {
      const error = new Error('original')
      const result = err<number>(error).flatMap((x) => ok(x * 2))
      expect(result.isErr()).toBe(true)
      expect((result as Err<unknown, Error>).error).toBe(error)
    })

    it('flatMap can chain with short-circuit', () => {
      const validate = (n: number): Result<number> => (n > 0 ? ok(n) : err<number>(new Error('negative')))
      const double = (n: number): Result<number> => ok(n * 2)

      expect(ok(5).flatMap(validate).flatMap(double).unwrap()).toBe(10)
      expect(ok(-1).flatMap(validate).flatMap(double).isErr()).toBe(true)
    })
  })

  describe('unwrapOr', () => {
    it('unwrapOr returns value for Ok', () => {
      expect(ok(42).unwrapOr(0)).toBe(42)
    })

    it('unwrapOr returns default for Err', () => {
      expect(err<number>(new Error('fail')).unwrapOr(99)).toBe(99)
    })

    it('unwrapOr with null default', () => {
      expect(err<string>(new Error('fail')).unwrapOr(null as unknown as string)).toBeNull()
    })
  })

  describe('unwrap', () => {
    it('unwrap returns value for Ok', () => {
      expect(ok('hello').unwrap()).toBe('hello')
    })

    it('unwrap throws for Err with Error instance', () => {
      expect(() => err(new Error('boom')).unwrap()).toThrow('boom')
    })

    it('unwrap throws for Err with string error', () => {
      expect(() => err<string, string>('boom').unwrap()).toThrow('boom')
    })
  })

  describe('match', () => {
    it('match calls onOk for Ok', () => {
      const result = ok(42).match(
        (v) => `got: ${v}`,
        (e) => `error: ${e}`
      )
      expect(result).toBe('got: 42')
    })

    it('match calls onErr for Err', () => {
      const result = err<number>(new Error('fail')).match(
        (v) => `got: ${v}`,
        (e) => `error: ${(e as Error).message}`
      )
      expect(result).toBe('error: fail')
    })

    it('match returns different types', () => {
      const num: number = ok(10).match(
        (v) => v * 2,
        () => 0
      )
      expect(num).toBe(20)

      const def: number = err<number>(new Error('x')).match(
        (v) => v,
        () => -1
      )
      expect(def).toBe(-1)
    })
  })
})
