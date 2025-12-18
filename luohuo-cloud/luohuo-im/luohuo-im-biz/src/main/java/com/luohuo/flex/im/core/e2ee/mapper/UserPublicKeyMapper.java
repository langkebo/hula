package com.luohuo.flex.im.core.e2ee.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户公钥Mapper接口
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Mapper
public interface UserPublicKeyMapper extends BaseMapper<UserPublicKey> {

    /**
     * 根据用户ID和密钥ID查询公钥
     *
     * @param userId 用户ID
     * @param keyId  密钥ID
     * @return 用户公钥
     */
    @Select("SELECT * FROM im_user_public_keys WHERE user_id = #{userId} AND key_id = #{keyId} AND is_del = 0")
    UserPublicKey selectByUserIdAndKeyId(@Param("userId") Long userId, @Param("keyId") String keyId);

    /**
     * 根据用户ID查询所有有效的公钥
     *
     * @param userId 用户ID
     * @return 公钥列表
     */
    @Select("SELECT * FROM im_user_public_keys WHERE user_id = #{userId} AND status = 1 AND is_del = 0 ORDER BY create_time DESC")
    List<UserPublicKey> selectActiveKeysByUserId(@Param("userId") Long userId);

    /**
     * 根据用户ID查询最新的活跃公钥
     *
     * @param userId 用户ID
     * @return 用户公钥
     */
    @Select("SELECT * FROM im_user_public_keys WHERE user_id = #{userId} AND status = 1 AND is_del = 0 ORDER BY create_time DESC LIMIT 1")
    UserPublicKey selectActiveKeyByUserId(@Param("userId") Long userId);

    /**
     * 根据指纹查询公钥
     *
     * @param fingerprint 指纹
     * @return 用户公钥
     */
    @Select("SELECT * FROM im_user_public_keys WHERE fingerprint = #{fingerprint} AND status = 1 AND is_del = 0")
    UserPublicKey selectByFingerprint(@Param("fingerprint") String fingerprint);

    /**
     * 根据用户ID和租户ID查询公钥
     *
     * @param userId   用户ID
     * @param tenantId 租户ID
     * @return 公钥列表
     */
    @Select("SELECT * FROM im_user_public_keys WHERE user_id = #{userId} AND tenant_id = #{tenantId} AND status = 1 AND is_del = 0")
    List<UserPublicKey> selectByUserIdAndTenantId(@Param("userId") Long userId, @Param("tenantId") Long tenantId);

    /**
     * 更新密钥最后使用时间
     *
     * @param id       密钥ID
     * @param lastUsedAt 最后使用时间
     * @return 影响行数
     */
    @Update("UPDATE im_user_public_keys SET last_used_at = #{lastUsedAt} WHERE id = #{id}")
    int updateLastUsedAt(@Param("id") Long id, @Param("lastUsedAt") LocalDateTime lastUsedAt);

    /**
     * 批量禁用用户的旧密钥
     *
     * @param userId       用户ID
     * @param excludeKeyId 排除的密钥ID
     * @return 影响行数
     */
    @Update("UPDATE im_user_public_keys SET status = 0 WHERE user_id = #{userId} AND key_id != #{excludeKeyId} AND status = 1 AND is_del = 0")
    int disableOldKeys(@Param("userId") Long userId, @Param("excludeKeyId") String excludeKeyId);

    /**
     * 查询过期密钥
     *
     * @param now 当前时间
     * @return 过期密钥列表
     */
    @Select("SELECT * FROM im_user_public_keys WHERE expires_at < #{now} AND status = 1 AND is_del = 0")
    List<UserPublicKey> selectExpiredKeys(@Param("now") LocalDateTime now);

    /**
     * 批量标记密钥为已过期
     *
     * @param ids 密钥ID列表
     * @return 影响行数
     */
    @Update("<script>" +
            "UPDATE im_user_public_keys SET status = -1 WHERE id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>" +
            "#{id}" +
            "</foreach>" +
            "</script>")
    int batchMarkAsExpired(@Param("ids") List<Long> ids);

