package com.luohuo.flex.im.service;

import java.util.Map;

/**
 * 推送重试服务接口
 *
 * @author HuLa
 */
public interface PushRetryService {

    /**
     * 添加失败的重试任务
     *
     * @param pushType 推送类型
     * @param deviceToken 设备Token
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @param retryCount 当前重试次数
     */
    void addRetryTask(String pushType, String deviceToken, String title,
                      String content, Map<String, Object> extra, int retryCount);

    /**
     * 处理重试任务
     */
    void processRetryTasks();

    /**
     * 清理过期的重试任务
     */
    void cleanupExpiredTasks();

    /**
     * 获取重试统计
     *
     * @return 统计信息
     */
    Map<String, Object> getRetryStatistics();
}