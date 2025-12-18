package com.luohuo.flex.oauth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.util.Base64;

@Component
public class AesUtil {
    private static final Logger logger = LoggerFactory.getLogger(AesUtil.class);
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final String DEFAULT_KEY = "Lu0Huo@32ByteKey!!1234567890ABCD"; // Fallback key
    private static final int KEY_LENGTH = 32; // 256 bits

    @Value("${luohuo.aes.secret-key:}")
    private String configuredKey;

    private byte[] secretKey;

    @PostConstruct
    public void init() {
        String keyToUse = configuredKey != null && !configuredKey.isEmpty() ? configuredKey : DEFAULT_KEY;

        // Ensure key is exactly 32 bytes for AES-256
        if (keyToUse.length() < KEY_LENGTH) {
            keyToUse = String.format("%-" + KEY_LENGTH + "s", keyToUse).replace(' ', '0');
        } else if (keyToUse.length() > KEY_LENGTH) {
            keyToUse = keyToUse.substring(0, KEY_LENGTH);
        }

        this.secretKey = keyToUse.getBytes();

        if (configuredKey == null || configuredKey.isEmpty()) {
            logger.warn("使用默认AES密钥，建议在配置文件中设置 luohuo.aes.secret-key 属性");
        }
    }

    public String encrypt(String plainText) {
        if (plainText == null) {
            return null;
        }
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(secretKey, "AES");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec);

            byte[] iv = cipher.getIV(); // GCM需要IV
            byte[] encrypted = cipher.doFinal(plainText.getBytes());

            // 组合IV+密文便于存储
            return Base64.getEncoder().encodeToString(
                ByteBuffer.allocate(iv.length + encrypted.length)
                    .put(iv)
                    .put(encrypted)
                    .array()
            );
        } catch (Exception e) {
            logger.error("AES加密失败", e);
            throw new RuntimeException("加密失败", e);
        }
    }

    public String decrypt(String encryptedText) {
        if (encryptedText == null) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedText);
            ByteBuffer buffer = ByteBuffer.wrap(decoded);

            // 提取IV
            byte[] iv = new byte[12];
            buffer.get(iv);

            // 提取密文
            byte[] cipherText = new byte[buffer.remaining()];
            buffer.get(cipherText);

            // 解密
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(secretKey, "AES");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));

            return new String(cipher.doFinal(cipherText));
        } catch (Exception e) {
            logger.error("AES解密失败", e);
            return null;
        }
    }
}