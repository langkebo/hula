package com.luohuo.flex.im.domain.vo.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 加密消息响应VO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "加密消息响应")
public class EncryptedMessageResp implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 消息ID
     */
    @Schema(description = "消息ID")
    private Long id;

    /**
     * 会话ID
     */
    @Schema(description = "会话ID")
    private String conversationId;

    /**
     * 发送者ID
     */
    @Schema(description = "发送者ID")
    private Long senderId;

    /**
     * 接收者ID（单聊）
     */
    @Schema(description = "接收者ID")
    private Long recipientId;

    /**
     * 群组ID（群聊）
     */
    @Schema(description = "群组ID")
    private Long groupId;

    /**
     * 密文（Base64编码）
     */
    @Schema(description = "密文")
    private String ciphertext;

    /**
     * 初始化向量（Base64编码）
     */
    @Schema(description = "初始化向量")
    private String iv;

    /**
     * 认证标签（Base64编码）
     */
    @Schema(description = "认证标签")
    private String tag;

    /**
     * 密钥ID
     */
    @Schema(description = "密钥ID")
    private String keyId;

    /**
     * 加密算法
     */
    @Schema(description = "加密算法")
    private String algorithm;

    /**
     * 内容类型
     */
    @Schema(description = "内容类型")
    private String contentType;

    /**
     * 消息签名（Base64编码）
     */
    @Schema(description = "消息签名")
    private String signature;

    /**
     * 消息状态
     */
    @Schema(description = "消息状态")
    private Integer status;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    /**
     * 阅读时间
     */
    @Schema(description = "阅读时间")
    private LocalDateTime readAt;

    /**
     * 销毁时间
     */
    @Schema(description = "销毁时间")
    private LocalDateTime destructAt;
}