/**
 * 语音统计夹具。
 *
 * 契约来源：`MatrixVoiceService.getRoomVoiceStats()` 归一化后的 `VoiceStats`
 * （`{ totalDuration, totalMessages, averageDuration }`，秒为单位）。
 */
import type { VoiceStats } from '@/services/matrix/media/voiceStatsOps'

export function makeVoiceStats(overrides: Partial<VoiceStats> = {}): VoiceStats {
  return { totalDuration: 0, totalMessages: 0, averageDuration: 0, ...overrides }
}
