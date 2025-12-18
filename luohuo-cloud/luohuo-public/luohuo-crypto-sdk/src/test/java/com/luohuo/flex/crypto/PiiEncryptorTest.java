package com.luohuo.flex.crypto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * PiiEncryptor 单元测试
 *
 * 测试内容:
 * - 加密/解密功能正确性
 * - 边界条件处理
 * - 异常情况处理
 * - 性能基准测试
 *
 * @author HuLa Security Team
 * @since 2025-12-13
 */
@DisplayName("PII加密器测试")
class PiiEncryptorTest {

    private PiiEncryptor piiEncryptor;
    private static final String TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32字节测试密钥

    @BeforeEach
    void setUp() throws Exception {
        piiEncryptor = new PiiEncryptor();
        // 使用反射设置私有字段
        ReflectionTestUtils.setField(piiEncryptor, "base64Key", TEST_KEY);
        // 调用init方法
        piiEncryptor.init();
    }

    @Test
    @DisplayName("测试基本加密/解密功能")
    void testBasicEncryptDecrypt() throws Exception {
        // 准备测试数据
        String plaintext = "test@example.com";

        // 执行加密
        String encrypted = piiEncryptor.encrypt(plaintext);

        // 验证加密结果
        assertNotNull(encrypted, "加密结果不应为null");
        assertNotEquals(plaintext, encrypted, "加密后的数据不应等于原文");
        assertTrue(encrypted.length() > plaintext.length(), "密文长度应大于明文");

        // 执行解密
        String decrypted = piiEncryptor.decrypt(encrypted);

        // 验证解密结果
        assertEquals(plaintext, decrypted, "解密后应恢复原文");
    }

    @Test
    @DisplayName("测试手机号加密/解密")
    void testMobileEncryption() throws Exception {
        String mobile = "13800138000";
        String encrypted = piiEncryptor.encrypt(mobile);
        String decrypted = piiEncryptor.decrypt(encrypted);
        assertEquals(mobile, decrypted, "手机号解密后应恢复原文");
    }

    @Test
    @DisplayName("测试身份证号加密/解密")
    void testIdCardEncryption() throws Exception {
        String idCard = "110101199001011234";
        String encrypted = piiEncryptor.encrypt(idCard);
        String decrypted = piiEncryptor.decrypt(encrypted);
        assertEquals(idCard, decrypted, "身份证号解密后应恢复原文");
    }

    @Test
    @DisplayName("测试中文内容加密/解密")
    void testChineseEncryption() throws Exception {
        String chinese = "张三";
        String encrypted = piiEncryptor.encrypt(chinese);
        String decrypted = piiEncryptor.decrypt(encrypted);
        assertEquals(chinese, decrypted, "中文内容解密后应恢复原文");
    }

    @Test
    @DisplayName("测试空字符串处理")
    void testEmptyString() throws Exception {
        String empty = "";
        String encrypted = piiEncryptor.encrypt(empty);
        String decrypted = piiEncryptor.decrypt(encrypted);
        assertEquals(empty, decrypted, "空字符串应正确处理");
    }

    @Test
    @DisplayName("测试null值处理")
    void testNullValue() throws Exception {
        // PiiEncryptor设计为对null值返回null（不抛异常），这是合理的行为
        // 因为数据库中可能存在null值，加密器应该优雅处理
        String result = piiEncryptor.encrypt(null);
        assertNull(result, "加密null应返回null");
        
        String decryptResult = piiEncryptor.decrypt(null);
        assertNull(decryptResult, "解密null应返回null");
    }

    @Test
    @DisplayName("测试特殊字符加密")
    void testSpecialCharacters() throws Exception {
        String special = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
        String encrypted = piiEncryptor.encrypt(special);
        String decrypted = piiEncryptor.decrypt(encrypted);
        assertEquals(special, decrypted, "特殊字符解密后应恢复原文");
    }

