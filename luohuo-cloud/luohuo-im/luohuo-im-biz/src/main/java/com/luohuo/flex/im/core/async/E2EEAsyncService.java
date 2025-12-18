package com.luohuo.flex.im.core.async;

import com.luohuo.flex.im.core.e2ee.service.E2EEMessageService;
import com.luohuo.flex.im.core.e2ee.service.E2EEKeyService;
import com.luohuo.flex.im.core.e2ee.service.E2EEPerformanceService;
import com.luohuo.flex.im.core.e2ee.service.E2EEDecryptionService;
import com.luohuo.flex.im.core.user.service.impl.PushService;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.Base64;

/**
 * E2EE 异步处理服务
 * 提供高性能的异步处理能力，提升系统吞吐量
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEAsyncService {

    private final Executor e2eeTaskExecutor;
    private final AsyncTaskMonitor taskMonitor;
    private final E2EEMessageService e2eeMessageService;
    private final E2EEKeyService e2eeKeyService;
    private final E2EEPerformanceService e2eePerformanceService;
    private final E2EEDecryptionService e2eeDecryptionService;
    private final PushService pushService;

    // 异步任务缓存
    private final ConcurrentHashMap<String, CompletableFuture<?>> taskCache = new ConcurrentHashMap<>();

    /**
     * 异步批量处理加密消息
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Void> asyncBatchEncryptMessages(List<Map<String, Object>> messages) {
        return CompletableFuture.runAsync(() -> {
            long startTime = System.currentTimeMillis();
            taskMonitor.startTask("batchEncryptMessages", messages.size());

            try {
                // 实现批量加密逻辑
                List<Map<String, Object>> encryptedResults = new ArrayList<>();

                for (Map<String, Object> message : messages) {
                    try {
                        // 获取消息内容
                        String content = (String) message.get("content");
                        String recipientId = message.get("recipientId") != null ?
                            String.valueOf(message.get("recipientId")) : null;
                        String algorithm = (String) message.getOrDefault("algorithm", "AES-GCM");

                        // 执行加密
                        Map<String, Object> encryptedMessage = encryptMessage(content, recipientId, algorithm);
                        encryptedMessage.putAll(message); // 保留原始字段
                        encryptedResults.add(encryptedMessage);

                        // 记录性能指标
                        e2eePerformanceService.recordEncryptionMetrics(1);

                    } catch (Exception e) {
                        log.error("加密消息失败: {}", message.get("id"), e);
                        // 继续处理其他消息
                    }
                    taskMonitor.incrementProgress();
                }

                log.info("异步批量加密完成，消息数: {}, 耗时: {}ms",
                    messages.size(), System.currentTimeMillis() - startTime);
                taskMonitor.completeTask("batchEncryptMessages");
            } catch (Exception e) {
                log.error("异步批量加密失败", e);
                taskMonitor.failTask("batchEncryptMessages", e);
                throw new RuntimeException(e);
            }
        }, e2eeTaskExecutor);
    }

    /**
     * 异步批量处理解密消息
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<List<String>> asyncBatchDecryptMessages(List<byte[]> encryptedMessages) {
        return CompletableFuture.supplyAsync(() -> {
            long startTime = System.currentTimeMillis();
            taskMonitor.startTask("batchDecryptMessages", encryptedMessages.size());

            List<String> decryptedMessages = new java.util.ArrayList<>();

            try {
                // 将字节数组转换为MessageEncrypted实体
                List<MessageEncrypted> messageEntities = convertToMessageEntities(encryptedMessages);

                // 使用解密服务进行批量解密
                E2EEDecryptionService.BatchDecryptionResult batchResult = e2eeDecryptionService.decryptMessagesBatch(messageEntities);

                // 处理解密结果
                for (MessageEncrypted message : messageEntities) {
                    if (batchResult.getSuccesses().containsKey(message.getId())) {
                        E2EEDecryptionService.DecryptionResult result = batchResult.getSuccesses().get(message.getId());
                        decryptedMessages.add(result.getContent());

                        // 记录性能指标
                        e2eePerformanceService.recordDecryptionMetrics(1);
                    } else if (batchResult.getFailures().containsKey(message.getId())) {
                        E2EEDecryptionService.DecryptionException exception = batchResult.getFailures().get(message.getId());
                        log.warn("消息解密失败，消息ID: {}, 错误: {}", message.getId(), exception.getErrorCode());
                        decryptedMessages.add("[DECRYPTION_FAILED]");
                    }
                    taskMonitor.incrementProgress();
                }

                log.info("异步批量解密完成，消息数: {}, 耗时: {}ms",
                    encryptedMessages.size(), System.currentTimeMillis() - startTime);
                taskMonitor.completeTask("batchDecryptMessages");
                return decryptedMessages;
            } catch (Exception e) {
                log.error("异步批量解密失败", e);
                taskMonitor.failTask("batchDecryptMessages", e);
                throw new RuntimeException(e);
            }
        }, e2eeTaskExecutor);
    }

    /**
     * 异步验证消息签名
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Map<Long, Boolean>> asyncBatchVerifySignatures(List<Map<String, Object>> messages) {
        return CompletableFuture.supplyAsync(() -> {
            long startTime = System.currentTimeMillis();
            taskMonitor.startTask("batchVerifySignatures", messages.size());

            Map<Long, Boolean> results = new ConcurrentHashMap<>();

            try {
                for (Map<String, Object> message : messages) {
                    Long messageId = (Long) message.get("id");
                    boolean isValid = verifyMessageSignature(message);
                    results.put(messageId, isValid);

                    // 记录性能指标
                    e2eePerformanceService.recordSignatureVerificationMetrics(1);

                    taskMonitor.incrementProgress();
                }

                log.info("异步批量验证签名完成，消息数: {}, 耗时: {}ms",
                    messages.size(), System.currentTimeMillis() - startTime);
                taskMonitor.completeTask("batchVerifySignatures");
                return results;
            } catch (Exception e) {
                log.error("异步批量验证签名失败", e);
                taskMonitor.failTask("batchVerifySignatures", e);
                throw new RuntimeException(e);
            }
        }, e2eeTaskExecutor);
    }

    /**
     * 异步发送消息通知
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Void> asyncSendNotifications(List<Map<String, Object>> notifications) {
        return CompletableFuture.runAsync(() -> {
            long startTime = System.currentTimeMillis();
            taskMonitor.startTask("sendNotifications", notifications.size());

            try {
                for (Map<String, Object> notification : notifications) {
                    sendNotification(notification);
                    taskMonitor.incrementProgress();
                }

                log.info("异步发送通知完成，通知数: {}, 耗时: {}ms",
                    notifications.size(), System.currentTimeMillis() - startTime);
                taskMonitor.completeTask("sendNotifications");
            } catch (Exception e) {
                log.error("异步发送通知失败", e);
                taskMonitor.failTask("sendNotifications", e);
                throw new RuntimeException(e);
            }
        }, e2eeTaskExecutor);
    }

    /**
     * 异步处理消息已读通知
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Void> asyncProcessReadNotifications(List<Map<String, Object>> notifications) {
        String taskId = "readNotifications:" + System.currentTimeMillis();

        CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
            long startTime = System.currentTimeMillis();
            taskMonitor.startTask("processReadNotifications", notifications.size());

            try {
                // 批量处理已读通知
                for (Map<String, Object> notification : notifications) {
                    processReadNotification(notification);
                    taskMonitor.incrementProgress();
                }

                log.info("异步处理已读通知完成，通知数: {}, 耗时: {}ms",
                    notifications.size(), System.currentTimeMillis() - startTime);
                taskMonitor.completeTask("processReadNotifications");
            } catch (Exception e) {
                log.error("异步处理已读通知失败", e);
                taskMonitor.failTask("processReadNotifications", e);
                throw new RuntimeException(e);
            }
        }, e2eeTaskExecutor);

        taskCache.put(taskId, future);
        return future;
    }

    /**
     * 异步处理消息销毁通知
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Void> asyncProcessDestructNotifications(List<Map<String, Object>> notifications) {
        String taskId = "destructNotifications:" + System.currentTimeMillis();

        CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
            long startTime = System.currentTimeMillis();
            taskMonitor.startTask("processDestructNotifications", notifications.size());

            try {
                // 批量处理销毁通知
                for (Map<String, Object> notification : notifications) {
                    processDestructNotification(notification);
                    taskMonitor.incrementProgress();
                }

                log.info("异步处理销毁通知完成，通知数: {}, 耗时: {}ms",
                    notifications.size(), System.currentTimeMillis() - startTime);
                taskMonitor.completeTask("processDestructNotifications");
            } catch (Exception e) {
                log.error("异步处理销毁通知失败", e);
                taskMonitor.failTask("processDestructNotifications", e);
                throw new RuntimeException(e);
            }
        }, e2eeTaskExecutor);

        taskCache.put(taskId, future);
        return future;
    }

    /**
     * 异步清理过期数据
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Integer> asyncCleanupExpiredData(String dataType, int batchSize) {
        return CompletableFuture.supplyAsync(() -> {
            long startTime = System.currentTimeMillis();

            try {
                int cleanedCount = cleanupExpiredDataByType(dataType, batchSize);

                log.info("异步清理过期数据完成，类型: {}, 批次大小: {}, 清理数量: {}, 耗时: {}ms",
                    dataType, batchSize, cleanedCount, System.currentTimeMillis() - startTime);
                return cleanedCount;
            } catch (Exception e) {
                log.error("异步清理过期数据失败", e);
                throw new RuntimeException(e);
            }
        }, e2eeTaskExecutor);
    }

    /**
     * 并行处理多个异步任务
     */
    public CompletableFuture<Void> parallelAsyncTasks(java.util.List<CompletableFuture<?>> tasks) {
        return CompletableFuture.allOf(tasks.toArray(new CompletableFuture[0]))
            .thenRun(() -> {
                log.info("所有异步任务完成，任务数: {}", tasks.size());
            });
    }

    /**
     * 取消异步任务
     */
    public boolean cancelAsyncTask(String taskId) {
        CompletableFuture<?> future = taskCache.get(taskId);
        if (future != null && !future.isDone()) {
            boolean cancelled = future.cancel(true);
            if (cancelled) {
                taskCache.remove(taskId);
                log.info("异步任务已取消: {}", taskId);
            }
            return cancelled;
        }
        return false;
    }

    /**
     * 获取任务状态
     */
    public AsyncTaskStatus getTaskStatus(String taskId) {
        CompletableFuture<?> future = taskCache.get(taskId);
        if (future == null) {
            return AsyncTaskStatus.NOT_FOUND;
        }

        if (future.isDone()) {
            if (future.isCompletedExceptionally()) {
                return AsyncTaskStatus.FAILED;
            } else if (future.isCancelled()) {
                return AsyncTaskStatus.CANCELLED;
            } else {
                return AsyncTaskStatus.COMPLETED;
            }
        } else {
            return AsyncTaskStatus.RUNNING;
        }
    }

    /**
     * 获取线程池状态
     */
    public ThreadPoolStatus getThreadPoolStatus() {
        if (e2eeTaskExecutor instanceof ThreadPoolExecutor) {
            ThreadPoolExecutor executor = (ThreadPoolExecutor) e2eeTaskExecutor;
            return new ThreadPoolStatus(
                executor.getActiveCount(),
                executor.getPoolSize(),
                executor.getCorePoolSize(),
                executor.getMaximumPoolSize(),
                executor.getQueue().size(),
                executor.getCompletedTaskCount()
            );
        }
        return new ThreadPoolStatus(0, 0, 0, 0, 0, 0);
    }

    // 辅助方法

    /**
     * 加密单个消息
     */
    private Map<String, Object> encryptMessage(String content, String recipientId, String algorithm) {
        try {
            // 生成随机密钥和IV
            KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
            keyGenerator.init(256);
            SecretKey secretKey = keyGenerator.generateKey();

            byte[] iv = new byte[12]; // GCM推荐IV长度
            new SecureRandom().nextBytes(iv);

            // 执行加密
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(128, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec);

            byte[] encrypted = cipher.doFinal(content.getBytes(StandardCharsets.UTF_8));

            // 使用接收者的公钥加密会话密钥
            byte[] wrappedKey = wrapSessionKey(secretKey, recipientId);

            // 构建结果
            Map<String, Object> result = new HashMap<>();
            result.put("ciphertext", Base64.getEncoder().encodeToString(encrypted));
            result.put("iv", Base64.getEncoder().encodeToString(iv));
            result.put("wrappedKey", Base64.getEncoder().encodeToString(wrappedKey));
            result.put("algorithm", algorithm);
            result.put("timestamp", LocalDateTime.now());

            return result;
        } catch (Exception e) {
            log.error("消息加密失败", e);
            throw new RuntimeException("加密失败", e);
        }
    }

    /**
     * 解密消息
     */
    private String decryptMessage(byte[] encryptedMessage) {
        try {
            // 这里应该根据实际的加密消息格式进行解密
            // 简化实现，实际应该从数据库获取完整消息信息
            // 完整解密需要：
            // 1. 从MessageEncrypted表获取消息的密文、IV、密钥ID等信息
            // 2. 获取对应的会话密钥
            // 3. 使用AES算法解密
            // 4. 验证消息完整性
            log.warn("使用简化解密实现，生产环境需要完整实现");
            return new String(encryptedMessage, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("消息解密失败", e);
            throw new RuntimeException("解密失败", e);
        }
    }

    /**
     * 验证消息签名
     */
    private boolean verifyMessageSignature(Map<String, Object> message) {
        try {
            String signature = (String) message.get("signature");
            String content = (String) message.get("content");
            String senderId = (String) message.get("senderId");

            if (signature == null || content == null || senderId == null) {
                return false;
            }

            // 获取发送者的公钥
            UserPublicKey publicKey = e2eeKeyService.getLatestPublicKey(Long.parseLong(senderId));
            if (publicKey == null) {
                log.warn("未找到发送者公钥: {}", senderId);
                return false;
            }

            // 验证签名
            return verifySignatureInternal(content, signature, publicKey.getSpki());
        } catch (Exception e) {
            log.error("签名验证失败", e);
            return false;
        }
    }

    /**
     * 发送通知
     */
    private void sendNotification(Map<String, Object> notification) {
        try {
            // 使用推送服务发送通知
            Long recipientId = notification.get("recipientId") != null ?
                Long.parseLong(String.valueOf(notification.get("recipientId"))) : null;

            if (recipientId != null) {
                com.luohuo.flex.model.entity.WsBaseResp<java.util.Map<String,Object>> msg = new com.luohuo.flex.model.entity.WsBaseResp<>();
                msg.setType("E2EE_NOTIFY");
                msg.setData(notification);
                pushService.sendPushMsg(msg, recipientId, null);
            }
        } catch (Exception e) {
            log.error("发送通知失败", e);
        }
    }

    /**
     * 处理已读通知
     */
    private void processReadNotification(Map<String, Object> notification) {
        try {
            Long messageId = notification.get("messageId") != null ?
                Long.parseLong(String.valueOf(notification.get("messageId"))) : null;
            Long userId = notification.get("userId") != null ?
                Long.parseLong(String.valueOf(notification.get("userId"))) : null;

            if (messageId != null && userId != null) {
                // 更新消息已读状态
                e2eeMessageService.updateMessageReadStatus(messageId, userId);

                // 发送WebSocket通知
                Map<String, Object> wsNotification = new HashMap<>();
                wsNotification.put("type", "MESSAGE_READ");
                wsNotification.put("messageId", messageId);
                wsNotification.put("userId", userId);
                wsNotification.put("timestamp", LocalDateTime.now());

                com.luohuo.flex.model.entity.WsBaseResp<java.util.Map<String,Object>> msg = new com.luohuo.flex.model.entity.WsBaseResp<>();
                msg.setType("MESSAGE_READ");
                msg.setData(wsNotification);
                pushService.sendPushMsg(msg, userId, null);
            }
        } catch (Exception e) {
            log.error("处理已读通知失败", e);
        }
    }

    /**
     * 处理销毁通知
     */
    private void processDestructNotification(Map<String, Object> notification) {
        try {
            Long messageId = notification.get("messageId") != null ?
                Long.parseLong(String.valueOf(notification.get("messageId"))) : null;
            Long userId = notification.get("userId") != null ?
                Long.parseLong(String.valueOf(notification.get("userId"))) : null;

            if (messageId != null && userId != null) {
                // 标记消息为已销毁
                e2eeMessageService.markMessageAsDestructed(messageId);

                // 发送WebSocket通知
                Map<String, Object> wsNotification = new HashMap<>();
                wsNotification.put("type", "MESSAGE_DESTRUCTED");
                wsNotification.put("messageId", messageId);
                wsNotification.put("userId", userId);
                wsNotification.put("timestamp", LocalDateTime.now());

                com.luohuo.flex.model.entity.WsBaseResp<java.util.Map<String,Object>> msg = new com.luohuo.flex.model.entity.WsBaseResp<>();
                msg.setType("MESSAGE_DESTRUCTED");
                msg.setData(wsNotification);
                pushService.sendPushMsg(msg, userId, null);
            }
        } catch (Exception e) {
            log.error("处理销毁通知失败", e);
        }
    }

    /**
     * 包装会话密钥
     */
    private byte[] wrapSessionKey(SecretKey sessionKey, String recipientId) {
        try {
            // 获取接收者的公钥
            UserPublicKey publicKey = e2eeKeyService.getLatestPublicKey(Long.parseLong(recipientId));
            if (publicKey == null) {
                throw new RuntimeException("未找到接收者公钥");
            }

            // 解析公钥
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(Base64.getDecoder().decode(publicKey.getSpki()));
            KeyFactory keyFactory = KeyFactory.getInstance(publicKey.getAlgorithm().getJavaAlgorithmName());
            PublicKey rsaPublicKey = keyFactory.generatePublic(keySpec);

            // 使用RSA-OAEP包装会话密钥
            Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            cipher.init(Cipher.WRAP_MODE, rsaPublicKey);
            return cipher.wrap(sessionKey);
        } catch (Exception e) {
            log.error("包装会话密钥失败", e);
            throw new RuntimeException("包装密钥失败", e);
        }
    }

    /**
     * 内部签名验证方法
     */
    private boolean verifySignatureInternal(String content, String signature, String publicKeyStr) {
        try {
            // 解析公钥
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(Base64.getDecoder().decode(publicKeyStr));
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            PublicKey publicKey = keyFactory.generatePublic(keySpec);

            // 验证签名
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(publicKey);
            sig.update(content.getBytes(StandardCharsets.UTF_8));

            byte[] signatureBytes = Base64.getDecoder().decode(signature);
            return sig.verify(signatureBytes);
        } catch (Exception e) {
            log.error("内部签名验证失败", e);
            return false;
        }
    }

    private int cleanupExpiredDataByType(String dataType, int batchSize) {
        try {
            int cleanedCount = 0;

            switch (dataType.toLowerCase()) {
                case "messages":
                    // 清理过期的加密消息
                    cleanedCount = e2eeMessageService.cleanupExpiredMessages(batchSize);
                    break;

                case "keys":
                    // 清理过期的密钥
                    cleanedCount = e2eeKeyService.cleanupExpiredKeys(batchSize);
                    break;

                case "sessions":
                    // 清理过期的会话密钥包
                    cleanedCount = e2eeMessageService.cleanupExpiredSessions(batchSize);
                    break;

                case "audit_logs":
                    // 清理过期的审计日志
                    cleanedCount = e2eePerformanceService.cleanupOldAuditLogs(batchSize);
                    break;

                default:
                    log.warn("未知的数据清理类型: {}", dataType);
                    return 0;
            }

            log.info("数据清理完成，类型: {}, 批次大小: {}, 清理数量: {}",
                dataType, batchSize, cleanedCount);

            return cleanedCount;
        } catch (Exception e) {
            log.error("数据清理失败，类型: {}", dataType, e);
            return 0;
        }
    }

    // 状态枚举
    public enum AsyncTaskStatus {
        NOT_FOUND,
        RUNNING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    /**
     * 将字节数组列表转换为MessageEncrypted实体列表
     * 注意：这是一个简化的实现，实际使用中应该包含完整的消息信息
     */
    private List<MessageEncrypted> convertToMessageEntities(List<byte[]> encryptedMessages) {
        List<MessageEncrypted> entities = new ArrayList<>();
        long id = 1L;

        for (byte[] encryptedData : encryptedMessages) {
            MessageEncrypted entity = new MessageEncrypted();
            entity.setId(id++);
            entity.setCiphertext(encryptedData);

            // 设置默认值，实际使用中应该从参数或数据库获取
            entity.setConversationId("default_conversation");
            entity.setSenderId(1L);
            entity.setRecipientId(2L);
            entity.setKeyId("default_key_id");
            entity.setAlgorithm(com.luohuo.flex.im.domain.enums.EncryptionAlgorithm.AES_GCM);

            // 生成随机的IV（实际使用中应该从消息中获取）
            entity.setIv(generateRandomIV());

            entities.add(entity);
        }

        return entities;
    }

    /**
     * 生成随机初始化向量
     */
    private byte[] generateRandomIV() {
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        return iv;
    }

    /**
     * 线程池状态
     */
    public static class ThreadPoolStatus {
        private final int activeThreads;
        private final int poolSize;
        private final int corePoolSize;
        private final int maximumPoolSize;
        private final int queueSize;
        private final long completedTaskCount;

        public ThreadPoolStatus(int activeThreads, int poolSize, int corePoolSize,
                               int maximumPoolSize, int queueSize, long completedTaskCount) {
            this.activeThreads = activeThreads;
            this.poolSize = poolSize;
            this.corePoolSize = corePoolSize;
            this.maximumPoolSize = maximumPoolSize;
            this.queueSize = queueSize;
            this.completedTaskCount = completedTaskCount;
        }

        // Getters
        public int getActiveThreads() { return activeThreads; }
        public int getPoolSize() { return poolSize; }
        public int getCorePoolSize() { return corePoolSize; }
        public int getMaximumPoolSize() { return maximumPoolSize; }
        public int getQueueSize() { return queueSize; }
        public long getCompletedTaskCount() { return completedTaskCount; }

        @Override
        public String toString() {
            return String.format(
                "ThreadPoolStatus{active=%d, pool=%d, core=%d, max=%d, queue=%d, completed=%d}",
                activeThreads, poolSize, corePoolSize, maximumPoolSize, queueSize, completedTaskCount
            );
        }
    }
}
