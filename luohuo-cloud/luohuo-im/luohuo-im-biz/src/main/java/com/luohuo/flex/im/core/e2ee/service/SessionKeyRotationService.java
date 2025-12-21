package com.luohuo.flex.im.core.e2ee.service;

import com.luohuo.flex.im.core.e2ee.config.E2EEProperties;
import com.luohuo.flex.im.core.e2ee.mapper.SessionKeyPackageMapper;
import com.luohuo.flex.im.core.e2ee.mapper.UserPublicKeyMapper;
import com.luohuo.flex.im.domain.entity.SessionKeyPackage;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.domain.enums.KeyPackageStatus;
import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

/**
 * 会话密钥轮换服务
 *
 * 功能：
 * 1. 自动检测即将过期的会话密钥
 * 2. 通知客户端更新密钥
 * 3. 管理密钥轮换计数
 * 4. 废弃旧密钥并归档
 * 5. 支持前向安全特性
 *
 * @author HuLa Team
 * @since 2025-12-13
 */
@Service
@RequiredArgsConstructor
public class SessionKeyRotationService {
    private static final Logger log = LoggerFactory.getLogger(SessionKeyRotationService.class);

    private final SessionKeyPackageMapper sessionKeyPackageMapper;
    private final UserPublicKeyMapper userPublicKeyMapper;
    private final E2EEProperties e2eeProperties;
    private final E2EEMetrics e2eeMetrics;
    private final E2EEAuditService auditService;

    /**
     * 检查并处理需要轮换的密钥
     *
     * @return 需要轮换的密钥包数量
     */
    public int checkAndRotateKeys() {
        log.debug("开始检查需要轮换的密钥");

        try {
            // 1. 查询即将过期的密钥（距离过期时间少于keyRotationDays天）
            int rotationDays = e2eeProperties.getKeyManagement().getKeyRotationDays();
            LocalDateTime rotationThreshold = LocalDateTime.now().plusDays(rotationDays);

            List<SessionKeyPackage> expiringKeys = sessionKeyPackageMapper.selectExpiringKeys(rotationThreshold);

            if (expiringKeys.isEmpty()) {
                log.debug("没有需要轮换的密钥");
                return 0;
            }

            log.info("发现{}个即将过期的密钥，准备处理", expiringKeys.size());

            // 2. 分组处理（按会话分组）
            var keysBySession = groupBySession(expiringKeys);
            int rotatedCount = 0;

            for (var entry : keysBySession.entrySet()) {
                String sessionId = entry.getKey();
                List<SessionKeyPackage> sessionKeys = entry.getValue();

                try {
                    // 为每个会话处理密钥轮换
                    boolean rotated = rotateSessionKeys(sessionId, sessionKeys);
                    if (rotated) {
                        rotatedCount += sessionKeys.size();
                    }
                } catch (Exception e) {
                    log.error("会话{}的密钥轮换失败", sessionId, e);
                    e2eeMetrics.recordError("key_rotation_failed");
                }
            }

            log.info("密钥轮换检查完成，处理了{}个密钥", rotatedCount);
            e2eeMetrics.recordKeyRotation(rotatedCount);

            return rotatedCount;

        } catch (Exception e) {
            log.error("密钥轮换检查失败", e);
            e2eeMetrics.recordError("key_rotation_check_failed");
            return 0;
        }
    }

