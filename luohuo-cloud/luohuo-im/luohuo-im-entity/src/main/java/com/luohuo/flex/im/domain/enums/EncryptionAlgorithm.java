package com.luohuo.flex.im.domain.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import com.luohuo.basic.interfaces.BaseEnum;

/**
 * 加密算法枚举
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public enum EncryptionAlgorithm implements BaseEnum {

    /**
     * AES-256-GCM (对称加密)
     */
    AES_GCM("AES-GCM", "AES-256-GCM对称加密"),

    /**
     * RSA-OAEP (非对称加密，用于密钥包装)
     */
    RSA_OAEP("RSA-OAEP", "RSA-OAEP非对称加密"),

    /**
     * X25519 (椭圆曲线 Diffie-Hellman)
     */
    X25519("X25519", "椭圆曲线密钥交换"),

    /**
     * ChaCha20-Poly1305
     */
    CHACHA20_POLY1305("ChaCha20-Poly1305", "ChaCha20-Poly1305对称加密");

    /**
     * 算法标识
     */
    @EnumValue
    @JsonValue
    private final String code;

    /**
     * 算法描述
     */
    private final String description;

    EncryptionAlgorithm(String code, String description) {
        this.code = code;
        this.description = description;
    }

    @Override
    public String getCode() {
        return code;
    }

    @Override
    public String getDesc() {
        return description;
    }

    public String getDescription() {
        return description;
    }

    /**
     * 根据code获取枚举
     */
    public static EncryptionAlgorithm of(String code) {
        for (EncryptionAlgorithm algorithm : values()) {
            if (algorithm.code.equals(code)) {
                return algorithm;
            }
        }
        throw new IllegalArgumentException("未知的加密算法: " + code);
    }
}
