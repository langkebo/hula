package com.luohuo.flex.im.core.e2ee.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.luohuo.flex.im.domain.entity.SessionKeyPackage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 会话密钥包Mapper接口
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Mapper
public interface SessionKeyPackageMapper extends BaseMapper<SessionKeyPackage> {

    /**
     * 根据会话ID和接收者ID查询激活的密钥包
     *
     * @param sessionId   会话ID
     * @param recipientId 接收者ID
     * @return 密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE session_id = #{sessionId} AND recipient_id = #{recipientId} " +
            "AND status = 1 AND is_del = 0 ORDER BY created_at DESC")
    List<SessionKeyPackage> selectActiveBySessionAndRecipient(@Param("sessionId") String sessionId,
                                                              @Param("recipientId") Long recipientId);

    /**
     * 根据会话ID和密钥ID查询密钥包
     *
     * @param sessionId 会话ID
     * @param keyId     密钥ID
     * @return 密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE session_id = #{sessionId} AND key_id = #{keyId} AND is_del = 0")
    List<SessionKeyPackage> selectBySessionAndKey(@Param("sessionId") String sessionId,
                                                  @Param("keyId") String keyId);

    /**
     * 查询接收者待处理的密钥包
     *
     * @param recipientId 接收者ID
     * @return 密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE recipient_id = #{recipientId} AND status = 3 AND is_del = 0 ORDER BY created_at")
    List<SessionKeyPackage> selectPendingByRecipientId(@Param("recipientId") Long recipientId);

    /**
     * 查询接收者所有激活的密钥包
     *
     * @param recipientId 接收者ID
     * @return 密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE recipient_id = #{recipientId} AND status = 1 AND is_del = 0 ORDER BY created_at DESC")
    List<SessionKeyPackage> selectActiveByRecipientId(@Param("recipientId") Long recipientId);

    /**
     * 根据会话ID查询所有密钥包
     *
     * @param sessionId 会话ID
     * @return 密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE session_id = #{sessionId} AND is_del = 0 ORDER BY created_at DESC")
    List<SessionKeyPackage> selectBySessionId(@Param("sessionId") String sessionId);

    /**
     * 查询过期的密钥包
     *
     * @param now 当前时间
     * @return 过期密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE expires_at < #{now} AND status = 1 AND is_del = 0")
    List<SessionKeyPackage> selectExpiredKeys(@Param("now") LocalDateTime now);

    /**
     * 批量标记密钥包为已过期
     *
     * @param ids 密钥包ID列表
     * @return 影响行数
     */
    @Update("<script>" +
            "UPDATE im_session_key_packages SET status = -1 WHERE id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>" +
            "#{id}" +
            "</foreach>" +
            "</script>")
    int batchMarkAsExpired(@Param("ids") List<Long> ids);

    /**
     * 撤销会话的所有旧密钥
     *
     * @param sessionId   会话ID
     * @param excludeKeyId 排除的密钥ID
     * @return 影响行数
     */
    @Update("UPDATE im_session_key_packages SET status = 0 WHERE session_id = #{sessionId} AND key_id != #{excludeKeyId} AND status = 1 AND is_del = 0")
    int revokeOldKeys(@Param("sessionId") String sessionId, @Param("excludeKeyId") String excludeKeyId);

    /**
     * 根据发送者ID查询密钥包
     *
     * @param senderId 发送者ID
     * @param limit    限制条数
     * @return 密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE sender_id = #{senderId} AND is_del = 0 ORDER BY created_at DESC LIMIT #{limit}")
    List<SessionKeyPackage> selectBySenderId(@Param("senderId") Long senderId, @Param("limit") Integer limit);

    /**
     * 查询指定时间内未使用的密钥包
     *
     * @param before 时间点
     * @param limit  限制条数
     * @return 密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE (used_at IS NULL OR used_at < #{before}) AND status = 1 AND is_del = 0 ORDER BY created_at DESC LIMIT #{limit}")
    List<SessionKeyPackage> selectUnusedKeys(@Param("before") LocalDateTime before, @Param("limit") Integer limit);

    /**
     * 标记密钥包为已使用
     *
     * @param id      密钥包ID
     * @param usedAt  使用时间
     * @return 影响行数
     */
    @Update("UPDATE im_session_key_packages SET status = 2, used_at = #{usedAt} WHERE id = #{id}")
    int markAsUsed(@Param("id") Long id, @Param("usedAt") LocalDateTime usedAt);

