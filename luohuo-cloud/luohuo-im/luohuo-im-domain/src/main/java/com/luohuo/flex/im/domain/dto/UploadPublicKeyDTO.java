package com.luohuo.flex.im.domain.dto;

import com.luohuo.flex.im.domain.enums.KeyAlgorithm;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 上传公钥请求DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "上传公钥请求")
public class UploadPublicKeyDTO {

    /**
     * 密钥ID
     */
    @NotBlank(message = "密钥ID不能为空")
    @Size(max = 64, message = "密钥ID长度不能超过64")
    @Schema(description = "密钥ID", example = "key_20250101_001")
    private String keyId;

    /**
     * 公钥SPKI(Base64格式)
     */
    @NotBlank(message = "公钥不能为空")
    @Schema(description = "公钥SPKI(Base64)", example = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...")
    private String spki;

    /**
     * 算法类型
     */
    @Schema(description = "算法类型", example = "RSA-OAEP")
    private KeyAlgorithm algorithm = KeyAlgorithm.RSA_OAEP;

    /**
     * 公钥指纹（客户端计算，服务端验证）
     */
    @NotBlank(message = "公钥指纹不能为空")
    @Size(max = 64, message = "指纹长度不能超过64")
    @Schema(description = "公钥指纹(SHA-256)", example = "a1b2c3d4e5f6...")
    private String fingerprint;

    /**
     * 过期时间（可选）
     */
    @Schema(description = "过期时间", example = "2025-12-31T23:59:59")
    private String expiresAt;

    /**
     * 密钥用途
     */
    @Schema(description = "密钥用途", example = "E2EE加密")
    private String keyUsage;

    /**
     * 是否激活旧密钥（默认禁用其他密钥）
     */
    @Schema(description = "是否激活旧密钥", example = "false")
    private Boolean activateOldKeys = false;
}