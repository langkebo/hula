package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.luohuo.basic.base.entity.TenantEntity;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 密钥备份实体类
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("im_key_backup")
@Schema(description = "密钥备份")
public class KeyBackup extends TenantEntity<Long> implements Serializable {

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
    @Schema(description = "密钥ID", example = "key_123456")
    private String keyId;

    /**
     * 备份类型
     */
    @NotBlank(message = "备份类型不能为空")
    @TableField("backup_type")
    @Schema(description = "备份类型", example = "ENCRYPTED_SHARES")
    private String backupType;

    /**
     * 备份数据（加密）
     */
    @NotNull(message = "备份数据不能为空")
    @TableField("backup_data")
    @Schema(description = "备份数据")
    private String backupData;

    /**
     * 备份数据加密算法
     */
    @TableField("encryption_algorithm")
    @Schema(description = "加密算法", example = "AES-256-GCM")
    private String encryptionAlgorithm = "AES-256-GCM";

    /**
     * 访问代码（哈希）
     */
    @TableField("access_code")
    @Schema(description = "访问代码哈希")
    private String accessCode;

    /**
     * 访问代码过期时间
     */
    @TableField("access_code_expires_at")
    @Schema(description = "访问代码过期时间")
    private LocalDateTime accessCodeExpiresAt;

    /**
     * 恢复阈值（用于门限方案）
     */
    @TableField("recovery_threshold")
    @Schema(description = "恢复阈值", example = "2")
    private Integer recoveryThreshold = 1;

    /**
     * 总份额数（用于门限方案）
     */
    @TableField("total_shares")
    @Schema(description = "总份额数", example = "3")
    private Integer totalShares = 1;

    /**
     * 备份位置标识
     */
    @TableField("backup_location")
    @Schema(description = "备份位置", example = "cloud_storage_1")
    private String backupLocation;

    /**
     * 备份版本
     */
    @TableField("backup_version")
    @Schema(description = "备份版本", example = "1")
    private Integer backupVersion = 1;

    /**
     * 状态
     */
    @TableField("status")
    @Schema(description = "状态", example = "ACTIVE")
    private String status = "ACTIVE";

    /**
     * 最后访问时间
     */
    @TableField("last_accessed_at")
    @Schema(description = "最后访问时间")
    private LocalDateTime lastAccessedAt;

    /**
     * 访问次数
     */
    @TableField("access_count")
    @Schema(description = "访问次数", example = "0")
    private Integer accessCount = 0;

    // 业务方法

    /**
     * 是否是活跃状态
     */
    public boolean isActive() {
        return "ACTIVE".equals(this.status);
    }

    /**
     * 是否已泄露
     */
    public boolean isCompromised() {
        return "COMPROMISED".equals(this.status);
    }

    /**
     * 检查访问代码是否有效
     */
    public boolean isAccessCodeValid() {
        return accessCode != null &&
               (accessCodeExpiresAt == null || LocalDateTime.now().isBefore(accessCodeExpiresAt));
    }

    /**
     * 是否使用门限方案
     */
    public boolean usesThresholdScheme() {
        return recoveryThreshold != null && recoveryThreshold > 1 &&
               totalShares != null && totalShares > recoveryThreshold;
    }
}