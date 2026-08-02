import { describe, expect, it } from 'vitest'
import {
  bytesToHumanReadable,
  convertProperties,
  entriesToObject,
  fromQueryString,
  getAndConvert,
  msToHumanReadable,
  objectToEntries,
  toArray,
  toBoolean,
  toCSSDimension,
  toDate,
  toDisplayString,
  toEnumValue,
  toInteger,
  toISODateString,
  toMap,
  toNumber,
  toObject,
  toQueryString,
  toSet,
  toString,
  toTimestamp,
  toTypedArray,
  toURL,
  toURLString,
  tryConvert
} from '../type-conversions'

describe('基础类型转换', () => {
  describe('toString', () => {
    it('应该正确转换字符串', () => {
      expect(toString('hello')).toBe('hello')
    })

    it('应该正确转换数字', () => {
      expect(toString(42)).toBe('42')
      expect(toString(3.14)).toBe('3.14')
    })

    it('应该正确转换布尔值', () => {
      expect(toString(true)).toBe('true')
      expect(toString(false)).toBe('false')
    })

    it('应该返回默认值当值为 null 或 undefined', () => {
      expect(toString(null, 'default')).toBe('default')
      expect(toString(undefined, 'default')).toBe('default')
    })

    it('应该使用 String() 转换其他类型', () => {
      expect(toString({ a: 1 })).toBe('[object Object]')
    })
  })

  describe('toNumber', () => {
    it('应该正确转换数字', () => {
      expect(toNumber(42)).toBe(42)
      expect(toNumber(3.14)).toBe(3.14)
    })

    it('应该正确转换字符串数字', () => {
      expect(toNumber('42')).toBe(42)
      expect(toNumber('  3.14  ')).toBe(3.14)
    })

    it('应该转换空字符串为默认值', () => {
      expect(toNumber('', 99)).toBe(99)
    })

    it('应该转换无效字符串为默认值', () => {
      expect(toNumber('abc', 99)).toBe(99)
    })

    it('应该正确转换布尔值', () => {
      expect(toNumber(true)).toBe(1)
      expect(toNumber(false)).toBe(0)
    })

    it('应该返回默认值当值无法转换', () => {
      expect(toNumber(null, 99)).toBe(99)
      expect(toNumber(undefined, 99)).toBe(99)
    })
  })

  describe('toInteger', () => {
    it('应该正确转换整数', () => {
      expect(toInteger(42.7)).toBe(42)
      expect(toInteger('42.7')).toBe(42)
    })

    it('应该截断小数部分', () => {
      expect(toInteger(3.9)).toBe(3)
      expect(toInteger(-3.9)).toBe(-3)
    })

    it('应该返回默认值当值无效', () => {
      expect(toInteger('abc', 0)).toBe(0)
    })
  })

  describe('toBoolean', () => {
    it('应该正确转换布尔值', () => {
      expect(toBoolean(true)).toBe(true)
      expect(toBoolean(false)).toBe(false)
    })

    it('应该正确转换字符串布尔值', () => {
      expect(toBoolean('true')).toBe(true)
      expect(toBoolean('True')).toBe(true)
      expect(toBoolean('TRUE')).toBe(true)
      expect(toBoolean('false')).toBe(false)
      expect(toBoolean('False')).toBe(false)
      expect(toBoolean('FALSE')).toBe(false)
    })

    it('应该正确转换 yes/no', () => {
      expect(toBoolean('yes')).toBe(true)
      expect(toBoolean('no')).toBe(false)
    })

    it('应该正确转换 on/off', () => {
      expect(toBoolean('on')).toBe(true)
      expect(toBoolean('off')).toBe(false)
    })

    it('应该正确转换数字', () => {
      expect(toBoolean(1)).toBe(true)
      expect(toBoolean(0)).toBe(false)
      expect(toBoolean(42)).toBe(true)
    })

    it('应该返回默认值当值无效', () => {
      expect(toBoolean('maybe', true)).toBe(true)
      expect(toBoolean('maybe', false)).toBe(false)
    })
  })
})