    @Test
    @DisplayName("测试长字符串加密")
    void testLongString() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 1000; i++) {
            sb.append("测试数据");
        }
        String longText = sb.toString();

        String encrypted = piiEncryptor.encrypt(longText);
        String decrypted = piiEncryptor.decrypt(encrypted);  // 修复: 应该解密encrypted而不是longText

        assertNotNull(encrypted, "长字符串加密不应为null");
        assertTrue(encrypted.length() > 0, "长字符串加密应产生输出");
        assertEquals(longText, decrypted, "长字符串解密后应恢复原文");
    }

    @Test
    @DisplayName("测试加密结果随机性")
    void testEncryptionRandomness() throws Exception {
        String plaintext = "test@example.com";

        // 多次加密同一内容
        String encrypted1 = piiEncryptor.encrypt(plaintext);
        String encrypted2 = piiEncryptor.encrypt(plaintext);

        // 由于使用随机IV，每次加密结果应不同
        assertNotEquals(encrypted1, encrypted2,
            "相同明文多次加密应产生不同密文（使用随机IV）");

        // 但解密后应都能恢复原文
        assertEquals(plaintext, piiEncryptor.decrypt(encrypted1));
        assertEquals(plaintext, piiEncryptor.decrypt(encrypted2));
    }

    @Test
    @DisplayName("测试密文格式正确性")
    void testCiphertextFormat() throws Exception {
        String plaintext = "test@example.com";
        String encrypted = piiEncryptor.encrypt(plaintext);

        // 验证密文是有效的Base64
        assertDoesNotThrow(() -> Base64.getDecoder().decode(encrypted),
            "密文应该是有效的Base64编码");

        // 解码后应包含 IV (12字节) + 密文 + Tag (16字节)
        byte[] decoded = Base64.getDecoder().decode(encrypted);
        assertTrue(decoded.length >= 12 + 16,
            "密文长度应至少包含IV(12) + Tag(16)字节");
    }

    @Test
    @DisplayName("测试错误密钥解密")
    void testDecryptWithWrongKey() throws Exception {
        String plaintext = "test@example.com";
        String encrypted = piiEncryptor.encrypt(plaintext);

        // 创建新的加密器，使用不同密钥
        PiiEncryptor wrongEncryptor = new PiiEncryptor();
        String wrongKey = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBE=";
        ReflectionTestUtils.setField(wrongEncryptor, "base64Key", wrongKey);
        wrongEncryptor.init();

        // 尝试使用错误密钥解密
        assertThrows(Exception.class, () -> wrongEncryptor.decrypt(encrypted),
            "使用错误密钥解密应抛出异常");
    }

    @Test
    @DisplayName("测试篡改密文检测")
    void testTamperedCiphertext() throws Exception {
        String plaintext = "test@example.com";
        String encrypted = piiEncryptor.encrypt(plaintext);

        // 篡改密文（修改最后一个字符）
        String tampered = encrypted.substring(0, encrypted.length() - 1) + "X";

        // 尝试解密篡改的密文
        assertThrows(Exception.class, () -> piiEncryptor.decrypt(tampered),
            "解密篡改的密文应抛出异常（GCM认证失败）");
    }

    @Test
    @DisplayName("性能测试：加密1000次")
    void testEncryptionPerformance() throws Exception {
        String plaintext = "test@example.com";
        int iterations = 1000;

        long startTime = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            piiEncryptor.encrypt(plaintext);
        }
        long endTime = System.nanoTime();

        long durationMs = (endTime - startTime) / 1_000_000;
        double avgTimeMs = (double) durationMs / iterations;

        System.out.println("加密1000次总耗时: " + durationMs + "ms");
        System.out.println("平均加密时间: " + String.format("%.3f", avgTimeMs) + "ms");

        // 性能断言：平均加密时间应小于10ms
        assertTrue(avgTimeMs < 10,
            "平均加密时间应小于10ms，实际: " + avgTimeMs + "ms");
    }

    @Test
    @DisplayName("性能测试：解密1000次")
    void testDecryptionPerformance() throws Exception {
        String plaintext = "test@example.com";
        String encrypted = piiEncryptor.encrypt(plaintext);
        int iterations = 1000;

        long startTime = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            piiEncryptor.decrypt(encrypted);
        }
        long endTime = System.nanoTime();

        long durationMs = (endTime - startTime) / 1_000_000;
        double avgTimeMs = (double) durationMs / iterations;

        System.out.println("解密1000次总耗时: " + durationMs + "ms");
        System.out.println("平均解密时间: " + String.format("%.3f", avgTimeMs) + "ms");

        // 性能断言：平均解密时间应小于10ms
        assertTrue(avgTimeMs < 10,
            "平均解密时间应小于10ms，实际: " + avgTimeMs + "ms");
    }

    @Test
    @DisplayName("并发测试：多线程加密解密")
    void testConcurrentEncryptDecrypt() throws InterruptedException {
        String plaintext = "test@example.com";
        int threadCount = 10;
        int iterationsPerThread = 100;

        Thread[] threads = new Thread[threadCount];
        final boolean[] success = {true};

        for (int i = 0; i < threadCount; i++) {
            threads[i] = new Thread(() -> {
                try {
                    for (int j = 0; j < iterationsPerThread; j++) {
                        String encrypted = piiEncryptor.encrypt(plaintext);
                        String decrypted = piiEncryptor.decrypt(encrypted);
                        if (!plaintext.equals(decrypted)) {
                            success[0] = false;
                        }
                    }
                } catch (Exception e) {
                    success[0] = false;
                    e.printStackTrace();
                }
            });
            threads[i].start();
        }

        // 等待所有线程完成
        for (Thread thread : threads) {
            thread.join();
        }

        assertTrue(success[0], "并发加密/解密应全部成功");
    }
}
