package com.luohuo.flex.im.core.e2ee.service;

import com.luohuo.flex.im.core.e2ee.mapper.SessionKeyPackageMapper;
import com.luohuo.flex.im.core.e2ee.mapper.UserPublicKeyMapper;
import com.luohuo.flex.im.core.e2ee.constants.E2EEErrorCodes;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.domain.entity.SessionKeyPackage;
import com.luohuo.flex.im.domain.entity.UserPrivateKey;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.domain.enums.KeyPackageStatus;
import com.luohuo.flex.im.domain.enums.EncryptionAlgorithm;
import com.luohuo.flex.im.core.user.dao.UserPrivateKeyDao;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.PSSParameterSpec;
import java.time.LocalDateTime;
import java.util.Base64;

/**
 * E2EE解密服务
 * 提供端到端加密消息的解密功能
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEDecryptionService {

    private final SessionKeyPackageMapper sessionKeyPackageMapper;
    private final UserPrivateKeyDao userPrivateKeyDao;
    private final UserPublicKeyMapper userPublicKeyMapper;
    private final ReplayAttackDetectionService replayAttackDetectionService;

    /**
     * 解密加密消息
     *
     * @param message 加密消息实体
     * @return 解密后的消息内容
     * @throws DecryptionException 解密失败时抛出
     */
    public DecryptionResult decryptMessage(MessageEncrypted message) throws DecryptionException {
        long startTime = System.currentTimeMillis();

        try {
            // 0. 检测重放攻击
            if (replayAttackDetectionService.isReplayAttack(message)) {
                throw new DecryptionException(
                    E2EEErrorCodes.getErrorMessage(E2EEErrorCodes.REPLAY_ATTACK_DETECTED),
                    E2EEErrorCodes.REPLAY_ATTACK_DETECTED
                );
            }

            // 1. 获取会话密钥包
            SessionKeyPackage keyPackage = getSessionKeyPackage(message);
            if (keyPackage == null) {
                throw new DecryptionException(
                    E2EEErrorCodes.getErrorMessage(E2EEErrorCodes.KEY_NOT_FOUND),
                    E2EEErrorCodes.KEY_NOT_FOUND
                );
            }

            // 2. 解包会话密钥
            SecretKey sessionKey = unwrapSessionKey(keyPackage, message.getRecipientId());
            if (sessionKey == null) {
                throw new DecryptionException(
                    E2EEErrorCodes.getErrorMessage(E2EEErrorCodes.KEY_UNWRAP_FAILED),
                    E2EEErrorCodes.KEY_UNWRAP_FAILED
                );
            }

            // 3. 解密消息
            String decryptedContent = decryptContent(message, sessionKey);

            // 4. 验证消息完整性
            boolean integrityValid = verifyMessageIntegrity(message);
            if (!integrityValid) {
                throw new DecryptionException(
                    E2EEErrorCodes.getErrorMessage(E2EEErrorCodes.INTEGRITY_CHECK_FAILED),
                    E2EEErrorCodes.INTEGRITY_CHECK_FAILED
                );
            }

            // 5. 标记密钥包为已使用
            markKeyPackageAsUsed(keyPackage);

            // 6. 记录解密耗时
            long decryptionTime = System.currentTimeMillis() - startTime;
            message.setDecryptionTime(decryptionTime);

            log.debug("消息解密成功，消息ID: {}, 耗时: {}ms", message.getId(), decryptionTime);

            return new DecryptionResult(
                decryptedContent,
                decryptionTime,
                keyPackage.getAlgorithm(),
                message.getContentType()
            );

        } catch (DecryptionException e) {
            throw e;
        } catch (Exception e) {
            log.error("解密消息失败，消息ID: {}", message.getId(), e);
            throw new DecryptionException("解密过程中发生异常: " + e.getMessage(), "DECRYPTION_ERROR", e);
        }
    }

    /**
     * 批量解密消息
     *
     * @param messages 加密消息列表
     * @return 解密结果列表
     */
    public BatchDecryptionResult decryptMessagesBatch(java.util.List<MessageEncrypted> messages) {
        BatchDecryptionResult result = new BatchDecryptionResult();
        int successCount = 0;
        int failureCount = 0;

        for (MessageEncrypted message : messages) {
            try {
                DecryptionResult decryptionResult = decryptMessage(message);
                Object idObj = message.getId();
                Long messageId = idObj instanceof Long ? (Long) idObj : Long.parseLong(idObj.toString());
                result.addSuccess(messageId, decryptionResult);
                successCount++;
            } catch (DecryptionException e) {
                Object idObj = message.getId();
                Long messageId = idObj instanceof Long ? (Long) idObj : Long.parseLong(idObj.toString());
                result.addFailure(messageId, e);
                failureCount++;
                log.warn("批量解密中单个消息失败，消息ID: {}, 错误: {}", message.getId(), e.getMessage());
            }
        }

        log.info("批量解密完成，总数: {}, 成功: {}, 失败: {}",
            messages.size(), successCount, failureCount);

        return result;
    }

    /**
     * 验证消息签名
     *
     * @param message 加密消息
     * @return 验证结果
     */
    public SignatureVerificationResult verifySignature(MessageEncrypted message) {
        try {
            if (message.getSignature() == null || message.getSignature().length == 0) {
                return new SignatureVerificationResult(false, "消息未签名", "NOT_SIGNED");
            }

            // 1. 获取发送者私钥（实际上应该是公钥，这里应该是验证签名）
            // 注意：验证签名使用发送者的公钥
            String senderId = String.valueOf(message.getSenderId());

            // 2. 重新计算消息哈希
            byte[] calculatedHash = calculateMessageHash(message);

            // 3. 验证签名
            boolean isValid = verifySignatureInternal(
                calculatedHash,
                message.getSignature(),
                message.getSenderId()
            );

            String status = isValid ? "VERIFIED" : "VERIFICATION_FAILED";
            String detail = isValid ? "签名验证成功" : "签名验证失败";

            return new SignatureVerificationResult(isValid, status, detail);

        } catch (Exception e) {
            log.error("验证消息签名失败，消息ID: {}", message.getId(), e);
            return new SignatureVerificationResult(false, "ERROR", "验证过程中发生异常: " + e.getMessage());
        }
    }

    /**
     * 获取会话密钥包
     */
    private SessionKeyPackage getSessionKeyPackage(MessageEncrypted message) {
        // 根据密钥ID和接收者ID查找密钥包
        return sessionKeyPackageMapper.selectByKeyAndRecipient(
            message.getKeyId(),
            message.getRecipientId()
        );
    }

    /**
     * 解包会话密钥
     */
    private SecretKey unwrapSessionKey(SessionKeyPackage keyPackage, Long recipientId) {
        try {
            // 1. 获取接收者的私钥
            UserPrivateKey privateKey = userPrivateKeyDao.selectByUserId(recipientId);
            if (privateKey == null) {
                log.error("未找到接收者的私钥，接收者ID: {}", recipientId);
                return null;
            }

            // 2. 解析私钥
            PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(
                Base64.getDecoder().decode(privateKey.getPrivateKey())
            );
            // 使用私钥中存储的算法类型，默认为RSA
            String algorithm = privateKey.getAlgorithm() != null ? privateKey.getAlgorithm() : "RSA";
            KeyFactory keyFactory = KeyFactory.getInstance(algorithm);
            PrivateKey rsaPrivateKey = keyFactory.generatePrivate(keySpec);

            // 3. 解包会话密钥
            Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            cipher.init(Cipher.UNWRAP_MODE, rsaPrivateKey);

            return (SecretKey) cipher.unwrap(keyPackage.getWrappedKey(), "AES", Cipher.SECRET_KEY);

        } catch (NoSuchAlgorithmException | NoSuchPaddingException
                | InvalidKeySpecException | InvalidKeyException e) {
            log.error("解包会话密钥失败", e);
            return null;
        }
    }

    /**
     * 解密消息内容
     */
    private String decryptContent(MessageEncrypted message, SecretKey sessionKey) throws DecryptionException {
        try {
            // 根据算法选择解密方式
            switch (message.getAlgorithm()) {
                case AES_GCM:
                    return decryptAESGCM(message, sessionKey);
                default:
                    throw new DecryptionException(
                        E2EEErrorCodes.getErrorMessage(E2EEErrorCodes.UNSUPPORTED_ALGORITHM) + ": " + message.getAlgorithm(),
                        E2EEErrorCodes.UNSUPPORTED_ALGORITHM
                    );
            }
        } catch (DecryptionException e) {
            throw e;
        } catch (Exception e) {
            log.error("解密消息内容失败", e);
            throw new DecryptionException(
                E2EEErrorCodes.getErrorMessage(E2EEErrorCodes.CONTENT_DECRYPTION_FAILED) + ": " + e.getMessage(),
                E2EEErrorCodes.CONTENT_DECRYPTION_FAILED,
                e
            );
        }
    }

    /**
     * 使用AES-GCM解密
     */
    private String decryptAESGCM(MessageEncrypted message, SecretKey sessionKey) throws Exception {
        // 创建密钥规范
        SecretKeySpec keySpec = new SecretKeySpec(sessionKey.getEncoded(), "AES");

        // 创建GCM参数规范
        GCMParameterSpec gcmSpec = new GCMParameterSpec(
            128, // 认证标签长度
            message.getIv() // IV
        );

        // 创建解密器
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);

        // 解密
        byte[] decryptedBytes = cipher.doFinal(message.getCiphertext());

        return new String(decryptedBytes, StandardCharsets.UTF_8);
    }

    /**
     * 验证消息完整性
     */
    private boolean verifyMessageIntegrity(MessageEncrypted message) {
        try {
            // 1. 验证内容哈希
            if (message.getContentHash() != null) {
                byte[] currentHash = calculateMessageHash(message);
                return java.util.Arrays.equals(currentHash, message.getContentHash());
            }

            // 2. 如果没有内容哈希，检查GCM标签
            if (message.getAlgorithm() == EncryptionAlgorithm.AES_GCM && message.getTag() != null) {
                // GCM模式已经在解密时验证了标签
                return true;
            }

            return true; // 如果没有完整性检查信息，默认通过

        } catch (Exception e) {
            log.error("验证消息完整性失败", e);
            return false;
        }
    }

    /**
     * 计算消息哈希
     * 使用SHA-256算法计算包含密文和元数据的哈希值
     *
     * @param message 加密消息
     * @return SHA-256哈希值
     */
    private byte[] calculateMessageHash(MessageEncrypted message) {
        try {
            // 获取需要哈希的字段（已包含密文、IV等）
            byte[] hashInput = buildHashInput(message);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(hashInput);
        } catch (Exception e) {
            log.error("计算消息哈希失败", e);
            return null;
        }
    }

    /**
     * 构建哈希输入
     * 包含密文、IV、元数据等关键字段以确保完整性
     * 防止密文篡改和重放攻击
     *
     * @param message 加密消息
     * @return 哈希输入字节数组
     */
    private byte[] buildHashInput(MessageEncrypted message) {
        try {
            // 计算总长度以优化内存分配
            int totalLength = 0;
            totalLength += message.getCiphertext().length;
            totalLength += message.getIv().length;
            totalLength += message.getConversationId().getBytes(StandardCharsets.UTF_8).length;
            totalLength += Long.BYTES; // senderId
            totalLength += message.getRecipientId() != null ? Long.BYTES : 0;
            totalLength += message.getContentType().getBytes(StandardCharsets.UTF_8).length;
            totalLength += message.getKeyId().getBytes(StandardCharsets.UTF_8).length;

            // 使用字节缓冲区避免多次数组拷贝
            java.nio.ByteBuffer buffer = java.nio.ByteBuffer.allocate(totalLength);

            // 1. 密文（最重要，防止密文被篡改）
            buffer.put(message.getCiphertext());

            // 2. IV（防止IV被替换）
            buffer.put(message.getIv());

            // 3. 会话ID（防止消息被移动到其他会话）
            buffer.put(message.getConversationId().getBytes(StandardCharsets.UTF_8));

            // 4. 发送者ID（防止伪造发送者）
            buffer.putLong(message.getSenderId());

            // 5. 接收者ID（防止消息被重定向到其他接收者）
            if (message.getRecipientId() != null) {
                buffer.putLong(message.getRecipientId());
            }

            // 6. 内容类型（防止类型被修改）
            buffer.put(message.getContentType().getBytes(StandardCharsets.UTF_8));

            // 7. 密钥ID（确保使用正确的密钥）
            buffer.put(message.getKeyId().getBytes(StandardCharsets.UTF_8));

            return buffer.array();

        } catch (Exception e) {
            log.error("构建哈希输入失败", e);
            // 降级为简单模式
            String fallback = String.format("%s|%s|%s|%s",
                message.getConversationId(),
                message.getSenderId(),
                message.getRecipientId() != null ? message.getRecipientId() : "",
                message.getContentType()
            );
            return fallback.getBytes(StandardCharsets.UTF_8);
        }
    }

    /**
     * 内部签名验证方法
     * 使用RSA-PSS算法验证消息签名
     *
     * @param contentHash 消息内容哈希
     * @param signature   消息签名
     * @param senderId    发送者ID
     * @return 验证是否成功
     */
    private boolean verifySignatureInternal(byte[] contentHash, byte[] signature, Long senderId) {
        try {
            // 1. 获取发送者的活跃公钥
            UserPublicKey publicKey = userPublicKeyMapper.selectActiveKeyByUserId(senderId);
            if (publicKey == null) {
                log.warn("未找到发送者的活跃公钥，发送者ID: {}", senderId);
                return false;
            }

            // 2. 解析公钥（X.509格式）
            byte[] publicKeyBytes = Base64.getDecoder().decode(publicKey.getSpki());
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(publicKeyBytes);
            KeyFactory keyFactory = KeyFactory.getInstance(publicKey.getAlgorithm().getJavaAlgorithmName());
            PublicKey rsaPublicKey = keyFactory.generatePublic(keySpec);

            // 3. 创建签名验证器（RSA-PSS）
            // PSS参数：SHA-256用于哈希，MGF1用于掩码生成，盐长度32字节
            PSSParameterSpec pssSpec = new PSSParameterSpec(
                "SHA-256",                    // 哈希算法
                "MGF1",                       // 掩码生成函数
                MGF1ParameterSpec.SHA256,     // MGF1参数
                32,                           // 盐长度
                1                             // trailer字段
            );

            Signature sig = Signature.getInstance("RSASSA-PSS");
            sig.setParameter(pssSpec);
            sig.initVerify(rsaPublicKey);

            // 4. 验证签名
            sig.update(contentHash);
            boolean isValid = sig.verify(signature);

            if (isValid) {
                log.debug("签名验证成功，发送者ID: {}, 公钥ID: {}", senderId, publicKey.getKeyId());
            } else {
                log.warn("签名验证失败，发送者ID: {}, 公钥ID: {}", senderId, publicKey.getKeyId());
            }

            return isValid;

        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            log.error("签名验证失败：密钥格式错误或算法不支持，发送者ID: {}", senderId, e);
            return false;
        } catch (InvalidKeyException | InvalidAlgorithmParameterException e) {
            log.error("签名验证失败：密钥无效或参数错误，发送者ID: {}", senderId, e);
            return false;
        } catch (SignatureException e) {
            log.error("签名验证失败：签名格式错误，发送者ID: {}", senderId, e);
            return false;
        } catch (Exception e) {
            log.error("签名验证过程中发生未知异常，发送者ID: {}", senderId, e);
            return false;
        }
    }

    /**
     * 标记密钥包为已使用
     */
    private void markKeyPackageAsUsed(SessionKeyPackage keyPackage) {
        try {
            keyPackage.markAsUsed();
            sessionKeyPackageMapper.updateById(keyPackage);
        } catch (Exception e) {
            log.error("标记密钥包为已使用失败", e);
        }
    }

    /**
     * 解密结果
     */
    public static class DecryptionResult {
        private final String content;
        private final long decryptionTimeMs;
        private final EncryptionAlgorithm algorithm;
        private final String contentType;

        public DecryptionResult(String content, long decryptionTimeMs,
                               EncryptionAlgorithm algorithm, String contentType) {
            this.content = content;
            this.decryptionTimeMs = decryptionTimeMs;
            this.algorithm = algorithm;
            this.contentType = contentType;
        }

        // Getters
        public String getContent() { return content; }
        public long getDecryptionTimeMs() { return decryptionTimeMs; }
        public EncryptionAlgorithm getAlgorithm() { return algorithm; }
        public String getContentType() { return contentType; }
    }

    /**
     * 批量解密结果
     */
    public static class BatchDecryptionResult {
        private final java.util.Map<Long, DecryptionResult> successes = new java.util.HashMap<>();
        private final java.util.Map<Long, DecryptionException> failures = new java.util.HashMap<>();

        public void addSuccess(Long messageId, DecryptionResult result) {
            successes.put(messageId, result);
        }

        public void addFailure(Long messageId, DecryptionException exception) {
            failures.put(messageId, exception);
        }

        // Getters
        public java.util.Map<Long, DecryptionResult> getSuccesses() { return successes; }
        public java.util.Map<Long, DecryptionException> getFailures() { return failures; }
        public int getSuccessCount() { return successes.size(); }
        public int getFailureCount() { return failures.size(); }
    }

    /**
     * 签名验证结果
     */
    public static class SignatureVerificationResult {
        private final boolean valid;
        private final String status;
        private final String detail;

        public SignatureVerificationResult(boolean valid, String status, String detail) {
            this.valid = valid;
            this.status = status;
            this.detail = detail;
        }

        // Getters
        public boolean isValid() { return valid; }
        public String getStatus() { return status; }
        public String getDetail() { return detail; }
    }

    /**
     * 解密异常
     */
    public static class DecryptionException extends Exception {
        private final String errorCode;
        private final Exception cause;

        public DecryptionException(String message, String errorCode) {
            super(message);
            this.errorCode = errorCode;
            this.cause = null;
        }

        public DecryptionException(String message, String errorCode, Exception cause) {
            super(message, cause);
            this.errorCode = errorCode;
            this.cause = cause;
        }

        public String getErrorCode() { return errorCode; }
        public Exception getCause() { return cause; }
    }
}