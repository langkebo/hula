package com.luohuo.flex.im.service.impl;

import com.luohuo.flex.im.service.QueryPerformanceMonitor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 查询性能监控服务实现
 *
 * @author HuLa
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QueryPerformanceMonitorImpl implements QueryPerformanceMonitor {

    private final JdbcTemplate jdbcTemplate;

    // 慢查询阈值（毫秒）
    private static final long SLOW_QUERY_THRESHOLD = 1000;

    @Override
    public void recordSlowQuery(String sql, Map<String, Object> parameters, long executionTime, int resultCount) {
        if (executionTime > SLOW_QUERY_THRESHOLD) {
            try {
                // 记录到慢查询日志表
                String insertSql = """
                        INSERT INTO im_slow_query_log (
                            sql_text, parameters, execution_time, result_count,
                            create_time, tenant_id
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """;

                jdbcTemplate.update(insertSql,
                        sql,
                        parameters.toString(),
                        executionTime,
                        resultCount,
                        LocalDateTime.now(),
                        1L // 租户ID
                );

                log.warn("Slow query detected: {}ms, SQL: {}", executionTime, sql);

            } catch (Exception e) {
                log.error("Failed to record slow query", e);
            }
        }
    }

    @Override
    public Map<String, Object> getSlowQueryStatistics(int hours) {
        Map<String, Object> statistics = new HashMap<>();

        try {
            // 查询慢查询统计
            String sql = """
                    SELECT
                        COUNT(*) as total_queries,
                        AVG(execution_time) as avg_execution_time,
                        MAX(execution_time) as max_execution_time,
                        SUM(result_count) as total_results
                    FROM im_slow_query_log
                    WHERE create_time >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                    """;

            Map<String, Object> result = jdbcTemplate.queryForMap(sql, hours);
            statistics.putAll(result);

            // 查询最慢的5个查询
            String topSql = """
                    SELECT sql_text, execution_time, result_count, create_time
                    FROM im_slow_query_log
                    WHERE create_time >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                    ORDER BY execution_time DESC
                    LIMIT 5
                    """;

            List<Map<String, Object>> topQueries = jdbcTemplate.queryForList(topSql, hours);
            statistics.put("topSlowQueries", topQueries);

            // 按小时统计
            String hourlySql = """
                    SELECT
                        DATE_FORMAT(create_time, '%Y-%m-%d %H:00:00') as hour,
                        COUNT(*) as count,
                        AVG(execution_time) as avg_time
                    FROM im_slow_query_log
                    WHERE create_time >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                    GROUP BY DATE_FORMAT(create_time, '%Y-%m-%d %H:00:00')
                    ORDER BY hour
                    """;

            List<Map<String, Object>> hourlyStats = jdbcTemplate.queryForList(hourlySql, hours);
            statistics.put("hourlyStatistics", hourlyStats);

        } catch (Exception e) {
            log.error("Failed to get slow query statistics", e);
            statistics.put("error", e.getMessage());
        }

        return statistics;
    }

    @Override
    public Map<String, Object> analyzeSql(String sql) {
        Map<String, Object> analysis = new HashMap<>();

        try {
            // 执行EXPLAIN分析
            String explainSql = "EXPLAIN " + sql;
            List<Map<String, Object>> explainResult = jdbcTemplate.queryForList(explainSql);
            analysis.put("explain", explainResult);

            // 分析是否使用了索引
            boolean usingIndex = explainResult.stream()
                    .anyMatch(row -> "USING INDEX".equals(row.get("Extra"))
                            || String.valueOf(row.get("key")) != null
                            && !"".equals(String.valueOf(row.get("key"))));

            analysis.put("usingIndex", usingIndex);

            // 分析查询类型
            List<String> queryTypes = new ArrayList<>();
            if (sql.toUpperCase().contains("SELECT")) {
                queryTypes.add("SELECT");
                if (sql.toUpperCase().contains("JOIN")) {
                    queryTypes.add("JOIN");
                }
            }
            if (sql.toUpperCase().contains("INSERT")) {
                queryTypes.add("INSERT");
            }
            if (sql.toUpperCase().contains("UPDATE")) {
                queryTypes.add("UPDATE");
            }
            if (sql.toUpperCase().contains("DELETE")) {
                queryTypes.add("DELETE");
            }
            analysis.put("queryTypes", queryTypes);

            // 执行时间预估
            long startTime = System.currentTimeMillis();
            try {
                jdbcTemplate.queryForList(sql);
            } catch (Exception e) {
                // 忽略执行错误，只关心执行时间
            }
            long executionTime = System.currentTimeMillis() - startTime;
            analysis.put("estimatedExecutionTime", executionTime);

        } catch (Exception e) {
            log.error("Failed to analyze SQL: {}", sql, e);
            analysis.put("error", e.getMessage());
        }

        return analysis;
    }

    @Override
    public Map<String, Object> getTableSpaceUsage() {
        Map<String, Object> usage = new HashMap<>();

        try {
            // 查询表空间使用情况
            String sql = """
                    SELECT
                        table_name,
                        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS table_size_mb,
                        ROUND((data_length / 1024 / 1024), 2) AS data_size_mb,
                        ROUND((index_length / 1024 / 1024), 2) AS index_size_mb,
                        table_rows
                    FROM information_schema.TABLES
                    WHERE table_schema = DATABASE()
                    AND table_name LIKE 'im_%'
                    ORDER BY (data_length + index_length) DESC
                    """;

            List<Map<String, Object>> tables = jdbcTemplate.queryForList(sql);
            usage.put("tables", tables);

            // 计算总计
            double totalSize = tables.stream()
                    .mapToDouble(row -> ((Number) row.get("table_size_mb")).doubleValue())
                    .sum();

            usage.put("totalSizeMB", totalSize);

            // 找出最大的表
            if (!tables.isEmpty()) {
                usage.put("largestTable", tables.get(0));
            }

        } catch (Exception e) {
            log.error("Failed to get table space usage", e);
            usage.put("error", e.getMessage());
        }

        return usage;
    }

    @Override
    public Map<String, Object> getIndexUsage(String tableName) {
        Map<String, Object> usage = new HashMap<>();

        try {
            // 查询索引使用情况
            String sql = """
                    SELECT
                        s.INDEX_NAME,
                        s.TABLE_NAME,
                        s.CARDINALITY,
                        t.TABLE_ROWS,
                        ROUND((s.CARDINALITY / NULLIF(t.TABLE_ROWS, 0)) * 100, 2) AS selectivity_percent,
                        s.SUB_PART,
                        s.NULLABLE
                    FROM information_schema.STATISTICS s
                    JOIN information_schema.TABLES t ON s.TABLE_NAME = t.TABLE_NAME
                    WHERE s.TABLE_SCHEMA = DATABASE()
                    AND s.TABLE_NAME = ?
                    ORDER BY s.INDEX_NAME, s.SEQ_IN_INDEX
                    """;

            List<Map<String, Object>> indexes = jdbcTemplate.queryForList(sql, tableName);
            usage.put("indexes", indexes);

            // 查询索引大小
            String indexSizeSql = """
                    SELECT
                        INDEX_NAME,
                        ROUND(((INDEX_LENGTH) / 1024 / 1024), 2) AS index_size_mb
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = ?
                    """;

            Map<String, Object> indexSizes = jdbcTemplate.queryForMap(indexSizeSql, tableName);
            usage.put("indexSizes", indexSizes);

        } catch (Exception e) {
            log.error("Failed to get index usage for table: {}", tableName, e);
            usage.put("error", e.getMessage());
        }

        return usage;
    }

    /**
     * 定期清理旧的慢查询日志
     */
    @Scheduled(cron = "0 0 2 * * ?") // 每天凌晨2点执行
    public void cleanupSlowQueryLogs() {
        try {
            // 删除30天前的慢查询日志
            String sql = "DELETE FROM im_slow_query_log WHERE create_time < DATE_SUB(NOW(), INTERVAL 30 DAY)";
            int deletedRows = jdbcTemplate.update(sql);
            log.info("Cleaned up {} old slow query logs", deletedRows);
        } catch (Exception e) {
            log.error("Failed to cleanup slow query logs", e);
        }
    }

    /**
     * 定期生成性能报告
     */
    @Scheduled(cron = "0 0 1 * * MON") // 每周一凌晨1点执行
    public void generatePerformanceReport() {
        try {
            Map<String, Object> report = new HashMap<>();
            report.put("reportTime", LocalDateTime.now());
            report.put("tableSpaceUsage", getTableSpaceUsage());
            report.put("slowQueryStats", getSlowQueryStatistics(24 * 7)); // 最近7天

            // 保存报告
            String insertSql = """
                    INSERT INTO im_performance_report (
                        report_data, create_time, tenant_id
                    ) VALUES (?, ?, ?)
                    """;

            jdbcTemplate.update(insertSql,
                    report.toString(),
                    LocalDateTime.now(),
                    1L
            );

            log.info("Generated performance report");

        } catch (Exception e) {
            log.error("Failed to generate performance report", e);
        }
    }
}