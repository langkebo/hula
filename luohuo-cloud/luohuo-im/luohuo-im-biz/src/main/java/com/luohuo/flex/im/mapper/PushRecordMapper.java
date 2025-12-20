package com.luohuo.flex.im.mapper;

import com.luohuo.flex.im.domain.entity.PushRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 推送记录Mapper
 *
 * @author HuLa
 */
@Mapper
public interface PushRecordMapper {

    /**
     * 插入推送记录
     *
     * @param record 推送记录
     * @return 影响行数
     */
    @Insert("""
            INSERT INTO im_push_record (user_id, device_token, push_type, title, content, extra, status, error_message, create_time, tenant_id)
            VALUES (#{userId}, #{deviceToken}, #{pushType}, #{title}, #{content}, #{extra}, #{status}, #{errorMessage}, #{createTime}, #{tenantId})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(PushRecord record);

    /**
     * 更新推送状态
     *
     * @param id 记录ID
     * @param status 状态
     * @param errorMessage 错误信息
     * @return 影响行数
     */
    @Update("""
            UPDATE im_push_record
            SET status = #{status}, error_message = #{errorMessage}
            WHERE id = #{id}
            """)
    int updateStatus(@Param("id") Long id, @Param("status") String status, @Param("errorMessage") String errorMessage);

    /**
     * 按状态统计数量
     *
     * @param status 状态
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 数量
     */
    @Select("""
            SELECT COUNT(*) FROM im_push_record
            WHERE status = #{status}
            AND create_time >= #{startTime}
            AND create_time <= #{endTime}
            """)
    long countByStatus(@Param("status") String status, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    /**
     * 按推送类型统计数量
     *
     * @param pushType 推送类型
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 数量
     */
    @Select("""
            SELECT COUNT(*) FROM im_push_record
            WHERE push_type = #{pushType}
            AND create_time >= #{startTime}
            AND create_time <= #{endTime}
            """)
    long countByType(@Param("pushType") String pushType, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    /**
     * 统计总数
     *
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 数量
     */
    @Select("""
            SELECT COUNT(*) FROM im_push_record
            WHERE create_time >= #{startTime}
            AND create_time <= #{endTime}
            """)
    long countTotal(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    /**
     * 按类型分组统计
     *
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 类型统计列表
     */
    @Select("""
            SELECT push_type as pushType, COUNT(*) as count FROM im_push_record
            WHERE create_time >= #{startTime}
            AND create_time <= #{endTime}
            GROUP BY push_type
            """)
    List<Map<String, Object>> countGroupByType(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    /**
     * 按状态分组统计
     *
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 状态统计列表
     */
    @Select("""
            SELECT status, COUNT(*) as count FROM im_push_record
            WHERE create_time >= #{startTime}
            AND create_time <= #{endTime}
            GROUP BY status
            """)
    List<Map<String, Object>> countGroupByStatus(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    /**
     * 根据ID查询记录
     *
     * @param id 记录ID
     * @return 推送记录
     */
    @Select("""
            SELECT * FROM im_push_record WHERE id = #{id}
            """)
    PushRecord selectById(@Param("id") Long id);
}
