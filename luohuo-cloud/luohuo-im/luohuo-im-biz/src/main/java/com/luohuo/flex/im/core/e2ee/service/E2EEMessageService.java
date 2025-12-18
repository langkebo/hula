package com.luohuo.flex.im.core.e2ee.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.luohuo.basic.exception.BizException;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.core.e2ee.event.SessionKeyDistributedEvent;
import com.luohuo.flex.im.core.e2ee.event.MessageDestructedEvent;
import com.luohuo.flex.im.core.e2ee.event.MessageReadEvent;
import com.luohuo.flex.im.core.e2ee.event.EncryptedMessageSendEvent;
import com.luohuo.flex.im.core.e2ee.mapper.MessageEncryptedMapper;
import com.luohuo.flex.im.core.e2ee.mapper.SessionKeyPackageMapper;
import com.luohuo.flex.im.domain.dto.SaveEncryptedMessageDTO;
import com.luohuo.flex.im.domain.dto.SessionKeyPackageDTO;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.domain.entity.SessionKeyPackage;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.core.e2ee.converter.UserKeyConverter;
import com.luohuo.flex.im.domain.enums.KeyPackageStatus;
import com.luohuo.flex.im.domain.enums.EncryptionAlgorithm;
import com.luohuo.flex.im.domain.vo.CursorPageBaseResp;
import com.luohuo.flex.im.domain.vo.EncryptedMessageResp;
import com.luohuo.flex.im.domain.vo.UserPublicKeyVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 端到端加密消息服务
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEMessageService {

    private final MessageEncryptedMapper messageEncryptedMapper;
    private final SessionKeyPackageMapper sessionKeyPackageMapper;
    private final E2EEKeyService e2eeKeyService;
    private final RedisTemplate<String, String> redisTemplate;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final E2EEAuditService auditService;
    private final com.luohuo.flex.im.core.e2ee.config.E2EEProperties e2eeProperties;
    private final UserKeyConverter userKeyConverter;

    private static final String MESSAGE_CACHE_PREFIX = "e2ee:message:";
    private static final String CONTENT_HASH_CACHE_PREFIX = "e2ee:hash:";

    /**
     * 保存加密消息
     */
    @Transactional(rollbackFor = Exception.class)
    public Long saveEncryptedMessage(SaveEncryptedMessageDTO dto) {
        log.info("保存加密消息，会话ID: {}, 发送者: {}", dto.getConversationId(), ContextUtil.getUserId());

        // 1. 验证字段
        validateEncryptedMessage(dto);

        // 2. 计算内容哈希
        byte[] contentHash = calculateContentHash(dto);

        // 3. 检查重复消息
        MessageEncrypted existMessage = messageEncryptedMapper.selectByContentHash(contentHash);
        if (existMessage != null) {
            log.warn("检测到重复消息，会话ID: {}, 哈希: {}", dto.getConversationId(),
                Base64.getEncoder().encodeToString(contentHash));
            throw new BizException("消息已存在");
        }

        // 4. 验证签名（如果提供）
        boolean signatureValid = false;
        if (dto.getSignature() != null) {
            signatureValid = verifySignature(dto);
            if (!signatureValid) {
                throw new BizException("消息签名验证失败");
            }
        } else if (e2eeProperties.getEncryption().isRequireSignature()) {
            throw new BizException("缺少签名");
        }

        // 5. 创建加密消息实体
        MessageEncrypted message = new MessageEncrypted();
        // ID由MyBatis-Plus自动生成，使用@TableId(type = IdType.ASSIGN_ID)
        message.setMsgId(dto.getMsgId());
        message.setConversationId(dto.getConversationId());
        message.setSenderId(ContextUtil.getUserId());
        message.setRecipientId(dto.getRecipientId());
        message.setRoomId(dto.getRoomId());
        message.setTenantId(ContextUtil.getTenantId());
        message.setKeyId(dto.getKeyId());
        message.setAlgorithm(dto.getAlgorithm());
        message.setCiphertext(dto.getCiphertextBytes());
        message.setIv(dto.getIvBytes());
        message.setTag(dto.getTagBytes());
        message.setContentHash(contentHash);
        message.setSignature(dto.getSignatureBytes());
        message.setContentType(dto.getContentType());
        message.setEncryptedExtra(dto.getEncryptedExtra());
        message.setMessageSize(dto.getMessageSize());
        message.setIsSigned(dto.getSignature() != null);
        message.setVerificationStatus(signatureValid ? "VERIFIED" : "UNVERIFIED");
        message.setEncryptionTimeMs(dto.getEncryptionTimeMs());
        Long userId = ContextUtil.getUserId();
        if (userId != null) {
            // 直接设置 createBy 和 updateBy，因为现在 ID 是 Long 类型
            message.setCreateBy(userId);
            message.setUpdateBy(userId);
        }

        // 设置自毁定时器并计算初始销毁时间
        if (dto.getSelfDestructTimer() != null && dto.getSelfDestructTimer() > 0) {
            message.setSelfDestructTimer(dto.getSelfDestructTimer());
            // 计算初始销毁时间（未读状态）
            LocalDateTime destructAt = message.calculateDestructTime();
            message.setDestructAt(destructAt);
            log.info("消息设置自毁定时器，定时器: {} ms, 预计销毁时间: {}",
                dto.getSelfDestructTimer(), destructAt);
        }

        // 6. 保存到数据库
        int affectedRows = messageEncryptedMapper.insert(message);
        if (affectedRows <= 0) {
            throw new BizException("保存加密消息失败");
        }

        // 7. 更新缓存
        updateMessageCache(message);

        // 8. 发布消息发送事件
        Long messageId = message.getId();
        applicationEventPublisher.publishEvent(
            new EncryptedMessageSendEvent(messageId, message.getConversationId(),
                message.getSenderId(), message.getRecipientId(), message.getRoomId())
        );

        // 9. 记录审计日志
        auditService.logMessageEncryption(
            message.getSenderId(),
            message.getConversationId(),
            message.getKeyId(),
            message.getAlgorithm().name(),
            message.getMessageSize(),
            message.getIsSigned()
        );

        log.info("加密消息保存成功，消息ID: {}", messageId);
        return messageId;
    }

    public String getEncryptedMessageExtra(Long messageId) {
        MessageEncrypted m = messageEncryptedMapper.selectById(messageId);
        if (m == null) {
            throw new BizException("加密消息不存在");
        }
        return m.getEncryptedExtra();
    }

    /**
     * 分发会话密钥包
     */
    @Transactional(rollbackFor = Exception.class)
    public void distributeSessionKey(SessionKeyPackageDTO dto) {
        log.info("分发会话密钥包，会话ID: {}, 接收者: {}", dto.getSessionId(), dto.getRecipientId());

        // 1. 验证接收者存在
        validateRecipient(dto.getRecipientId());

        // 2. 检查密钥包是否已存在
        SessionKeyPackage existPackage = sessionKeyPackageMapper.selectByKeyAndRecipient(
            dto.getKeyId(), dto.getRecipientId()
        );
        if (existPackage != null) {
            throw new BizException("密钥包已存在");
        }

        // 3. 解析过期时间
        LocalDateTime expiresAt = null;
        if (dto.getExpiresAt() != null) {
            try {
                expiresAt = LocalDateTime.parse(dto.getExpiresAt(), DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            } catch (Exception e) {
                throw new BizException("过期时间格式错误");
            }
        } else {
            // 默认7天过期
            expiresAt = LocalDateTime.now().plusDays(7);
        }

        // 4. 创建密钥包实体
        SessionKeyPackage keyPackage = new SessionKeyPackage();
        // ID由MyBatis-Plus自动生成，使用@TableId(type = IdType.ASSIGN_ID)
        keyPackage.setSessionId(dto.getSessionId());
        keyPackage.setKeyId(dto.getKeyId());
        keyPackage.setSenderId(ContextUtil.getUserId());
        keyPackage.setRecipientId(dto.getRecipientId());
        keyPackage.setTenantId(ContextUtil.getTenantId());
        keyPackage.setWrappedKey(dto.getWrappedKeyBytes());
        keyPackage.setAlgorithm(dto.getAlgorithm());
        keyPackage.setStatus(KeyPackageStatus.ACTIVE);
        keyPackage.setExpiresAt(expiresAt);
        keyPackage.setForwardSecret(dto.getForwardSecret());
        keyPackage.setEphemeralPublicKey(dto.getEphemeralPublicKey());
        keyPackage.setKdfAlgorithm(dto.getKdfAlgorithm());
        keyPackage.setKdfInfo(dto.getKdfInfo());
        // 设置创建者和更新者
        Long currentUserId = ContextUtil.getUserId();
        if (currentUserId != null) {
            try {
                // 直接设置用户ID
                keyPackage.setCreateBy(currentUserId);
                keyPackage.setUpdateBy(currentUserId);
            } catch (Exception e) {
                log.error("设置密钥包创建者和更新者信息失败", e);
            }
        }

        // 5. 保存到数据库
        int affectedRows = sessionKeyPackageMapper.insert(keyPackage);
        if (affectedRows <= 0) {
            throw new BizException("保存密钥包失败");
        }

        // 6. 撤销会话的旧密钥（如果需要）
        sessionKeyPackageMapper.revokeOldKeys(dto.getSessionId(), dto.getKeyId());

        // 7. 发布密钥包分发事件
        Long keyPackageId = keyPackage.getId();
        applicationEventPublisher.publishEvent(
            new SessionKeyDistributedEvent(keyPackage, dto.getSessionId(), keyPackageId.toString(),
                dto.getRecipientId(), ContextUtil.getUserId(), true)
        );

        // 8. 通知接收者（通过WebSocket或推送）
        notifyRecipientKeyPackage(dto);

        log.info("会话密钥包分发成功，ID: {}", keyPackage.getId());
    }

    /**
     * 获取待接收的密钥包
     */
    public List<SessionKeyPackageDTO> getPendingKeyPackages(Long userId) {
        List<SessionKeyPackage> packages = sessionKeyPackageMapper.selectPendingByRecipientId(userId);
        return packages.stream()
            .map(this::convertKeyPackageToDTO)
            .collect(Collectors.toList());
    }

    /**
     * 获取加密消息列表
     */
    @Cacheable(value = "e2ee:messages", key = "#conversationId + ':' + #cursor + ':' + #limit")
    public CursorPageBaseResp<EncryptedMessageResp> getEncryptedMessages(
            String conversationId, Long cursor, Integer limit) {

        // 设置默认值
        if (limit == null || limit <= 0) {
            limit = 20;
        }
        if (limit > 100) {
            limit = 100; // 最大限制100条
        }

        // 创建分页对象
        Page<MessageEncrypted> page = new Page<>(1, limit);

        // 查询消息
        IPage<MessageEncrypted> result = messageEncryptedMapper.selectPageByConversationId(
            page, conversationId, ContextUtil.getTenantId()
        );

        // 转换为响应对象
        List<EncryptedMessageResp> messages = result.getRecords().stream()
            .map(this::convertToResp)
            .collect(Collectors.toList());

        // 构建游标分页响应
        CursorPageBaseResp<EncryptedMessageResp> response = new CursorPageBaseResp<>();
        response.setList(messages);
        response.setEmpty(messages.isEmpty());
        response.setCursor(messages.isEmpty() ? null :
            messages.get(messages.size() - 1).getId());
        response.setHasMore(result.getCurrent() < result.getPages());

        return response;
    }

    /**
     * 验证消息签名
     */
    public boolean verifyMessageSignature(Long msgId, byte[] signature) {
        MessageEncrypted message = messageEncryptedMapper.selectById(msgId);
        if (message == null) {
            throw new BizException("消息不存在");
        }

        // 获取发送者的公钥
        UserPublicKeyVO senderKeyVO = e2eeKeyService.getUserPublicKey(
            message.getSenderId(), message.getKeyId()
        );
        UserPublicKey senderKey = userKeyConverter.toEntity(senderKeyVO);

        // RSA-PSS签名验证已实现
        boolean valid = verifyRSAPSSSignature(message, senderKey, signature);

        // 更新验证状态
        message.setVerificationStatus(valid ? "VERIFIED" : "INVALID");
        messageEncryptedMapper.updateById(message);

        return valid;
    }

    /**
     * 验证加密消息格式
     */
    private void validateEncryptedMessage(SaveEncryptedMessageDTO dto) {
        // 检查必要字段
        if (dto.getConversationId() == null || dto.getConversationId().isEmpty()) {
            throw new BizException("会话ID不能为空");
        }
        if (dto.getKeyId() == null || dto.getKeyId().isEmpty()) {
            throw new BizException("密钥ID不能为空");
        }
        if (dto.getCiphertext() == null || dto.getCiphertext().isEmpty()) {
            throw new BizException("密文不能为空");
        }
        if (dto.getIv() == null || dto.getIv().isEmpty()) {
            throw new BizException("初始化向量不能为空");
        }

        // 验证Base64格式
        try {
            Base64.getDecoder().decode(dto.getCiphertext());
            Base64.getDecoder().decode(dto.getIv());
            if (dto.getTag() != null) {
                Base64.getDecoder().decode(dto.getTag());
            }
            if (dto.getSignature() != null) {
                Base64.getDecoder().decode(dto.getSignature());
            }
        } catch (IllegalArgumentException e) {
            throw new BizException("加密数据格式错误");
        }

        // 检查消息大小
        if (dto.getMessageSize() > 10 * 1024 * 1024) { // 10MB限制
            throw new BizException("消息过大");
        }

        // 验证会话类型
        if (!dto.isGroupMessage() && !dto.isPrivateMessage()) {
            throw new BizException("必须指定接收者或群组");
        }
    }

    /**
     * 计算内容哈希
     */
    private byte[] calculateContentHash(SaveEncryptedMessageDTO dto) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            // 构建要哈希的内容：ciphertext || iv || keyId || contentType
            byte[] ciphertext = dto.getCiphertextBytes();
            byte[] iv = dto.getIvBytes();
            byte[] keyId = dto.getKeyId().getBytes(StandardCharsets.UTF_8);
            byte[] contentType = dto.getContentType().getBytes(StandardCharsets.UTF_8);

            digest.update(ciphertext);
            digest.update(iv);
            digest.update(keyId);
            digest.update(contentType);

            return digest.digest();
        } catch (Exception e) {
            throw new BizException("计算内容哈希失败");
        }
    }

    /**
     * 验证签名
     */
    private boolean verifySignature(SaveEncryptedMessageDTO dto) {
        try {
            UserPublicKeyVO senderKeyVO = e2eeKeyService.getUserPublicKey(ContextUtil.getUserId(), dto.getKeyId());
            UserPublicKey senderKey = userKeyConverter.toEntity(senderKeyVO);
            byte[] signature = dto.getSignatureBytes();
            if (senderKey == null || signature == null || signature.length == 0) {
                return false;
            }

            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(Base64.getDecoder().decode(senderKey.getSpki()));
            KeyFactory keyFactory = KeyFactory.getInstance(senderKey.getAlgorithm().getJavaAlgorithmName());
            PublicKey pubKey = keyFactory.generatePublic(keySpec);

            Signature sig = Signature.getInstance("RSASSA-PSS");
            PSSParameterSpec pssSpec = new PSSParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, 32, 1);
            sig.setParameter(pssSpec);
            sig.initVerify(pubKey);

            String messageData = ContextUtil.getUserId() + ":" +
                dto.getConversationId() + ":" +
                dto.getKeyId() + ":" +
                Base64.getEncoder().encodeToString(dto.getCiphertextBytes());

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] messageHash = digest.digest(messageData.getBytes(StandardCharsets.UTF_8));

            sig.update(messageHash);
            boolean valid = sig.verify(signature);
            log.debug("RSA-PSS签名验证结果: {} 会话: {}", valid, dto.getConversationId());
            return valid;
        } catch (NoSuchAlgorithmException | InvalidKeySpecException |
                 InvalidKeyException | InvalidAlgorithmParameterException |
                 SignatureException e) {
            log.error("签名验证失败", e);
            return false;
        } catch (Exception e) {
            log.error("签名验证异常", e);
            return false;
        }
    }

    /**
     * 验证RSA-PSS签名
     */
    private boolean verifyRSAPSSSignature(MessageEncrypted message, UserPublicKey publicKey, byte[] signature) {
        try {
            // 将SPKI转换为公钥对象
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(Base64.getDecoder().decode(publicKey.getSpki()));
            KeyFactory keyFactory = KeyFactory.getInstance(publicKey.getAlgorithm().getJavaAlgorithmName());
            java.security.PublicKey pubKey = keyFactory.generatePublic(keySpec);

            // 创建签名验证器，使用SHA256withRSA/PSS
            Signature sig = Signature.getInstance("RSASSA-PSS");

            // 配置PSS参数
            PSSParameterSpec pssSpec = new PSSParameterSpec(
                "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, 32, 1
            );
            sig.setParameter(pssSpec);

            // 初始化验证
            sig.initVerify(pubKey);

            // 计算消息内容的哈希（根据文档5.2.3节）
            String messageData = message.getSenderId() + ":" +
                               message.getConversationId() + ":" +
                               message.getKeyId() + ":" +
                               Base64.getEncoder().encodeToString(message.getCiphertext());

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] messageHash = digest.digest(messageData.getBytes(StandardCharsets.UTF_8));

            // 更新签名数据
            sig.update(messageHash);

            // 验证签名
            boolean isValid = sig.verify(signature);

            log.debug("RSA-PSS签名验证结果: {}, 消息ID: {}", isValid, message.getId());
            return isValid;

        } catch (NoSuchAlgorithmException | InvalidKeySpecException |
                 InvalidKeyException | InvalidAlgorithmParameterException |
                 SignatureException e) {
            log.error("RSA-PSS签名验证失败，消息ID: {}", message.getId(), e);
            return false;
        } catch (Exception e) {
            log.error("签名验证异常，消息ID: {}", message.getId(), e);
            return false;
        }
    }

    /**
     * 验证接收者
     */
    private void validateRecipient(Long recipientId) {
        if (recipientId == null || recipientId <= 0) {
            throw new BizException("无效的接收者ID");
        }
        // 如需进一步校验，可调用用户服务确认用户有效性
    }

    /**
     * 通知接收者密钥包
     */
    private void notifyRecipientKeyPackage(SessionKeyPackageDTO dto) {
        log.info("通知接收者 {} 有新的密钥包(sessionId={}, keyId={})", dto.getRecipientId(), dto.getSessionId(), dto.getKeyId());
        // 具体推送在WS模块通过 SessionKeyDistributedEvent 进行转发，当前服务仅记录审计与事件
        auditService.logKeyPackageDistribution(ContextUtil.getUserId(), dto.getRecipientId(), dto.getSessionId(), dto.getKeyId());
    }

    public void updateMessageReadStatus(Long messageId, Long userId) {
        markMessageAsRead(messageId, System.currentTimeMillis(), userId);
    }

    public void markMessageAsDestructed(Long messageId) {
        MessageEncrypted msg = messageEncryptedMapper.selectById(messageId);
        if (msg == null) {
            return;
        }
        messageEncryptedMapper.deleteById(messageId);
        applicationEventPublisher.publishEvent(
            new MessageDestructedEvent(msg, messageId, msg.getConversationId(),
                msg.getSenderId(), msg.getRecipientId(), msg.getRoomId())
        );
        auditService.logMessageDestruction(messageId, msg.getConversationId(), "MANUAL", java.time.LocalDateTime.now());
    }

    public int cleanupExpiredMessages(int batchSize) {
        return cleanupExpiredMessages();
    }

    public int cleanupExpiredSessions(int batchSize) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.util.List<SessionKeyPackage> expired = sessionKeyPackageMapper.selectExpiredKeys(now);
        if (expired == null || expired.isEmpty()) {
            return 0;
        }
        java.util.List<Long> ids = expired.stream()
            .map(SessionKeyPackage::getId)
            .toList();
        return sessionKeyPackageMapper.batchMarkAsExpired(ids);
    }

    /**
     * 更新消息缓存
     */
    private void updateMessageCache(MessageEncrypted message) {
        String cacheKey = MESSAGE_CACHE_PREFIX + message.getId();
        // 这里可以将消息的元数据缓存到Redis
        redisTemplate.opsForValue().set(cacheKey, message.getId().toString(),
            24, java.util.concurrent.TimeUnit.HOURS);

        // 缓存内容哈希
        if (message.getContentHash() != null) {
            String hashCacheKey = CONTENT_HASH_CACHE_PREFIX +
                Base64.getEncoder().encodeToString(message.getContentHash());
            redisTemplate.opsForValue().set(hashCacheKey, message.getId().toString(),
                24, java.util.concurrent.TimeUnit.HOURS);
        }
    }

    /**
     * 转换为响应对象
     */
    private EncryptedMessageResp convertToResp(MessageEncrypted message) {
        EncryptedMessageResp resp = new EncryptedMessageResp();
        BeanUtils.copyProperties(message, resp);

        // Base64编码二进制数据
        resp.setCiphertext(Base64.getEncoder().encodeToString(message.getCiphertext()));
        resp.setIv(Base64.getEncoder().encodeToString(message.getIv()));
        if (message.getTag() != null) {
            resp.setTag(Base64.getEncoder().encodeToString(message.getTag()));
        }
        if (message.getSignature() != null) {
            resp.setSignature(Base64.getEncoder().encodeToString(message.getSignature()));
        }

        return resp;
    }

    /**
     * 转换密钥包为DTO
     */
    private SessionKeyPackageDTO convertKeyPackageToDTO(SessionKeyPackage keyPackage) {
        SessionKeyPackageDTO dto = new SessionKeyPackageDTO();
        BeanUtils.copyProperties(keyPackage, dto);

        // Base64编码二进制数据
        dto.setWrappedKey(Base64.getEncoder().encodeToString(keyPackage.getWrappedKey()));
        if (keyPackage.getEphemeralPublicKey() != null) {
            dto.setEphemeralPublicKey(keyPackage.getEphemeralPublicKey());
        }

        return dto;
    }

    /**
     * 标记消息为已读
     * 接收方阅读消息时调用此方法，触发自毁倒计时重新计算
     *
     * @param messageId 消息ID
     * @param readAt 阅读时间戳（毫秒）
     * @param userId 阅读者ID
     */
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "e2ee:messages", allEntries = true)
    public void markMessageAsRead(Long messageId, Long readAt, Long userId) {
        log.info("标记消息为已读，消息ID: {}, 用户: {}, 阅读时间: {}", messageId, userId, readAt);

        // 1. 查询消息
        MessageEncrypted message = messageEncryptedMapper.selectById(messageId);
        if (message == null) {
            throw new BizException("消息不存在");
        }

        // 2. 验证权限：只有接收者可以标记消息为已读
        if (!userId.equals(message.getRecipientId())) {
            log.warn("用户 {} 尝试标记非接收消息为已读，消息ID: {}, 接收者: {}",
                userId, messageId, message.getRecipientId());
            throw new BizException("无权操作此消息");
        }

        // 3. 检查是否已标记
        if (message.getReadAt() != null) {
            log.debug("消息已标记为已读，消息ID: {}, 原阅读时间: {}", messageId, message.getReadAt());
            return; // 已读，不重复标记
        }

        // 4. 更新 readAt 字段
        LocalDateTime readAtTime = LocalDateTime.ofInstant(
            java.time.Instant.ofEpochMilli(readAt),
            java.time.ZoneId.systemDefault()
        );
        message.setReadAt(readAtTime);

        // 5. 重新计算 destructAt（如果启用了自毁功能）
        if (message.isSelfDestructEnabled()) {
            LocalDateTime destructAt = message.calculateDestructTime();
            message.setDestructAt(destructAt);
            log.info("消息自毁时间已更新，消息ID: {}, 销毁时间: {}", messageId, destructAt);
        }

        // 6. 保存到数据库
        try {
            message.setUpdateBy(userId);
        } catch (Exception e) {
            log.error("设置更新者失败", e);
        }
        int affectedRows = messageEncryptedMapper.updateById(message);
        if (affectedRows <= 0) {
            throw new BizException("标记消息已读失败");
        }

        // 7. 清除相关缓存
        String cacheKey = MESSAGE_CACHE_PREFIX + messageId;
        redisTemplate.delete(cacheKey);

        // 8. 发布消息已读事件（用于 WebSocket 通知发送方）
        applicationEventPublisher.publishEvent(
            new MessageReadEvent(messageId, userId, message.getConversationId(),
                readAtTime, null, message.getSenderId())
        );

        // 9. 记录审计日志
        auditService.logMessageRead(userId, messageId, message.getConversationId(), readAtTime);

        log.info("消息已标记为已读，消息ID: {}", messageId);
    }

    /**
     * 清理过期消息
     */
    @Transactional(rollbackFor = Exception.class)
    public int cleanupExpiredMessages() {
        LocalDateTime expireTime = LocalDateTime.now().minusDays(30); // 30天前
        List<MessageEncrypted> expiredMessages = messageEncryptedMapper.selectExpiredMessages(expireTime, 1000);

        if (expiredMessages.isEmpty()) {
            return 0;
        }

        // 批量标记为已删除 - 使用循环删除以避免deleteBatchIds废弃警告
        int affectedRows = 0;
        for (MessageEncrypted message : expiredMessages) {
            Long id = message.getId();
            if (id != null) {
                affectedRows += messageEncryptedMapper.deleteById(id);
            }
        }

        // 清除缓存
        expiredMessages.forEach(msg -> {
            String cacheKey = MESSAGE_CACHE_PREFIX + msg.getId();
            redisTemplate.delete(cacheKey);
        });

        log.info("清理过期加密消息 {} 个", affectedRows);
        return affectedRows;
    }

    /**
     * 清理到期的自毁消息
     * 由定时任务调用，删除所有 destructAt <= now 的消息
     *
     * @return 清理的消息数量
     */
    @Transactional(rollbackFor = Exception.class)
    public int cleanupSelfDestructMessages() {
        LocalDateTime now = LocalDateTime.now();

        // 查询所有到期的自毁消息
        List<MessageEncrypted> expiredMessages = messageEncryptedMapper.selectSelfDestructExpiredMessages(now, 1000);

        if (expiredMessages.isEmpty()) {
            return 0;
        }

        log.info("发现 {} 条到期自毁消息，开始清理", expiredMessages.size());

        // 批量删除 - 使用循环删除以避免deleteBatchIds废弃警告
        int affectedRows = 0;
        for (MessageEncrypted message : expiredMessages) {
            Long id = message.getId();
            if (id != null) {
                affectedRows += messageEncryptedMapper.deleteById(id);
            }
        }

        // 清除缓存并通知客户端
        expiredMessages.forEach(msg -> {
            // 清除缓存
            String cacheKey = MESSAGE_CACHE_PREFIX + msg.getId();
            redisTemplate.delete(cacheKey);

            // 发布消息销毁事件（用于 WebSocket 通知双方）
            applicationEventPublisher.publishEvent(
                new MessageDestructedEvent(msg, msg.getId(), msg.getConversationId(),
                    msg.getSenderId(), msg.getRecipientId(), msg.getRoomId())
            );

            // 记录审计日志
            Long messageId = msg.getId();
            auditService.logMessageDestruction(messageId, msg.getConversationId(),
                "SELF_DESTRUCT", now);
        });

        log.info("清理自毁消息完成，删除 {} 条", affectedRows);
        return affectedRows;
    }

    /**
     * 清理到期的自毁消息（支持批量通知优化）
     * 新增方法，返回清理的通知列表，支持批量发送
     *
     * @return 清理的消息数量
     */
    @Transactional(rollbackFor = Exception.class)
    public int cleanupSelfDestructMessagesWithNotifications() {
        LocalDateTime now = LocalDateTime.now();

        // 查询所有到期的自毁消息（增加批次大小以提高效率）
        List<MessageEncrypted> expiredMessages = messageEncryptedMapper.selectSelfDestructExpiredMessages(now, 5000);

        if (expiredMessages.isEmpty()) {
            return 0;
        }

        log.info("发现 {} 条到期自毁消息，开始批量清理", expiredMessages.size());

        // 批量删除 - 使用循环删除以避免deleteBatchIds废弃警告
        int affectedRows = 0;
        for (MessageEncrypted message : expiredMessages) {
            Long id = message.getId();
            if (id != null) {
                affectedRows += messageEncryptedMapper.deleteById(id);
            }
        }

        // 清除缓存
        expiredMessages.forEach(msg -> {
            String cacheKey = MESSAGE_CACHE_PREFIX + msg.getId();
            redisTemplate.delete(cacheKey);
        });

        // 批量发布事件（优化的通知发送）
        expiredMessages.forEach(msg -> {
            // 发布消息销毁事件
            applicationEventPublisher.publishEvent(
                new MessageDestructedEvent(msg, msg.getId(), msg.getConversationId(),
                    msg.getSenderId(), msg.getRecipientId(), msg.getRoomId())
            );

            // 记录审计日志（可优化为批量）
            Long messageId = msg.getId();
            auditService.logMessageDestruction(messageId, msg.getConversationId(),
                "SELF_DESTRUCT", now);
        });

        log.info("自毁消息批量清理完成，实际删除 {} 条消息", affectedRows);
        return affectedRows;
    }
}
