package com.luohuo.flex.im.common.event.listener;

import com.luohuo.flex.common.OnlineService;
import com.luohuo.flex.im.common.event.GroupMemberAddEvent;
import com.luohuo.flex.im.core.chat.dao.GroupMemberDao;
import com.luohuo.flex.im.core.chat.dao.GroupDao;
import com.luohuo.flex.im.core.chat.service.adapter.MemberAdapter;
import com.luohuo.flex.im.core.chat.service.cache.GroupMemberCache;
import com.luohuo.flex.im.domain.entity.User;
import com.luohuo.flex.im.domain.entity.Group;
import com.luohuo.flex.im.core.user.service.cache.UserCache;
import com.luohuo.flex.im.core.user.dao.UserBlackDao;
import com.luohuo.flex.im.core.user.service.impl.PushService;
import com.luohuo.flex.model.entity.ws.ChatMember;
import com.luohuo.flex.model.entity.WsBaseResp;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.util.CollectionUtils;
import java.util.*;
import java.util.stream.Collectors;

import static com.luohuo.flex.im.common.config.ThreadPoolConfig.LUOHUO_EXECUTOR;

/**
 * 添加群成员监听器
 *
 * @author nyh
 */
@Slf4j
@Component
@AllArgsConstructor
public class GroupMemberAddListener {

    private UserCache userCache;
	private GroupMemberDao groupMemberDao;
    private GroupMemberCache groupMemberCache;
	private OnlineService onlineService;
    private PushService pushService;
	private GroupDao groupDao;
	private UserBlackDao userBlackDao;

	/**
	 * 群成员变动推送逻辑
	 * 包含屏蔽群成员、所有群成员的处理
	 * @param event
	 */
    @Async(LUOHUO_EXECUTOR)
    @TransactionalEventListener(classes = GroupMemberAddEvent.class, fallbackExecution = true, phase = TransactionPhase.AFTER_COMMIT)
    public void sendChangePush(GroupMemberAddEvent event) {
        Long roomId = event.getRoomId();

        try {
            // 1. 获取群组信息
            Group group = groupDao.selectByGroupId(roomId);
            if (group == null) {
                log.error("群组不存在: {}", roomId);
                return;
            }

            // 2. 获取所有群成员（不包括新加入的成员）
            List<Long> memberUidList = groupMemberCache.getMemberExceptUidList(roomId);

            // 3. 检查并过滤被屏蔽的成员
            List<Long> filteredMemberList = filterBlockedMembers(memberUidList, event.getMemberList());

            // 4. 获取在线用户
            List<Long> onlineUids = onlineService.getGroupOnlineMembers(roomId);

            // 5. 获取新加入成员的用户信息
            Map<Long, User> newMembersMap = userCache.getBatch(event.getMemberList());

            // 6. 获取新成员的详细信息
            List<ChatMember> memberResps = groupMemberDao.getMemberListByUid(event.getMemberList());

            // 7. 构建推送消息
            WsBaseResp<?> pushMessage = MemberAdapter.buildMemberAddWS(
                roomId,
                event.getTotalNum(),
                onlineUids,
                memberResps,
                newMembersMap
            );

            // 8. 分别推送消息
            // 8.1 推送给现有成员（已过滤屏蔽用户）
            if (!CollectionUtils.isEmpty(filteredMemberList)) {
                pushService.sendPushMsg(pushMessage, filteredMemberList, event.getUid());
                log.info("群成员加入通知已推送给现有成员，群ID: {}, 接收者数: {}", roomId, filteredMemberList.size());
            }

            // 8.2 推送给新加入的成员（群成员列表）
            if (!CollectionUtils.isEmpty(event.getMemberList())) {
                // 获取完整群成员列表（包括新加入的）
                List<Long> allMemberUids = groupMemberCache.getMemberUidList(roomId);
                Map<Long, User> allMembersMap = userCache.getBatch(allMemberUids);
                List<ChatMember> allMemberResps = groupMemberDao.getMemberListByUid(allMemberUids);

                // 构建新成员的欢迎消息（复用成员添加消息）
                WsBaseResp<?> welcomeMessage = MemberAdapter.buildMemberAddWS(
                    roomId,
                    allMemberResps.size(),
                    onlineUids,
                    allMemberResps,
                    allMembersMap
                );

                pushService.sendPushMsg(welcomeMessage, event.getMemberList(), null);
                log.info("群欢迎信息已推送给新成员，群ID: {}, 新成员数: {}", roomId, event.getMemberList().size());
            }

            // 9. 更新缓存
            groupMemberCache.evictMemberList(roomId);
            groupMemberCache.evictExceptMemberList(roomId);

            // 10. 记录操作日志
            log.info("群成员变动处理完成，群ID: {}, 新增成员数: {}, 现有成员数: {}, 在线数: {}",
                roomId, event.getMemberList().size(), memberUidList.size(), onlineUids.size());

        } catch (Exception e) {
            log.error("处理群成员加入事件失败，群ID: {}", roomId, e);
        }
    }

    /**
     * 过滤被屏蔽的成员
     * @param existingMembers 现有成员列表
     * @param newMembers 新加入成员列表
     * @return 过滤后的成员列表
     */
    private List<Long> filterBlockedMembers(List<Long> existingMembers, List<Long> newMembers) {
        if (CollectionUtils.isEmpty(existingMembers)) {
            return existingMembers;
        }

        try {
            // 1. 获取所有相关的屏蔽关系
            Set<Long> blockedUsers = new HashSet<>();

            // 检查新成员是否被现有成员屏蔽
            for (Long newMember : newMembers) {
                List<Long> blockers = userBlackDao.selectWhoBlockedUser(newMember);
                blockedUsers.addAll(blockers);
            }

            // 检查现有成员是否屏蔽了新成员
            for (Long existingMember : existingMembers) {
                List<Long> blockedByExisting = userBlackDao.selectBlockedList(existingMember);
                if (blockedByExisting.stream().anyMatch(newMembers::contains)) {
                    blockedUsers.add(existingMember);
                }
            }

            // 2. 过滤掉被屏蔽的用户
            List<Long> filteredList = existingMembers.stream()
                .filter(member -> !blockedUsers.contains(member))
                .collect(Collectors.toList());

            log.debug("成员过滤完成，原始数: {}, 屏蔽数: {}, 剩余数: {}",
                existingMembers.size(), blockedUsers.size(), filteredList.size());

            return filteredList;

        } catch (Exception e) {
            log.error("过滤屏蔽成员时发生错误", e);
            // 出错时返回原列表，避免影响正常流程
            return existingMembers;
        }
    }

}
