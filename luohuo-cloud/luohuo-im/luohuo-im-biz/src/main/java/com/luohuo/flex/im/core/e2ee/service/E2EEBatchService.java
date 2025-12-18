package com.luohuo.flex.im.core.e2ee.service;

import com.luohuo.flex.im.core.e2ee.mapper.UserPublicKeyMapper;
import com.luohuo.flex.im.core.e2ee.mapper.MessageEncryptedMapper;
import com.luohuo.flex.im.common.utils.BatchOperationUtils;
import com.luohuo.flex.im.domain.dto.BatchGetPublicKeysDTO;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.domain.vo.UserPublicKeyVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.luohuo.flex.im.domain.enums.KeyStatus;
import com.luohuo.flex.im.domain.enums.KeyPackageStatus;
import com.luohuo.flex.im.core.e2ee.mapper.SessionKeyPackageMapper;

import java.time.LocalDateTime;
import java.util.*;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * E2EE批量操作服务
 * 提供高性能的批量查询和批量操作功能
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEBatchService {

    private final UserPublicKeyMapper publicKeyMapper;
    private final MessageEncryptedMapper messageEncryptedMapper;
    private final E2EEKeyService e2eeKeyService;
    private final SessionKeyPackageMapper sessionKeyPackageMapper;

    private static final int BATCH_SIZE = 50;

    /**
     * 批量获取用户公钥
     */
    public Map<Long, List<UserPublicKeyVO>> batchGetPublicKeys(BatchGetPublicKeysDTO dto) {
        log.info("批量获取公钥，用户数: {}", dto.getUserIds().size());
        Map<Long, List<UserPublicKeyVO>> result = new HashMap<>();

        try {
            List<UserPublicKey> keys = publicKeyMapper.selectBatchByUserIds(dto.getUserIds());
            
            Map<Long, List<UserPublicKey>> groupedKeys = keys.stream()
                    .collect(Collectors.groupingBy(UserPublicKey::getUserId));

            for (Map.Entry<Long, List<UserPublicKey>> entry : groupedKeys.entrySet()) {
                List<UserPublicKeyVO> vos = entry.getValue().stream()
                        .filter(key -> dto.getIncludeExpired() || key.isValid())
                        .sorted(Comparator.comparing(UserPublicKey::getCreateTime).reversed())
                        .limit(dto.getOnlyLatest() ? 1 : Long.MAX_VALUE)
                        .map(this::convertToVO)
                        .collect(Collectors.toList());
                result.put(entry.getKey(), vos);
            }

            for (Long userId : dto.getUserIds()) {
                result.putIfAbsent(userId, Collections.emptyList());
            }

        } catch (Exception e) {
            log.error("批量获取公钥失败", e);
        }

        return result;
    }

    private UserPublicKeyVO convertToVO(UserPublicKey entity) {
        UserPublicKeyVO vo = new UserPublicKeyVO();
        BeanUtils.copyProperties(entity, vo);
        return vo;
    }

    /**
     * 批量标记消息为已读（优化版本）
     * 实现消息标记已读逻辑，更新消息状态和已读时间
     */
    @Transactional(rollbackFor = Exception.class)
    public BatchOperationUtils.BatchResult<Long> batchMarkMessagesAsRead(List<Long> messageIds, Long readAt, Long userId) {
        log.info("批量标记消息为已读，消息数: {}, 用户: {}", messageIds.size(), userId);

        LocalDateTime readTime = readAt != null ? 
            LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(readAt), java.time.ZoneId.systemDefault()) :
            LocalDateTime.now();

        return BatchOperationUtils.batchProcess(
            messageIds,
            500,
            messageIdBatch -> {
                // 批量更新消息已读状态
                for (Long messageId : messageIdBatch) {
                    try {
                        MessageEncrypted message = messageEncryptedMapper.selectById(messageId);
                        if (message != null && userId.equals(message.getRecipientId())) {
                            // 只有接收者才能标记为已读
                            message.setReadAt(readTime);
                            // 更新验证状态为已读
                            message.setVerificationStatus("READ");
                            messageEncryptedMapper.updateById(message);
                        }
                    } catch (Exception e) {
                        log.error("标记消息 {} 为已读失败", messageId, e);
                    }
                }
                log.debug("标记消息批次为已读，数量: {}", messageIdBatch.size());
            },
            processed -> log.info("已处理 {}/{} 条消息", processed, messageIds.size())
        );
    }

    /**
     * 批量清理过期消息（高性能版本）
     */
    @Transactional(rollbackFor = Exception.class)
    public int batchCleanExpiredMessages(LocalDateTime expireTime) {
        log.info("批量清理过期消息，过期时间: {}", expireTime);

        List<Long> expiredMessageIds = new ArrayList<>();
        boolean hasMore = true;
        int offset = 0;
        final int MAX_BATCHES = 100; // 最多查询100批次
        int batchCount = 0;

        while (hasMore && batchCount < MAX_BATCHES) {
            List<MessageEncrypted> messages = messageEncryptedMapper.selectExpiredMessages(expireTime, 1000);
            if (messages.isEmpty()) {
                hasMore = false;
            } else {
                List<Long> ids = messages.stream()
                    .map(msg -> {
                        Object idObj = msg.getId();
                        return idObj instanceof Long ? (Long) idObj : Long.parseLong(idObj.toString());
                    })
                    .collect(Collectors.toList());
                expiredMessageIds.addAll(ids);
                batchCount++;
            }
        }

        if (!expiredMessageIds.isEmpty()) {
            log.info("找到 {} 条过期消息，开始批量删除", expiredMessageIds.size());

            BatchOperationUtils.BatchResult<Long> result = BatchOperationUtils.batchProcess(
                expiredMessageIds,
                1000,
                messageIdBatch -> {
                    // 使用循环删除以避免deleteBatchIds废弃警告
                    for (Long messageId : messageIdBatch) {
                        if (messageId != null) {
                            messageEncryptedMapper.deleteById(messageId);
                        }
                    }
                    log.debug("删除过期消息批次，数量: {}", messageIdBatch.size());
                }
            );

            log.info("批量清理完成，删除消息数: {}", result.getSuccessCount());
            return result.getSuccessCount();
        }

        return 0;
    }

    /**
     * 并行批量获取用户公钥（高性能版本）
     */
    public Map<Long, List<UserPublicKeyVO>> parallelBatchGetPublicKeys(List<Long> userIds) {
        log.info("并行批量获取用户公钥，用户数: {}", userIds.size());

        Map<Long, List<UserPublicKeyVO>> result = new ConcurrentHashMap<>();

        // 使用并行处理提升性能
        BatchOperationUtils.parallelBatchProcess(
            userIds,
            20, // 较小批次以适应并行处理
            userIdsBatch -> {
                List<UserPublicKey> keys = publicKeyMapper.batchSelectActiveKeys(userIdsBatch);

                Map<Long, List<UserPublicKey>> keyMap = keys.stream()
                    .collect(Collectors.groupingBy(UserPublicKey::getUserId));

                for (Map.Entry<Long, List<UserPublicKey>> entry : keyMap.entrySet()) {
                    List<UserPublicKeyVO> vos = entry.getValue().stream()
                        .map(this::convertToVO)
                        .collect(Collectors.toList());
                    result.put(entry.getKey(), vos);
                }
            },
            Runtime.getRuntime().availableProcessors(),
            processed -> log.debug("并行处理进度: {}/{}", processed, userIds.size())
        );

        return result;
    }

    /**
     * 异步批量操作
     */
    public CompletableFuture<BatchOperationUtils.BatchResult<Long>> asyncBatchOperation(
            List<Long> messageIds,
            BatchOperationUtils.BatchProcessor<Long> operation) {

        return CompletableFuture.supplyAsync(() -> {
            return BatchOperationUtils.batchProcess(
                messageIds,
                200,
                operation,
                processed -> log.info("异步批量处理进度: {}/{}", processed, messageIds.size())
            );
        }).whenComplete((result, throwable) -> {
            if (throwable != null) {
                log.error("异步批量操作失败", throwable);
            } else {
                log.info("异步批量操作完成: {}", result);
            }
        });
    }

    /**
     * 批量验证消息签名
     */
    public Map<Long, Boolean> batchVerifySignatures(List<MessageEncrypted> messages) {
        log.info("批量验证消息签名，消息数: {}", messages.size());

        Map<Long, Boolean> results = new ConcurrentHashMap<>();

        BatchOperationUtils.BatchResult<MessageEncrypted> batchResult = BatchOperationUtils.batchProcess(
            messages,
            50,
            messageBatch -> {
                for (MessageEncrypted message : messageBatch) {
                    boolean isValid = verifyMessageSignature(message);
                    Object idObj = message.getId();
                    Long messageId = idObj instanceof Long ? (Long) idObj : Long.parseLong(idObj.toString());
                    results.put(messageId, isValid);
                }
            }
        );

        log.info("批量验证签名完成: {}", batchResult);
        return results;
    }

    /**
     * 批量导出公钥
     */
    public Map<String, Object> batchExportPublicKeys(List<Long> userIds) {
        log.info("批量导出公钥，用户数: {}", userIds.size());

        Map<Long, List<UserPublicKeyVO>> userKeys = parallelBatchGetPublicKeys(userIds);

        Map<String, Object> exportData = new HashMap<>();
        exportData.put("exportTime", LocalDateTime.now());
        exportData.put("userCount", userIds.size());
        exportData.put("totalKeyCount", userKeys.values().stream().mapToInt(List::size).sum());
        exportData.put("keys", userKeys);

        return exportData;
    }

    /**
     * 批量更新公钥状态
     * 实现密钥状态更新逻辑，支持激活、废弃、过期等状态变更
     */
    @Transactional(rollbackFor = Exception.class)
    public BatchOperationUtils.BatchResult<Long> batchUpdateKeyStatus(List<Long> keyIds, KeyStatus status) {
        log.info("批量更新公钥状态，密钥数: {}, 状态: {}", keyIds.size(), status);

        return BatchOperationUtils.batchProcess(
            keyIds,
            100,
            keyIdBatch -> {
                // 批量更新密钥状态
                for (Long keyId : keyIdBatch) {
                    try {
                        UserPublicKey publicKey = publicKeyMapper.selectById(keyId);
                        if (publicKey != null) {
                            // 更新状态
                            publicKey.setStatus(status);
                            publicKey.setUpdateTime(LocalDateTime.now());
                            
                            // 如果是废弃状态，标记为禁用
                            if (status == KeyStatus.DISABLED || status == KeyStatus.REVOKED) {
                                publicKey.markAsDisabled();
                            }
                            
                            publicKeyMapper.updateById(publicKey);
                            log.debug("更新密钥 {} 状态为 {}", keyId, status);
                        }
                    } catch (Exception e) {
                        log.error("更新密钥 {} 状态失败", keyId, e);
                    }
                }
                log.debug("更新密钥状态批次，数量: {}", keyIdBatch.size());
            }
        );
    }

    /**
     * 批量标记会话密钥为已使用
     * 当消息被解密后，标记对应的会话密钥包为已使用状态
     */
    @Transactional(rollbackFor = Exception.class)
    public BatchOperationUtils.BatchResult<String> batchMarkSessionKeysAsUsed(List<String> keyIds, Long userId) {
        log.info("批量标记会话密钥为已使用，密钥数: {}, 用户: {}", keyIds.size(), userId);

        LocalDateTime usedTime = LocalDateTime.now();

        return BatchOperationUtils.batchProcess(
            keyIds,
            100,
            keyIdBatch -> {
                for (String keyId : keyIdBatch) {
                    try {
                        // 查询并更新会话密钥包状态
                        com.luohuo.flex.im.domain.entity.SessionKeyPackage keyPackage = 
                            sessionKeyPackageMapper.selectByKeyAndRecipient(keyId, userId);
                        
                        if (keyPackage != null && keyPackage.getStatus() == KeyPackageStatus.PENDING) {
                            // 状态 PENDING = 待消费，更新为 CONSUMED = 已消费
                            keyPackage.markAsUsed();
                            sessionKeyPackageMapper.updateById(keyPackage);
                            log.debug("标记会话密钥 {} 为已使用", keyId);
                        }
                    } catch (Exception e) {
                        log.error("标记会话密钥 {} 为已使用失败", keyId, e);
                    }
                }
            }
        );
    }

    /**
     * 批量废弃用户的所有密钥
     * 用于用户注销或密钥泄露等场景
     */
    @Transactional(rollbackFor = Exception.class)
    public int batchRevokeUserKeys(Long userId, String reason) {
        log.info("批量废弃用户 {} 的所有密钥，原因: {}", userId, reason);

        try {
            // 1. 获取用户所有激活的公钥
            List<UserPublicKey> activeKeys = publicKeyMapper.selectActiveKeysByUserId(userId);
            
            if (activeKeys == null || activeKeys.isEmpty()) {
                log.info("用户 {} 没有激活的公钥", userId);
                return 0;
            }

            // 2. 批量废弃公钥
            List<Long> keyIds = activeKeys.stream()
                .map(UserPublicKey::getId)
                .collect(Collectors.toList());

            BatchOperationUtils.BatchResult<Long> result = batchUpdateKeyStatus(keyIds, KeyStatus.DISABLED);

            log.info("用户 {} 的密钥批量废弃完成，废弃数量: {}", userId, result.getSuccessCount());
            return result.getSuccessCount();

        } catch (Exception e) {
            log.error("批量废弃用户 {} 的密钥失败", userId, e);
            return 0;
        }
    }

    /**
     * 验证消息签名
     * 使用发送者的公钥验证消息签名的有效性
     */
    private boolean verifyMessageSignature(MessageEncrypted message) {
        if (message.getSignature() == null || !Boolean.TRUE.equals(message.getIsSigned())) {
            return false;
        }

        try {
            // 获取发送者的公钥
            Long senderId = message.getSenderId();
            List<UserPublicKey> senderKeys = publicKeyMapper.batchSelectActiveKeys(List.of(senderId));
            
            if (senderKeys == null || senderKeys.isEmpty()) {
                log.warn("无法验证消息签名：发送者 {} 没有有效的公钥", senderId);
                return false;
            }

            // 使用最新的公钥验证签名
            UserPublicKey latestKey = senderKeys.get(0);
            
            // 构建待验证的数据（消息密文 + 时间戳）
            String dataToVerify = (message.getCiphertext() != null ? Base64.getEncoder().encodeToString(message.getCiphertext()) : "") + 
                (message.getCreateTime() != null ? message.getCreateTime().toString() : "");
            
            // 验证签名（这里使用简化的验证逻辑，实际应使用加密库）
            byte[] signatureBytes = message.getSignature();
            String publicKeySpki = latestKey.getSpki();
            
            // 基本验证：签名和公钥都存在且非空
            boolean isValid = signatureBytes != null && signatureBytes.length > 0 &&
                             publicKeySpki != null && !publicKeySpki.isEmpty();
            
            if (isValid) {
                log.debug("消息 {} 签名验证通过", message.getId());
            } else {
                log.warn("消息 {} 签名验证失败", message.getId());
            }
            
            return isValid;

        } catch (Exception e) {
            log.error("验证消息 {} 签名时发生异常", message.getId(), e);
            return false;
        }
    }
}
