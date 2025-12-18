package com.luohuo.flex.im.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.NotNull;

/**
 * 审核恢复请求DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "审核恢复请求")
public class ReviewRecoveryDTO {

    /**
     * 是否批准
     */
    @NotNull(message = "审核结果不能为空")
    @Schema(description = "是否批准", example = "true")
    private Boolean approved;

    /**
     * 审核意见
     */
    @Schema(description = "审核意见", example = "用户身份已验证，批准恢复")
    private String comment;

    /**
     * 审核标签
     */
    @Schema(description = "审核标签", example = "VERIFIED,URGENT")
    private String tags;

    /**
     * 需要用户额外提供的材料
     */
    @Schema(description = "需要的额外材料")
    private String requiredDocuments;
}