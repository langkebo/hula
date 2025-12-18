package com.luohuo.flex.im.domain.vo;

import com.luohuo.flex.im.domain.enums.EncryptionAlgorithm;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 加密消息响应VO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "加密消息响应")
public class EncryptedMessageResp {

    /**
     * 消息ID
     */
    @Schema(description = "消息ID", example = "123456")
    private Long id;

    /**
     * 关联原始消息ID
     */
    @Schema(description = "关联原始消息ID", example = "123456")
    private Long msgId;

    /**
     * 会话ID
     */
    @Schema(description = "会话ID", example = "conv_123456")
    private String conversationId;

    /**
     * 发送者ID
     */
    @Schema(description = "发送者ID", example = "123456")
    private Long senderId;

    /**
     * 接收者ID
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
    @Schema(description = "会话密钥ID", example = "session_key_001")
    private String keyId;

    /**
     * 加密算法
     */
    @Schema(description = "加密算法", example = "AES-GCM")
    private EncryptionAlgorithm algorithm;

    /**
     * 密文(Base64)
     */
    @Schema(description = "密文(Base64)", example = "Base64编码的密文")
    private String ciphertext;

    /**
     * 初始化向量(Base64)
     */
    @Schema(description = "初始化向量(Base64)", example = "Base64编码的IV")
    private String iv;

    /**
     * 认证标签(Base64)
     */
    @Schema(description = "认证标签(Base64)", example = "Base64编码的tag")
    private String tag;

    /**
     * 内容哈希
     */
    @Schema(description = "内容哈希", example = "a1b2c3d4...")
    private String contentHash;

    /**
     * 消息签名(Base64)
     */
    @Schema(description = "消息签名(Base64)", example = "Base64编码的签名")
    private String signature;

    /**
     * 内容类型
     */
    @Schema(description = "内容类型", example = "text")
    private String contentType;

    /**
     * 加密的扩展信息
     */
    @Schema(description = "加密的扩展信息", example = "JSON字符串")
    private String encryptedExtra;

    /**
     * 消息大小(字节)
     */
    @Schema(description = "消息大小(字节)", example = "1024")
    private Integer messageSize;

    /**
     * 是否已签名
     */
    @Schema(description = "是否已签名", example = "true")
    private Boolean isSigned;

    /**
     * 验证状态
     */
    @Schema(description = "验证状态", example = "VERIFIED")
    private String verificationStatus;

    /**
     * 加密耗时(毫秒)
     */
    @Schema(description = "加密耗时(毫秒)", example = "15")
    private Long encryptionTimeMs;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    /**
     * 是否是群消息
     */
    @Schema(description = "是否是群消息", example = "false")
    private Boolean groupMessage;

    /**
     * 是否是私聊消息
     */
    @Schema(description = "是否是私聊消息", example = "true")
    private Boolean privateMessage;

    /**
     * 设置消息类型标识
     */
    public void setMessageTypeFlags() {
        this.groupMessage = roomId != null && roomId > 0;
        this.privateMessage = recipientId != null && recipientId > 0;
    }
}