package com.luohuo.flex.ws.websocket.processor;

import com.fasterxml.jackson.databind.JsonNode;
import com.luohuo.basic.jackson.JsonUtil;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.core.e2ee.service.E2EEMessageService;
import com.luohuo.flex.im.domain.dto.SaveEncryptedMessageDTO;
import com.luohuo.flex.im.domain.dto.SessionKeyPackageDTO;
import com.luohuo.flex.model.ws.WSBaseReq;
import com.luohuo.flex.ws.websocket.SessionManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketSession;

import reactor.core.publisher.Mono;

/**
 * 端到端加密消息处理器
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Component
@Order(10) // 高优先级，在默认处理器之前
@RequiredArgsConstructor
public class E2EEMessageProcessor implements MessageProcessor {

    private final E2EEMessageService e2eeMessageService;
    private final SessionManager sessionManager;

    @Override
    public boolean supports(WSBaseReq bean) {
        // 检查是否是加密消息类型
        if (bean == null) {
            return false;
        }

        // 根据type字段判断
        Integer type = bean.getType();
        return type != null && (
            type == 1001 || // 加密消息
            type == 1002     // 加密密钥包
        );
    }

    @Override
    public void process(WebSocketSession session, Long uid, WSBaseReq bean) {
        try {
            Integer type = bean.getType();

            switch (type) {
                case 1001:
                    processEncryptedMessage(session, uid, bean);
                    break;
                case 1002:
                    processEncryptedKeyPackage(session, uid, bean);
                    break;
                default:
                    log.warn("未知的加密消息类型: {}", type);
            }
        } catch (Exception e) {
            log.error("处理E2EE消息失败", e);
            // 发送错误响应
            sendErrorResponse(session, "处理加密消息失败: " + e.getMessage());
        }
    }

    /**
     * 处理加密消息
     */
    private void processEncryptedMessage(WebSocketSession session, Long uid, WSBaseReq bean) {
        log.debug("处理加密消息，用户: {}", uid);

        try {
            // 解析加密消息数据
            String dataStr = bean.getData().toString();
            SaveEncryptedMessageDTO messageDto = parseEncryptedMessage(dataStr);

            // 设置发送者ID
            // messageDto 会从 ContextUtil 获取当前用户ID

            // 保存加密消息
            Long messageId = e2eeMessageService.saveEncryptedMessage(messageDto);

            // 发送成功响应
            sendSuccessResponse(session, messageId, "加密消息发送成功");

            // 推送给接收者
            forwardEncryptedMessage(messageDto, messageId);

        } catch (Exception e) {
            log.error("处理加密消息失败", e);
            sendErrorResponse(session, "加密消息处理失败: " + e.getMessage());
        }
    }

    /**
     * 处理加密密钥包
     */
    private void processEncryptedKeyPackage(WebSocketSession session, Long uid, WSBaseReq bean) {
        log.debug("处理加密密钥包，用户: {}", uid);

        try {
            // 解析密钥包数据
            String dataStr = bean.getData().toString();
            SessionKeyPackageDTO keyPackageDto = parseKeyPackage(dataStr);

            // 分发密钥包
            e2eeMessageService.distributeSessionKey(keyPackageDto);

            // 发送成功响应
            sendSuccessResponse(session, null, "密钥包分发成功");

            // 推送给接收者
            WSBaseReq push = new WSBaseReq();
            push.setType(1005); // 密钥包推送类型
            String data = String.format(
                "{\"type\":\"encrypted_key_package\",\"sessionId\":\"%s\",\"keyId\":\"%s\",\"wrappedKey\":\"%s\"}",
                keyPackageDto.getSessionId(),
                keyPackageDto.getKeyId(),
                keyPackageDto.getWrappedKey()
            );
            push.setData(data);
            sessionManager.sendToUser(keyPackageDto.getRecipientId(), push);

        } catch (Exception e) {
            log.error("处理密钥包失败", e);
            sendErrorResponse(session, "密钥包处理失败: " + e.getMessage());
        }
    }

    /**
     * 解析加密消息
     */
    private SaveEncryptedMessageDTO parseEncryptedMessage(String dataStr) {
        try {
            // 使用JSON解析数据
            JsonNode json = JsonUtil.readTree(dataStr);

            SaveEncryptedMessageDTO dto = new SaveEncryptedMessageDTO();
            dto.setConversationId(getJsonString(json, "conversationId"));
            dto.setRecipientId(getJsonLong(json, "recipientId"));
            dto.setRoomId(getJsonLong(json, "roomId"));
            dto.setKeyId(getJsonString(json, "keyId"));
            dto.setAlgorithm(getJsonEncryptionAlgorithm(json, "algorithm"));
            dto.setCiphertext(getJsonString(json, "ciphertext"));
            dto.setIv(getJsonString(json, "iv"));
            dto.setTag(getJsonString(json, "tag"));
            dto.setSignature(getJsonString(json, "signature"));
            dto.setContentType(getJsonString(json, "contentType"));
            dto.setEncryptedExtra(getJsonString(json, "encryptedExtra"));
            dto.setEncryptionTimeMs(getJsonLong(json, "encryptionTimeMs"));

            return dto;
        } catch (Exception e) {
            throw new RuntimeException("解析加密消息失败: " + e.getMessage());
        }
    }

    /**
     * 解析密钥包
     */
    private SessionKeyPackageDTO parseKeyPackage(String dataStr) {
        try {
            JsonNode json = JsonUtil.readTree(dataStr);

            SessionKeyPackageDTO dto = new SessionKeyPackageDTO();
            dto.setSessionId(getJsonString(json, "sessionId"));
            dto.setKeyId(getJsonString(json, "keyId"));
            dto.setRecipientId(getJsonLong(json, "recipientId"));
            dto.setWrappedKey(getJsonString(json, "wrappedKey"));
            dto.setAlgorithm(getJsonEncryptionAlgorithm(json, "algorithm"));
            dto.setExpiresAt(getJsonString(json, "expiresAt"));
            dto.setForwardSecret(getJsonBoolean(json, "forwardSecret"));
            dto.setEphemeralPublicKey(getJsonString(json, "ephemeralPublicKey"));
            dto.setKdfAlgorithm(getJsonString(json, "kdfAlgorithm"));
            dto.setKdfInfo(getJsonString(json, "kdfInfo"));

            return dto;
        } catch (Exception e) {
            throw new RuntimeException("解析密钥包失败: " + e.getMessage());
        }
    }

    /**
     * 转发加密消息给接收者
     */
    private void forwardEncryptedMessage(SaveEncryptedMessageDTO messageDto, Long messageId) {
        // 构建推送消息
        WSBaseReq pushMessage = new WSBaseReq();
        pushMessage.setType(1003); // 加密消息推送类型
        pushMessage.setCreateTime(System.currentTimeMillis());

        // 构建JSON数据
        String jsonData = String.format(
            "{\"type\":\"encrypted_message\",\"conversationId\":\"%s\",\"msgId\":%d,\"from\":%d,\"roomId\":%s,\"content\":{\"keyId\":\"%s\",\"iv\":\"%s\",\"ciphertext\":\"%s\",\"tag\":\"%s\",\"contentType\":\"%s\",\"signature\":\"%s\"}}",
            messageDto.getConversationId(),
            messageId,
            ContextUtil.getUserId(),
            messageDto.getRoomId(),
            messageDto.getKeyId(),
            messageDto.getIv(),
            messageDto.getCiphertext(),
            messageDto.getTag() != null ? messageDto.getTag() : "",
            messageDto.getContentType(),
            messageDto.getSignature() != null ? messageDto.getSignature() : ""
        );
        pushMessage.setData(jsonData);

        // 发送给接收者
        if (messageDto.isGroupMessage()) {
            // 群消息 - 发送给群内其他成员
            sessionManager.broadcastToRoomExcludeSender(
                messageDto.getRoomId(),
                ContextUtil.getUserId(),
                pushMessage
            );
        } else if (messageDto.isPrivateMessage()) {
            // 私聊消息 - 发送给接收者
            sessionManager.sendToUser(messageDto.getRecipientId(), pushMessage);
        }
    }

    /**
     * 发送成功响应
     */
    private void sendSuccessResponse(WebSocketSession session, Long messageId, String message) {
        WSBaseReq response = new WSBaseReq();
        response.setType(1004); // 加密消息响应类型

        String jsonData = String.format(
            "{\"success\":true,\"message\":\"%s\",\"messageId\":%s}",
            message,
            messageId != null ? messageId.toString() : "null"
        );
        response.setData(jsonData);

        try {
            sessionManager.sendMessageToSession(session.getId(), response).subscribe();
        } catch (Exception e) {
            log.error("发送响应失败", e);
        }
    }

    /**
     * 发送错误响应
     */
    private void sendErrorResponse(WebSocketSession session, String error) {
        WSBaseReq response = new WSBaseReq();
        response.setType(1004); // 加密消息响应类型

        String jsonData = String.format(
            "{\"success\":false,\"error\":\"%s\"}",
            error.replace("\"", "\\\"")
        );
        response.setData(jsonData);

        try {
            sessionManager.sendMessageToSession(session.getId(), response).subscribe();
        } catch (Exception e) {
            log.error("发送错误响应失败", e);
        }
    }

    // JSON解析辅助方法
    private String getJsonString(JsonNode json, String key) {
        JsonNode node = json.get(key);
        return node != null && !node.isNull() ? node.asText() : null;
    }

    private Long getJsonLong(JsonNode json, String key) {
        JsonNode node = json.get(key);
        return node != null && !node.isNull() ? node.asLong() : null;
    }

    private Boolean getJsonBoolean(JsonNode json, String key) {
        JsonNode node = json.get(key);
        return node != null && !node.isNull() ? node.asBoolean() : null;
    }

    private com.luohuo.flex.im.domain.enums.EncryptionAlgorithm getJsonEncryptionAlgorithm(
            JsonNode json, String key) {
        String algorithmStr = getJsonString(json, key);
        if (algorithmStr != null) {
            try {
                return com.luohuo.flex.im.domain.enums.EncryptionAlgorithm.of(algorithmStr);
            } catch (Exception e) {
                log.warn("未知的加密算法: {}", algorithmStr);
            }
        }
        return com.luohuo.flex.im.domain.enums.EncryptionAlgorithm.AES_GCM;
    }
}
