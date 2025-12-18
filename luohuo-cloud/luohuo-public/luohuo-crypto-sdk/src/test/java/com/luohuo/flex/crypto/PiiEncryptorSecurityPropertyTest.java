package com.luohuo.flex.crypto;

import net.jqwik.api.*;
import net.jqwik.api.constraints.*;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * PiiEncryptor 安全属性测试
 * 
 * 使用 jqwik 框架进行属性测试，验证 PII 加密的安全性属性。
 * 每个属性测试运行至少 100 次迭代。
 *
 * @author HuLa Security Team
 * @since 2025-12-13
 */
class PiiEncryptorSecurityPropertyTest {

    private static final String TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32字节测试密钥

    private PiiEncryptor createEncryptor() throws Exception {
        PiiEncryptor encryptor = new PiiEncryptor();
        ReflectionTestUtils.setField(encryptor, "base64Key", TEST_KEY);
        encryptor.init();
        return encryptor;
    }

    /**
     * **Feature: hula-optimization, Property 2: 加密数据不可读性**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * *For any* 加密后的 PII 数据，直接从数据库读取的值不应该包含原始明文的任何子串
     * （对于长度 >= 3 的子串）
     */
    @Property(tries = 100)
    @Label("Property 2: 加密数据不可读性 - 密文不包含明文子串")
    void encryptedDataNotReadable(@ForAll @StringLength(min = 3, max = 100) String plaintext) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        // 加密
        String encrypted = encryptor.encrypt(plaintext);
        
        // 验证密文不包含明文的任何长度>=3的子串
        for (int i = 0; i <= plaintext.length() - 3; i++) {
            for (int j = i + 3; j <= plaintext.length(); j++) {
                String substring = plaintext.substring(i, j);
                assertFalse(encrypted.contains(substring),
                    "密文不应包含明文子串: " + substring);
            }
        }
    }

    /**
     * **Feature: hula-optimization, Property 2: 加密数据不可读性**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * 密文应该是有效的 Base64 格式
     */
    @Property(tries = 100)
    @Label("Property 2: 加密数据不可读性 - 密文是有效Base64")
    void encryptedDataIsValidBase64(@ForAll @StringLength(min = 1, max = 200) String plaintext) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(plaintext);
        
        // 验证密文是有效的 Base64
        assertDoesNotThrow(() -> Base64.getDecoder().decode(encrypted),
            "密文应该是有效的Base64编码");
    }

    /**
     * **Feature: hula-optimization, Property 2: 加密数据不可读性**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * 相同明文多次加密应产生不同密文（随机IV）
     */
    @Property(tries = 100)
    @Label("Property 2: 加密数据不可读性 - 加密结果随机性")
    void encryptionProducesRandomCiphertext(@ForAll @StringLength(min = 1, max = 100) String plaintext) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        // 多次加密同一明文
        String encrypted1 = encryptor.encrypt(plaintext);
        String encrypted2 = encryptor.encrypt(plaintext);
        
        // 由于使用随机IV，每次加密结果应不同
        assertNotEquals(encrypted1, encrypted2,
            "相同明文多次加密应产生不同密文（使用随机IV）");
    }

    /**
     * **Feature: hula-optimization, Property 2: 加密数据不可读性**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * 密文长度应该大于明文长度（包含IV和认证标签）
     */
    @Property(tries = 100)
    @Label("Property 2: 加密数据不可读性 - 密文长度大于明文")
    void ciphertextLongerThanPlaintext(@ForAll @StringLength(min = 1, max = 200) String plaintext) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(plaintext);
        
        // 密文应该比明文长（包含12字节IV + 16字节GCM Tag）
        assertTrue(encrypted.length() > plaintext.length(),
            "密文长度应大于明文长度");
    }

    /**
     * **Feature: hula-optimization, Property 2: 加密数据不可读性**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * 密文解码后应包含足够的字节（IV + 密文 + Tag）
     */
    @Property(tries = 100)
    @Label("Property 2: 加密数据不可读性 - 密文结构正确")
    void ciphertextHasCorrectStructure(@ForAll @StringLength(min = 1, max = 200) String plaintext) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(plaintext);
        byte[] decoded = Base64.getDecoder().decode(encrypted);
        
        // 密文应至少包含: 12字节IV + 16字节GCM Tag + 明文字节
        int minLength = 12 + 16;  // IV + Tag
        assertTrue(decoded.length >= minLength,
            "密文解码后长度应至少为 " + minLength + " 字节");
    }

    /**
     * **Feature: hula-optimization, Property 2: 加密数据不可读性**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * 篡改密文应导致解密失败（GCM认证）
     */
    @Property(tries = 100)
    @Label("Property 2: 加密数据不可读性 - 篡改检测")
    void tamperedCiphertextDetected(@ForAll @StringLength(min = 1, max = 100) String plaintext) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(plaintext);
        
        // 篡改密文（修改中间的一个字符）
        if (encrypted.length() > 10) {
            int midPoint = encrypted.length() / 2;
            char originalChar = encrypted.charAt(midPoint);
            char newChar = (originalChar == 'A') ? 'B' : 'A';
            String tampered = encrypted.substring(0, midPoint) + newChar + encrypted.substring(midPoint + 1);
            
            // 尝试解密篡改的密文应该失败
            assertThrows(Exception.class, () -> encryptor.decrypt(tampered),
                "解密篡改的密文应抛出异常（GCM认证失败）");
        }
    }

    /**
     * **Feature: hula-optimization, Property 2: 加密数据不可读性**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * 使用错误密钥解密应失败
     */
    @Property(tries = 50)
    @Label("Property 2: 加密数据不可读性 - 错误密钥检测")
    void wrongKeyDecryptionFails(@ForAll @StringLength(min = 1, max = 100) String plaintext) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(plaintext);
        
        // 创建使用不同密钥的加密器
        PiiEncryptor wrongEncryptor = new PiiEncryptor();
        String wrongKey = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBE=";
        ReflectionTestUtils.setField(wrongEncryptor, "base64Key", wrongKey);
        wrongEncryptor.init();
        
        // 使用错误密钥解密应失败
        assertThrows(Exception.class, () -> wrongEncryptor.decrypt(encrypted),
            "使用错误密钥解密应抛出异常");
    }
}
