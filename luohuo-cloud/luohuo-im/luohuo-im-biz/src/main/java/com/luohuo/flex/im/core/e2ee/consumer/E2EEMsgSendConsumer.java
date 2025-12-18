package com.luohuo.flex.im.core.e2ee.consumer;

import com.luohuo.basic.cache.repository.CachePlusOps;
import com.luohuo.flex.common.OnlineService;
import com.luohuo.flex.common.cache.PassageMsgCacheKeyBuilder;
import com.luohuo.flex.common.constant.MqConstant;
import com.luohuo.flex.im.core.chat.dao.RoomDao;
import com.luohuo.flex.im.core.chat.dao.RoomFriendDao;
import com.luohuo.flex.im.core.chat.service.cache.GroupMemberCache;
import com.luohuo.flex.im.core.chat.service.cache.RoomCache;
import com.luohuo.flex.im.core.e2ee.mapper.MessageEncryptedMapper;
import com.luohuo.flex.im.core.chat.service.E2EEChatService;
import com.luohuo.flex.im.core.user.service.adapter.WsAdapter;
import com.luohuo.flex.im.core.user.service.impl.PushService;
import com.luohuo.flex.im.domain.dto.E2EEMsgSendDTO;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.domain.entity.Room;
import com.luohuo.flex.im.domain.entity.RoomFriend;
import com.luohuo.flex.im.domain.enums.RoomTypeEnum;
import com.luohuo.flex.im.domain.vo.response.EncryptedChatMessageResp;
import com.luohuo.flex.model.entity.WsBaseResp;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.spring.annotation.MessageModel;
import org.apache.rocketmq.spring.annotation.RocketMQMessageListener;
import org.apache.rocketmq.spring.core.RocketMQListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * E2EE加密消息发送消费者
 *
 * 功能：
 * 1. 从RocketMQ接收加密消息
 * 2. 更新房间收信箱
 * 3. 推送消息给房间成员
 * 4. 管理在途消息缓存
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@RocketMQMessageListener(
        consumerGroup = MqConstant.E2EE_MSG_SEND_GROUP,
        topic = MqConstant.E2EE_MSG_SEND_TOPIC,
        messageModel = MessageModel.CLUSTERING
)
@Component
@AllArgsConstructor
public class E2EEMsgSendConsumer implements RocketMQListener<E2EEMsgSendDTO> {

    private final MessageEncryptedMapper messageEncryptedMapper;
    private final RoomCache roomCache;
    private final RoomDao roomDao;
    private final GroupMemberCache groupMemberCache;
    private final RoomFriendDao roomFriendDao;
    private final OnlineService onlineService;
    private final PushService pushService;
    private final CachePlusOps cachePlusOps;
    private final E2EEChatService e2eeChatService;

    @Override
    public void onMessage(E2EEMsgSendDTO dto) {
        log.info("接收E2EE加密消息，消息ID: {}, 会话ID: {}", dto.getMessageId(), dto.getConversationId());

        // 1. 查询加密消息
        MessageEncrypted message = messageEncryptedMapper.selectById(dto.getMessageId());
        if (Objects.isNull(message)) {
            log.warn("E2EE加密消息不存在，消息ID: {}", dto.getMessageId());
            return;
        }

        // 2. 确定目标房间
        Long roomId = dto.getRoomId();
        if (roomId == null && dto.getRecipientId() != null) {
            // 单聊场景，从RoomFriend获取roomId
            RoomFriend roomFriend = roomFriendDao.getByKey(dto.getSenderId(), dto.getRecipientId());
            if (roomFriend != null) {
                roomId = roomFriend.getRoomId();
            }
        }

        if (roomId == null) {
            log.warn("无法确定房间ID，消息ID: {}", dto.getMessageId());
            return;
        }

        Room room = roomCache.get(roomId);
        if (room == null) {
            log.warn("房间不存在，roomId: {}", roomId);
            return;
        }

        // 3. 更新房间最新消息（使用消息ID作为时间戳）
        roomDao.refreshActiveTime(room.getId(), dto.getMessageId(), message.getCreateTime());
        roomCache.refresh(room.getId());

        // 4. 确定接收者列表
        List<Long> memberUidList = new ArrayList<>();
        if (Objects.equals(room.getType(), RoomTypeEnum.GROUP.getType())) {
            // 群聊：排除发送者的所有成员
            memberUidList = groupMemberCache.getMemberExceptUidList(room.getId());
        } else if (Objects.equals(room.getType(), RoomTypeEnum.FRIEND.getType())) {
            // 单聊：仅接收者
            RoomFriend roomFriend = roomFriendDao.getByRoomId(room.getId());
            if (roomFriend != null) {
                memberUidList.add(roomFriend.getUid1());
                memberUidList.add(roomFriend.getUid2());
                // 移除发送者
                memberUidList.remove(dto.getSenderId());
            }
        }

        if (memberUidList.isEmpty()) {
            log.debug("没有需要推送的成员，消息ID: {}", dto.getMessageId());
            return;
        }

        // 5. 过滤在线用户
        Set<Long> onlineUsersList = onlineService.getOnlineUsersList(memberUidList);
        if (onlineUsersList.isEmpty()) {
            log.debug("没有在线用户，消息ID: {}", dto.getMessageId());
            return;
        }

        // 6. 构建E2EE消息响应
        EncryptedChatMessageResp msgResp = e2eeChatService.buildEncryptedMsgResp(message);
        WsBaseResp<EncryptedChatMessageResp> wsBaseResp = WsAdapter.buildEncryptedMsgSend(msgResp);

        // 7. 推送消息给在线用户
        pushService.sendPushMsg(wsBaseResp, new ArrayList<>(onlineUsersList), dto.getSenderId());

        // 8. 异步保存在途消息
        asyncSavePassageMsg(dto.getMessageId(), wsBaseResp, onlineUsersList, dto.getSenderId());

        log.info("E2EE加密消息推送完成，消息ID: {}, 推送人数: {}", dto.getMessageId(), onlineUsersList.size());
    }

    /**
     * 异步保存在途消息
     * 用于消息重试机制
     */
    @Async
    public void asyncSavePassageMsg(Long messageId, WsBaseResp<?> wsBaseResp, Set<Long> memberUidList, Long senderId) {
        // 1. 发送重试消息
        pushService.sendPushMsgWithRetry(wsBaseResp, new ArrayList<>(memberUidList), messageId, senderId);

        // 2. 给每个成员添加在途消息标记
        memberUidList.forEach(memberUid -> {
            cachePlusOps.sAdd(PassageMsgCacheKeyBuilder.build(memberUid), messageId);
        });
    }
}
