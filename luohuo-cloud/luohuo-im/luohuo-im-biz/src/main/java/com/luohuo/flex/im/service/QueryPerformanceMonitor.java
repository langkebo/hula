package com.luohuo.flex.im.service;

import java.util.Map;

/**
 * 查询性能监控服务
 *
 * @author HuLa
 */
public interface QueryPerformanceMonitor {

    /**
     * 记录慢查询
     *
     * @param sql SQL语句
     * @param parameters 参数
     * @param executionTime 执行时间（毫秒）
     * @param resultCount 结果数量
     */
    void recordSlowQuery(String sql, Map<String, Object> parameters, long executionTime, int resultCount);

    /**
     * 获取慢查询统计
     *
     * @param hours 时间范围（小时）
     * @return 统计信息
     */
    Map<String, Object> getSlowQueryStatistics(int hours);

    /**
     * 分析SQL性能
     *
     * @param sql SQL语句
     * @return 性能分析结果
     */
    Map<String, Object> analyzeSql(String sql);

    /**
     * 获取表空间使用情况
     *
     * @return 表空间统计
     */
    Map<String, Object> getTableSpaceUsage();

    /**
     * 获取索引使用情况
     *
     * @param tableName 表名
     * @return 索引使用统计
     */
    Map<String, Object> getIndexUsage(String tableName);
}