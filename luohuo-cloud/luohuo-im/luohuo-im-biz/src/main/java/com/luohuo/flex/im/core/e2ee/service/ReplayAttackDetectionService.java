package com.luohuo.flex.im.core.e2ee.service;

import com.luohuo.flex.im.core.e2ee.config.E2EEProperties;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

/**
 * 重放攻击检测服务
 *
 * 功能：
 * 1. 检测并防止消息重放攻击
 * 2. 使用滑动时间窗口跟踪已处理的消息
 * 3. 基于消息指纹识别重复消息
 * 4. 支持可配置的检测窗口期
 *
 * @author HuLa Team
 * @since 2025-12-13
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReplayAttackDetectionService {

    private final StringRedisTemplate redisTemplate;
    private final E2EEProperties e2eeProperties;
    private final E2EEMetrics e2eeMetrics;
    private final E2EEAuditService auditService;

    private static final String REPLAY_DETECTION_PREFIX = "e2ee:replay:";

    /**
     * 检测消息是否为重放攻击
     *
     * @param message 加密消息
     * @return true 如果检测到重放攻击，false 否则
     */
    public boolean isReplayAttack(MessageEncrypted message) {
        // 检查是否启用重放检测
        if (!e2eeProperties.getSecurity().isReplayDetectionEnabled()) {
            return false;
        }

        try {
            // 1. 生成消息指纹
            String fingerprint = generateMessageFingerprint(message);

            // 2. 构建Redis键
            String redisKey = REPLAY_DETECTION_PREFIX + fingerprint;

            // 3. 检查Redis���是否已存在该指纹
            Boolean exists = redisTemplate.hasKey(redisKey);

            if (Boolean.TRUE.equals(exists)) {
                // 检测到重放攻击
                log.warn("检测到重放攻击！消息ID: {}, 会话: {}, 发送者: {}",
                    message.getId(), message.getConversationId(), message.getSenderId());

                // 记录安全事件
                recordReplayAttack(message, fingerprint);

                // 记录指标
                e2eeMetrics.recordEvent("security", "replay_attack_detected");

                return true;
            }

            // 4. 记录消息指纹到Redis（设置过期时间）
            int windowMinutes = e2eeProperties.getSecurity().getReplayWindowMinutes();
            redisTemplate.opsForValue().set(
                redisKey,
                String.valueOf(System.currentTimeMillis()),
                windowMinutes,
                TimeUnit.MINUTES
            );

            return false;

        } catch (Exception e) {
            log.error("重放攻击检测失败，消息ID: {}", message.getId(), e);
            e2eeMetrics.recordError("replay_detection_failed");
            // 检测失败时默认放行，避免影响正常消息
            return false;
        }
    }

    /**
     * 生成消息指纹
     * 基于密文、IV、发送者、接收者和会话ID计算唯一标识
     *
     * @param message 加密消息
     * @return 消息指纹（Base64编码的SHA-256哈希）
     */
    private String generateMessageFingerprint(MessageEncrypted message) {
        try {
            // 计算总长度
            int totalLength = 0;
            totalLength += message.getCiphertext().length;
            totalLength += message.getIv().length;
            totalLength += Long.BYTES; // senderId
            totalLength += message.getRecipientId() != null ? Long.BYTES : 0;
            totalLength += message.getConversationId().getBytes(StandardCharsets.UTF_8).length;

            // 使用ByteBuffer优化性能
            java.nio.ByteBuffer buffer = java.nio.ByteBuffer.allocate(totalLength);

            // 1. 密文（最重要的唯一性标识）
            buffer.put(message.getCiphertext());

            // 2. IV（防止相同明文产生相同密文时的冲突）
            buffer.put(message.getIv());

            // 3. 发送者ID
            buffer.putLong(message.getSenderId());

            // 4. 接收者ID（如果存在）
            if (message.getRecipientId() != null) {
                buffer.putLong(message.getRecipientId());
            }

            // 5. 会话ID（防止跨会话重放）
            buffer.put(message.getConversationId().getBytes(StandardCharsets.UTF_8));

            // 计算SHA-256哈希
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(buffer.array());

            // Base64编码以便存储
            return Base64.getEncoder().encodeToString(hash);

        } catch (Exception e) {
            log.error("生成消息指纹失败", e);
            // 降级：使用简单的字符串拼接
            return String.format("%s:%s:%s",
                message.getConversationId(),
                message.getSenderId(),
                System.currentTimeMillis()
            );
        }
    }

    /**
     * 清除过期的重放检测记录
     * 注意：Redis的TTL机制会自动清除过期键，此方法主要用于手动触发清理
     *
     * @return 清除的记录数
     */
    public int cleanupExpiredRecords() {
        try {
            // Redis会自动清除过期键，这里只是统计信息
            int count = redisTemplate.keys(REPLAY_DETECTION_PREFIX + "*").size();
            log.debug("当前重放检测记录数: {}", count);
            return count;

        } catch (Exception e) {
            log.error("清理过期重放检测记录失败", e);
            return 0;
        }
    }

    /**
     * 获取重放检测统计信息
     *
     * @return 统计信息
     */
    public ReplayDetectionStats getStats() {
        ReplayDetectionStats stats = new ReplayDetectionStats();

        try {
            // 统计当前跟踪的消息数量
            int trackedCount = redisTemplate.keys(REPLAY_DETECTION_PREFIX + "*").size();
            stats.setTrackedMessagesCount(trackedCount);

            // 配置信息
            stats.setEnabled(e2eeProperties.getSecurity().isReplayDetectionEnabled());
            stats.setWindowMinutes(e2eeProperties.getSecurity().getReplayWindowMinutes());

        } catch (Exception e) {
            log.error("获取重放检测统计信息失败", e);
        }

        return stats;
    }

    /**
     * 手动标记消息为已处理（可选，用于某些特殊场景）
     *
     * @param message 加密消息
     */
    public void markMessageAsProcessed(MessageEncrypted message) {
        if (!e2eeProperties.getSecurity().isReplayDetectionEnabled()) {
            return;
        }

        try {
            String fingerprint = generateMessageFingerprint(message);
            String redisKey = REPLAY_DETECTION_PREFIX + fingerprint;
            int windowMinutes = e2eeProperties.getSecurity().getReplayWindowMinutes();

            redisTemplate.opsForValue().set(
                redisKey,
                String.valueOf(System.currentTimeMillis()),
                windowMinutes,
                TimeUnit.MINUTES
            );

            log.debug("标记消息为已处理，消息ID: {}, 指纹: {}", message.getId(), fingerprint);

        } catch (Exception e) {
            log.error("标记消息为已处理失败，消息ID: {}", message.getId(), e);
        }
    }

    /**
     * 记录重放攻击事件
     */
    private void recordReplayAttack(MessageEncrypted message, String fingerprint) {
        try {
            // 创建安全事件详情
            java.util.Map<String, Object> details = new java.util.HashMap<>();
            details.put("messageId", message.getId());
            details.put("conversationId", message.getConversationId());
            details.put("senderId", message.getSenderId());
            details.put("recipientId", message.getRecipientId());
            details.put("fingerprint", fingerprint);
            details.put("timestamp", java.time.LocalDateTime.now());

            // 记录到审计日志
            auditService.logSecurityEvent(
                "REPLAY_ATTACK",
                "HIGH",
                "检测到重放攻击：同一消息在时间窗口内被重复提交",
                details
            );

        } catch (Exception e) {
            log.error("记录重放攻击事件失败", e);
        }
    }

    /**
     * 重放检测统计信息
     */
    public static class ReplayDetectionStats {
        private boolean enabled;              // 是否启用
        private int windowMinutes;            // 时间窗口（分钟）
        private int trackedMessagesCount;     // 当前跟踪的消息数

        // Getters and Setters
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }

        public int getWindowMinutes() { return windowMinutes; }
        public void setWindowMinutes(int windowMinutes) { this.windowMinutes = windowMinutes; }

        public int getTrackedMessagesCount() { return trackedMessagesCount; }
        public void setTrackedMessagesCount(int trackedMessagesCount) {
            this.trackedMessagesCount = trackedMessagesCount;
        }
    }
}