describe('数组转换', () => {
  describe('toArray', () => {
    it('应该返回数组本身', () => {
      expect(toArray([1, 2, 3])).toEqual([1, 2, 3])
    })

    it('应该返回默认值当值不是数组', () => {
      expect(toArray(null, { defaultValue: [1] })).toEqual([1])
      expect(toArray(undefined, { defaultValue: [2] })).toEqual([2])
    })

    it('应该支持字符串分割', () => {
      expect(toArray('a,b,c', { splitString: true })).toEqual(['a', 'b', 'c'])
    })

    it('应该支持自定义分隔符', () => {
      expect(toArray('a|b|c', { splitString: true, delimiter: '|' })).toEqual(['a', 'b', 'c'])
    })
  })

  describe('toTypedArray', () => {
    it('应该正确映射数组元素', () => {
      const result = toTypedArray([1, 2, 3], (item) => (item as number) * 2)
      expect(result).toEqual([2, 4, 6])
    })

    it('应该过滤 null 和 undefined', () => {
      const result = toTypedArray([1, null, 3, undefined], (item) =>
        item === null || item === undefined ? null : (item as number) * 2
      )
      expect(result).toEqual([2, 6])
    })

    it('应该保留 null 当 filterNull 为 false', () => {
      const result = toTypedArray([1, null, 3], (item) => (item === null ? null : (item as number) * 2), {
        filterNull: false
      })
      expect(result).toEqual([2, null, 6])
    })

    it('应该返回默认值当值不是数组', () => {
      const result = toTypedArray(null, (item) => item, { defaultValue: [1, 2] })
      expect(result).toEqual([1, 2])
    })
  })
})

describe('对象转换', () => {
  describe('toObject', () => {
    it('应该返回对象本身', () => {
      expect(toObject({ a: 1 })).toEqual({ a: 1 })
    })

    it('应该解析 JSON 字符串', () => {
      expect(toObject('{"a":1}')).toEqual({ a: 1 })
    })

    it('应该返回默认值当值无效', () => {
      expect(toObject(null, { x: 1 })).toEqual({ x: 1 })
      expect(toObject('not json', { x: 1 })).toEqual({ x: 1 })
    })
  })

  describe('objectToEntries', () => {
    it('应该将对象转换为键值对数组', () => {
      expect(objectToEntries({ a: 1, b: 2 })).toEqual([
        ['a', 1],
        ['b', 2]
      ])
    })
  })

  describe('entriesToObject', () => {
    it('应该将键值对数组转换为对象', () => {
      expect(
        entriesToObject<string, number>([
          ['a', 1],
          ['b', 2]
        ])
      ).toEqual({ a: 1, b: 2 })
    })
  })
})

describe('日期时间转换', () => {
  describe('toDate', () => {
    it('应该返回 Date 对象本身', () => {
      const date = new Date()
      expect(toDate(date)).toEqual(date)
    })

    it('应该正确转换时间戳（毫秒）', () => {
      const result = toDate(1609459200000)
      expect(result?.getFullYear()).toBe(2021)
    })

    it('应该正确转换时间戳（秒）', () => {
      const result = toDate(1609459200)
      expect(result?.getFullYear()).toBe(2021)
    })

    it('应该正确转换日期字符串', () => {
      const result = toDate('2021-01-01')
      expect(result?.getFullYear()).toBe(2021)
    })

    it('应该返回默认值当值无效', () => {
      expect(toDate('invalid', null)).toBeNull()
    })
  })

  describe('toISODateString', () => {
    it('应该正确转换日期', () => {
      const result = toISODateString('2021-01-01')
      expect(result).toContain('2021')
    })

    it('应该返回默认值当值无效', () => {
      expect(toISODateString('invalid', 'default')).toBe('default')
    })
  })

  describe('toTimestamp', () => {
    it('应该正确转换日期', () => {
      expect(toTimestamp('2021-01-01')).toBeGreaterThan(0)
    })

    it('应该返回默认值当值无效', () => {
      expect(toTimestamp('invalid', 0)).toBe(0)
    })
  })
})

