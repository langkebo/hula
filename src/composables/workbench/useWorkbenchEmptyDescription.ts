import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionEngagementFilter,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'

interface UseWorkbenchEmptyDescriptionOptions {
  t: (key: 'space.empty_filtered_sessions' | 'space.empty_sessions') => string
  searchKeyword: MaybeRefOrGetter<string>
  sessionTypeFilter: MaybeRefOrGetter<WorkbenchSessionTypeFilter>
  sessionEngagementFilter: MaybeRefOrGetter<WorkbenchSessionEngagementFilter>
  selectedSpaceId?: MaybeRefOrGetter<string | null | undefined>
}

export const useWorkbenchEmptyDescription = ({
  t,
  searchKeyword,
  sessionTypeFilter,
  sessionEngagementFilter,
  selectedSpaceId
}: UseWorkbenchEmptyDescriptionOptions) => {
  return computed(() => {
    if (
      toValue(selectedSpaceId) ||
      toValue(searchKeyword).trim() ||
      toValue(sessionTypeFilter) !== WORKBENCH_SESSION_TYPE_FILTERS.all ||
      toValue(sessionEngagementFilter) !== WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
    ) {
      return t('space.empty_filtered_sessions')
    }

    return t('space.empty_sessions')
  })
}
