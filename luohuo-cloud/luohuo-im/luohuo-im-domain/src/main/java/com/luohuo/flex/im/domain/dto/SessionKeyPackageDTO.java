package com.luohuo.flex.im.domain.dto;

import com.luohuo.flex.im.domain.enums.EncryptionAlgorithm;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Base64;

/**
 * 会话密钥包请求DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "会话密钥包请求")
public class SessionKeyPackageDTO {

    /**
     * 会话ID
     */
    @NotBlank(message = "会话ID不能为空")
    @Size(max = 64, message = "会话ID长度不能超过64")
    @Schema(description = "会话ID", example = "session_123456")
    private String sessionId;

    /**
     * 密钥ID
     */
    @NotBlank(message = "密钥ID不能为空")
    @Size(max = 64, message = "密钥ID长度不能超过64")
    @Schema(description = "密钥ID", example = "key_20250101_001")
    private String keyId;

    /**
     * 接收者ID
     */
    @NotNull(message = "接收者ID不能为空")
    @Schema(description = "接收者ID", example = "654321")
    private Long recipientId;

    /**
     * RSA-OAEP包装的会话密钥(Base64)
     */
    @NotBlank(message = "包装的会话密钥不能为空")
    @Schema(description = "RSA-OAEP包装的会话密钥(Base64)", example = "Base64编码的包装密钥")
    private String wrappedKey;

    /**
     * 加密算法
     */
    @Schema(description = "加密算法", example = "AES-GCM")
    private EncryptionAlgorithm algorithm = EncryptionAlgorithm.AES_GCM;

    /**
     * 过期时间(可选)
     */
    @Schema(description = "过期时间", example = "2025-12-31T23:59:59")
    private String expiresAt;

    /**
     * 是否启用前向安全
     */
    @Schema(description = "是否启用前向安全", example = "true")
    private Boolean forwardSecret = false;

    /**
     * Ephemeral公钥(用于ECDH, Base64)
     */
    @Schema(description = "Ephemeral公钥(Base64)", example = "Base64编码的临时公钥")
    private String ephemeralPublicKey;

    /**
     * 密钥派生算法
     */
    @Schema(description = "密钥派生算法", example = "HKDF-SHA256")
    private String kdfAlgorithm;

    /**
     * 密钥派生信息
     */
    @Schema(description = "密钥派生信息", example = "E2EE Session Key")
    private String kdfInfo;

    /**
     * 验证并解码包装的密钥
     */
    public byte[] getWrappedKeyBytes() {
        return Base64.getDecoder().decode(wrappedKey);
    }

    /**
     * 验证并解码临时公钥
     */
    public byte[] getEphemeralPublicKeyBytes() {
        return ephemeralPublicKey != null ?
            Base64.getDecoder().decode(ephemeralPublicKey) : null;
    }

    /**
     * 获取包装密钥的大小
     */
    public int getWrappedKeySize() {
        return getWrappedKeyBytes().length;
    }
}