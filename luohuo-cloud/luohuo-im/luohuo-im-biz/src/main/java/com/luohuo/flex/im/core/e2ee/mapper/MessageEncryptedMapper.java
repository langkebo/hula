package com.luohuo.flex.im.core.e2ee.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 加密消息Mapper接口
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Mapper
public interface MessageEncryptedMapper extends BaseMapper<MessageEncrypted> {

    /**
     * 根据会话ID分页查询加密消息
     *
     * @param page          分页参数
     * @param conversationId 会话ID
     * @param tenantId      租户ID
     * @return 加密消息分页列表
     */
    @Select("SELECT * FROM im_message_encrypted WHERE conversation_id = #{conversationId} AND tenant_id = #{tenantId} AND is_del = 0 ORDER BY create_time DESC")
    IPage<MessageEncrypted> selectPageByConversationId(Page<MessageEncrypted> page,
                                                       @Param("conversationId") String conversationId,
                                                       @Param("tenantId") Long tenantId);

    /**
     * 根据会话ID和时间范围查询消息
     *
     * @param conversationId 会话ID
     * @param startTime      开始时间
     * @param endTime        结束时间
     * @param limit          限制条数
     * @return 消息列表
     */
    @Select("<script>" +
            "SELECT * FROM im_message_encrypted WHERE conversation_id = #{conversationId} AND is_del = 0" +
            "<if test='startTime != null'> AND create_time >= #{startTime}</if>" +
            "<if test='endTime != null'> AND create_time &lt;= #{endTime}</if>" +
            " ORDER BY create_time DESC" +
            "<if test='limit != null and limit > 0'> LIMIT #{limit}</if>" +
            "</script>")
    List<MessageEncrypted> selectByConversationIdAndTime(@Param("conversationId") String conversationId,
                                                        @Param("startTime") LocalDateTime startTime,
                                                        @Param("endTime") LocalDateTime endTime,
                                                        @Param("limit") Integer limit);

    /**
     * 根据发送者ID查询消息
     *
     * @param senderId 发送者ID
     * @param limit    限制条数
     * @return 消息列表
     */
    @Select("SELECT * FROM im_message_encrypted WHERE sender_id = #{senderId} AND is_del = 0 ORDER BY create_time DESC LIMIT #{limit}")
    List<MessageEncrypted> selectBySenderId(@Param("senderId") Long senderId, @Param("limit") Integer limit);

    /**
     * 根据接收者ID查询未读消息
     *
     * @param recipientId 接收者ID
     * @param lastReadAt  最后阅读时间
     * @return 未读消息列表
     */
    @Select("SELECT * FROM im_message_encrypted WHERE recipient_id = #{recipientId} AND create_time > #{lastReadAt} AND is_del = 0 ORDER BY create_time")
    List<MessageEncrypted> selectUnreadMessages(@Param("recipientId") Long recipientId,
                                               @Param("lastReadAt") LocalDateTime lastReadAt);

    /**
     * 根据群组ID查询消息
     *
     * @param roomId 群组ID
     * @param limit  限制条数
     * @return 消息列表
     */
    @Select("SELECT * FROM im_message_encrypted WHERE room_id = #{roomId} AND is_del = 0 ORDER BY create_time DESC LIMIT #{limit}")
    List<MessageEncrypted> selectByRoomId(@Param("roomId") Long roomId, @Param("limit") Integer limit);

    /**
     * 根据消息ID列表批量查询
     *
     * @param msgIds 消息ID列表
     * @return 消息列表
     */
    @Select("<script>" +
            "SELECT * FROM im_message_encrypted WHERE id IN " +
            "<foreach collection='msgIds' item='id' open='(' separator=',' close=')'>" +
            "#{id}" +
            "</foreach>" +
            " AND is_del = 0" +
            "</script>")
    List<MessageEncrypted> selectByMsgIds(@Param("msgIds") List<Long> msgIds);

    /**
     * 根据密钥ID查询消息
     *
     * @param keyId 密钥ID
     * @param limit 限制条数
     * @return 消息列表
     */
    @Select("SELECT * FROM im_message_encrypted WHERE key_id = #{keyId} AND is_del = 0 ORDER BY create_time DESC LIMIT #{limit}")
    List<MessageEncrypted> selectByKeyId(@Param("keyId") String keyId, @Param("limit") Integer limit);

    /**
     * 查询需要清理的过期消息
     *
     * @param expireTime 过期时间
     * @param limit      限制条数
     * @return 消息列表
     */
    @Select("SELECT * FROM im_message_encrypted WHERE create_time < #{expireTime} AND is_del = 0 ORDER BY create_time LIMIT #{limit}")
    List<MessageEncrypted> selectExpiredMessages(@Param("expireTime") LocalDateTime expireTime,
                                                @Param("limit") Integer limit);

    /**
     * 查询到期的自毁消息
     * 查找所有 destructAt <= now 的消息
     *
     * @param now   当前时间
     * @param limit 限制条数
     * @return 到期自毁消息列表
     */
    @Select("SELECT * FROM im_message_encrypted WHERE destruct_at IS NOT NULL AND destruct_at <= #{now} AND is_del = 0 ORDER BY destruct_at LIMIT #{limit}")
    List<MessageEncrypted> selectSelfDestructExpiredMessages(@Param("now") LocalDateTime now,
                                                             @Param("limit") Integer limit);

    /**
     * 根据内容哈希查询消息
     *
     * @param contentHash 内容哈希
     * @return 消息
     */
    @Select("SELECT * FROM im_message_encrypted WHERE content_hash = #{contentHash} AND is_del = 0 LIMIT 1")
    MessageEncrypted selectByContentHash(@Param("contentHash") byte[] contentHash);

