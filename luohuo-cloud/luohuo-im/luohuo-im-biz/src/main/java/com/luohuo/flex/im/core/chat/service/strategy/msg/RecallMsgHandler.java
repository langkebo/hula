package com.luohuo.flex.im.core.chat.service.strategy.msg;

import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.utils.SpringUtils;
import com.luohuo.basic.utils.TimeUtils;
import com.luohuo.flex.im.core.chat.service.cache.GroupMemberCache;
import com.luohuo.flex.im.core.chat.service.cache.MsgCache;
import com.luohuo.flex.im.core.chat.service.cache.RoomCache;
import com.luohuo.flex.im.core.user.service.cache.UserSummaryCache;
import lombok.extern.slf4j.Slf4j;
import com.luohuo.flex.im.domain.dto.SummeryInfoDTO;
import com.luohuo.flex.im.domain.entity.GroupMember;
import com.luohuo.flex.im.domain.entity.Room;
import com.luohuo.flex.im.domain.enums.GroupRoleEnum;
import com.luohuo.flex.im.domain.enums.RoomTypeEnum;
import com.luohuo.flex.im.vo.result.tenant.MsgRecallVo;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Component;
import com.luohuo.flex.im.common.event.MessageRecallEvent;
import com.luohuo.flex.im.core.chat.dao.MessageDao;
import com.luohuo.flex.model.entity.dto.ChatMsgRecallDTO;
import com.luohuo.flex.im.domain.entity.Message;
import com.luohuo.flex.im.domain.entity.msg.MessageExtra;
import com.luohuo.flex.im.domain.vo.response.msg.MsgRecallDTO;
import com.luohuo.flex.im.domain.enums.MessageTypeEnum;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * 撤回文本消息
 * @author nyh
 */
@Slf4j
@Component
@AllArgsConstructor
public class RecallMsgHandler extends AbstractMsgHandler<Object> {

	private RoomCache roomCache;
	private MessageDao messageDao;
	private UserSummaryCache userSummaryCache;
	private GroupMemberCache groupMemberCache;
	private MsgCache msgCache;

	@Override
	MessageTypeEnum getMsgTypeEnum() {
		return MessageTypeEnum.RECALL;
	}

	@Override
	public void saveMsg(Message msg, Object body) {
		throw new UnsupportedOperationException();
	}

	@Override
	public Object showMsg(Message msg) {
		MsgRecallDTO recall = msg.getExtra().getRecall();
		Long recallerUid = recall.getRecallUid();
		Long senderUid = msg.getFromUid();
		Long currentUserUid = ContextUtil.getUid();

		String roleName = "";
		Room room = roomCache.get(msg.getRoomId());
		if(room.getType().equals(RoomTypeEnum.GROUP.getType())){
			GroupMember recallerMember = groupMemberCache.getMemberDetail(msg.getRoomId(), recallerUid);
			roleName = GroupRoleEnum.get(recallerMember.getRoleId());
		}

		// 获取撤回者的群成员信息和用户信息
		SummeryInfoDTO recallerUserInfo = userSummaryCache.get(recallerUid);

		// 获取被撤回消息发送者的用户信息（用于显示成员名称）
		SummeryInfoDTO senderUserInfo = userSummaryCache.get(senderUid);

		// 判断关键关系
		boolean isRecallerCurrentUser = Objects.equals(recallerUid, currentUserUid);
		boolean isSenderCurrentUser = Objects.equals(senderUid, currentUserUid);


		String messageText;

		if (isRecallerCurrentUser) {
			// 当前用户是撤回操作执行者
			if (Objects.equals(recallerUid, senderUid)) {
				// 撤回自己的消息：自己视角
				messageText = "你撤回了一条消息";
			} else {
				// 撤回他人的消息：群主/管理员视角
				messageText = "你撤回了成员" + senderUserInfo.getName() + "的一条消息";
			}
		} else {
			// 当前用户不是撤回操作执行者
			if (isSenderCurrentUser) {
				// 当前用户是被撤回消息的发送者（被撤回者视角）
				messageText = roleName + recallerUserInfo.getName() + "撤回了你的一条消息";
			} else {
				// 当前用户是旁观者（其他成员视角）
				messageText = roleName + recallerUserInfo.getName() + "撤回了一条消息";
			}
		}

		return new MsgRecallVo(messageText);
	}

