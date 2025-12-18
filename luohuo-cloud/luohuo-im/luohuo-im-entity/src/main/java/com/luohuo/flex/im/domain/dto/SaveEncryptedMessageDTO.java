package com.luohuo.flex.im.domain.dto;

import com.luohuo.flex.im.domain.enums.EncryptionAlgorithm;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Base64;

/**
 * 保存加密消息请求DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "保存加密消息请求")
public class SaveEncryptedMessageDTO {

    /**
     * 关联原始消息ID(兼容性)
     */
    @Schema(description = "关联原始消息ID", example = "123456")
    private Long msgId;

    /**
     * 会话ID
     */
    @NotBlank(message = "会话ID不能为空")
    @Size(max = 64, message = "会话ID长度不能超过64")
    @Schema(description = "会话ID", example = "conv_123456")
    private String conversationId;

    /**
     * 接收者ID(私聊)
     */
    @Schema(description = "接收者ID", example = "654321")
    private Long recipientId;

    /**
     * 群聊ID
     */
    @Schema(description = "群聊ID", example = "1001")
    private Long roomId;

    /**
     * 会话密钥ID
     */
    @NotBlank(message = "会话密钥ID不能为空")
    @Size(max = 64, message = "密钥ID长度不能超过64")
    @Schema(description = "会话密钥ID", example = "session_key_001")
    private String keyId;

    /**
     * 加密算法
     */
    @Schema(description = "加密算法", example = "AES-GCM")
    private EncryptionAlgorithm algorithm = EncryptionAlgorithm.AES_GCM;

    /**
     * 密文(Base64)
     */
    @NotBlank(message = "密文不能为空")
    @Schema(description = "密文(Base64)", example = "Base64编码的密文")
    private String ciphertext;

    /**
     * 初始化向量(IV, Base64)
     */
    @NotBlank(message = "初始化向量不能为空")
    @Schema(description = "初始化向量(Base64)", example = "Base64编码的IV")
    private String iv;

    /**
     * 认证标签(Base64, GCM)
     */
    @Schema(description = "认证标签(Base64)", example = "Base64编码的tag")
    private String tag;

    /**
     * 消息签名(Base64, RSA-PSS)
     */
    @Schema(description = "消息签名(Base64)", example = "Base64编码的签名")
    private String signature;

    /**
     * 内容类型
     */
    @NotBlank(message = "内容类型不能为空")
    @Size(max = 32, message = "内容类型长度不能超过32")
    @Schema(description = "内容类型", example = "text")
    private String contentType;

    /**
     * 加密的扩展信息(Base64)
     */
    @Schema(description = "加密的扩展信息(Base64)", example = "Base64编码的扩展信息")
    private String encryptedExtra;

    /**
     * 加密耗时(毫秒)
     */
    @Schema(description = "加密耗时(毫秒)", example = "15")
    private Long encryptionTimeMs;

    /**
     * 自毁定时器(毫秒)
     * 消息在被阅读后多少毫秒自动销毁
     */
    @Schema(description = "自毁定时器(毫秒)", example = "60000")
    private Long selfDestructTimer;

    /**
     * 验证签名后解码为字节数组
     */
    public byte[] getCiphertextBytes() {
        return Base64.getDecoder().decode(ciphertext);
    }

    /**
     * 验证IV后解码为字节数组
     */
    public byte[] getIvBytes() {
        return Base64.getDecoder().decode(iv);
    }

    /**
     * 验证Tag后解码为字节数组
     */
    public byte[] getTagBytes() {
        return tag != null ? Base64.getDecoder().decode(tag) : null;
    }

    /**
     * 验证签名后解码为字节数组
     */
    public byte[] getSignatureBytes() {
        return signature != null ? Base64.getDecoder().decode(signature) : null;
    }

    /**
     * 获取消息大小
     */
    public int getMessageSize() {
        return getCiphertextBytes().length;
    }

    /**
     * 是否是群消息
     */
    public boolean isGroupMessage() {
        return roomId != null && roomId > 0;
    }

    /**
     * 是否是私聊消息
     */
    public boolean isPrivateMessage() {
        return recipientId != null && recipientId > 0;
    }
}