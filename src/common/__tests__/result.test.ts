import { describe, expect, it } from 'vitest'
import { Err, err, Ok, ok, type Result } from '../result'

describe('Result', () => {
  describe('Ok', () => {
    it('isOk returns true', () => {
      const result = new Ok(42)
      expect(result.isOk()).toBe(true)
    })

    it('isErr returns false', () => {
      const result = new Ok('value')
      expect(result.isErr()).toBe(false)
    })

    it('holds the value', () => {
      const result = new Ok({ data: 'test' })
      expect(result.value).toEqual({ data: 'test' })
    })
  })

  describe('Err', () => {
    it('isOk returns false', () => {
      const result = new Err(new Error('fail'))
      expect(result.isOk()).toBe(false)
    })

    it('isErr returns true', () => {
      const result = new Err(new Error('fail'))
      expect(result.isErr()).toBe(true)
    })

    it('holds the error', () => {
      const error = new Error('something went wrong')
      const result = new Err(error)
      expect(result.error).toBe(error)
    })
  })

  describe('ok helper', () => {
    it('creates an Ok result', () => {
      const result = ok(42)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(42)
      }
    })
  })

  describe('err helper', () => {
    it('creates an Err result', () => {
      const result = err(new Error('fail'))
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toBe('fail')
      }
    })
  })

  describe('type narrowing', () => {
    it('narrows Ok correctly', () => {
      const result: Result<number> = ok(10)
      if (result.isOk()) {
        expect(result.value).toBe(10)
      } else {
        expect.unreachable('Should be Ok')
      }
    })

    it('narrows Err correctly', () => {
      const result: Result<number> = err(new Error('oops'))
      if (result.isErr()) {
        expect(result.error.message).toBe('oops')
      } else {
        expect.unreachable('Should be Err')
      }
    })
  })

  describe('with custom error types', () => {
    it('supports string errors', () => {
      const result: Result<number, string> = err<number, string>('not found')
      if (result.isErr()) {
        expect(result.error).toBe('not found')
      }
    })

    it('supports complex error types', () => {
      type ApiError = { code: number; message: string }
      const result: Result<string, ApiError> = err<string, ApiError>({ code: 404, message: 'Not found' })
      if (result.isErr()) {
        expect(result.error.code).toBe(404)
      }
    })
  })
})
