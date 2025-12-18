package com.luohuo.flex.presence.task;

import com.luohuo.flex.presence.service.PresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 用户在线状态清理定时任务
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "hula.presence.cleanup.enabled", havingValue = "true", matchIfMissing = true)
public class PresenceCleanupTask {

    private final PresenceService presenceService;

    /**
     * 每5分钟清理一次过期的在线状态
     */
    @Scheduled(fixedRate = 300000) // 5分钟
    public void cleanupExpiredPresence() {
        try {
            log.debug("开始清理过期的用户在线状态 - {}", LocalDateTime.now());

            presenceService.cleanExpiredPresence();

            log.debug("清理过期的用户在线状态完成 - {}", LocalDateTime.now());
        } catch (Exception e) {
            log.error("清理过期的用户在线状态失败", e);
        }
    }

    /**
     * 每小时统计在线用户数量
     */
    @Scheduled(fixedRate = 3600000) // 1小时
    public void statisticsOnlineUsers() {
        try {
            Long onlineCount = presenceService.getOnlineUserCount();
            log.info("当前在线用户数: {} - {}", onlineCount, LocalDateTime.now());

            // 这里可以将统计信息保存到数据库或发送到监控系统
            // statsService.recordOnlineUserCount(onlineCount);

        } catch (Exception e) {
            log.error("统计在线用户数量失败", e);
        }
    }
}