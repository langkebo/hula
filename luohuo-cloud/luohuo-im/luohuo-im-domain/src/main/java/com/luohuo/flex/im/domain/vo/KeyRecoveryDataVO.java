package com.luohuo.flex.im.domain.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 密钥恢复数据VO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "密钥恢复数据响应")
public class KeyRecoveryDataVO {

    /**
     * 密钥ID
     */
    @Schema(description = "密钥ID", example = "key_123456")
    private String keyId;

    /**
     * 算法类型
     */
    @Schema(description = "算法类型", example = "RSA")
    private String algorithm;

    /**
     * 公钥数据
     */
    @Schema(description = "公钥数据（Base64编码）", example = "MIIBIjANBgkqhki...")
    private String publicKeyData;

    /**
     * 密钥格式（PEM/DER）
     */
    @Schema(description = "密钥格式", example = "PEM")
    private String format;

    /**
     * 密钥指纹
     */
    @Schema(description = "密钥指纹", example = "SHA256:abc123...")
    private String fingerprint;

    /**
     * 恢复时间
     */
    @Schema(description = "恢复时间")
    private LocalDateTime recoveryTime;

    /**
     * 恢复方法
     */
    @Schema(description = "恢复方法", example = "SECURITY_QUESTION")
    private String recoveryMethod;

    /**
     * 使用说明
     */
    @Schema(description = "使用说明")
    private String instructions;

    /**
     * 安全提示
     */
    @Schema(description = "安全提示", example = "请立即更换密码并启用二次验证")
    private String securityTips;
}