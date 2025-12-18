package com.luohuo.flex.im.domain.vo;

import com.luohuo.flex.im.domain.enums.KeyAlgorithm;
import com.luohuo.flex.im.domain.enums.KeyStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户公钥响应VO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "用户公钥信息")
public class UserPublicKeyVO {

    /**
     * 用户ID
     */
    @Schema(description = "用户ID", example = "123456")
    private Long userId;

    /**
     * 密钥ID
     */
    @Schema(description = "密钥ID", example = "key_20250101_001")
    private String keyId;

    /**
     * 公钥SPKI(Base64)
     */
    @Schema(description = "公钥SPKI(Base64)", example = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...")
    private String spki;

    /**
     * 算法类型
     */
    @Schema(description = "算法类型", example = "RSA-OAEP")
    private KeyAlgorithm algorithm;

    /**
     * 公钥指纹
     */
    @Schema(description = "公钥指纹(SHA-256)", example = "a1b2c3d4e5f6...")
    private String fingerprint;

    /**
     * 主键ID
     */
    @Schema(description = "主键ID", example = "1")
    private Long id;

    /**
     * 密钥状态
     */
    @Schema(description = "密钥状态", example = "1")
    private KeyStatus status;

    /**
     * 公钥内容（SPKI的别名，保持兼容性）
     */
    @Schema(description = "公钥内容", example = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...")
    private String publicKey;

    /**
     * 最后使用时间
     */
    @Schema(description = "最后使用时间")
    private LocalDateTime lastUsedAt;

    /**
     * 过期时间
     */
    @Schema(description = "过期时间")
    private LocalDateTime expiresAt;

    /**
     * 密钥用途
     */
    @Schema(description = "密钥用途", example = "E2EE加密")
    private String keyUsage;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间")
    private LocalDateTime createTime;

    /**
     * 创建人ID
     */
    @Schema(description = "创建人ID", example = "123")
    private String createBy;

    /**
     * 更新时间
     */
    @Schema(description = "更新时间")
    private LocalDateTime updateTime;

    /**
     * 更新人ID
     */
    @Schema(description = "更新人ID", example = "123")
    private String updateBy;

    /**
     * 租户ID
     */
    @Schema(description = "租户ID", example = "1")
    private Long tenantId;

    /**
     * 是否有效（与valid字段保持一致）
     */
    @Schema(description = "是否有效", example = "true")
    private Boolean isValid;

    /**
     * 是否有效（兼容字段）
     */
    @Schema(description = "是否有效", example = "true")
    private Boolean valid;
}