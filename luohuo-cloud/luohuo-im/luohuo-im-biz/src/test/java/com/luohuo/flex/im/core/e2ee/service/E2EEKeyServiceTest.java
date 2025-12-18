package com.luohuo.flex.im.core.e2ee.service;

import com.luohuo.basic.exception.BizException;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.core.e2ee.mapper.UserPublicKeyMapper;
import com.luohuo.flex.im.domain.dto.UploadPublicKeyDTO;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.domain.enums.KeyAlgorithm;
import com.luohuo.flex.im.domain.enums.KeyStatus;
import com.luohuo.flex.im.domain.vo.UserPublicKeyVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * E2EE公钥管理服务测试
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@ExtendWith(MockitoExtension.class)
class E2EEKeyServiceTest {

    @Mock
    private UserPublicKeyMapper publicKeyMapper;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    @Mock
    private E2EEAuditService auditService;

    @InjectMocks
    private E2EEKeyService e2eeKeyService;

    private final Long USER_ID = 12345L;
    private final Long TENANT_ID = 1L;
    private final String KEY_ID = "test_key_001";
    private final String SPKI = generateTestSPKI();
    private final String FINGERPRINT = calculateFingerprintHex(SPKI);

    @BeforeEach
    void setUp() {
        // 模拟Redis操作
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void testUploadPublicKey_Success() {
        // 准备测试数据
        try (MockedStatic<ContextUtil> contextUtil = mockStatic(ContextUtil.class)) {
            contextUtil.when(ContextUtil::getUserId).thenReturn(USER_ID);
            contextUtil.when(ContextUtil::getTenantId).thenReturn(TENANT_ID);

            UploadPublicKeyDTO dto = new UploadPublicKeyDTO();
            dto.setKeyId(KEY_ID);
            dto.setSpki(SPKI);
            dto.setAlgorithm(KeyAlgorithm.RSA_OAEP);
            dto.setFingerprint(FINGERPRINT);

            // 模拟数据库操作
            when(publicKeyMapper.selectByUserIdAndKeyId(USER_ID, KEY_ID)).thenReturn(null);
            when(publicKeyMapper.insert(any(UserPublicKey.class))).thenReturn(1);

            // 执行测试
            assertDoesNotThrow(() -> e2eeKeyService.uploadUserPublicKey(dto));

            // 验证
            verify(publicKeyMapper).insert(any(UserPublicKey.class));
            verify(valueOperations, atLeastOnce()).set(anyString(), anyString(), anyLong(), any());
            verify(applicationEventPublisher).publishEvent(any());
        }
    }

    @Test
    void testUploadPublicKey_DuplicateKeyId() {
        // 准备测试数据
        try (MockedStatic<ContextUtil> contextUtil = mockStatic(ContextUtil.class)) {
            contextUtil.when(ContextUtil::getUserId).thenReturn(USER_ID);
            contextUtil.when(ContextUtil::getTenantId).thenReturn(TENANT_ID);

            UploadPublicKeyDTO dto = new UploadPublicKeyDTO();
            dto.setKeyId(KEY_ID);
            dto.setSpki(SPKI);
            dto.setAlgorithm(KeyAlgorithm.RSA_OAEP);
            dto.setFingerprint(FINGERPRINT);

            // 模拟密钥ID已存在
            UserPublicKey existKey = new UserPublicKey();
            when(publicKeyMapper.selectByUserIdAndKeyId(USER_ID, KEY_ID)).thenReturn(existKey);

            // 执行测试并验证异常
            BizException exception = assertThrows(BizException.class,
                () -> e2eeKeyService.uploadUserPublicKey(dto));
            assertEquals("密钥ID已存在，请使用不同的ID", exception.getMessage());
        }
    }

    @Test
    void testUploadPublicKey_InvalidFingerprint() {
        // 准备测试数据
        try (MockedStatic<ContextUtil> contextUtil = mockStatic(ContextUtil.class)) {
            contextUtil.when(ContextUtil::getUserId).thenReturn(USER_ID);
            contextUtil.when(ContextUtil::getTenantId).thenReturn(TENANT_ID);

            UploadPublicKeyDTO dto = new UploadPublicKeyDTO();
            dto.setKeyId(KEY_ID);
            dto.setSpki(SPKI);
            dto.setAlgorithm(KeyAlgorithm.RSA_OAEP);
            dto.setFingerprint("invalid_fingerprint");

            // 执行测试并验证异常
            BizException exception = assertThrows(BizException.class,
                () -> e2eeKeyService.uploadUserPublicKey(dto));
            assertEquals("公钥指纹验证失败", exception.getMessage());
        }
    }

    @Test
    void testGetUserPublicKey_Success() {
        // 准备测试数据
        UserPublicKey key = createTestPublicKey();
        when(publicKeyMapper.selectByUserIdAndKeyId(USER_ID, KEY_ID)).thenReturn(key);
        when(valueOperations.get(anyString())).thenReturn(null);

        // 执行测试
        UserPublicKeyVO result = e2eeKeyService.getUserPublicKey(USER_ID, KEY_ID);

        // 验证
        assertNotNull(result);
        assertEquals(KEY_ID, result.getKeyId());
        assertEquals(SPKI, result.getSpki());
        assertEquals(KeyAlgorithm.RSA_OAEP, result.getAlgorithm());
        assertTrue(result.getValid());

        verify(publicKeyMapper).updateLastUsedAt(eq(key.getId()), any(LocalDateTime.class));
    }

    @Test
    void testGetUserPublicKey_NotFound() {
        // 准备测试数据
        when(publicKeyMapper.selectByUserIdAndKeyId(USER_ID, KEY_ID)).thenReturn(null);
        when(valueOperations.get(anyString())).thenReturn(null);

        // 执行测试并验证异常
        BizException exception = assertThrows(BizException.class,
            () -> e2eeKeyService.getUserPublicKey(USER_ID, KEY_ID));
        assertEquals("公钥不存在", exception.getMessage());
    }

    @Test
    void testGetUserPublicKey_Expired() {
        // 准备测试数据
        UserPublicKey key = createTestPublicKey();
        key.setExpiresAt(LocalDateTime.now().minusDays(1)); // 过期
        when(publicKeyMapper.selectByUserIdAndKeyId(USER_ID, KEY_ID)).thenReturn(key);
        when(valueOperations.get(anyString())).thenReturn(null);

        // 执行测试并验证异常
        BizException exception = assertThrows(BizException.class,
            () -> e2eeKeyService.getUserPublicKey(USER_ID, KEY_ID));
        assertEquals("公钥已失效", exception.getMessage());
    }

    @Test
    void testGetUserPublicKeys() {
        // 准备测试数据
        List<UserPublicKey> keys = List.of(createTestPublicKey(), createTestPublicKey());
        keys.get(1).setStatus(KeyStatus.DISABLED); // 第二个密钥已禁用

        when(publicKeyMapper.selectActiveKeysByUserId(USER_ID)).thenReturn(keys);

        // 执行测试
        List<UserPublicKeyVO> result = e2eeKeyService.getUserPublicKeys(USER_ID);

        // 验证
        assertEquals(2, result.size());
        assertTrue(result.get(0).getValid());
        assertFalse(result.get(1).getValid());
    }

    @Test
    void testCleanupExpiredKeys() {
        // 准备测试数据
        List<UserPublicKey> expiredKeys = List.of(createTestPublicKey(), createTestPublicKey());
        when(publicKeyMapper.selectExpiredKeys(any(LocalDateTime.class))).thenReturn(expiredKeys);
        when(publicKeyMapper.batchMarkAsExpired(any())).thenReturn(2);

        // 执行测试
        int result = e2eeKeyService.cleanupExpiredKeys();

        // 验证
        assertEquals(2, result);
        verify(publicKeyMapper).batchMarkAsExpired(any());
    }

    private UserPublicKey createTestPublicKey() {
        UserPublicKey key = new UserPublicKey();
        key.setId(1L);
        key.setUserId(USER_ID);
        key.setTenantId(TENANT_ID);
        key.setKeyId(KEY_ID);
        key.setSpki(SPKI);
        key.setAlgorithm(KeyAlgorithm.RSA_OAEP);
        key.setFingerprint(FINGERPRINT);
        key.setStatus(KeyStatus.ACTIVE);
        return key;
    }

    private String generateTestSPKI() {
        byte[] spkiBytes = new byte[128];
        new SecureRandom().nextBytes(spkiBytes);
        spkiBytes[0] = 0x30;
        return Base64.getEncoder().encodeToString(spkiBytes);
    }

    private String calculateFingerprintHex(String spki) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(Base64.getDecoder().decode(spki));
            StringBuilder result = new StringBuilder();
            for (byte b : hash) {
                result.append(String.format("%02x", b));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
