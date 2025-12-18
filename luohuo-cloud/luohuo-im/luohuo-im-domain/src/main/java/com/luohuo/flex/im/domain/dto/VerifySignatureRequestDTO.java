package com.luohuo.flex.im.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Base64;

/**
 * 验证签名请求DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "验证签名请求")
public class VerifySignatureRequestDTO {

    /**
     * 签名字节数组(Base64编码)
     */
    @NotBlank(message = "签名不能为空")
    @Schema(description = "签名(Base64编码)", example = "Base64编码的签名数据")
    private String signatureBase64;

    /**
     * 获取签名字节数组
     */
    public byte[] getSignatureBytes() {
        if (signatureBase64 == null || signatureBase64.isEmpty()) {
            return null;
        }
        return Base64.getDecoder().decode(signatureBase64);
    }
}