import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
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
  const { isCapabilityAvailable } = useServerCapability()

  const displayNameSaving = ref(false)
  const userId = computed(() => matrixStore.userId || '')
  const supportsExtendedProfile = computed(() => isCapabilityAvailable('extended-profile'))
  // 读取扩展资料失败时不能把空值当成账号真实资料：既显示错误态，也禁用编辑，避免写回空值覆盖
  const extendedProfileLoadFailed = ref(false)
  const extendedProfileDisabled = computed(() => !supportsExtendedProfile.value || extendedProfileLoadFailed.value)

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
      await matrixAccountService.updateDisplayName(formData.displayName)
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
    if (!supportsExtendedProfile.value) {
      showFeedback(t('setting.account.extended_profile_unsupported'), 'warning')
      return
    }
    if (value === previousValue) return
    try {
      await profileService.updateOwnExtendedProfile({
        [field]: value
      })
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

  async function loadExtendedProfile() {
    if (!userId.value || !supportsExtendedProfile.value) return
    extendedProfileLoadFailed.value = false
    try {
      const extendedProfile = await profileService.getExtendedProfile(userId.value)
      formData.about = typeof extendedProfile.resume === 'string' ? extendedProfile.resume : ''
      formData.sex = typeof extendedProfile.sex === 'number' ? extendedProfile.sex : null
      formData.region = typeof extendedProfile.region === 'string' ? extendedProfile.region : ''
      formData.birthday = typeof extendedProfile.birthday === 'string' ? extendedProfile.birthday : ''
      syncExtendedProfileSnapshot()
      patchCurrentUserExtendedProfile()
    } catch (error) {
      logger.warn('Failed to load extended profile for account settings', error)
      extendedProfileLoadFailed.value = true
    }
  }

  onMounted(loadExtendedProfile)

  return {
    userId,
    supportsExtendedProfile,
    extendedProfileLoadFailed,
    extendedProfileDisabled,
    displayNameSaving,
    formData,
    genderOptions,
    loadExtendedProfile,
    handleDisplayNameChange,
    handleAboutChange,
    handleSexChange,
    handleRegionChange,
    handleBirthdayChange
  }
}
