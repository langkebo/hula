package com.luohuo.flex.im.domain.dto;

import com.luohuo.flex.im.domain.enums.RecoveryType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 创建密钥恢复请求DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "创建密钥恢复请求")
public class CreateKeyRecoveryDTO {

    /**
     * 恢复类型
     */
    @NotNull(message = "恢复类型不能为空")
    @Schema(description = "恢复类型", example = "LOST_KEY")
    private RecoveryType recoveryType;

    /**
     * 请求的密钥ID
     */
    @NotBlank(message = "密钥ID不能为空")
    @Size(max = 64, message = "密钥ID长度不能超过64")
    @Schema(description = "密钥ID", example = "key_123456")
    private String keyId;

    /**
     * 备用邮箱
     */
    @Schema(description = "备用邮箱", example = "backup@example.com")
    private String backupEmail;

    /**
     * 备用手机号
     */
    @Schema(description = "备用手机号", example = "+86138****1234")
    private String backupPhone;

    /**
     * 安全问题
     */
    @Schema(description = "安全问题", example = "您的第一个宠物的名字是什么？")
    private String securityQuestion;

    /**
     * 安全问题答案
     */
    @Schema(description = "安全问题答案")
    private String securityAnswer;

    /**
     * 身份验证数据
     */
    @Schema(description = "身份验证数据")
    private String identityVerification;

    /**
     * 最大验证次数
     */
    @Schema(description = "最大验证次数", example = "3")
    private Integer maxAttempts = 3;

    /**
     * 恢复原因
     */
    @Schema(description = "恢复原因", example = "手机丢失，需要恢复密钥")
    private String reason;

    /**
     * 附加信息
     */
    @Schema(description = "附加信息")
    private String additionalInfo;
}