describe('URL 转换', () => {
  describe('toURL', () => {
    it('应该返回 URL 对象本身', () => {
      const url = new URL('https://example.com')
      expect(toURL(url)).toEqual(url)
    })

    it('应该正确转换字符串 URL', () => {
      const result = toURL('https://example.com')
      expect(result?.href).toBe('https://example.com/')
    })

    it('应该支持基础 URL', () => {
      const result = toURL('/path', 'https://example.com')
      expect(result?.href).toBe('https://example.com/path')
    })

    it('应该返回 null 当 URL 无效', () => {
      expect(toURL('not a url')).toBeNull()
    })
  })

  describe('toURLString', () => {
    it('应该正确转换 URL', () => {
      expect(toURLString('https://example.com')).toBe('https://example.com/')
    })

    it('应该返回默认值当 URL 无效', () => {
      expect(toURLString('invalid', 'default')).toBe('default')
    })
  })
})

describe('枚举转换', () => {
  enum TestEnum {
    A = 'a',
    B = 'b',
    C = 'c'
  }

  describe('toEnumValue', () => {
    it('应该正确匹配枚举值', () => {
      expect(toEnumValue('a', TestEnum, TestEnum.A)).toBe(TestEnum.A)
      expect(toEnumValue('b', TestEnum, TestEnum.A)).toBe(TestEnum.B)
    })

    it('应该支持大小写不敏感匹配', () => {
      expect(toEnumValue('A', TestEnum, TestEnum.C)).toBe(TestEnum.A)
      expect(toEnumValue('B', TestEnum, TestEnum.C)).toBe(TestEnum.B)
    })

    it('应该返回默认值当值不匹配', () => {
      expect(toEnumValue('d', TestEnum, TestEnum.C)).toBe(TestEnum.C)
    })
  })
})

describe('集合转换', () => {
  describe('toSet', () => {
    it('应该将数组转换为 Set', () => {
      const result = toSet([1, 2, 2, 3])
      expect(result).toBeInstanceOf(Set)
      expect(Array.from(result)).toEqual([1, 2, 3])
    })
  })

  describe('toMap', () => {
    it('应该将对象转换为 Map', () => {
      const result = toMap({ a: 1, b: 2 })
      expect(result).toBeInstanceOf(Map)
      expect(result.get('a')).toBe(1)
      expect(result.get('b')).toBe(2)
    })

    it('应该将数组转换为 Map', () => {
      const result = toMap([
        ['a', 1],
        ['b', 2]
      ])
      expect(result.get('a')).toBe(1)
      expect(result.get('b')).toBe(2)
    })

    it('应该返回 Map 本身', () => {
      const map = new Map([['a', 1]])
      expect(toMap(map)).toBe(map)
    })
  })
})

describe('格式化转换', () => {
  describe('bytesToHumanReadable', () => {
    it('应该正确格式化字节', () => {
      expect(bytesToHumanReadable(0)).toBe('0 B')
      expect(bytesToHumanReadable(1024)).toBe('1 KB')
      expect(bytesToHumanReadable(1024 * 1024)).toBe('1 MB')
      expect(bytesToHumanReadable(1024 * 1024 * 1024)).toBe('1 GB')
    })

    it('应该处理小数', () => {
      expect(bytesToHumanReadable(1536)).toBe('1.5 KB')
    })

    it('应该处理无效值', () => {
      expect(bytesToHumanReadable(-1)).toBe('Unknown')
    })
  })

  describe('msToHumanReadable', () => {
    it('应该正确格式化毫秒', () => {
      expect(msToHumanReadable(0)).toBe('0 seconds')
      expect(msToHumanReadable(5000)).toContain('5')
    })

    it('应该支持紧凑模式', () => {
      expect(msToHumanReadable(3600000, { compact: true })).toBe('1h 0m')
      expect(msToHumanReadable(60000, { compact: true })).toBe('1m 0s')
    })

    it('应该处理无效值', () => {
      expect(msToHumanReadable(-1)).toBe('0 seconds')
    })
  })
})

