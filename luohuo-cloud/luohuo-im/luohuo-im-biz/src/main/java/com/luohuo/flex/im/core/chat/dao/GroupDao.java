package com.luohuo.flex.im.core.chat.dao;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.luohuo.flex.im.domain.entity.Group;
import org.springframework.stereotype.Service;

/**
 * 群组DAO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Service
public class GroupDao extends ServiceImpl<GroupMapper, Group> {

    /**
     * 根据群组ID查询群组信息
     *
     * @param groupId 群组ID
     * @return 群组信息
     */
    public Group selectByGroupId(Long groupId) {
        return lambdaQuery()
                .eq(Group::getId, groupId)
                .one();
    }
}