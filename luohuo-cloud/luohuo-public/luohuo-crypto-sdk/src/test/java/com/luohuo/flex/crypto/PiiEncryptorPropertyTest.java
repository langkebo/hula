package com.luohuo.flex.crypto;

import net.jqwik.api.*;
import net.jqwik.api.constraints.*;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * PiiEncryptor 属性测试
 * 
 * 使用 jqwik 框架进行属性测试，验证 PII 加密的正确性属性。
 * 每个属性测试运行至少 100 次迭代。
 *
 * @author HuLa Security Team
 * @since 2025-12-13
 */
class PiiEncryptorPropertyTest {

    private static final String TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32字节测试密钥

    private PiiEncryptor createEncryptor() throws Exception {
        PiiEncryptor encryptor = new PiiEncryptor();
        ReflectionTestUtils.setField(encryptor, "base64Key", TEST_KEY);
        encryptor.init();
        return encryptor;
    }

    /**
     * **Feature: hula-optimization, Property 1: PII 加密往返一致性**
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
     * 
     * *For any* 有效的 PII 字符串（email、mobile、id_card），加密后解密应该得到原始值
     */
    @Property(tries = 100)
    @Label("Property 1: PII 加密往返一致性 - 任意字符串")
    void piiEncryptionRoundTrip(@ForAll @StringLength(min = 1, max = 500) String plaintext) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        // 加密
        String encrypted = encryptor.encrypt(plaintext);
        
        // 解密
        String decrypted = encryptor.decrypt(encrypted);
        
        // 验证往返一致性
        assertEquals(plaintext, decrypted, 
            "加密后解密应该恢复原始值");
    }

    /**
     * **Feature: hula-optimization, Property 1: PII 加密往返一致性**
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
     * 
     * 专门测试邮箱格式的往返一致性
     */
    @Property(tries = 100)
    @Label("Property 1: PII 加密往返一致性 - 邮箱格式")
    void emailEncryptionRoundTrip(@ForAll("emails") String email) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(email);
        String decrypted = encryptor.decrypt(encrypted);
        
        assertEquals(email, decrypted, 
            "邮箱加密后解密应该恢复原始值");
    }

    /**
     * **Feature: hula-optimization, Property 1: PII 加密往返一致性**
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
     * 
     * 专门测试手机号格式的往返一致性
     */
    @Property(tries = 100)
    @Label("Property 1: PII 加密往返一致性 - 手机号格式")
    void mobileEncryptionRoundTrip(@ForAll("mobiles") String mobile) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(mobile);
        String decrypted = encryptor.decrypt(encrypted);
        
        assertEquals(mobile, decrypted, 
            "手机号加密后解密应该恢复原始值");
    }

    /**
     * **Feature: hula-optimization, Property 1: PII 加密往返一致性**
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
     * 
     * 专门测试身份证号格式的往返一致性
     */
    @Property(tries = 100)
    @Label("Property 1: PII 加密往返一致性 - 身份证号格式")
    void idCardEncryptionRoundTrip(@ForAll("idCards") String idCard) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(idCard);
        String decrypted = encryptor.decrypt(encrypted);
        
        assertEquals(idCard, decrypted, 
            "身份证号加密后解密应该恢复原始值");
    }

    /**
     * **Feature: hula-optimization, Property 1: PII 加密往返一致性**
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
     * 
     * 测试中文内容的往返一致性
     */
    @Property(tries = 100)
    @Label("Property 1: PII 加密往返一致性 - 中文内容")
    void chineseContentRoundTrip(@ForAll("chineseStrings") String chinese) throws Exception {
        PiiEncryptor encryptor = createEncryptor();
        
        String encrypted = encryptor.encrypt(chinese);
        String decrypted = encryptor.decrypt(encrypted);
        
        assertEquals(chinese, decrypted, 
            "中文内容加密后解密应该恢复原始值");
    }

    // ==================== 数据生成器 ====================

    @Provide
    Arbitrary<String> emails() {
        Arbitrary<String> localPart = Arbitraries.strings()
            .withCharRange('a', 'z')
            .withCharRange('0', '9')
            .ofMinLength(1)
            .ofMaxLength(20);
        
        Arbitrary<String> domain = Arbitraries.of(
            "example.com", "test.org", "mail.cn", "qq.com", "163.com", "gmail.com"
        );
        
        return Combinators.combine(localPart, domain)
            .as((local, dom) -> local + "@" + dom);
    }

    @Provide
    Arbitrary<String> mobiles() {
        // 中国手机号格式: 1开头，第二位3-9，后面9位数字
        return Arbitraries.strings()
            .withCharRange('0', '9')
            .ofLength(9)
            .map(suffix -> "1" + Arbitraries.of("3", "4", "5", "6", "7", "8", "9").sample() + suffix);
    }

    @Provide
    Arbitrary<String> idCards() {
        // 简化的身份证号生成: 18位数字（最后一位可能是X）
        Arbitrary<String> first17 = Arbitraries.strings()
            .withCharRange('0', '9')
            .ofLength(17);
        
        Arbitrary<String> lastChar = Arbitraries.of(
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "X"
        );
        
        return Combinators.combine(first17, lastChar)
            .as((prefix, last) -> prefix + last);
    }

    @Provide
    Arbitrary<String> chineseStrings() {
        // 常用中文字符
        return Arbitraries.strings()
            .withCharRange('\u4e00', '\u9fa5')  // 基本汉字范围
            .ofMinLength(1)
            .ofMaxLength(50);
    }
}