    /**
     * 查询支持前向安全的密钥包
     *
     * @param sessionId   会话ID
     * @param recipientId 接收者ID
     * @return 密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE session_id = #{sessionId} AND recipient_id = #{recipientId} " +
            "AND forward_secret = 1 AND status = 1 AND is_del = 0 ORDER BY created_at DESC")
    List<SessionKeyPackage> selectForwardSecureKeys(@Param("sessionId") String sessionId,
                                                    @Param("recipientId") Long recipientId);

    /**
     * 统计会话的密钥轮换次数
     *
     * @param sessionId 会话ID
     * @return 轮换次数
     */
    @Select("SELECT MAX(rotation_count) FROM im_session_key_packages WHERE session_id = #{sessionId} AND is_del = 0")
    Integer getMaxRotationCount(@Param("sessionId") String sessionId);

    /**
     * 清理过期的密钥包
     *
     * @param expireTime 过期时间
     * @param limit      限制条数
     * @return 影响行数
     */
    @Update("UPDATE im_session_key_packages SET status = -1 WHERE expires_at < #{expireTime} AND status != -1 AND is_del = 0 LIMIT #{limit}")
    int cleanupExpiredKeys(@Param("expireTime") LocalDateTime expireTime, @Param("limit") Integer limit);

    /**
     * 根据密钥ID和接收者查询密钥包
     *
     * @param keyId       密钥ID
     * @param recipientId 接收者ID
     * @return 密钥包
     */
    @Select("SELECT * FROM im_session_key_packages WHERE key_id = #{keyId} AND recipient_id = #{recipientId} AND is_del = 0 LIMIT 1")
    SessionKeyPackage selectByKeyAndRecipient(@Param("keyId") String keyId, @Param("recipientId") Long recipientId);

    /**
     * 查询即将过期的密钥包（用于密钥轮换）
     *
     * @param rotationThreshold 轮换阈值时间
     * @return 即将过期的密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE expires_at < #{rotationThreshold} AND expires_at > NOW() AND status = 1 AND is_del = 0 ORDER BY expires_at ASC")
    List<SessionKeyPackage> selectExpiringKeys(@Param("rotationThreshold") LocalDateTime rotationThreshold);

    /**
     * 查询指定时间之前已废弃的密钥包
     *
     * @param cutoffTime 截止时间
     * @return 已废弃的密钥包列表
     */
    @Select("SELECT * FROM im_session_key_packages WHERE status = 4 AND updated_at < #{cutoffTime} AND is_del = 0")
    List<SessionKeyPackage> selectRevokedKeysBeforeTime(@Param("cutoffTime") LocalDateTime cutoffTime);

    /**
     * 批量删除密钥包
     *
     * @param ids 密钥包ID列表
     * @return 影响行数
     */
    @Update("<script>" +
            "UPDATE im_session_key_packages SET is_del = 1 WHERE id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>" +
            "#{id}" +
            "</foreach>" +
            "</script>")
    int batchDeleteByIds(@Param("ids") List<Long> ids);

    /**
     * 统计即将过期的密钥数量
     *
     * @param rotationThreshold 轮换阈值时间
     * @return 密钥数量
     */
    @Select("SELECT COUNT(*) FROM im_session_key_packages WHERE expires_at < #{rotationThreshold} AND expires_at > NOW() AND status = 1 AND is_del = 0")
    int countExpiringKeys(@Param("rotationThreshold") LocalDateTime rotationThreshold);

    /**
     * 统计已废弃的密钥数量
     *
     * @return 密钥数量
     */
    @Select("SELECT COUNT(*) FROM im_session_key_packages WHERE status = 4 AND is_del = 0")
    int countRevokedKeys();

    /**
     * 统计总密钥数量
     *
     * @return 密钥数量
     */
    @Select("SELECT COUNT(*) FROM im_session_key_packages WHERE is_del = 0")
    int countAllKeys();

    /**
     * 统计活跃密钥数量
     *
     * @return 密钥数量
     */
    @Select("SELECT COUNT(*) FROM im_session_key_packages WHERE status = 1 AND is_del = 0")
    int countActiveKeys();

    /**
     * 根据会话ID列表批量查询密钥包
     *
     * @param conversationIds 会话ID列表
     * @return 密钥包列表
     */
    @Select("<script>" +
            "SELECT * FROM im_session_key_packages WHERE session_id IN " +
            "<foreach collection='conversationIds' item='id' open='(' separator=',' close=')'>" +
            "#{id}" +
            "</foreach>" +
            " AND is_del = 0 ORDER BY created_at DESC" +
            "</script>")
    List<SessionKeyPackage> batchSelectByConversationIds(@Param("conversationIds") List<String> conversationIds);
}