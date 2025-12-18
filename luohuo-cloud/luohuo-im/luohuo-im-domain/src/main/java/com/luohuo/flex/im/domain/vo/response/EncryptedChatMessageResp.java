package com.luohuo.flex.im.domain.vo.response;

import com.luohuo.flex.model.entity.ws.ChatMessageResp;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.beans.BeanUtils;

/**
 * 加密聊天消息响应
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "加密聊天消息响应")
public class EncryptedChatMessageResp extends ChatMessageResp {

    /**
     * 是否是加密消息
     */
    @Schema(description = "是否是加密消息", example = "true")
    private Boolean encrypted = false;

    /**
     * 加密消息ID
     */
    @Schema(description = "加密消息ID", example = "123456")
    private Long encryptedMessageId;

    /**
     * 会话密钥ID
     */
    @Schema(description = "会话密钥ID", example = "session_key_001")
    private String keyId;

    /**
     * 加密算法
     */
    @Schema(description = "加密算法", example = "AES-GCM")
    private String algorithm;

    /**
     * 内容类型
     */
    @Schema(description = "内容类型", example = "text")
    private String contentType;

    /**
     * 是否已签名
     */
    @Schema(description = "是否已签名", example = "true")
    private Boolean isSigned = false;

    /**
     * 消息大小
     */
    @Schema(description = "消息大小(字节)", example = "1024")
    private Integer messageSize;

    /**
     * 密文
     */
    @Schema(description = "密文(Base64编码)", example = "...")
    private String ciphertext;

    /**
     * 初始化向量
     */
    @Schema(description = "初始化向量(Base64编码)", example = "...")
    private String iv;

    /**
     * 认证标签
     */
    @Schema(description = "认证标签(Base64编码)", example = "...")
    private String tag;

    /**
     * 签名
     */
    @Schema(description = "数字签名(Base64编码)", example = "...")
    private String signature;

    /**
     * 加密的扩展数据
     */
    @Schema(description = "加密的扩展数据(Base64编码)", example = "...")
    private String encryptedExtra;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间", example = "2025-01-01T00:00:00")
    private java.time.LocalDateTime createTime;

    /**
     * 消息ID
     */
    @Schema(description = "消息ID", example = "123456")
    private Long msgId;

    /**
     * 发送者ID
     */
    @Schema(description = "发送者ID", example = "789")
    private Long senderId;

    /**
     * 接收者ID
     */
    @Schema(description = "接收者ID", example = "101112")
    private Long recipientId;

    /**
     * 房间ID
     */
    @Schema(description = "房间ID", example = "131415")
    private Long roomId;

    /**
     * 会话ID
     */
    @Schema(description = "会话ID", example = "conversation_001")
    private String conversationId;

    /**
     * ID
     */
    @Schema(description = "ID", example = "123456")
    private Long id;

    /**
     * 创建加密消息响应
     */
    public static EncryptedChatMessageResp from(ChatMessageResp resp) {
        EncryptedChatMessageResp encryptedResp = new EncryptedChatMessageResp();

        // 复制父类属性
        BeanUtils.copyProperties(resp, encryptedResp);

        return encryptedResp;
    }

    /**
     * 设置消息加密标识
     */
    public void setMessageEncrypted(Boolean encrypted, Long encryptedMessageId,
                                   String keyId, String algorithm, String contentType) {
        this.encrypted = encrypted;
        this.encryptedMessageId = encryptedMessageId;
        this.keyId = keyId;
        this.algorithm = algorithm;
        this.contentType = contentType;
    }

    /**
     * 扩展Message内部类
     */
    @Data
        public static class EncryptedMessage extends Message {

        /**
         * 是否是加密消息
         */
        @Schema(description = "是否是加密消息", example = "true")
        private Boolean encrypted = false;

        /**
         * 加密消息ID
         */
        @Schema(description = "加密消息ID", example = "123456")
        private Long encryptedMessageId;

        /**
         * 会话密钥ID
         */
        @Schema(description = "会话密钥ID", example = "session_key_001")
        private String keyId;

        /**
         * 创建加密消息
         */
        public static EncryptedMessage from(Message message) {
            EncryptedMessage encryptedMessage = new EncryptedMessage();
            BeanUtils.copyProperties(message, encryptedMessage);
            return encryptedMessage;
        }
    }
}