    /**
     * 轮换指定会话的密钥
     *
     * @param sessionId 会话ID
     * @param oldKeys 旧密钥列表
     * @return 是否成功轮换
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean rotateSessionKeys(String sessionId, List<SessionKeyPackage> oldKeys) {
        try {
            log.debug("开始轮换会话{}的密钥，旧密钥数量: {}", sessionId, oldKeys.size());

            // 1. 获取会话中的用户（发送者和接收者）
            if (oldKeys.isEmpty()) {
                return false;
            }

            SessionKeyPackage firstKey = oldKeys.get(0);
            Long senderId = firstKey.getSenderId();
            Long recipientId = firstKey.getRecipientId();

            // 2. 检查双方是否有有效公钥
            UserPublicKey senderPublicKey = userPublicKeyMapper.selectActiveKeyByUserId(senderId);
            UserPublicKey recipientPublicKey = userPublicKeyMapper.selectActiveKeyByUserId(recipientId);

            if (senderPublicKey == null || recipientPublicKey == null) {
                log.warn("会话{}的用户公钥不完整，无法轮换密钥。发送者: {}, 接收者: {}",
                    sessionId, senderId, recipientId);
                return false;
            }

            // 3. 标记旧密钥为已轮换（保留一段时间以支持消息解密）
            for (SessionKeyPackage oldKey : oldKeys) {
                oldKey.incrementRotationCount();
                oldKey.markAsRevoked();
                sessionKeyPackageMapper.updateById(oldKey);

                // 记录审计日志
                auditService.recordKeyRotation(
                    sessionId,
                    oldKey.getKeyId(),
                    oldKey.getRotationCount(),
                    "AUTO_ROTATION",
                    String.format("密钥即将过期(过期时间: %s)", oldKey.getExpiresAt())
                );
            }

            // 4. 通知客户端生成新密钥
            // 注意：实际的密钥生成由客户端完成，这里只是发送通知
            notifyKeyRotationRequired(sessionId, senderId, recipientId);

            log.info("会话{}的密钥轮换完成，轮换数量: {}", sessionId, oldKeys.size());

            return true;

        } catch (Exception e) {
            log.error("轮换会话{}的密钥失败", sessionId, e);
            throw new RuntimeException("密钥轮换失败: " + e.getMessage(), e);
        }
    }

    /**
     * 强制轮换指定用户的所有密钥
     * 用于密钥泄露等紧急情况
     *
     * @param userId 用户ID
     * @param reason 轮换原因
     * @return 轮换的密钥数量
     */
    @Transactional(rollbackFor = Exception.class)
    public int forceRotateUserKeys(Long userId, String reason) {
        log.warn("强制轮换用户{}的所有密钥，原因: {}", userId, reason);

        try {
            // 1. 查询用户作为接收者的所有活跃密钥包
            List<SessionKeyPackage> activeKeys = sessionKeyPackageMapper.selectActiveByRecipientId(userId);

            if (activeKeys.isEmpty()) {
                log.info("用户{}没有活跃的密钥包", userId);
                return 0;
            }

            // 2. 废弃所有密钥
            int revokedCount = 0;
            for (SessionKeyPackage key : activeKeys) {
                key.markAsRevoked();
                sessionKeyPackageMapper.updateById(key);

                // 记录审计日志
                auditService.recordKeyRotation(
                    key.getSessionId(),
                    key.getKeyId(),
                    key.getRotationCount(),
                    "FORCE_ROTATION",
                    reason
                );

                revokedCount++;
            }

            // 3. 通知用户重新生成密钥
            notifyForceKeyRotation(userId, reason);

            log.warn("用户{}的密钥强制轮换完成，废弃数量: {}", userId, revokedCount);
            e2eeMetrics.recordForceKeyRotation(userId, revokedCount);

            return revokedCount;

        } catch (Exception e) {
            log.error("强制轮换用户{}的密钥失败", userId, e);
            throw new RuntimeException("强制密钥轮换失败: " + e.getMessage(), e);
        }
    }

    /**
     * 清理已废弃的旧密钥
     *
     * @param retentionDays 保留天数
     * @return 清理的密钥数量
     */
    @Transactional(rollbackFor = Exception.class)
    public int cleanupRevokedKeys(int retentionDays) {
        log.debug("开始清理已废弃的旧密钥，保留天数: {}", retentionDays);

        try {
            LocalDateTime cutoffTime = LocalDateTime.now().minusDays(retentionDays);

            // 查询需要清理的密钥（已废弃且废弃时间超过保留期）
            List<SessionKeyPackage> oldKeys = sessionKeyPackageMapper.selectRevokedKeysBeforeTime(cutoffTime);

            if (oldKeys.isEmpty()) {
                log.debug("没有需要清理的已废弃密钥");
                return 0;
            }

            // 删除密钥
            int deletedCount = sessionKeyPackageMapper.batchDeleteByIds(
                oldKeys.stream().map(SessionKeyPackage::getId).toList()
            );

            log.info("已废弃密钥清理完成，清理数量: {}", deletedCount);

            return deletedCount;

        } catch (Exception e) {
            log.error("清理已废弃密钥失败", e);
            return 0;
        }
    }

