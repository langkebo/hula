import { describe, expect, it } from 'vitest'
import {
  SPACE_ROUTE_NAMES,
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  buildSpaceWorkbenchQuery,
  buildCreateSpaceRoute,
  buildSpaceRoute,
  buildSpaceWorkbenchRoute,
  normalizeWorkbenchSearch,
  normalizeWorkbenchSessionSort,
  normalizeWorkbenchSessionTypeFilter,
  normalizeSpaceId,
  readSpaceWorkbenchSearch,
  readSpaceWorkbenchSessionSort,
  readSpaceWorkbenchSessionTypeFilter,
  readSpaceWorkbenchSpaceId
} from '@/router/spaceNavigation'
import { getDesktopRoutes } from '@/router/routes/desktop'

describe('spaceNavigation', () => {
  it('normalizes and builds legacy space routes consistently', () => {
    expect(normalizeSpaceId('  !space:server  ')).toBe('!space:server')
    expect(normalizeSpaceId(undefined)).toBe('')

    expect(buildCreateSpaceRoute()).toEqual({ name: SPACE_ROUTE_NAMES.create })
    expect(buildSpaceRoute('  !space:server  ', { foo: 'bar' })).toEqual({
      name: SPACE_ROUTE_NAMES.legacy,
      params: { roomId: '!space:server' },
      query: { foo: 'bar' }
    })
  })

  it('builds workbench routes without leaking stale space ids', () => {
    expect(
      buildSpaceWorkbenchQuery('  !space:server  ', {
        foo: 'bar',
        search: '  hello  ',
        type: ' group ',
        sort: ' name '
      })
    ).toEqual({
      foo: 'bar',
      search: 'hello',
      sort: 'name',
      spaceId: '!space:server',
      type: 'group'
    })

    expect(
      buildSpaceWorkbenchQuery('', { foo: 'bar', search: '   ', spaceId: 'old-space', type: 'all', sort: 'recent' })
    ).toEqual({
      foo: 'bar'
    })

    expect(
      buildSpaceWorkbenchRoute('  !space:server  ', {
        foo: 'bar',
        search: '  hello  ',
        type: ' group ',
        sort: ' name '
      })
    ).toEqual({
      name: SPACE_ROUTE_NAMES.workbench,
      query: { foo: 'bar', search: 'hello', sort: 'name', spaceId: '!space:server', type: 'group' }
    })

    expect(
      buildSpaceWorkbenchRoute('', { foo: 'bar', search: '   ', spaceId: 'old-space', type: 'all', sort: 'recent' })
    ).toEqual({
      name: SPACE_ROUTE_NAMES.workbench,
      query: { foo: 'bar' }
    })
  })

  it('reads the normalized workbench query state from route queries', () => {
    expect(normalizeWorkbenchSearch('  hello  ')).toBe('hello')
    expect(normalizeWorkbenchSearch(undefined)).toBe('')
    expect(normalizeWorkbenchSessionTypeFilter(' group ')).toBe(WORKBENCH_SESSION_TYPE_FILTERS.group)
    expect(normalizeWorkbenchSessionTypeFilter(undefined)).toBe(WORKBENCH_SESSION_TYPE_FILTERS.all)
    expect(normalizeWorkbenchSessionSort(' name ')).toBe(WORKBENCH_SESSION_SORTS.name)
    expect(normalizeWorkbenchSessionSort(undefined)).toBe(WORKBENCH_SESSION_SORTS.recent)

    expect(readSpaceWorkbenchSpaceId({ spaceId: '  !space:server  ' })).toBe('!space:server')
    expect(readSpaceWorkbenchSpaceId({ spaceId: ['  !space:server  ', '!ignored:server'] })).toBe('!space:server')
    expect(readSpaceWorkbenchSpaceId({})).toBe('')

    expect(readSpaceWorkbenchSearch({ search: '  hello  ' })).toBe('hello')
    expect(readSpaceWorkbenchSearch({ search: ['  hello  ', 'ignored'] })).toBe('hello')
    expect(readSpaceWorkbenchSearch({})).toBe('')
    expect(readSpaceWorkbenchSessionTypeFilter({ type: ' single ' })).toBe(WORKBENCH_SESSION_TYPE_FILTERS.single)
    expect(readSpaceWorkbenchSessionTypeFilter({ type: [' group ', 'single'] })).toBe(
      WORKBENCH_SESSION_TYPE_FILTERS.group
    )
    expect(readSpaceWorkbenchSessionTypeFilter({})).toBe(WORKBENCH_SESSION_TYPE_FILTERS.all)
    expect(readSpaceWorkbenchSessionSort({ sort: ' name ' })).toBe(WORKBENCH_SESSION_SORTS.name)
    expect(readSpaceWorkbenchSessionSort({ sort: [' recent ', 'name'] })).toBe(WORKBENCH_SESSION_SORTS.recent)
    expect(readSpaceWorkbenchSessionSort({})).toBe(WORKBENCH_SESSION_SORTS.recent)
  })

  it('redirects desktop legacy space routes into the message workbench', () => {
    const spaceRoute = getDesktopRoutes().find((route) => route.name === SPACE_ROUTE_NAMES.legacy)

    expect(spaceRoute).toBeDefined()
    const redirect = spaceRoute?.redirect

    expect(typeof redirect).toBe('function')
    if (typeof redirect !== 'function') {
      throw new Error('Expected desktop space route redirect to be a function')
    }

    const redirectFn = redirect as (to: { params: Record<string, unknown>; query: Record<string, unknown> }) => unknown
    const resolved = redirectFn({
      params: { roomId: '  !space:server  ' },
      query: { foo: 'bar' }
    } as never)

    expect(resolved).toEqual({
      name: SPACE_ROUTE_NAMES.workbench,
      query: {
        foo: 'bar',
        spaceId: '!space:server'
      }
    })
  })
})
