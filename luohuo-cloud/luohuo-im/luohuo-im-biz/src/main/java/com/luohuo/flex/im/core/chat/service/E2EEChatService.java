package com.luohuo.flex.im.core.chat.service;

import com.luohuo.flex.im.core.e2ee.service.E2EEMessageService;
import com.luohuo.flex.im.core.e2ee.event.EncryptedChatMessageSendEvent;
import com.luohuo.flex.im.domain.dto.SaveEncryptedMessageDTO;
import com.luohuo.flex.im.domain.entity.Message;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.domain.vo.CursorPageBaseResp;
import com.luohuo.flex.im.domain.vo.request.EncryptedChatMessageReq;
import com.luohuo.flex.im.domain.vo.request.ChatMessageReq;
import com.luohuo.flex.model.entity.ws.ChatMessageResp;
import com.luohuo.flex.im.domain.vo.response.EncryptedMessageListItemVO;
import com.luohuo.flex.im.core.chat.dao.MessageDao;
import com.luohuo.flex.im.core.e2ee.mapper.MessageEncryptedMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 端到端加密聊天服务
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEChatService {

    private final ChatService chatService;
    private final E2EEMessageService e2eeMessageService;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final MessageDao messageDao;
    private final MessageEncryptedMapper messageEncryptedMapper;

    /**
     * 发送加密消息
     *
     * @param request 加密消息请求
     * @param uid     用户ID
     * @return 消息ID
     */
    @Transactional(rollbackFor = Exception.class)
    public Long sendEncryptedMessage(EncryptedChatMessageReq request, Long uid) {
        log.info("发送加密消息，用户: {}, 房间: {}", uid, request.getRoomId());

        // 1. 验证加密消息
        request.validateEncryptedMessage();

        // 2. 保存加密消息
        SaveEncryptedMessageDTO encryptedDto = request.getEncryptedMessage();
        // 设置会话ID（如果没有，则使用房间ID）
        if (encryptedDto.getConversationId() == null || encryptedDto.getConversationId().isEmpty()) {
            encryptedDto.setConversationId("room_" + request.getRoomId());
        }
        // 设置房间ID（如果接收者为空）
        if (encryptedDto.getRecipientId() == null && encryptedDto.getRoomId() == null) {
            encryptedDto.setRoomId(request.getRoomId());
        }

        Long encryptedMsgId = e2eeMessageService.saveEncryptedMessage(encryptedDto);

        // 3. 创建占位的普通消息（用于列表展示和兼容）
        ChatMessageReq normalReq = request.toChatMessageReq();
        normalReq.setBody("[加密消息]");
        Long normalMsgId = chatService.sendMsg(normalReq, uid);

        // 4. 更新普通消息关联的加密消息ID
        updateNormalMessageWithEncryptedId(normalMsgId, encryptedMsgId);

        // 5. 发布加密消息发送事件
        applicationEventPublisher.publishEvent(
            new EncryptedChatMessageSendEvent(this, getEncryptedMessageById(encryptedMsgId))
        );

        log.info("加密消息发送成功，加密消息ID: {}, 普通消息ID: {}", encryptedMsgId, normalMsgId);
        return normalMsgId;
    }

    /**
     * 获取消息响应（处理加密消息）
     *
     * @param msgId      消息ID
     * @param receiveUid 接收者ID
     * @return 消息响应
     */
    public ChatMessageResp getEncryptedMessageResp(Long msgId, Long receiveUid) {
        // 1. 获取普通消息
        ChatMessageResp resp = chatService.getMsgResp(msgId, receiveUid);

        // 2. 检查是否是加密消息
        if (resp != null && resp.getMessage() != null && resp.getMessage().getId() != null) {
            Message message = getMessageById(Long.parseLong(resp.getMessage().getId()));
            if (message != null && Boolean.TRUE.equals(message.getIsEncrypted()) && message.getEncryptedMsgId() != null) {
                // 3. 获取加密消息详情
                MessageEncrypted encryptedMsg = getEncryptedMessageById(message.getEncryptedMsgId());
                if (encryptedMsg != null) {
                    // 4. 设置加密消息标识
                    resp.getMessage().setEncrypted(true);
                    Object encryptedMsgId = encryptedMsg.getId();
                    if (encryptedMsgId instanceof Long) {
                        resp.getMessage().setEncryptedMsgId((Long) encryptedMsgId);
                    }
                    resp.getMessage().setKeyId(encryptedMsg.getKeyId());
                    // 注意：不返回密文，客户端需要单独通过E2EE接口获取
                }
            }
        }

        return resp;
    }

    /**
     * 更新普通消息，关联加密消息ID
     */
    private void updateNormalMessageWithEncryptedId(Long normalMsgId, Long encryptedMsgId) {
        try {
            Message message = getMessageById(normalMsgId);
            if (message != null) {
                message.setIsEncrypted(true);
                message.setEncryptedMsgId(encryptedMsgId);
                updateMessage(message);
                log.debug("更新普通消息 {} 关联加密消息 {}", normalMsgId, encryptedMsgId);
            }
        } catch (Exception e) {
            log.error("更新普通消息关联失败", e);
        }
    }

    // 以下是依赖ChatService的私有方法，需要通过ChatService暴露或者自己实现
    // 为了简化，这里使用伪代码，实际实现时需要根据项目结构调整

    /**
     * 根据ID获取消息
     */
    private Message getMessageById(Long msgId) {
        return messageDao.getById(msgId);
    }

    /**
     * 根据ID获取加密消息
     */
    private MessageEncrypted getEncryptedMessageById(Long encryptedMsgId) {
        return messageEncryptedMapper.selectById(encryptedMsgId);
    }

    /**
     * 更新消息
     */
    private void updateMessage(Message message) {
        messageDao.updateById(message);
    }

    /**
     * 标记消息为已读
     * 委托给E2EEMessageService处理
     *
     * @param msgId  消息ID
     * @param readAt 阅读时间戳（毫秒）
     * @param userId 用户ID
     */
    public void markMessageAsRead(Long msgId, Long readAt, Long userId) {
        log.info("E2EEChatService: 标记消息为已读，消息ID: {}, 用户: {}", msgId, userId);
        e2eeMessageService.markMessageAsRead(msgId, readAt, userId);
    }

    /**
     * 分页获取会话的加密消息
     *
     * @param conversationId 会话ID
     * @param cursor        游标（消息ID）
     * @param limit         每页大小
     * @param userId        用户ID
     * @return 游标分页响应
     */
    public CursorPageBaseResp<EncryptedMessageListItemVO> getMessagesByConversation(
            String conversationId, Long cursor, Integer limit, Long userId) {
        log.info("获取会话加密消息，会话ID: {}, 游标: {}, 限制: {}, 用户: {}", conversationId, cursor, limit, userId);

        // 查询数据（多查询1条用于判断是否有更多）
        List<MessageEncrypted> messages = messageEncryptedMapper.selectOptimizedByConversation(
            conversationId, cursor, limit + 1
        );

        // 判断是否有更多
        boolean hasMore = messages.size() > limit;
        if (hasMore) {
            // 移除最后一条（多查询的）
            messages.remove(messages.size() - 1);
        }

        // 转换为响应VO
        List<EncryptedMessageListItemVO> voList = messages.stream()
            .map(this::convertToEncryptedMessageListItemVO)
            .collect(Collectors.toList());

        // 构建游标分页响应
        CursorPageBaseResp<EncryptedMessageListItemVO> response = new CursorPageBaseResp<>();
        response.setList(voList);
        response.setHasMore(hasMore);
        response.setEmpty(voList.isEmpty());
        response.setSize(limit);

        // 设置下一页游标（如果有更多数据）
        if (hasMore && !messages.isEmpty()) {
            Object id = messages.get(messages.size() - 1).getId();
            if (id instanceof Long) {
                response.setCursor((Long) id);
            }
        }

        log.info("查询完成，返回 {} 条消息，是否有更多: {}", voList.size(), hasMore);
        return response;
    }

    /**
     * 转换加密消息为列表项VO（轻量）
     *
     * @param message 加密消息实体
     * @return 列表项VO
     */
    private EncryptedMessageListItemVO convertToEncryptedMessageListItemVO(MessageEncrypted message) {
        EncryptedMessageListItemVO resp = new EncryptedMessageListItemVO();

        // 基础信息
        Object id = message.getId();
        if (id instanceof Long) {
            resp.setId((Long) id);
        }
        resp.setConversationId(message.getConversationId());
        resp.setSenderId(message.getSenderId());
        resp.setRecipientId(message.getRecipientId());
        resp.setRoomId(message.getRoomId());

        // 加密信息
        resp.setKeyId(message.getKeyId());
        resp.setAlgorithm(message.getAlgorithm() != null ? message.getAlgorithm().name() : null);
        resp.setContentType(message.getContentType());

        // 元数据
        resp.setMessageSize(message.getMessageSize());
        resp.setIsSigned(message.getIsSigned());
        resp.setVerificationStatus(message.getVerificationStatus());

        // 时间信息
        resp.setCreateTime(message.getCreateTime());
        resp.setReadAt(message.getReadAt());
        resp.setDestructAt(message.getDestructAt());

        // 自毁信息
        resp.setSelfDestructTimer(message.getSelfDestructTimer());
        resp.setIsDestroyed(Boolean.TRUE.equals(message.getIsDel()) || message.getDestructAt() != null
            && message.getDestructAt().isBefore(LocalDateTime.now()));

        // 设置消息类型标识
        resp.setMessageTypeFlags(message.getContentType());

        return resp;
    }

    /**
     * 构建加密消息响应
     * 用于MQ消费者推送加密消息
     */
    public com.luohuo.flex.im.domain.vo.response.EncryptedChatMessageResp buildEncryptedMsgResp(MessageEncrypted message) {
        com.luohuo.flex.im.domain.vo.response.EncryptedChatMessageResp resp = new com.luohuo.flex.im.domain.vo.response.EncryptedChatMessageResp();

        // 设置基础信息
        Object id = message.getId();
        if (id instanceof Long) {
            resp.setId((Long) id);
        }
        resp.setMsgId(message.getMsgId());
        resp.setConversationId(message.getConversationId());
        resp.setSenderId(message.getSenderId());
        resp.setRecipientId(message.getRecipientId());
        resp.setRoomId(message.getRoomId());

        // 设置加密数据
        resp.setKeyId(message.getKeyId());
        resp.setAlgorithm(message.getAlgorithm().name());
        resp.setCiphertext(java.util.Base64.getEncoder().encodeToString(message.getCiphertext()));
        resp.setIv(java.util.Base64.getEncoder().encodeToString(message.getIv()));

        if (message.getTag() != null) {
            resp.setTag(java.util.Base64.getEncoder().encodeToString(message.getTag()));
        }

        if (message.getSignature() != null) {
            resp.setSignature(java.util.Base64.getEncoder().encodeToString(message.getSignature()));
            resp.setIsSigned(true);
        } else {
            resp.setIsSigned(false);
        }

        // 设置元数据
        resp.setContentType(message.getContentType());
        resp.setEncryptedExtra(message.getEncryptedExtra());
        resp.setMessageSize(message.getMessageSize());
        resp.setCreateTime(message.getCreateTime());

        return resp;
    }
}