    /**
     * 获取密钥轮换统计信息
     *
     * @return 统计信息
     */
    public KeyRotationStats getRotationStats() {
        try {
            KeyRotationStats stats = new KeyRotationStats();

            // 查询即将过期的密钥
            int rotationDays = e2eeProperties.getKeyManagement().getKeyRotationDays();
            LocalDateTime rotationThreshold = LocalDateTime.now().plusDays(rotationDays);
            stats.setExpiringKeysCount(sessionKeyPackageMapper.countExpiringKeys(rotationThreshold));

            // 查询已轮换的密钥
            stats.setRevokedKeysCount(sessionKeyPackageMapper.countRevokedKeys());

            // 查询总密钥数
            stats.setTotalKeysCount(sessionKeyPackageMapper.countAllKeys());

            // 查询活跃密钥数
            stats.setActiveKeysCount(sessionKeyPackageMapper.countActiveKeys());

            return stats;

        } catch (Exception e) {
            log.error("获取密钥轮换统计信息失败", e);
            return new KeyRotationStats();
        }
    }

    /**
     * 按会话分组密钥包
     */
    private java.util.Map<String, List<SessionKeyPackage>> groupBySession(List<SessionKeyPackage> keys) {
        var grouped = new java.util.HashMap<String, List<SessionKeyPackage>>();
        for (SessionKeyPackage key : keys) {
            grouped.computeIfAbsent(key.getSessionId(), k -> new ArrayList<>()).add(key);
        }
        return grouped;
    }

    /**
     * 通知密钥轮换需求
     * 通过WebSocket推送密钥轮换通知给相关用户
     */
    private void notifyKeyRotationRequired(String sessionId, Long senderId, Long recipientId) {
        log.info("发送密钥轮换通知。会话: {}, 发送者: {}, 接收者: {}", sessionId, senderId, recipientId);

        try {
            // 构建密钥轮换通知数据
            KeyRotationNotification notification = new KeyRotationNotification();
            notification.setSessionId(sessionId);
            notification.setReason("KEY_EXPIRING");
            notification.setExpiresAt(LocalDateTime.now().plusDays(e2eeProperties.getKeyManagement().getKeyRotationDays()));
            notification.setTimestamp(LocalDateTime.now());
            notification.setRequireNewKey(true);

            // 构建WebSocket消息
            com.luohuo.flex.model.entity.WsBaseResp<KeyRotationNotification> wsResp = new com.luohuo.flex.model.entity.WsBaseResp<>();
            wsResp.setType(com.luohuo.flex.model.entity.WSRespTypeEnum.E2EE_KEY_ROTATION_REQUIRED.getType());
            wsResp.setData(notification);

            // 推送给发送者和接收者
            List<Long> targetUsers = new ArrayList<>();
            if (senderId != null) {
                targetUsers.add(senderId);
            }
            if (recipientId != null && !recipientId.equals(senderId)) {
                targetUsers.add(recipientId);
            }

            if (!targetUsers.isEmpty()) {
                // 使用 Spring 事件发布机制推送消息
                org.springframework.context.ApplicationContext context = 
                    com.luohuo.basic.utils.SpringUtils.getApplicationContext();
                if (context != null) {
                    context.publishEvent(new KeyRotationNotificationEvent(this, wsResp, targetUsers));
                }
                log.info("密钥轮换通知已发送。会话: {}, 目标用户: {}", sessionId, targetUsers);
            }

        } catch (Exception e) {
            log.error("发送密钥轮换通知失败。会话: {}", sessionId, e);
            e2eeMetrics.recordError("key_rotation_notification_failed");
        }
    }

