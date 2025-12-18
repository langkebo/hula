package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.luohuo.basic.base.entity.TenantEntity;
import com.luohuo.flex.im.domain.enums.EncryptionAlgorithm;
import com.luohuo.flex.im.domain.enums.KeyPackageStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 会话密钥包实体类
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("im_session_key_packages")
@Schema(description = "会话密钥包")
public class SessionKeyPackage extends TenantEntity<Long> implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 会话ID
     */
    @NotBlank(message = "会话ID不能为空")
    @Size(max = 64, message = "会话ID长度不能超过64")
    @TableField("session_id")
    @Schema(description = "会话ID", example = "session_123456")
    private String sessionId;

    /**
     * 密钥ID
     */
    @NotBlank(message = "密钥ID不能为空")
    @Size(max = 64, message = "密钥ID长度不能超过64")
    @TableField("key_id")
    @Schema(description = "密钥ID", example = "key_20250101_001")
    private String keyId;

    /**
     * 发送者ID
     */
    @NotNull(message = "发送者ID不能为空")
    @TableField("sender_id")
    @Schema(description = "发送者ID", example = "123456")
    private Long senderId;

    /**
     * 接收者ID
     */
    @NotNull(message = "接收者ID不能为空")
    @TableField("recipient_id")
    @Schema(description = "接收者ID", example = "654321")
    private Long recipientId;

    /**
     * RSA-OAEP包装的会话密钥
     */
    @NotNull(message = "包装的会话密钥不能为空")
    @TableField("wrapped_key")
    @Schema(description = "RSA-OAEP包装的会话密钥")
    private byte[] wrappedKey;

    /**
     * 加密算法
     */
    @TableField("algorithm")
    @Schema(description = "加密算法", example = "AES-GCM")
    private EncryptionAlgorithm algorithm = EncryptionAlgorithm.AES_GCM;

    /**
     * 密钥包状态
     */
    @TableField("status")
    @Schema(description = "密钥包状态", example = "1")
    private KeyPackageStatus status = KeyPackageStatus.PENDING;

    /**
     * 过期时间
     */
    @TableField("expires_at")
    @Schema(description = "过期时间")
    private LocalDateTime expiresAt;

    /**
     * 使用时间
     */
    @TableField("used_at")
    @Schema(description = "使用时间")
    private LocalDateTime usedAt;

    /**
     * 密钥轮换次数
     */
    @TableField("rotation_count")
    @Schema(description = "密钥轮换次数", example = "0")
    private Integer rotationCount = 0;

    /**
     * 前向安全标识
     */
    @TableField("forward_secret")
    @Schema(description = "是否使用前向安全", example = "true")
    private Boolean forwardSecret = false;

    /**
     * Ephemeral公钥(用于ECDH)
     */
    @TableField("ephemeral_public_key")
    @Schema(description = "Ephemeral公钥")
    private String ephemeralPublicKey;

    /**
     * 密钥派生算法
     */
    @TableField("kdf_algorithm")
    @Schema(description = "密钥派生算法", example = "HKDF-SHA256")
    private String kdfAlgorithm;

    /**
     * 密钥派生信息
     */
    @TableField("kdf_info")
    @Schema(description = "密钥派生信息")
    private String kdfInfo;

    /**
     * 验证密钥包是否有效
     *
     * @return true if key package is valid and not expired
     */
    public boolean isValid() {
        return status == KeyPackageStatus.PENDING
            && (expiresAt == null || expiresAt.isAfter(LocalDateTime.now()));
    }

    /**
     * 验证密钥包是否已过期
     *
     * @return true if key package is expired
     */
    public boolean isExpired() {
        return expiresAt != null && expiresAt.isBefore(LocalDateTime.now());
    }

    /**
     * 标记密钥包为已使用
     */
    public void markAsUsed() {
        this.usedAt = LocalDateTime.now();
        this.status = KeyPackageStatus.CONSUMED;
    }

    /**
     * 标记密钥包为已废弃
     */
    public void markAsRevoked() {
        this.status = KeyPackageStatus.REVOKED;
    }

    /**
     * 标记密钥包为已过期
     */
    public void markAsExpired() {
        this.status = KeyPackageStatus.EXPIRED;
    }

    /**
     * 增加密钥轮换次数
     */
    public void incrementRotationCount() {
        this.rotationCount = (this.rotationCount == null ? 0 : this.rotationCount) + 1;
    }

    /**
     * 设置过期时间（默认7天后）
     */
    public void setDefaultExpiration() {
        this.expiresAt = LocalDateTime.now().plusDays(7);
    }

    /**
     * 检查是否支持前向安全
     *
     * @return true if forward secrecy is enabled
     */
    public boolean supportsForwardSecrecy() {
        return Boolean.TRUE.equals(forwardSecret) && ephemeralPublicKey != null;
    }
}