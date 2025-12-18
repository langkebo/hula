package com.luohuo.flex.im.core.chat.service.cache;

import cn.hutool.core.collection.CollUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.luohuo.flex.im.core.chat.dao.GroupMemberDao;
import com.luohuo.flex.im.core.chat.dao.RoomGroupDao;
import com.luohuo.flex.im.domain.entity.GroupMember;
import com.luohuo.flex.im.domain.entity.RoomGroup;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 群成员相关缓存
 * P1优化: 重构为批量查询模式，解决N+1查询问题 (2025-12-13)
 *
 * 缓存策略：
 * - luohuo:member:all - 群所有成员UID列表
 * - luohuo:member:except - 群成员UID列表（排除屏蔽）
 * - luohuo:member:info - 单个成员详情
 * - luohuo:member:batch - 批量成员详情
 * - luohuo:member:rooms - 用户加入的房间列表
 *
 * @author nyh
 */
@Slf4j
@Component
public class GroupMemberCache {

    @Resource
    private RoomGroupDao roomGroupDao;
    @Resource
    private GroupMemberDao groupMemberDao;

	/**
	 * 群里所有人
	 * @param roomId
	 * @return
	 */
    @Cacheable(cacheNames = "luohuo:member:all", key = "#roomId")
    public List<Long> getMemberUidList(Long roomId) {
        RoomGroup roomGroup = roomGroupDao.getByRoomId(roomId);
        if (Objects.isNull(roomGroup)) {
            return null;
        }
        return groupMemberDao.getMemberUidList(roomGroup.getId(), null);
    }

	/**
	 * 这里不查询屏蔽群的人
	 * @param roomId
	 * @return
	 */
	@Cacheable(cacheNames = "luohuo:member:except", key = "#roomId")
	public List<Long> getMemberExceptUidList(Long roomId) {
		RoomGroup roomGroup = roomGroupDao.getByRoomId(roomId);
		if (Objects.isNull(roomGroup)) {
			return null;
		}
		return groupMemberDao.getMemberUidList(roomGroup.getId(), false);
	}

	/**
	 * 获取指定成员在群中的详细信息
	 * @param roomId 房间id
	 * @param memberUid 成员用户ID
	 * @return 成员详细信息
	 */
	@Cacheable(cacheNames = "luohuo:member:info", key = "#roomId + ':' + #memberUid", unless = "#result == null")
	public GroupMember getMemberDetail(Long roomId, Long memberUid) {
		return groupMemberDao.getMember(roomId, memberUid);
	}

	/**
	 * 批量获取房间所有成员的详细信息
	 * P1优化: 使用批量查询代替单个查询，解决N+1问题 (2025-12-13)
	 *
	 * @param roomId 房间id
	 * @return 房间所有成员列表
	 */
	@Cacheable(cacheNames = "luohuo:member:batch", key = "#roomId")
	public List<GroupMember> getMembersByRoom(Long roomId) {
		RoomGroup roomGroup = roomGroupDao.getByRoomId(roomId);
		if (Objects.isNull(roomGroup)) {
			return new ArrayList<>();
		}
		return groupMemberDao.getBaseMapper().selectList(
			new QueryWrapper<GroupMember>()
				.eq("group_id", roomGroup.getId())
				.orderByAsc("create_time")
		);
	}

	/**
	 * 批量获取指定成员在群中的详细信息
	 * P1优化: 使用批量查询避免N+1问题 (2025-12-13)
	 *
	 * @param roomId 房间id
	 * @param memberUids 成员用户ID列表
	 * @return 成员详细信息列表
	 */
	public List<GroupMember> getMemberDetailsBatch(Long roomId, Collection<Long> memberUids) {
		if (CollUtil.isEmpty(memberUids)) {
			return new ArrayList<>();
		}
		RoomGroup roomGroup = roomGroupDao.getByRoomId(roomId);
		if (Objects.isNull(roomGroup)) {
			return new ArrayList<>();
		}
		return groupMemberDao.getMemberBatch(roomGroup.getId(), memberUids);
	}

	@CacheEvict(cacheNames = "luohuo:member:info", key = "#roomId + ':' + #memberUid")
	public void evictMemberDetail(Long roomId, Long memberUid) {
	}