    /**
     * 通知强制密钥轮换
     * 用于密钥泄露等紧急情况，强制用户重新生成密钥
     */
    private void notifyForceKeyRotation(Long userId, String reason) {
        log.warn("发送强制密钥轮换通知。用户: {}, 原因: {}", userId, reason);

        try {
            // 构建强制密钥轮换通知数据
            ForceKeyRotationNotification notification = new ForceKeyRotationNotification();
            notification.setUserId(userId);
            notification.setReason(reason);
            notification.setTimestamp(LocalDateTime.now());
            notification.setUrgent(true);
            notification.setRequireImmediateAction(true);

            // 构建WebSocket消息
            com.luohuo.flex.model.entity.WsBaseResp<ForceKeyRotationNotification> wsResp = new com.luohuo.flex.model.entity.WsBaseResp<>();
            wsResp.setType(com.luohuo.flex.model.entity.WSRespTypeEnum.E2EE_FORCE_KEY_ROTATION.getType());
            wsResp.setData(notification);

            // 推送给目标用户
            List<Long> targetUsers = List.of(userId);

            // 使用 Spring 事件发布机制推送消息
            org.springframework.context.ApplicationContext context = 
                com.luohuo.basic.utils.SpringUtils.getApplicationContext();
            if (context != null) {
                context.publishEvent(new KeyRotationNotificationEvent(this, wsResp, targetUsers));
            }

            log.warn("强制密钥轮换通知已发送。用户: {}", userId);

        } catch (Exception e) {
            log.error("发送强制密钥轮换通知失败。用户: {}", userId, e);
            e2eeMetrics.recordError("force_key_rotation_notification_failed");
        }
    }

    /**
     * 密钥轮换通知数据
     */
    @lombok.Data
    public static class KeyRotationNotification {
        private String sessionId;
        private String reason;
        private LocalDateTime expiresAt;
        private LocalDateTime timestamp;
        private boolean requireNewKey;
    }

    /**
     * 强制密钥轮换通知数据
     */
    @lombok.Data
    public static class ForceKeyRotationNotification {
        private Long userId;
        private String reason;
        private LocalDateTime timestamp;
        private boolean urgent;
        private boolean requireImmediateAction;
    }

    /**
     * 密钥轮换通知事件
     * 用于通过Spring事件机制发布WebSocket消息
     */
    public static class KeyRotationNotificationEvent extends org.springframework.context.ApplicationEvent {
        private final com.luohuo.flex.model.entity.WsBaseResp<?> wsMessage;
        private final List<Long> targetUsers;

        public KeyRotationNotificationEvent(Object source, com.luohuo.flex.model.entity.WsBaseResp<?> wsMessage, List<Long> targetUsers) {
            super(source);
            this.wsMessage = wsMessage;
            this.targetUsers = targetUsers;
        }

        public com.luohuo.flex.model.entity.WsBaseResp<?> getWsMessage() {
            return wsMessage;
        }

        public List<Long> getTargetUsers() {
            return targetUsers;
        }
    }

    /**
     * 密钥轮换统计信息
     */
    public static class KeyRotationStats {
        private int totalKeysCount;       // 总密钥数
        private int activeKeysCount;      // 活跃密钥数
        private int expiringKeysCount;    // 即将过期密钥数
        private int revokedKeysCount;     // 已废弃密钥数

        // Getters and Setters
        public int getTotalKeysCount() { return totalKeysCount; }
        public void setTotalKeysCount(int totalKeysCount) { this.totalKeysCount = totalKeysCount; }

        public int getActiveKeysCount() { return activeKeysCount; }
        public void setActiveKeysCount(int activeKeysCount) { this.activeKeysCount = activeKeysCount; }

        public int getExpiringKeysCount() { return expiringKeysCount; }
        public void setExpiringKeysCount(int expiringKeysCount) { this.expiringKeysCount = expiringKeysCount; }

        public int getRevokedKeysCount() { return revokedKeysCount; }
        public void setRevokedKeysCount(int revokedKeysCount) { this.revokedKeysCount = revokedKeysCount; }
    }
}
