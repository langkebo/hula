package com.luohuo.flex.im.core.user.dao;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.luohuo.flex.im.domain.entity.UserBlack;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 用户黑名单DAO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Service
public class UserBlackDao extends ServiceImpl<UserBlackMapper, UserBlack> {

    /**
     * 查询用户的黑名单列表
     *
     * @param userId 用户ID
     * @return 黑名单用户ID列表
     */
    public List<Long> selectBlackUserIds(Long userId) {
        return lambdaQuery()
                .eq(UserBlack::getUserId, userId)
                .list()
                .stream()
                .map(UserBlack::getBlackUserId)
                .toList();
    }

    /**
     * 检查是否在黑名单中
     *
     * @param userId       用户ID
     * @param blackUserId  被检查的用户ID
     * @return 是否在黑名单中
     */
    public boolean isInBlackList(Long userId, Long blackUserId) {
        return lambdaQuery()
                .eq(UserBlack::getUserId, userId)
                .eq(UserBlack::getBlackUserId, blackUserId)
                .exists();
    }

    /**
     * 查询谁屏蔽了指定用户
     *
     * @param userId 用户ID
     * @return 屏蔽该用户的用户ID列表
     */
    public List<Long> selectWhoBlockedUser(Long userId) {
        return lambdaQuery()
                .eq(UserBlack::getBlackUserId, userId)
                .list()
                .stream()
                .map(UserBlack::getUserId)
                .toList();
    }

    /**
     * 查询用户的屏蔽列表
     *
     * @param userId 用户ID
     * @return 被屏蔽的用户ID列表
     */
    public List<Long> selectBlockedList(Long userId) {
        return selectBlackUserIds(userId);
    }
}