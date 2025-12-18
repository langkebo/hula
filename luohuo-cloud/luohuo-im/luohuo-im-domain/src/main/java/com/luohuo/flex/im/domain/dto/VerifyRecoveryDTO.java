package com.luohuo.flex.im.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 验证密钥恢复请求DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "验证密钥恢复请求")
public class VerifyRecoveryDTO {

    /**
     * 恢复令牌
     */
    @NotBlank(message = "恢复令牌不能为空")
    @Size(max = 128, message = "恢复令牌长度不能超过128")
    @Schema(description = "恢复令牌", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    private String recoveryToken;

    /**
     * 安全问题答案（如果设置了）
     */
    @Schema(description = "安全问题答案")
    private String securityAnswer;

    /**
     * 验证码（如果通过邮件或短信发送）
     */
    @Schema(description = "验证码", example = "123456")
    private String verificationCode;

    /**
     * 身份验证数据
     */
    @Schema(description = "身份验证数据")
    private String identityVerification;
}