describe('安全转换', () => {
  describe('tryConvert', () => {
    it('应该成功转换有效值', () => {
      const result = tryConvert(
        '42',
        (v) => Number(v),
        (v) => !Number.isNaN(v),
        0
      )
      expect(result).toBe(42)
    })

    it('应该在验证失败时返回默认值', () => {
      const result = tryConvert(
        'abc',
        (v) => Number(v),
        (v) => !Number.isNaN(v),
        0
      )
      expect(result).toBe(0)
    })

    it('应该在转换异常时返回默认值', () => {
      const result = tryConvert(
        'test',
        () => {
          throw new Error('conversion error')
        },
        () => true,
        0
      )
      expect(result).toBe(0)
    })
  })

  describe('convertProperties', () => {
    it('应该转换对象属性', () => {
      const source = { name: 'John', age: '30', active: 'true' }
      const result = convertProperties(source, {
        name: (v) => String(v),
        age: (v) => Number(v),
        active: (v) => Boolean(v)
      })

      expect(result).toEqual({
        name: 'John',
        age: 30,
        active: true
      })
    })
  })
})

describe('特殊转换', () => {
  describe('toQueryString', () => {
    it('应该正确生成查询字符串', () => {
      expect(toQueryString({ a: 1, b: 'hello' })).toBe('a=1&b=hello')
    })

    it('应该处理数组', () => {
      expect(toQueryString({ a: [1, 2] })).toBe('a=1&a=2')
    })

    it('应该跳过 null 和 undefined', () => {
      expect(toQueryString({ a: 1, b: null, c: undefined })).toBe('a=1')
    })

    it('应该编码特殊字符', () => {
      expect(toQueryString({ a: 'hello world' })).toBe('a=hello%20world')
    })
  })

  describe('fromQueryString', () => {
    it('应该正确解析查询字符串', () => {
      expect(fromQueryString('a=1&b=hello')).toEqual({ a: '1', b: 'hello' })
    })

    it('应该处理重复键', () => {
      expect(fromQueryString('a=1&a=2')).toEqual({ a: ['1', '2'] })
    })

    it('应该处理空字符串', () => {
      expect(fromQueryString('')).toEqual({})
    })

    it('应该处理带问号的字符串', () => {
      expect(fromQueryString('?a=1&b=2')).toEqual({ a: '1', b: '2' })
    })
  })

  describe('toCSSDimension', () => {
    it('应该正确转换数字', () => {
      expect(toCSSDimension(42)).toBe('42px')
      expect(toCSSDimension(42, 'em')).toBe('42em')
    })

    it('应该保留带单位的字符串', () => {
      expect(toCSSDimension('42px')).toBe('42px')
      expect(toCSSDimension('42%')).toBe('42%')
      expect(toCSSDimension('2rem')).toBe('2rem')
    })

    it('应该返回 0 当值无效', () => {
      expect(toCSSDimension('invalid')).toBe('0')
    })
  })

  describe('getAndConvert', () => {
    it('应该获取并转换嵌套属性', () => {
      const obj = { user: { age: '30' } }
      const result = getAndConvert(obj, 'user.age', (v) => Number(v), 0)
      expect(result).toBe(30)
    })

    it('应该在路径不存在时返回默认值', () => {
      const obj = { user: {} }
      const result = getAndConvert(obj, 'user.age', (v) => Number(v), 0)
      expect(result).toBe(0)
    })

    it('应该在转换异常时返回默认值', () => {
      const obj = { user: { age: 'not a number' } }
      const result = getAndConvert(
        obj,
        'user.age',
        () => {
          throw new Error('conversion error')
        },
        0
      )
      expect(result).toBe(0)
    })
  })

  describe('toDisplayString', () => {
    it('应该正确转换各种类型', () => {
      expect(toDisplayString(null)).toBe('null')
      expect(toDisplayString(undefined)).toBe('undefined')
      expect(toDisplayString('hello')).toBe('hello')
      expect(toDisplayString(42)).toBe('42')
      expect(toDisplayString(true)).toBe('true')
    })

    it('应该支持自定义标签', () => {
      expect(toDisplayString(null, { nullLabel: 'N/A' })).toBe('N/A')
    })

    it('应该处理对象', () => {
      expect(toDisplayString({ a: 1 })).toBe('{"a":1}')
    })

    it('应该处理循环引用', () => {
      const obj: Record<string, unknown> = { a: 1 }
      obj.self = obj
      expect(toDisplayString(obj)).toBe('[Object]')
    })
  })
})
