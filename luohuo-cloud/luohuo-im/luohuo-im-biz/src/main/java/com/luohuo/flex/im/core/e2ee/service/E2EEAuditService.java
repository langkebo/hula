package com.luohuo.flex.im.core.e2ee.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * E2EE审计日志服务
 *
 * 根据文档5.5安全策略要求，记录所有关键操作
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEAuditService {

    private final E2EEMetrics e2eeMetrics;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String AUDIT_LOG_PREFIX = "e2ee:audit:";
    private static final String AUDIT_LOG_KEY = AUDIT_LOG_PREFIX + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

    /**
     * 记录密钥上传操作
     */
    @Async("e2eeTaskExecutor")
    public void logKeyUpload(Long userId, String keyId, String algorithm, String status) {
        Map<String, Object> auditData = createAuditData("KEY_UPLOAD");
        auditData.put("userId", userId);
        auditData.put("keyId", keyId);
        auditData.put("algorithm", algorithm);
        auditData.put("status", status);

        saveAuditLog(auditData);

        if ("SUCCESS".equals(status)) {
            e2eeMetrics.recordPublicKeyUpload(algorithm);
        }
    }

    /**
     * 记录加密消息发送
     */
    @Async("e2eeTaskExecutor")
    public void logMessageEncryption(Long senderId, String conversationId, String keyId,
                                   String algorithm, int messageSize, boolean signed) {
        Map<String, Object> auditData = createAuditData("MESSAGE_ENCRYPTION");
        auditData.put("senderId", senderId);
        auditData.put("conversationId", conversationId);
        auditData.put("keyId", keyId);
        auditData.put("algorithm", algorithm);
        auditData.put("messageSize", messageSize);
        auditData.put("signed", signed);

        saveAuditLog(auditData);
        e2eeMetrics.recordEncryptedMessage(algorithm, "text");
    }

    /**
     * 记录密钥包分发
     */
    @Async("e2eeTaskExecutor")
    public void logKeyPackageDistribution(String sessionId, Long senderId, Long recipientId,
                                        String algorithm, String status) {
        Map<String, Object> auditData = createAuditData("KEY_PACKAGE_DISTRIBUTION");
        auditData.put("sessionId", sessionId);
        auditData.put("senderId", senderId);
        auditData.put("recipientId", recipientId);
        auditData.put("algorithm", algorithm);
        auditData.put("status", status);

        saveAuditLog(auditData);

        if ("SUCCESS".equals(status)) {
            e2eeMetrics.recordKeyPackageDistributed(algorithm, true);
        }
    }

    /**
     * 记录签名验证
     */
    @Async("e2eeTaskExecutor")
    public void logSignatureVerification(Long messageId, Long senderId, boolean valid, long duration) {
        Map<String, Object> auditData = createAuditData("SIGNATURE_VERIFICATION");
        auditData.put("messageId", messageId);
        auditData.put("senderId", senderId);
        auditData.put("valid", valid);
        auditData.put("duration", duration);

        saveAuditLog(auditData);

        e2eeMetrics.recordSignatureVerificationTime(duration);
        e2eeMetrics.recordSignatureVerification(valid);
    }

    /**
     * 记录解密尝试
     */
    @Async("e2eeTaskExecutor")
    public void logMessageDecryption(Long messageId, Long userId, boolean success, long duration) {
        Map<String, Object> auditData = createAuditData("MESSAGE_DECRYPTION");
        auditData.put("messageId", messageId);
        auditData.put("userId", userId);
        auditData.put("success", success);
        auditData.put("duration", duration);

        saveAuditLog(auditData);

        e2eeMetrics.recordDecryptionTime(duration);

        if (!success) {
            e2eeMetrics.recordError("decryption", "failed");
        }
    }

    /**
     * 记录密钥撤销
     */
    @Async("e2eeTaskExecutor")
    public void logKeyRevocation(Long userId, String keyId, String reason) {
        Map<String, Object> auditData = createAuditData("KEY_REVOCATION");
        auditData.put("userId", userId);
        auditData.put("keyId", keyId);
        auditData.put("reason", reason);

        saveAuditLog(auditData);
    }

    /**
     * 记录密钥轮换
     *
     * @param sessionId      会话ID
     * @param keyId          密钥ID
     * @param rotationCount  轮换次数
     * @param rotationType   轮换类型（AUTO_ROTATION/FORCE_ROTATION）
     * @param reason         轮换原因
     */
    @Async("e2eeTaskExecutor")
    public void recordKeyRotation(String sessionId, String keyId, Integer rotationCount,
                                   String rotationType, String reason) {
        Map<String, Object> auditData = createAuditData("KEY_ROTATION");
        auditData.put("sessionId", sessionId);
        auditData.put("keyId", keyId);
        auditData.put("rotationCount", rotationCount);
        auditData.put("rotationType", rotationType);
        auditData.put("reason", reason);

        saveAuditLog(auditData);

        // 记录指标
        e2eeMetrics.recordEvent("key_rotation", rotationType);
    }

    /**
     * 记录安全事件
     */
    @Async("e2eeTaskExecutor")
    public void logSecurityEvent(String eventType, String severity, String description,
                                Map<String, Object> details) {
        Map<String, Object> auditData = createAuditData("SECURITY_EVENT");
        auditData.put("eventType", eventType);
        auditData.put("severity", severity); // LOW, MEDIUM, HIGH, CRITICAL
        auditData.put("description", description);
        if (details != null) {
            auditData.putAll(details);
        }

        saveAuditLog(auditData);

        // 对于高严重性事件，额外记录到专门的安全日志
        if ("HIGH".equals(severity) || "CRITICAL".equals(severity)) {
            log.warn("E2EE安全事件 - {}: {}", eventType, description);
        }

        e2eeMetrics.recordError("security_event", eventType);
    }

    /**
     * 记录访问异常
     */
    @Async("e2eeTaskExecutor")
    public void logAccessViolation(Long userId, String resource, String violationType) {
        Map<String, Object> auditData = createAuditData("ACCESS_VIOLATION");
        auditData.put("userId", userId);
        auditData.put("resource", resource);
        auditData.put("violationType", violationType);

        saveAuditLog(auditData);

        log.warn("E2EE访问违规 - 用户: {}, 资源: {}, 类型: {}", userId, resource, violationType);
        e2eeMetrics.recordError("access_violation", violationType);
    }

    /**
     * 记录配置变更
     */
    @Async("e2eeTaskExecutor")
    public void logConfigurationChange(String configType, String oldValue, String newValue, Long operatorId) {
        Map<String, Object> auditData = createAuditData("CONFIGURATION_CHANGE");
        auditData.put("configType", configType);
        auditData.put("oldValue", oldValue);
        auditData.put("newValue", newValue);
        auditData.put("operatorId", operatorId);

        saveAuditLog(auditData);
    }

    /**
     * 记录消息已读
     */
    @Async("e2eeTaskExecutor")
    public void logMessageRead(Long userId, Long messageId, String conversationId, LocalDateTime readAt) {
        Map<String, Object> auditData = createAuditData("MESSAGE_READ");
        auditData.put("userId", userId);
        auditData.put("messageId", messageId);
        auditData.put("conversationId", conversationId);
        auditData.put("readAt", readAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        saveAuditLog(auditData);

        log.debug("消息已读审计日志记录完成，消息ID: {}", messageId);
    }

    /**
     * 记录消息销毁
     */
    @Async("e2eeTaskExecutor")
    public void logMessageDestruction(Long messageId, String conversationId, String reason, LocalDateTime destructAt) {
        Map<String, Object> auditData = createAuditData("MESSAGE_DESTRUCTION");
        auditData.put("messageId", messageId);
        auditData.put("conversationId", conversationId);
        auditData.put("reason", reason);
        auditData.put("destructAt", destructAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        saveAuditLog(auditData);

        log.info("消息销毁审计日志记录完成，消息ID: {}, 原因: {}", messageId, reason);
    }

    /**
     * 记录密钥包分发（兼容overload）
     */
    @Async("e2eeTaskExecutor")
    public void logKeyPackageDistribution(Long senderId, Long recipientId, String sessionId, String keyId) {
        logKeyPackageDistribution(sessionId, senderId, recipientId, "AES-GCM", "SUCCESS");
    }

    /**
     * 创建审计数据基础结构
     */
    private Map<String, Object> createAuditData(String action) {
        Map<String, Object> auditData = new HashMap<>();

        // 基本信息
        auditData.put("action", action);
        auditData.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        auditData.put("tenantId", ContextUtil.getTenantId());

        // 请求信息
        try {
            String ip = ContextUtil.getIP();
            if (ip != null && !ip.isEmpty()) {
                auditData.put("ip", ip);
            }
        } catch (Exception e) {
            log.debug("获取请求信息失败", e);
        }

        // 用户信息
        try {
            Long currentUserId = ContextUtil.getUserId();
            if (currentUserId != null) {
                auditData.put("operatorId", currentUserId);
            }
        } catch (Exception e) {
            log.debug("获取用户信息失败", e);
        }

        return auditData;
    }

    /**
     * 保存审计日志
     */
    private void saveAuditLog(Map<String, Object> auditData) {
        try {
            String logKey = AUDIT_LOG_PREFIX + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            String logValue = objectMapper.writeValueAsString(auditData);

            // 使用Redis List存储审计日志，保留30天
            redisTemplate.opsForList().rightPush(logKey, logValue);
            redisTemplate.expire(logKey, 30, TimeUnit.DAYS);

            // 限制每天的日志条数（最多10万条）
            redisTemplate.opsForList().trim(logKey, -100000, -1);

            log.debug("E2EE审计日志已记录: {}", auditData.get("action"));

        } catch (Exception e) {
            log.error("保存E2EE审计日志失败", e);
        }
    }

    /**
     * 查询审计日志
     */
    public Map<String, Object> queryAuditLogs(LocalDateTime startDate, LocalDateTime endDate,
                                             String action, Long userId, int page, int size) {
        Map<String, Object> result = new HashMap<>();

        try {
            // 这里应该实现具体的查询逻辑
            // 可以从Redis或数据库中查询符合条件的数据

            result.put("success", true);
            result.put("message", "查询成功");

        } catch (Exception e) {
            log.error("查询审计日志失败", e);
            result.put("success", false);
            result.put("message", "查询失败");
        }

        return result;
    }

    /**
     * 清理过期审计日志
     * 删除90天前的日志
     */
    public int cleanupExpiredLogs() {
        log.info("开始清理过期E2EE审计日志");
        int cleanedCount = 0;

        try {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime expireDate = now.minusDays(90);

            // 清理Redis中的过期日志
            for (int i = 0; i < 90; i++) {
                LocalDateTime checkDate = expireDate.minusDays(i);
                String logKey = AUDIT_LOG_PREFIX + checkDate.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

                // 删除该日期的日志
                Boolean deleted = redisTemplate.delete(logKey);
                if (Boolean.TRUE.equals(deleted)) {
                    cleanedCount++;
                    log.debug("删除过期审计日志: {}", logKey);
                }
            }

            log.info("清理过期E2EE审计日志完成，清理数量: {}", cleanedCount);

        } catch (Exception e) {
            log.error("清理过期审计日志失败", e);
        }

        return cleanedCount;
    }
}