    /**
     * 统计用户在指定时间内的加密消息数量
     *
     * @param userId    用户ID
     * @param startTime 开始时间
     * @param endTime   结束时间
     * @return 消息数量
     */
    @Select("<script>" +
            "SELECT COUNT(*) FROM im_message_encrypted WHERE (sender_id = #{userId} OR recipient_id = #{userId})" +
            " AND is_del = 0" +
            "<if test='startTime != null'> AND create_time >= #{startTime}</if>" +
            "<if test='endTime != null'> AND create_time &lt;= #{endTime}</if>" +
            "</script>")
    Long countUserEncryptedMessages(@Param("userId") Long userId,
                                   @Param("startTime") LocalDateTime startTime,
                                   @Param("endTime") LocalDateTime endTime);

    /**
     * 获取用户最新的加密消息
     *
     * @param userId 用户ID
     * @return 最新消息
     */
    @Select("(SELECT * FROM im_message_encrypted WHERE sender_id = #{userId} AND is_del = 0 ORDER BY create_time DESC LIMIT 1) " +
            "UNION ALL " +
            "(SELECT * FROM im_message_encrypted WHERE recipient_id = #{userId} AND is_del = 0 ORDER BY create_time DESC LIMIT 1) " +
            "ORDER BY create_time DESC LIMIT 1")
    MessageEncrypted selectLatestMessageByUserId(@Param("userId") Long userId);

    /**
     * 批量查询会话的最新消息
     *
     * @param conversationIds 会话ID列表
     * @return 最新消息列表
     */
    @Select("<script>" +
            "SELECT t1.* FROM im_message_encrypted t1 " +
            "INNER JOIN (" +
            "  SELECT conversation_id, MAX(create_time) as max_time " +
            "  FROM im_message_encrypted " +
            "  WHERE conversation_id IN " +
            "  <foreach collection='conversationIds' item='convId' open='(' separator=',' close=')'>" +
            "  #{convId}" +
            "  </foreach>" +
            "  AND is_del = 0 " +
            "  GROUP BY conversation_id" +
            ") t2 ON t1.conversation_id = t2.conversation_id AND t1.create_time = t2.max_time " +
            "WHERE t1.is_del = 0" +
            "</script>")
    List<MessageEncrypted> batchSelectLatestByConversationIds(@Param("conversationIds") List<String> conversationIds);

    /**
     * 优化的会话消息查询（使用索引优化）
     */
    @Select("SELECT * FROM im_message_encrypted " +
            "WHERE conversation_id = #{conversationId} " +
            "AND is_del = 0 " +
            "AND (#{fromMessageId} IS NULL OR id < #{fromMessageId}) " +
            "ORDER BY id DESC " +
            "LIMIT #{limit}")
    List<MessageEncrypted> selectOptimizedByConversation(
            @Param("conversationId") String conversationId,
            @Param("fromMessageId") Long fromMessageId,
            @Param("limit") Integer limit);

    /**
     * 批量插入加密消息
     */
    @Insert("<script>" +
            "INSERT INTO im_message_encrypted " +
            "(conversation_id, sender_id, recipient_id, room_id, tenant_id, " +
            "key_id, algorithm, ciphertext, iv, tag, content_hash, signature, " +
            "content_type, encrypted_extra, message_size, is_signed, " +
            "verification_status, encryption_time_ms, create_time, create_by) " +
            "VALUES " +
            "<foreach collection='messages' item='msg' separator=','>" +
            "(#{msg.conversationId}, #{msg.senderId}, #{msg.recipientId}, #{msg.roomId}, #{msg.tenantId}, " +
            "#{msg.keyId}, #{msg.algorithm}, #{msg.ciphertext}, #{msg.iv}, #{msg.tag}, #{msg.contentHash}, #{msg.signature}, " +
            "#{msg.contentType}, #{msg.encryptedExtra}, #{msg.messageSize}, #{msg.isSigned}, " +
            "#{msg.verificationStatus}, #{msg.encryptionTimeMs}, NOW(), #{msg.createBy})" +
            "</foreach>" +
            "</script>")
    int batchInsert(@Param("messages") List<MessageEncrypted> messages);

    /**
     * 批量更新签名验证状态
     */
    @Update("<script>" +
            "<foreach collection='messages' item='msg' separator=';'>" +
            "UPDATE im_message_encrypted SET " +
            "verification_status = #{msg.verificationStatus}, " +
            "signature_verified_at = #{msg.signatureVerifiedAt}, " +
            "update_time = NOW() " +
            "WHERE id = #{msg.id}" +
            "</foreach>" +
            "</script>")
    int batchUpdateVerificationStatus(@Param("messages") List<MessageEncrypted> messages);

    /**
     * 根据会话ID列表批量查询最新消息
     *
     * @param conversationIds 会话ID列表
     * @return 最新消息列表
     */
    @Select("<script>" +
            "SELECT t1.* FROM im_message_encrypted t1 " +
            "INNER JOIN (" +
            "  SELECT conversation_id, MAX(create_time) as max_create_time " +
            "  FROM im_message_encrypted " +
            "  WHERE conversation_id IN " +
            "  <foreach collection='conversationIds' item='id' open='(' separator=',' close=')'>" +
            "  #{id}" +
            "  </foreach>" +
            "  AND is_del = 0 " +
            "  GROUP BY conversation_id" +
            ") t2 ON t1.conversation_id = t2.conversation_id AND t1.create_time = t2.max_create_time " +
            "WHERE t1.is_del = 0" +
            "</script>")
    List<MessageEncrypted> selectLatestByConversationIds(@Param("conversationIds") List<String> conversationIds);
}