	@CacheEvict(cacheNames = "luohuo:member:info", allEntries = true)
	public void evictAllMemberDetails() {
		// 清理所有成员详情缓存（慎用）
	}

	@CacheEvict(cacheNames = "luohuo:member:batch", key = "#roomId")
	public void evictMemberBatch(Long roomId) {
		// P1优化: 清理批量成员缓存 (2025-12-13)
	}

	@CacheEvict(cacheNames = "luohuo:member:batch", allEntries = true)
	public void evictAllMemberBatches() {
		// 清理所有批量成员缓存（慎用）
	}

	@CacheEvict(cacheNames = "luohuo:member:except", key = "#roomId")
	public void evictExceptMemberList(Long roomId) {
	}

	@CacheEvict(cacheNames = "luohuo:member:all", key = "#roomId")
	public void evictMemberList(Long roomId) {
	}

	/**
	 * 查询用户加入的群的房间
	 * P1优化: 添加缓存支持 (2025-12-13)
	 *
	 * @param uid 用户id
	 * @return 用户加入的房间ID列表
	 */
	@Cacheable(cacheNames = "luohuo:member:rooms", key = "#uid", unless = "#result == null || #result.isEmpty()")
	public List<Long> getJoinedRoomIds(Long uid) {
		log.debug("查询用户 {} 加入的房间列表", uid);
		List<Long> groupIds = groupMemberDao.getBaseMapper().selectList(
			new QueryWrapper<GroupMember>()
				.eq("uid", uid)
				.eq("de_friend", 0)
		).stream().map(GroupMember::getGroupId).collect(Collectors.toList());

		if(CollUtil.isNotEmpty(groupIds)){
			return roomGroupDao.getRoomIdByGroupId(groupIds);
		}
		return new ArrayList<>();
	}

	/**
	 * 清理用户加入房间的缓存
	 * @param uid 用户id
	 */
	@CacheEvict(cacheNames = "luohuo:member:rooms", key = "#uid")
	public void evictJoinedRoomIds(Long uid) {
		log.debug("清理用户 {} 的房间列表缓存", uid);
	}

	/**
	 * 批量获取多个房间的成员列表
	 * P1优化: 批量查询多个房间的成员，避免循环查询 (2025-12-13)
	 *
	 * @param roomIds 房间ID列表
	 * @return 房间ID到成员列表的映射
	 */
	public Map<Long, List<GroupMember>> getMembersByRoomsBatch(Collection<Long> roomIds) {
		if (CollUtil.isEmpty(roomIds)) {
			return new HashMap<>();
		}

		log.debug("批量查询 {} 个房间的成员列表", roomIds.size());
		Map<Long, List<GroupMember>> result = new HashMap<>();

		// 先尝试从缓存获取
		List<Long> uncachedRoomIds = new ArrayList<>();
		for (Long roomId : roomIds) {
			List<GroupMember> cached = getMembersByRoom(roomId);
			if (cached != null && !cached.isEmpty()) {
				result.put(roomId, cached);
			} else {
				uncachedRoomIds.add(roomId);
			}
		}

		// 批量查询未缓存的房间
		if (!uncachedRoomIds.isEmpty()) {
			// 获取房间对应的群组ID
			List<RoomGroup> roomGroups = roomGroupDao.getBaseMapper().selectList(
				new QueryWrapper<RoomGroup>().in("room_id", uncachedRoomIds)
			);

			if (CollUtil.isNotEmpty(roomGroups)) {
				Map<Long, Long> groupIdToRoomId = roomGroups.stream()
					.collect(Collectors.toMap(RoomGroup::getId, RoomGroup::getRoomId));

				List<Long> groupIds = roomGroups.stream()
					.map(RoomGroup::getId)
					.collect(Collectors.toList());

				// 批量查询所有群组的成员
				List<GroupMember> allMembers = groupMemberDao.getBaseMapper().selectList(
					new QueryWrapper<GroupMember>()
						.in("group_id", groupIds)
						.orderByAsc("create_time")
				);

				// 按群组ID分组
				Map<Long, List<GroupMember>> membersByGroup = allMembers.stream()
					.collect(Collectors.groupingBy(GroupMember::getGroupId));

				// 转换为房间ID映射
				for (Map.Entry<Long, List<GroupMember>> entry : membersByGroup.entrySet()) {
					Long roomId = groupIdToRoomId.get(entry.getKey());
					if (roomId != null) {
						result.put(roomId, entry.getValue());
					}
				}
			}
		}

		log.debug("批量查询完成，返回 {} 个房间的成员列表", result.size());
		return result;
	}

