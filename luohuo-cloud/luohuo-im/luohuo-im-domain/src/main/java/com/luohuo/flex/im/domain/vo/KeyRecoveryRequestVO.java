package com.luohuo.flex.im.domain.vo;

import com.luohuo.flex.im.domain.enums.RecoveryStatus;
import com.luohuo.flex.im.domain.enums.RecoveryType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 密钥恢复请求VO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "密钥恢复请求响应")
public class KeyRecoveryRequestVO {

    /**
     * 请求ID
     */
    @Schema(description = "请求ID", example = "123456789")
    private Long id;

    /**
     * 用户ID
     */
    @Schema(description = "用户ID", example = "123456")
    private Long userId;

    /**
     * 恢复类型
     */
    @Schema(description = "恢复类型", example = "LOST_KEY")
    private RecoveryType recoveryType;

    /**
     * 状态
     */
    @Schema(description = "状态", example = "PENDING")
    private RecoveryStatus status;

    /**
     * 密钥ID
     */
    @Schema(description = "密钥ID", example = "key_123456")
    private String keyId;

    /**
     * 验证次数
     */
    @Schema(description = "当前验证次数", example = "1")
    private Integer verificationAttempts;

    /**
     * 最大验证次数
     */
    @Schema(description = "最大验证次数", example = "3")
    private Integer maxAttempts;

    /**
     * 安全问题（脱敏）
     */
    @Schema(description = "安全问题")
    private String securityQuestion;

    /**
     * 备用邮箱（脱敏）
     */
    @Schema(description = "备用邮箱", example = "b***@example.com")
    private String maskedBackupEmail;

    /**
     * 备用手机号（脱敏）
     */
    @Schema(description = "备用手机号", example = "+86138****1234")
    private String maskedBackupPhone;

    /**
     * 令牌过期时间
     */
    @Schema(description = "令牌过期时间")
    private LocalDateTime tokenExpiresAt;

    /**
     * 审核员ID
     */
    @Schema(description = "审核员ID", example = "789012")
    private Long reviewerId;

    /**
     * 审核意见
     */
    @Schema(description = "审核意见")
    private String reviewComment;

    /**
     * 审核时间
     */
    @Schema(description = "审核时间")
    private LocalDateTime reviewedAt;

    /**
     * 完成时间
     */
    @Schema(description = "完成时间")
    private LocalDateTime completedAt;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间")
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @Schema(description = "更新时间")
    private LocalDateTime updateTime;

    /**
     * 失败原因
     */
    @Schema(description = "失败原因")
    private String failureReason;

    /**
     * 安全问题答案哈希
     */
    @Schema(description = "安全问题答案哈希")
    private String securityAnswerHash;

    /**
     * 恢复令牌
     */
    @Schema(description = "恢复令牌")
    private String recoveryToken;

    /**
     * 恢复的密钥数据
     */
    @Schema(description = "恢复的密钥数据")
    private String recoveredKeyData;

    /**
     * 备份验证
     */
    @Schema(description = "备份验证状态")
    private Boolean backupVerification;

    /**
     * 剩余验证次数
     */
    @Schema(description = "剩余验证次数", example = "2")
    public Integer getRemainingAttempts() {
        if (verificationAttempts == null || maxAttempts == null) {
            return maxAttempts != null ? maxAttempts : 0;
        }
        return Math.max(0, maxAttempts - verificationAttempts);
    }

    /**
     * 是否令牌有效
     */
    @Schema(description = "是否令牌有效", example = "true")
    public boolean isTokenValid() {
        return tokenExpiresAt != null && LocalDateTime.now().isBefore(tokenExpiresAt);
    }
}