import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { trackSettingsWrite } from '@/composables/settings/settingsPendingWrites'
import { SexEnum } from '@/enums'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { profileService } from '@/services/matrix/user/MatrixProfileService'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AccountSettings')

/**
 * 账号设置页的个人资料（昵称 + 扩展资料）状态与写入逻辑。
 * 从 `AccountSettings.vue` 下沉，组件只保留模板与跨区块组合。
 */
export function useAccountProfileForm() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const userStore = useUserStore()
  const matrixStore = useMatrixStore()
  const { getCapabilityStatus } = useServerCapability()

  const displayNameSaving = ref(false)
  const profileSaving = ref(false)
  const userId = computed(() => matrixStore.userId || '')
  /**
   * 能力快照未加载时为 unknown，此时不能当成「不支持」：否则首屏先渲染的组件
   * 会把扩展资料永久禁用，且能力到达后也不会重试。
   */
  const extendedProfileStatus = computed(() => getCapabilityStatus('extended-profile'))
  const supportsExtendedProfile = computed(() => extendedProfileStatus.value === 'supported')
  const extendedProfileUnsupported = computed(() => extendedProfileStatus.value === 'unsupported')
  let extendedProfileLoaded = false
  let extendedProfileLoading = false
  // 读取扩展资料失败时不能把空值当成账号真实资料：既显示错误态，也禁用编辑，避免写回空值覆盖
  const extendedProfileLoadFailed = ref(false)
  const extendedProfileDisabled = computed(() => extendedProfileUnsupported.value || extendedProfileLoadFailed.value)

  const formData = reactive({
    displayName: userStore.currentUserDisplayName || '',
    about: '',
    sex: null as number | null,
    region: '',
    birthday: ''
  })

  const initialExtendedProfile = reactive({
    about: '',
    sex: null as number | null,
    region: '',
    birthday: ''
  })

  const genderOptions = computed(() => [
    { label: t('setting.account.gender_male'), value: SexEnum.MAN },
    { label: t('setting.account.gender_female'), value: SexEnum.REMALE }
  ])

  async function handleDisplayNameChange() {
    // 保存期间禁用输入并拦截重复触发，避免 blur 连发造成并发写
    if (displayNameSaving.value) return
    if (formData.displayName === userStore.currentUserDisplayName) return

    displayNameSaving.value = true
    try {
      // blur 自动保存没有"未保存"概念，写请求必须登记给关窗守卫，
      // 否则"改完昵称直接 Cmd+W"会在写请求发出前就放行关窗，丢失最后一次输入。
      const write = matrixAccountService.updateDisplayName(formData.displayName)
      trackSettingsWrite(write)
      await write
      showFeedback(t('setting.account.nickname_updated'), 'success')
    } catch {
      showFeedback(t('setting.account.nickname_update_failed'), 'error')
      formData.displayName = userStore.currentUserDisplayName || ''
    } finally {
      displayNameSaving.value = false
    }
  }

  function syncExtendedProfileSnapshot() {
    initialExtendedProfile.about = formData.about
    initialExtendedProfile.sex = formData.sex
    initialExtendedProfile.region = formData.region
    initialExtendedProfile.birthday = formData.birthday
  }

  function patchCurrentUserExtendedProfile() {
    if (userStore.userInfo) {
      userStore.userInfo.resume = formData.about
      if (typeof formData.sex === 'number') {
        userStore.userInfo.sex = formData.sex as typeof userStore.userInfo.sex
      }
    }
    if (userStore.matrixProfile) {
      userStore.matrixProfile.resume = formData.about || undefined
      userStore.matrixProfile.sex = typeof formData.sex === 'number' ? formData.sex : undefined
    }
  }

  async function updateExtendedProfileField(
    field: 'resume' | 'sex' | 'region' | 'birthday',
    value: string | number | null,
    previousValue: string | number | null
  ) {
    if (extendedProfileUnsupported.value) {
      showFeedback(t('setting.account.extended_profile_unsupported'), 'warning')
      return
    }
    if (value === previousValue) return
    try {
      // 同上：登记在飞写请求，供关窗 / 切换 tab 时 flush。
      const write = profileService.updateOwnExtendedProfile({
        [field]: value
      })
      trackSettingsWrite(write)
      await write
      patchCurrentUserExtendedProfile()
      syncExtendedProfileSnapshot()
      showFeedback(t('setting.account.extended_profile_updated'), 'success')
    } catch {
      showFeedback(t('setting.account.extended_profile_update_failed'), 'error')
      if (field === 'resume') formData.about = initialExtendedProfile.about
      if (field === 'sex') formData.sex = initialExtendedProfile.sex
      if (field === 'region') formData.region = initialExtendedProfile.region
      if (field === 'birthday') formData.birthday = initialExtendedProfile.birthday
    }
  }

  async function handleAboutChange() {
    await updateExtendedProfileField('resume', formData.about.trim(), initialExtendedProfile.about)
  }

  async function handleSexChange(value: number | null) {
    formData.sex = value
    await updateExtendedProfileField('sex', value, initialExtendedProfile.sex)
  }

  async function handleRegionChange() {
    await updateExtendedProfileField('region', formData.region.trim(), initialExtendedProfile.region)
  }

  async function handleBirthdayChange() {
    await updateExtendedProfileField('birthday', formData.birthday.trim(), initialExtendedProfile.birthday)
  }

  // 资料字段此前只有 blur 自动保存，界面上没有任何「保存」入口，
  // 用户改完字段不做失焦操作会误以为改动丢失。这里提供显式保存按钮：
  // 有改动时可用，点击后按顺序复用各字段的既有保存逻辑（无改动字段会自动跳过）。
  const profileDirty = computed(() => {
    const displayNameChanged = formData.displayName.trim() !== (userStore.currentUserDisplayName || '')
    const extendedChanged =
      formData.about.trim() !== initialExtendedProfile.about ||
      formData.sex !== initialExtendedProfile.sex ||
      formData.region.trim() !== initialExtendedProfile.region ||
      formData.birthday.trim() !== initialExtendedProfile.birthday
    return displayNameChanged || extendedChanged
  })

  async function saveProfile() {
    if (profileSaving.value) return
    profileSaving.value = true
    try {
      formData.displayName = formData.displayName.trim()
      formData.about = formData.about.trim()
      formData.region = formData.region.trim()
      formData.birthday = formData.birthday.trim()
      await handleDisplayNameChange()
      await handleAboutChange()
      await updateExtendedProfileField('sex', formData.sex, initialExtendedProfile.sex)
      await handleRegionChange()
      await handleBirthdayChange()
    } finally {
      profileSaving.value = false
    }
  }

  async function loadExtendedProfile() {
    // unknown 也要尝试读取：能力快照晚到时由 watch 重新触发，只有明确不支持才跳过
    if (!userId.value || extendedProfileUnsupported.value || extendedProfileLoading) return
    extendedProfileLoading = true
    extendedProfileLoadFailed.value = false
    try {
      const extendedProfile = await profileService.getExtendedProfile(userId.value)
      formData.about = typeof extendedProfile.resume === 'string' ? extendedProfile.resume : ''
      formData.sex = typeof extendedProfile.sex === 'number' ? extendedProfile.sex : null
      formData.region = typeof extendedProfile.region === 'string' ? extendedProfile.region : ''
      formData.birthday = typeof extendedProfile.birthday === 'string' ? extendedProfile.birthday : ''
      syncExtendedProfileSnapshot()
      patchCurrentUserExtendedProfile()
      extendedProfileLoaded = true
    } catch (error) {
      logger.warn('Failed to load extended profile for account settings', error)
      extendedProfileLoadFailed.value = true
    } finally {
      extendedProfileLoading = false
    }
  }

  // 能力快照到达后补一次读取（mount 时能力可能仍是 unknown）
  watch(extendedProfileStatus, (status) => {
    if (status === 'unsupported') {
      extendedProfileLoadFailed.value = false
      return
    }
    if (status === 'supported' && !extendedProfileLoaded) {
      void loadExtendedProfile()
    }
  })

  onMounted(loadExtendedProfile)

  return {
    userId,
    supportsExtendedProfile,
    extendedProfileUnsupported,
    extendedProfileLoadFailed,
    extendedProfileDisabled,
    displayNameSaving,
    profileSaving,
    profileDirty,
    formData,
    genderOptions,
    loadExtendedProfile,
    saveProfile,
    handleDisplayNameChange,
    handleAboutChange,
    handleSexChange,
    handleRegionChange,
    handleBirthdayChange
  }
}
