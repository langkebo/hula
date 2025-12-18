package com.luohuo.flex.im.core.chat.dao;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.luohuo.flex.im.common.enums.NormalOrNoEnum;
import com.luohuo.flex.im.domain.entity.RoomFriend;
import com.luohuo.flex.im.core.chat.mapper.RoomFriendMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * <p>
 * 单聊房间表 服务实现类
 * </p>
 *
 * @author nyh
 */
@Service
public class RoomFriendDao extends ServiceImpl<RoomFriendMapper, RoomFriend> {

    public RoomFriend getByKey(String key) {
        return lambdaQuery().eq(RoomFriend::getRoomKey, key).one();
    }

    public void restoreRoom(Long id) {
        lambdaUpdate()
                .eq(RoomFriend::getId, id)
				.set(RoomFriend::getDeFriend1, NormalOrNoEnum.NORMAL.getStatus())
				.set(RoomFriend::getDeFriend2, NormalOrNoEnum.NORMAL.getStatus())
                .update();
    }

    public void disableRoom(String key) {
        lambdaUpdate()
                .eq(RoomFriend::getRoomKey, key)
				.set(RoomFriend::getDeFriend1, NormalOrNoEnum.NOT_NORMAL.getStatus())
				.set(RoomFriend::getDeFriend2, NormalOrNoEnum.NOT_NORMAL.getStatus())
                .update();
    }

    public List<RoomFriend> listByRoomIds(List<Long> roomIds) {
        return lambdaQuery()
                .in(RoomFriend::getRoomId, roomIds)
                .list();
    }

    public RoomFriend getByRoomId(Long roomID) {
        return lambdaQuery()
                .eq(RoomFriend::getRoomId, roomID)
                .one();
    }

	public void updateState(Long uid1, Long uid2) {
		update(new UpdateWrapper<RoomFriend>().and(w -> w
						.eq("uid1", uid1)
						.eq("uid2", uid2)
				)
				.or(w -> w
						.eq("uid1", uid2)
						.eq("uid2", uid1)
				).set("state", 1));
	}

	/**
	 * 根据两个用户ID获取单聊房间
	 * 用于E2EE消息路由
	 */
	public RoomFriend getByKey(Long uid1, Long uid2) {
		return lambdaQuery()
				.and(w -> w
						.eq(RoomFriend::getUid1, uid1)
						.eq(RoomFriend::getUid2, uid2)
				)
				.or(w -> w
						.eq(RoomFriend::getUid1, uid2)
						.eq(RoomFriend::getUid2, uid1)
				)
				.one();
	}
}
