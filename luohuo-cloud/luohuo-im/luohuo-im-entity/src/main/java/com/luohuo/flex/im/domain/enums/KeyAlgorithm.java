package com.luohuo.flex.im.domain.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
public enum KeyAlgorithm {

    /**
     * RSA-OAEP非对称加密
     */
    RSA_OAEP("RSA-OAEP", "RSA-OAEP非对称加密"),

    /**
     * ECDH密钥交换
     */
    ECDH("ECDH", "椭圆曲线密钥交换"),

    /**
     * X25519密钥交换
     */
    X25519("X25519", "X25519密钥交换"),

    /**
     * Ed25519数字签名
     */
    ED25519("Ed25519", "Ed25519数字签名");

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

    KeyAlgorithm(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public String getCode() {
        return code;
    }

    public String getDescription() {
        return description;
    }

    /**
     * 根据code获取枚举
     */
    public static KeyAlgorithm of(String code) {
        for (KeyAlgorithm algorithm : values()) {
            if (algorithm.code.equals(code)) {
                return algorithm;
            }
        }
        throw new IllegalArgumentException("未知的密钥算法: " + code);
    }

    /**
     * 获取Java标准算法名称
     */
    public String getJavaAlgorithmName() {
        switch (this) {
            case RSA_OAEP:
                return "RSA";
            case ECDH:
                return "EC";
            case X25519:
                return "XDH";
            case ED25519:
                return "EdDSA";
            default:
                return "RSA"; // 默认使用RSA
        }
    }
}
