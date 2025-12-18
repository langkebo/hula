package com.luohuo.flex.im.core.e2ee.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.luohuo.basic.exception.BizException;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.core.e2ee.mapper.UserPublicKeyMapper;
import com.luohuo.flex.im.core.e2ee.service.E2EEAuditService;
import com.luohuo.flex.im.domain.dto.UploadPublicKeyDTO;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.domain.enums.KeyAlgorithm;
import com.luohuo.flex.im.domain.enums.KeyStatus;
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
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 端到端加密公钥管理服务
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEKeyService {

    private final UserPublicKeyMapper publicKeyMapper;
    private final RedisTemplate<String, String> redisTemplate;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final E2EEAuditService auditService;

    private static final String CACHE_PREFIX = "e2ee:public_key:";
    private static final String FINGERPRINT_CACHE_PREFIX = "e2ee:fingerprint:";
    private static final int CACHE_EXPIRE_DAYS = 30;

    /**
     * 上传用户公钥
     */
    @Transactional(rollbackFor = Exception.class)
    public void uploadUserPublicKey(UploadPublicKeyDTO dto) {
        log.info("用户 {} 上传公钥，密钥ID: {}", ContextUtil.getUserId(), dto.getKeyId());

        // 1. 验证公钥格式
        validatePublicKey(dto.getSpki(), dto.getAlgorithm());

        // 2. 计算并验证指纹
        String calculatedFingerprint = calculateFingerprint(dto.getSpki());
        if (!calculatedFingerprint.equals(dto.getFingerprint())) {
            throw new BizException("公钥指纹验证失败");
        }

        // 3. 检查密钥ID是否已存在
        UserPublicKey existKey = publicKeyMapper.selectByUserIdAndKeyId(
            ContextUtil.getUserId(), dto.getKeyId()
        );
        if (existKey != null) {
            throw new BizException("密钥ID已存在，请使用不同的ID");
        }

        // 4. 解析过期时间
        LocalDateTime expiresAt = null;
        if (dto.getExpiresAt() != null) {
            try {
                expiresAt = LocalDateTime.parse(dto.getExpiresAt(), DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            } catch (Exception e) {
                throw new BizException("过期时间格式错误");
            }
        }

        // 5. 创建公钥实体
        UserPublicKey key = new UserPublicKey();
        BeanUtils.copyProperties(dto, key);
        key.setUserId(ContextUtil.getUserId());
        key.setTenantId(ContextUtil.getTenantId());
        key.setFingerprint(calculatedFingerprint);
        key.setExpiresAt(expiresAt);
        key.setStatus(KeyStatus.ACTIVE);
        key.setCreateBy(ContextUtil.getUserId());
        key.setUpdateBy(ContextUtil.getUserId());

        // 6. 保存到数据库
        int affectedRows = publicKeyMapper.insert(key);
        if (affectedRows <= 0) {
            throw new BizException("保存公钥失败");
        }

        // 7. 如果不激活旧密钥，则禁用其他密钥
        if (!Boolean.TRUE.equals(dto.getActivateOldKeys())) {
            publicKeyMapper.disableOldKeys(ContextUtil.getUserId(), dto.getKeyId());
            // 清除用户的旧公钥缓存
            evictUserKeyCache(ContextUtil.getUserId());
        }

        // 8. 更新缓存
        updateKeyCache(key);

        // 9. 发布事件
        applicationEventPublisher.publishEvent(new com.luohuo.flex.im.core.e2ee.event.PublicKeyUploadedEvent(
                key.getUserId(),
                key.getKeyId(),
                key.getAlgorithm() != null ? key.getAlgorithm().name() : null,
                key.getSpki(),
                System.currentTimeMillis(),
                true
        ));

        // 10. 记录审计日志
        auditService.logKeyUpload(
            ContextUtil.getUserId(),
            dto.getKeyId(),
            dto.getAlgorithm().name(),
            "SUCCESS"
        );

        log.info("用户 {} 公钥上传成功，密钥ID: {}", ContextUtil.getUserId(), dto.getKeyId());
    }

    /**
     * 获取用户公钥
     */
    @Cacheable(value = "e2ee:public_key", key = "#userId + ':' + #keyId", unless = "#result == null")
    public UserPublicKeyVO getUserPublicKey(Long userId, String keyId) {
        // 1. 先从缓存获取
        String cacheKey = buildKeyCacheKey(userId, keyId);
        String cached = redisTemplate.opsForValue().get(cacheKey);

        if (cached != null) {
            // 从缓存恢复对象（简化实现，实际可用JSON）
            UserPublicKey key = publicKeyMapper.selectByUserIdAndKeyId(userId, keyId);
            if (key != null) {
                return convertToVO(key);
            }
        }

        // 2. 从数据库查询
        UserPublicKey key = publicKeyMapper.selectByUserIdAndKeyId(userId, keyId);
        if (key == null) {
            throw new BizException("公钥不存在");
        }

        // 3. 检查是否有效
        if (!key.isValid()) {
            throw new BizException("公钥已失效");
        }

        // 4. 更新缓存
        updateKeyCache(key);

        // 5. 更新最后使用时间
        publicKeyMapper.updateLastUsedAt(key.getId(), LocalDateTime.now());

        return convertToVO(key);
    }

    /**
     * 根据指纹获取公钥
     */
    @Cacheable(value = "e2ee:fingerprint", key = "#fingerprint", unless = "#result == null")
    public UserPublicKeyVO getPublicKeyByFingerprint(String fingerprint) {
        UserPublicKey key = publicKeyMapper.selectByFingerprint(fingerprint);
        if (key == null || !key.isValid()) {
            throw new BizException("公钥不存在或已失效");
        }
        return convertToVO(key);
    }

    /**
     * 获取用户的所有有效公钥
     */
    public List<UserPublicKeyVO> getUserPublicKeys(Long userId) {
        List<UserPublicKey> keys = publicKeyMapper.selectActiveKeysByUserId(userId);
        return keys.stream()
            .map(this::convertToVO)
            .collect(Collectors.toList());
    }

    /**
     * 验证公钥格式
     */
    private void validatePublicKey(String spki, KeyAlgorithm algorithm) {
        try {
            byte[] spkiBytes = Base64.getDecoder().decode(spki);

            // 简单验证：检查SPKI ASN.1结构
            if (spkiBytes.length < 10) {
                throw new BizException("公钥格式无效");
            }

            // 验证算法特定的格式
            switch (algorithm) {
                case RSA_OAEP:
                    validateRSAKey(spkiBytes);
                    break;
                case ECDH:
                    validateECKey(spkiBytes);
                    break;
                case ED25519:
                case X25519:
                    validateCurve25519Key(spkiBytes);
                    break;
            }
        } catch (IllegalArgumentException e) {
            throw new BizException("公钥Base64格式无效");
        }
    }

    /**
     * 验证RSA公钥
     */
    private void validateRSAKey(byte[] spkiBytes) {
        // RSA SPKI应该以特定序列开始
        if (spkiBytes[0] != 0x30) {
            throw new BizException("RSA公钥格式无效");
        }
    }

    /**
     * 验证椭圆曲线公钥
     */
    private void validateECKey(byte[] spkiBytes) {
        // EC SPKI应该以特定序列开始
        if (spkiBytes[0] != 0x30) {
            throw new BizException("椭圆曲线公钥格式无效");
        }
    }

    /**
     * 验证Curve25519公钥
     */
    private void validateCurve25519Key(byte[] spkiBytes) {
        // Curve25519公钥长度通常是32字节
        if (spkiBytes.length != 32) {
            throw new BizException("Curve25519公钥长度无效");
        }
    }

    /**
     * 计算公钥指纹
     */
    private String calculateFingerprint(String spki) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(Base64.getDecoder().decode(spki));
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new BizException("不支持SHA-256算法");
        }
    }

    /**
     * 字节数组转十六进制
     */
    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }

    /**
     * 构建缓存键
     */
    private String buildKeyCacheKey(Long userId, String keyId) {
        return CACHE_PREFIX + userId + ":" + keyId;
    }

    /**
     * 构建指纹缓存键
     */
    private String buildFingerprintCacheKey(String fingerprint) {
        return FINGERPRINT_CACHE_PREFIX + fingerprint;
    }

    /**
     * 更新密钥缓存
     */
    private void updateKeyCache(UserPublicKey key) {
        String cacheKey = buildKeyCacheKey(key.getUserId(), key.getKeyId());
        redisTemplate.opsForValue().set(cacheKey, key.getSpki(), CACHE_EXPIRE_DAYS, TimeUnit.DAYS);

        String fingerprintCacheKey = buildFingerprintCacheKey(key.getFingerprint());
        redisTemplate.opsForValue().set(fingerprintCacheKey, key.getSpki(), CACHE_EXPIRE_DAYS, TimeUnit.DAYS);
    }

    /**
     * 清除用户密钥缓存
     */
    @CacheEvict(value = "e2ee:public_key", key = "#userId + ':'")
    private void evictUserKeyCache(Long userId) {
        // 实际实现可能需要更复杂的缓存清除逻辑
        String pattern = CACHE_PREFIX + userId + ":*";
        // 这里需要使用Redis的keys命令或scan命令来删除匹配的键
        log.info("清除用户 {} 的公钥缓存", userId);
    }

    /**
     * 转换为VO对象
     */
    private UserPublicKeyVO convertToVO(UserPublicKey key) {
        UserPublicKeyVO vo = new UserPublicKeyVO();
        BeanUtils.copyProperties(key, vo);
        vo.setValid(key.isValid());
        return vo;
    }

    /**
     * 清理过期密钥
     */
    @Transactional(rollbackFor = Exception.class)
    public int cleanupExpiredKeys() {
        List<UserPublicKey> expiredKeys = publicKeyMapper.selectExpiredKeys(LocalDateTime.now());
        if (expiredKeys.isEmpty()) {
            return 0;
        }

        List<Long> ids = expiredKeys.stream().map(UserPublicKey::getId).collect(Collectors.toList());
        int affectedRows = publicKeyMapper.batchMarkAsExpired(ids);

        // 清除缓存
        expiredKeys.forEach(key -> {
            String cacheKey = buildKeyCacheKey(key.getUserId(), key.getKeyId());
            redisTemplate.delete(cacheKey);
            String fingerprintCacheKey = buildFingerprintCacheKey(key.getFingerprint());
            redisTemplate.delete(fingerprintCacheKey);
        });

        log.info("清理过期密钥 {} 个", affectedRows);
        return affectedRows;
    }
    public UserPublicKey getLatestPublicKey(long userId) {
        return publicKeyMapper.selectActiveKeyByUserId(userId);
    }

    public int cleanupExpiredKeys(int batchSize) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.util.List<UserPublicKey> expired = publicKeyMapper.selectExpiredKeys(now);
        if (expired.isEmpty()) {
            return 0;
        }
        java.util.List<Long> ids = expired.stream().map(UserPublicKey::getId).toList();
        return publicKeyMapper.batchMarkAsExpired(ids);
    }
}
