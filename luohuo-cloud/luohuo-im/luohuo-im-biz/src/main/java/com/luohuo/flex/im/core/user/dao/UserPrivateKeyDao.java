package com.luohuo.flex.im.core.user.dao;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.luohuo.flex.im.domain.entity.UserPrivateKey;
import org.springframework.stereotype.Service;

/**
 * 用户私钥DAO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Service
public class UserPrivateKeyDao extends ServiceImpl<UserPrivateKeyMapper, UserPrivateKey> {

    /**
     * 根据用户ID查询私钥
     *
     * @param userId 用户ID
     * @return 用户私钥
     */
    public UserPrivateKey selectByUserId(Long userId) {
        return lambdaQuery()
                .eq(UserPrivateKey::getUserId, userId)
                .one();
    }

    /**
     * 批量查询用户私钥
     *
     * @param userIds 用户ID列表
     * @return 用户私钥列表
     */
    public java.util.List<UserPrivateKey> selectByUserIds(java.util.List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        return lambdaQuery()
                .in(UserPrivateKey::getUserId, userIds)
                .list();
    }
}