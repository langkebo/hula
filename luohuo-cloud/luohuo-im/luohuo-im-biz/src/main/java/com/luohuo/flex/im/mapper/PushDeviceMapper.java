package com.luohuo.flex.im.mapper;

import com.luohuo.flex.im.domain.entity.PushDevice;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 推送设备Mapper
 *
 * @author HuLa
 */
@Mapper
public interface PushDeviceMapper {

    /**
     * 查询用户的所有活跃设备
     *
     * @param userId 用户ID
     * @return 设备列表
     */
    @Select("""
            SELECT * FROM im_push_device
            WHERE user_id = #{userId}
            AND active = 1
            AND last_active_time > DATE_SUB(NOW(), INTERVAL 30 DAY)
            """)
    List<PushDevice> selectActiveDevicesByUserId(@Param("userId") Long userId);

    /**
     * 查询群组成员的所有活跃设备
     *
     * @param groupId 群组ID
     * @param excludeUserId 排除的用户ID
     * @return 设备列表
     */
    @Select("""
            SELECT DISTINCT pd.* FROM im_push_device pd
            INNER JOIN im_group_member gm ON pd.user_id = gm.user_id
            WHERE gm.group_id = #{groupId}
            AND gm.user_id != #{excludeUserId}
            AND pd.active = 1
            AND pd.last_active_time > DATE_SUB(NOW(), INTERVAL 30 DAY)
            """)
    List<PushDevice> selectActiveDevicesByGroupId(@Param("groupId") Long groupId,
                                                  @Param("excludeUserId") Long excludeUserId);

    /**
     * 查询所有活跃设备
     *
     * @return 设备列表
     */
    @Select("""
            SELECT * FROM im_push_device
            WHERE active = 1
            AND last_active_time > DATE_SUB(NOW(), INTERVAL 30 DAY)
            """)
    List<PushDevice> selectAllActiveDevices();

    /**
     * 更新设备最后活跃时间
     *
     * @param userId 用户ID
     * @param deviceToken 设备Token
     * @return 影响行数
     */
    @Select("""
            UPDATE im_push_device
            SET last_active_time = NOW()
            WHERE user_id = #{userId}
            AND device_token = #{deviceToken}
            """)
    int updateLastActiveTime(@Param("userId") Long userId,
                             @Param("deviceToken") String deviceToken);

    /**
     * 插入或更新设备信息
     *
     * @param device 设备信息
     * @return 影响行数
     */
    int insertOrUpdate(PushDevice device);
}