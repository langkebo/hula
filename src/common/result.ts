export type Result<T, E = Error> = Ok<T, E> | Err<T, E>

export class Ok<T, E> {
  constructor(public readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true
  }

  isErr(): this is Err<T, E> {
    return false
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value))
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value)
  }

  unwrapOr(_defaultValue: T): T {
    return this.value
  }

  unwrap(): T {
    return this.value
  }

  match<U>(onOk: (value: T) => U, _onErr: (error: E) => U): U {
    return onOk(this.value)
  }
}

export class Err<T, E> {
  constructor(public readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false
  }

  isErr(): this is Err<T, E> {
    return true
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Err<U, E>(this.error)
  }

  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new Err<U, E>(this.error)
  }

  unwrapOr(defaultValue: T): T {
    return defaultValue
  }

  unwrap(): T {
    throw this.error instanceof Error ? this.error : new Error(String(this.error))
  }

  match<U>(_onOk: (value: T) => U, onErr: (error: E) => U): U {
    return onErr(this.error)
  }
}

export const ok = <T, E = Error>(value: T): Result<T, E> => new Ok(value)
export const err = <T, E = Error>(error: E): Result<T, E> => new Err(error)
