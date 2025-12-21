package com.luohuo.flex.crypto;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * PII字段加密工具
 * ===== P0修复: PII数据字段级加密 (2025-12-13) =====
 *
 * 功能:
 * - 使用AES-256-GCM加密敏感个人信息
 * - 提供认证加密(AEAD), 防篡改
 * - 密钥通过配置文件管理 (建议使用KMS或Vault)
 *
 * 加密字段:
 * - email (邮箱)
 * - mobile (手机号)
 * - id_card (身份证号)
 *
 * 存储格式: Base64(IV || Ciphertext)
 * - IV: 12字节随机初始化向量
 * - Ciphertext: 加密数据 + 16字节GCM认证标签
 *
 * @author HuLa Security Team
 * @since 2025-12-13
 */
@Slf4j
@Component
public class PiiEncryptor {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;          // GCM推荐96位(12字节)IV
    private static final int TAG_LENGTH = 128;        // GCM认证标签128位
    private static final int KEY_LENGTH = 256;        // AES-256

    /**
     * 加密密钥 (Base64编码的32字节密钥)
     * 配置示例: pii.encryption.key=YOUR_BASE64_ENCODED_32_BYTE_KEY
     *
     * 生成密钥命令:
     * openssl rand -base64 32
     */
    @Value("${pii.encryption.key:}")
    private String base64Key;

    private SecretKey secretKey;
    private SecureRandom secureRandom;

    /**
     * 初始化密钥和随机数生成器
     */
    @PostConstruct
    public void init() throws Exception {
        // 检查密钥配置
        if (base64Key == null || base64Key.isEmpty()) {
            log.warn("PII加密密钥未配置! 将使用默认密钥 (仅供开发测试, 生产环境必须配置!)");
            // 开发环境默认密钥 (生产环境必须替换!)
            base64Key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32字节全0
        }

        // 解码密钥
        byte[] decodedKey = Base64.getDecoder().decode(base64Key);
        if (decodedKey.length != 32) {
            throw new IllegalArgumentException(
                String.format("PII加密密钥长度错误: 期望32字节, 实际%d字节", decodedKey.length)
            );
        }

        this.secretKey = new SecretKeySpec(decodedKey, 0, decodedKey.length, "AES");
        this.secureRandom = SecureRandom.getInstanceStrong();

        log.info("PII加密器初始化成功 (AES-256-GCM)");
    }

    /**
     * 加密明文
     *
     * @param plaintext 明文字符串
     * @return Base64编码的密文 (格式: Base64(IV + Ciphertext))
     * @throws Exception 加密失败
     */
    public String encrypt(String plaintext) throws Exception {
        if (plaintext == null || plaintext.isEmpty()) {
            return plaintext;  // 空值不加密
        }

        // 1. 生成随机IV
        byte[] iv = new byte[IV_LENGTH];
        secureRandom.nextBytes(iv);

        // 2. 初始化加密器
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        GCMParameterSpec spec = new GCMParameterSpec(TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec);

        // 3. 加密数据
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        // 4. 拼接 IV + Ciphertext
        byte[] combined = new byte[iv.length + ciphertext.length];
        System.arraycopy(iv, 0, combined, 0, iv.length);
        System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

        // 5. Base64编码
        return Base64.getEncoder().encodeToString(combined);
    }

    /**
     * 解密密文
     *
     * @param encryptedData Base64编码的密文
     * @return 明文字符串
     * @throws Exception 解密失败
     */
    public String decrypt(String encryptedData) throws Exception {
        if (encryptedData == null || encryptedData.isEmpty()) {
            return encryptedData;  // 空值不解密
        }

        try {
            // 1. Base64解码
            byte[] combined = Base64.getDecoder().decode(encryptedData);

            // 2. 分离 IV 和 Ciphertext
            if (combined.length < IV_LENGTH) {
                throw new IllegalArgumentException("加密数据格式错误: 长度不足");
            }

            byte[] iv = new byte[IV_LENGTH];
            byte[] ciphertext = new byte[combined.length - IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
            System.arraycopy(combined, IV_LENGTH, ciphertext, 0, ciphertext.length);

            // 3. 初始化解密器
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec spec = new GCMParameterSpec(TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);

            // 4. 解密数据
            byte[] plaintext = cipher.doFinal(ciphertext);

            return new String(plaintext, StandardCharsets.UTF_8);

        } catch (Exception e) {
            // 使用 WARN 级别，因为解密失败可能是预期的业务场景（如密钥轮换、数据迁移）
            log.warn("PII解密失败: {}", e.getMessage());
            throw new Exception("数据解密失败: " + e.getMessage(), e);
        }
    }

    /**
     * 判断字符串是否为Base64格式 (可能已加密)
     * 用于数据迁移时判断是否已加密
     *
     * @param value 待检查字符串
     * @return true=可能已加密, false=明文
     */
    public boolean isEncrypted(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }

        // Base64字符串特征:
        // 1. 长度是4的倍数
        // 2. 只包含 A-Za-z0-9+/= 字符
        // 3. 长度应该大于IV长度 (12字节 → 16字符Base64)
        if (value.length() % 4 != 0 || value.length() < 16) {
            return false;
        }

        return value.matches("^[A-Za-z0-9+/]+=*$");
    }

    /**
     * 批量加密 (用于数据迁移)
     *
     * @param plaintexts 明文数组
     * @return 密文数组
     */
    public String[] encryptBatch(String[] plaintexts) throws Exception {
        if (plaintexts == null) {
            return null;
        }

        String[] encrypted = new String[plaintexts.length];
        for (int i = 0; i < plaintexts.length; i++) {
            encrypted[i] = encrypt(plaintexts[i]);
        }
        return encrypted;
    }
}
