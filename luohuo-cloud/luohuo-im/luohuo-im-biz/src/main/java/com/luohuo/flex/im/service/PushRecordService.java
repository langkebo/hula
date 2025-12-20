package com.luohuo.flex.im.service;

import com.luohuo.flex.im.api.PushStatistics;
import com.luohuo.flex.im.domain.entity.PushRecord;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 推送记录服务接口
 *
 * @author HuLa
 */
public interface PushRecordService {

    /**
     * 创建推送记录
     *
     * @param userId 用户ID
     * @param deviceToken 设备Token
     * @param pushType 推送类型
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 推送记录
     */
    PushRecord createRecord(Long userId, String deviceToken, String pushType,
                           String title, String content, Map<String, Object> extra);

    /**
     * 更新推送状态
     *
     * @param recordId 记录ID
     * @param status 状态：pending/success/failed
     * @param errorMessage 错误信息（失败时）
     */
    void updateStatus(Long recordId, String status, String errorMessage);

    /**
     * 获取推送统计数据
     *
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 推送统计
     */
    PushStatistics getStatistics(LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 按推送类型统计数量
     *
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 类型统计Map
     */
    Map<String, Long> countByType(LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 根据ID查询推送记录
     *
     * @param id 记录ID
     * @return 推送记录
     */
    PushRecord getById(Long id);
}