	/**
	 * 批量获取多个房间的成员UID列表
	 * P1优化: 批量查询多个房间的成员UID，避免循环查询 (2025-12-13)
	 *
	 * @param roomIds 房间ID列表
	 * @return 房间ID到成员UID列表的映射
	 */
	public Map<Long, List<Long>> getMemberUidsByRoomsBatch(Collection<Long> roomIds) {
		Map<Long, List<GroupMember>> membersByRooms = getMembersByRoomsBatch(roomIds);
		return membersByRooms.entrySet().stream()
			.collect(Collectors.toMap(
				Map.Entry::getKey,
				entry -> entry.getValue().stream()
					.map(GroupMember::getUid)
					.collect(Collectors.toList())
			));
	}

	/**
	 * 获取成员在多个房间中的角色信息
	 * P1优化: 批量查询用户在多个房间中的角色 (2025-12-13)
	 *
	 * @param uid 用户ID
	 * @param roomIds 房间ID列表
	 * @return 房间ID到成员信息的映射
	 */
	public Map<Long, GroupMember> getMemberRolesInRooms(Long uid, Collection<Long> roomIds) {
		if (uid == null || CollUtil.isEmpty(roomIds)) {
			return new HashMap<>();
		}

		log.debug("查询用户 {} 在 {} 个房间中的角色", uid, roomIds.size());

		// 获取房间对应的群组ID
		List<RoomGroup> roomGroups = roomGroupDao.getBaseMapper().selectList(
			new QueryWrapper<RoomGroup>().in("room_id", roomIds)
		);

		if (CollUtil.isEmpty(roomGroups)) {
			return new HashMap<>();
		}

		Map<Long, Long> groupIdToRoomId = roomGroups.stream()
			.collect(Collectors.toMap(RoomGroup::getId, RoomGroup::getRoomId));

		List<Long> groupIds = roomGroups.stream()
			.map(RoomGroup::getId)
			.collect(Collectors.toList());

		// 批量查询用户在这些群组中的成员信息
		List<GroupMember> members = groupMemberDao.getBaseMapper().selectList(
			new QueryWrapper<GroupMember>()
				.eq("uid", uid)
				.in("group_id", groupIds)
		);

		// 转换为房间ID映射
		Map<Long, GroupMember> result = new HashMap<>();
		for (GroupMember member : members) {
			Long roomId = groupIdToRoomId.get(member.getGroupId());
			if (roomId != null) {
				result.put(roomId, member);
			}
		}

		return result;
	}

	/**
	 * 清理房间相关的所有缓存
	 * P1优化: 统一清理方法，确保缓存一致性 (2025-12-13)
	 *
	 * @param roomId 房间ID
	 */
	@Caching(evict = {
		@CacheEvict(cacheNames = "luohuo:member:all", key = "#roomId"),
		@CacheEvict(cacheNames = "luohuo:member:except", key = "#roomId"),
		@CacheEvict(cacheNames = "luohuo:member:batch", key = "#roomId")
	})
	public void evictAllRoomCaches(Long roomId) {
		log.debug("清理房间 {} 的所有成员缓存", roomId);
	}

	/**
	 * 清理成员变更相关的所有缓存
	 * P1优化: 成员变更时统一清理缓存 (2025-12-13)
	 *
	 * @param roomId 房间ID
	 * @param memberUid 成员UID
	 */
	public void evictMemberChangeCaches(Long roomId, Long memberUid) {
		log.debug("清理房间 {} 成员 {} 变更相关的缓存", roomId, memberUid);
		evictAllRoomCaches(roomId);
		evictMemberDetail(roomId, memberUid);
		evictJoinedRoomIds(memberUid);
	}
}
