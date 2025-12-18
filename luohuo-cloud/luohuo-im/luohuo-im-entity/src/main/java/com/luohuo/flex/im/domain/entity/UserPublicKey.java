package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.luohuo.basic.base.entity.TenantEntity;
import com.luohuo.flex.im.domain.enums.KeyAlgorithm;
import com.luohuo.flex.im.domain.enums.KeyStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 用户公钥实体类
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("im_user_public_keys")
@Schema(description = "用户公钥")
public class UserPublicKey extends TenantEntity<Long> implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 用户ID
     */
    @NotNull(message = "用户ID不能为空")
    @TableField("user_id")
    @Schema(description = "用户ID", example = "123456")
    private Long userId;

    /**
     * 密钥ID
     */
    @NotBlank(message = "密钥ID不能为空")
    @Size(max = 64, message = "密钥ID长度不能超过64")
    @TableField("key_id")
    @Schema(description = "密钥ID", example = "key_20250101_001")
    private String keyId;

    /**
     * 公钥SPKI(Base64格式)
     */
    @NotBlank(message = "公钥不能为空")
    @TableField("spki")
    @Schema(description = "公钥SPKI(Base64)", example = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...")
    private String spki;

    /**
     * 算法类型
     */
    @TableField("algorithm")
    @Schema(description = "算法类型", example = "RSA-OAEP")
    private KeyAlgorithm algorithm = KeyAlgorithm.RSA_OAEP;

    /**
     * 公钥指纹(SHA-256)
     */
    @NotBlank(message = "公钥指纹不能为空")
    @Size(max = 64, message = "指纹长度不能超过64")
    @TableField("fingerprint")
    @Schema(description = "公钥指纹(SHA-256)", example = "a1b2c3d4e5f6...")
    private String fingerprint;

    /**
     * 密钥状态
     */
    @TableField("status")
    @Schema(description = "密钥状态", example = "1")
    private KeyStatus status = KeyStatus.ACTIVE;

    /**
     * 最后使用时间
     */
    @TableField("last_used_at")
    @Schema(description = "最后使用时间")
    private LocalDateTime lastUsedAt;

    /**
     * 过期时间
     */
    @TableField("expires_at")
    @Schema(description = "过期时间")
    private LocalDateTime expiresAt;

    /**
     * 密钥用途描述
     */
    @TableField("key_usage")
    @Schema(description = "密钥用途", example = "E2EE加密")
    private String keyUsage;

    /**
     * 验证密钥是否有效
     *
     * @return true if key is valid and not expired
     */
    public boolean isValid() {
        return status == KeyStatus.ACTIVE
            && (expiresAt == null || expiresAt.isAfter(LocalDateTime.now()));
    }

    /**
     * 标记密钥为已使用
     */
    public void markAsUsed() {
        this.lastUsedAt = LocalDateTime.now();
    }

    /**
     * 标记密钥为已禁用
     */
    public void markAsDisabled() {
        this.status = KeyStatus.DISABLED;
    }
}
