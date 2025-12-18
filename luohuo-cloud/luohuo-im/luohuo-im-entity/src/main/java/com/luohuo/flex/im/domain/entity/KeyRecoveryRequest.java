package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.luohuo.basic.base.entity.TenantEntity;
import com.luohuo.flex.im.domain.enums.RecoveryStatus;
import com.luohuo.flex.im.domain.enums.RecoveryType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 密钥恢复请求实体类
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("im_key_recovery_request")
@Schema(description = "密钥恢复请求")
public class KeyRecoveryRequest extends TenantEntity<Long> implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 用户ID
     */
    @NotNull(message = "用户ID不能为空")
    @TableField("user_id")
    @Schema(description = "用户ID", example = "123456")
    private Long userId;

    /**
     * 恢复类型
     */
    @NotNull(message = "恢复类型不能为空")
    @TableField("recovery_type")
    @Schema(description = "恢复类型", example = "LOST_KEY")
    private RecoveryType recoveryType;

    /**
     * 恢复状态
     */
    @TableField("status")
    @Schema(description = "恢复状态", example = "PENDING")
    private RecoveryStatus status = RecoveryStatus.PENDING;

    /**
     * 请求的密钥ID
     */
    @NotBlank(message = "密钥ID不能为空")
    @Size(max = 64, message = "密钥ID长度不能超过64")
    @TableField("key_id")
    @Schema(description = "请求的密钥ID", example = "key_123456")
    private String keyId;

    /**
     * 备份验证数据（加密的）
     */
    @TableField("backup_verification")
    @Schema(description = "备份验证数据")
    private String backupVerification;

    /**
     * 恢复令牌
     */
    @TableField("recovery_token")
    @Schema(description = "恢复令牌")
    private String recoveryToken;

    /**
     * 令牌过期时间
     */
    @TableField("token_expires_at")
    @Schema(description = "令牌过期时间")
    private LocalDateTime tokenExpiresAt;

    /**
     * 验证次数
     */
    @TableField("verification_attempts")
    @Schema(description = "验证次数", example = "0")
    private Integer verificationAttempts = 0;

    /**
     * 最大验证次数
     */
    @TableField("max_attempts")
    @Schema(description = "最大验证次数", example = "3")
    private Integer maxAttempts = 3;

    /**
     * 验证问题（预设问题或自定义）
     */
    @TableField("security_question")
    @Schema(description = "验证问题")
    private String securityQuestion;

    /**
     * 问题答案（哈希后）
     */
    @TableField("security_answer_hash")
    @Schema(description = "问题答案哈希")
    private String securityAnswerHash;

    /**
     * 备用邮箱
     */
    @TableField("backup_email")
    @Schema(description = "备用邮箱", example = "backup@example.com")
    private String backupEmail;

    /**
     * 备用手机号
     */
    @TableField("backup_phone")
    @Schema(description = "备用手机号", example = "+86138****1234")
    private String backupPhone;

    /**
     * 身份验证数据（如人脸识别数据等）
     */
    @TableField("identity_verification")
    @Schema(description = "身份验证数据")
    private String identityVerification;

    /**
     * 审核员ID
     */
    @TableField("reviewer_id")
    @Schema(description = "审核员ID", example = "789012")
    private Long reviewerId;

    /**
     * 审核意见
     */
    @TableField("review_comment")
    @Schema(description = "审核意见")
    private String reviewComment;

    /**
     * 审核时间
     */
    @TableField("reviewed_at")
    @Schema(description = "审核时间")
    private LocalDateTime reviewedAt;

    /**
     * 完成时间
     */
    @TableField("completed_at")
    @Schema(description = "完成时间")
    private LocalDateTime completedAt;

    /**
     * 恢复的密钥数据（加密）
     */
    @TableField("recovered_key_data")
    @Schema(description = "恢复的密钥数据")
    private String recoveredKeyData;

    /**
     * IP地址
     */
    @TableField("ip_address")
    @Schema(description = "IP地址", example = "192.168.1.100")
    private String ipAddress;

    /**
     * 用户代理
     */
    @TableField("user_agent")
    @Schema(description = "用户代理")
    private String userAgent;

    /**
     * 失败原因
     */
    @TableField("failure_reason")
    @Schema(description = "失败原因")
    private String failureReason;

    // 业务方法

    /**
     * 检查令牌是否有效
     */
    public boolean isTokenValid() {
        return recoveryToken != null &&
               tokenExpiresAt != null &&
               LocalDateTime.now().isBefore(tokenExpiresAt);
    }

    /**
     * 检查是否超过最大验证次数
     */
    public boolean isMaxAttemptsReached() {
        return verificationAttempts >= maxAttempts;
    }

    /**
     * 增加验证次数
     */
    public KeyRecoveryRequest incrementAttempts() {
        this.verificationAttempts = (this.verificationAttempts == null ? 0 : this.verificationAttempts) + 1;
        return this;
    }

    /**
     * 是否待处理
     */
    public boolean isPending() {
        return RecoveryStatus.PENDING.equals(this.status);
    }

    /**
     * 是否待验证
     */
    public boolean isPendingVerification() {
        return RecoveryStatus.PENDING_VERIFICATION.equals(this.status);
    }

    /**
     * 是否已批准
     */
    public boolean isApproved() {
        return RecoveryStatus.APPROVED.equals(this.status);
    }

    /**
     * 是否已拒绝
     */
    public boolean isRejected() {
        return RecoveryStatus.REJECTED.equals(this.status);
    }

    /**
     * 是否已完成
     */
    public boolean isCompleted() {
        return RecoveryStatus.RECOVERED.equals(this.status);
    }
}