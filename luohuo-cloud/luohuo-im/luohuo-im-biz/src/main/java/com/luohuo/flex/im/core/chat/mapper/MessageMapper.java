package com.luohuo.flex.im.core.chat.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.luohuo.flex.im.domain.entity.Contact;
import com.luohuo.flex.im.domain.entity.Message;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * <p>
 * 消息表 Mapper 接口
 * </p>
 *
 * @author nyh
 */
@Repository
public interface MessageMapper extends BaseMapper<Message> {

	List<Map<String, Object>> batchGetUnReadCount(@Param("uid") Long uid, @Param("contactList") Collection<Contact> contactList);

	/**
	 * 统计今日消息总数
	 */
	@Select("SELECT COUNT(*) FROM im_message WHERE DATE(create_time) = CURDATE()")
	long countTodayMessages();

	/**
	 * 统计今日加密消息总数
	 */
	@Select("SELECT COUNT(*) FROM im_message WHERE DATE(create_time) = CURDATE() AND is_encrypted = 1")
	long countTodayEncryptedMessages();

	/**
	 * 统计今日自毁消息总数
	 */
	@Select("SELECT COUNT(*) FROM im_message WHERE DATE(create_time) = CURDATE() " +
			"AND (extra LIKE '%selfDestruct%') OR (extra LIKE '%selfDestructTime%')")
	long countTodaySelfDestructMessages();

	/**
	 * 统计指定时间范围内的消息数量
	 * @param startTime 开始时间
	 * @param endTime 结束时间
	 * @return 消息总数
	 */
	@Select("SELECT COUNT(*) FROM im_message WHERE create_time BETWEEN #{startTime} AND #{endTime}")
	long countMessagesByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

	/**
	 * 统计指定时间范围内的加密消息数量
	 * @param startTime 开始时间
	 * @param endTime 结束时间
	 * @return 加密消息总数
	 */
	@Select("SELECT COUNT(*) FROM im_message WHERE create_time BETWEEN #{startTime} AND #{endTime} AND is_encrypted = 1")
	long countEncryptedMessagesByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
}
