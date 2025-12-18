package com.luohuo.flex.im.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.NotNull;

/**
 * 恢复密钥DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "恢复密钥请求")
public class RecoverKeyDTO {

    /**
     * 恢复请求ID
     */
    @NotNull(message = "恢复请求ID不能为空")
    @Schema(description = "恢复请求ID", example = "123456789")
    private Long requestId;

    /**
     * 访问代码（如果备份设置了访问代码）
     */
    @Schema(description = "访问代码")
    private String accessCode;

    /**
     * 恢复密码（用于解密备份数据）
     */
    @Schema(description = "恢复密码")
    private String recoveryPassword;

    /**
     * 新的密钥数据（如果要重新生成）
     */
    @Schema(description = "新的密钥数据")
    private String newKeyData;
}