	@Override
	public Object showReplyMsg(Message msg) {
		return "原消息已被撤回";
	}

	/**
	 * 撤回消息
	 * P1优化: 使用版本号解决消息覆盖问题 (2025-12-13)
	 *
	 * 通过乐观锁机制确保并发撤回时不会发生消息覆盖：
	 * 1. 获取当前消息的版本号
	 * 2. 更新时携带版本号条件
	 * 3. 如果版本号不匹配，说明消息已被其他操作修改，需要重试
	 *
	 * @param recallUid 撤回操作的用户ID
	 * @param uidList 需要通知的用户列表
	 * @param message 要撤回的消息
	 */
	public void recall(Long recallUid, List<Long> uidList, Message message) {
		// 最大重试次数
		final int MAX_RETRY = 3;
		int retryCount = 0;
		boolean success = false;

		while (!success && retryCount < MAX_RETRY) {
			try {
				// 1. 重新获取最新的消息（包含最新版本号）
				Message latestMessage = messageDao.getById(message.getId());
				if (latestMessage == null) {
					throw new RuntimeException("消息不存在: " + message.getId());
				}

				// 2. 检查消息是否已经被撤回
				if (MessageTypeEnum.RECALL.getType().equals(latestMessage.getType())) {
					// 消息已被撤回，无需重复操作
					return;
				}

				// 3. 构建撤回信息
				MessageExtra extra = latestMessage.getExtra();
				if (extra == null) {
					extra = new MessageExtra();
				}
				extra.setRecall(new MsgRecallDTO(recallUid, TimeUtils.getTime(LocalDateTime.now())));

				// 4. 构建更新对象（携带版本号）
				Message update = new Message();
				update.setId(latestMessage.getId());
				update.setType(MessageTypeEnum.RECALL.getType());
				update.setExtra(extra);
				update.setVersion(latestMessage.getVersion()); // 设置当前版本号

				// 5. 执行更新（MyBatis-Plus会自动处理版本号）
				boolean updated = messageDao.updateById(update);

				if (updated) {
					success = true;

					// 6. 清除消息缓存，确保撤回后立即生效
					try {
						msgCache.delete(message.getId());
						// 同时需要清除所有引用此消息作为回复的消息缓存
						// TODO: 这里可以优化为批量清除，但目前先保证功能正确性
					} catch (Exception e) {
						// 缓存清除失败不应该影响撤回操作，仅记录日志
						log.error("清除撤回消息缓存失败: messageId={}, error={}", message.getId(), e.getMessage(), e);
					}

					// 7. 发布撤回事件
					SpringUtils.publishEvent(new MessageRecallEvent(this, uidList,
						new ChatMsgRecallDTO(message.getId(), message.getRoomId(), recallUid)));
				} else {
					// 更新失败，可能是版本号冲突，重试
					retryCount++;
					if (retryCount < MAX_RETRY) {
						// 短暂等待后重试
						Thread.sleep(50 * retryCount);
					}
				}
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				throw new RuntimeException("撤回消息被中断", e);
			} catch (Exception e) {
				retryCount++;
				if (retryCount >= MAX_RETRY) {
					throw new RuntimeException("撤回消息失败，已重试" + MAX_RETRY + "次: " + e.getMessage(), e);
				}
			}
		}

		if (!success) {
			throw new RuntimeException("撤回消息失败，版本冲突次数过多");
		}
	}

	@Override
	public String showContactMsg(Message msg) {
		return "撤回了一条消息";
//		return ((MsgRecallVo) showMsg(msg)).getContent();
	}
}