    /**
     * 根据算法类型查询公钥数量
     *
     * @param algorithm 算法类型
     * @return 数量
     */
    @Select("SELECT COUNT(*) FROM im_user_public_keys WHERE algorithm = #{algorithm} AND status = 1 AND is_del = 0")
    Long countByAlgorithm(@Param("algorithm") String algorithm);

    /**
     * 查询指定时间内未使用的密钥
     *
     * @param before 时间点
     * @return 密钥列表
     */
    @Select("SELECT * FROM im_user_public_keys WHERE (last_used_at < #{before} OR last_used_at IS NULL) AND status = 1 AND is_del = 0")
    List<UserPublicKey> selectUnusedKeys(@Param("before") LocalDateTime before);

    /**
     * 批量查询多个用户的公钥
     */
    @Select("<script>" +
            "SELECT * FROM im_user_public_keys WHERE user_id IN " +
            "<foreach collection='userIds' item='userId' open='(' separator=',' close=')'>" +
            "#{userId}" +
            "</foreach>" +
            " AND status = 1 AND is_del = 0 ORDER BY user_id, create_time DESC" +
            "</script>")
    List<UserPublicKey> batchSelectByUserIds(@Param("userIds") List<Long> userIds);

    /**
     * 批量查询活跃公钥
     */
    @Select("<script>" +
            "SELECT * FROM im_user_public_keys WHERE user_id IN " +
            "<foreach collection='userIds' item='userId' open='(' separator=',' close=')'>" +
            "#{userId}" +
            "</foreach>" +
            " AND status = 1 AND is_del = 0" +
            "</script>")
    List<UserPublicKey> batchSelectActiveKeys(@Param("userIds") List<Long> userIds);

    /**
     * 批量插入或更新公钥
     */
    @Insert("<script>" +
            "INSERT INTO im_user_public_keys (user_id, key_id, spki, algorithm, fingerprint, status, tenant_id, create_time, create_by) " +
            "VALUES " +
            "<foreach collection='keys' item='key' separator=','>" +
            "(#{key.userId}, #{key.keyId}, #{key.spki}, #{key.algorithm}, #{key.fingerprint}, #{key.status}, #{key.tenantId}, NOW(), #{key.createBy})" +
            "</foreach>" +
            " ON DUPLICATE KEY UPDATE " +
            "spki = VALUES(spki), " +
            "algorithm = VALUES(algorithm), " +
            "fingerprint = VALUES(fingerprint), " +
            "status = VALUES(status), " +
            "update_time = NOW()" +
            "</script>")
    int batchUpsert(@Param("keys") List<UserPublicKey> keys);

    /**
     * 查询用户ID列表（分页）
     *
     * @param offset 偏移量
     * @param limit  限制数量
     * @return 用户ID列表
     */
    @Select("SELECT DISTINCT user_id FROM im_user_public_keys WHERE is_del = 0 ORDER BY user_id LIMIT #{offset}, #{limit}")
    List<Long> selectUserIds(@Param("offset") int offset, @Param("limit") int limit);

    /**
     * 统计公钥数量
     *
     * @param activeOnly 是否只统计有效公钥
     * @return 数量
     */
    @Select("SELECT COUNT(*) FROM im_user_public_keys WHERE is_del = 0 ${activeOnly ? 'AND status = 1' : ''}")
    Long selectCount(@Param("activeOnly") Boolean activeOnly);

    /**
     * 统计指定日期到期的公钥数量
     *
     * @param expiryDate 到期日期
     * @return 数量
     */
    @Select("SELECT COUNT(*) FROM im_user_public_keys WHERE DATE(expires_at) = #{expiryDate} AND is_del = 0")
    Long selectCountByExpiryDate(@Param("expiryDate") LocalDateTime expiryDate);

    /**
     * 检查用户公钥是否有效
     *
     * @param userId 用户ID
     * @return 是否有效
     */
    @Select("SELECT CASE WHEN COUNT(*) > 0 THEN true ELSE false END FROM im_user_public_keys " +
            "WHERE user_id = #{userId} AND status = 1 AND is_del = 0")
    boolean isValid(@Param("userId") Long userId);

    /**
     * 别名方法，用于兼容性
     */
    default List<UserPublicKey> selectBatchByUserIds(List<Long> userIds) {
        return batchSelectByUserIds(userIds);
    }
}