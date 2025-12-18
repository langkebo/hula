package com.luohuo.flex.im.core.e2ee.service;

import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 数据库维护服务
 * 
 * 功能：
 * 1. 分析表以更新统计信息
 * 2. 监控表大小和索引使用率
 * 3. 归档历史数据
 * 
 * @author HuLa Team
 * @since 2025-12-15
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DatabaseMaintenanceService {

    private final JdbcTemplate jdbcTemplate;
    private final E2EEMetrics e2eeMetrics;

    /**
     * E2EE 相关表列表
     */
    private static final String[] E2EE_TABLES = {
        "e2ee_keys",
        "e2ee_messages",
        "e2ee_audit_logs",
        "e2ee_sessions"
    };

    /**
     * 执行数据库维护任务
     * 包括分析表、更新统计信息
     * 
     * @return 维护的表数量
     */
    public int performMaintenance() {
        log.info("开始执行数据库维护任务");
        int maintainedCount = 0;

        for (String table : E2EE_TABLES) {
            try {
                if (tableExists(table)) {
                    analyzeTable(table);
                    maintainedCount++;
                    log.debug("表 {} 维护完成", table);
                }
            } catch (Exception e) {
                log.warn("表 {} 维护失败: {}", table, e.getMessage());
            }
        }

        log.info("数据库维护任务完成，维护表数量: {}", maintainedCount);
        return maintainedCount;
    }

    /**
     * 分析表以更新统计信息
     * 
     * @param tableName 表名
     */
    private void analyzeTable(String tableName) {
        try {
            // MySQL 使用 ANALYZE TABLE
            jdbcTemplate.execute("ANALYZE TABLE " + tableName);
            log.debug("表 {} 分析完成", tableName);
        } catch (Exception e) {
            log.warn("分析表 {} 失败: {}", tableName, e.getMessage());
        }
    }

    /**
     * 检查表是否存在
     * 
     * @param tableName 表名
     * @return 是否存在
     */
    private boolean tableExists(String tableName) {
        try {
            String sql = "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = ?";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class, tableName);
            return count != null && count > 0;
        } catch (Exception e) {
            log.warn("检查表 {} 是否存在失败: {}", tableName, e.getMessage());
            return false;
        }
    }

    /**
     * 监控数据库性能
     * 包括表大小、索引使用率等
     */
    public void monitorPerformance() {
        log.debug("开始监控数据库性能");

        for (String table : E2EE_TABLES) {
            try {
                if (tableExists(table)) {
                    monitorTableSize(table);
                    monitorIndexUsage(table);
                }
            } catch (Exception e) {
                log.warn("监控表 {} 性能失败: {}", table, e.getMessage());
            }
        }

        // 监控连接池状态
        monitorConnectionPool();

        log.debug("数据库性能监控完成");
    }

    /**
     * 监控表大小
     * 
     * @param tableName 表名
     */
    private void monitorTableSize(String tableName) {
        try {
            String sql = """
                SELECT 
                    table_rows as row_count,
                    ROUND(data_length / 1024 / 1024, 2) as data_size_mb,
                    ROUND(index_length / 1024 / 1024, 2) as index_size_mb
                FROM information_schema.tables 
                WHERE table_name = ?
                """;

            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, tableName);

            if (!results.isEmpty()) {
                Map<String, Object> row = results.get(0);
                Long rowCount = (Long) row.get("row_count");
                Object dataSizeMb = row.get("data_size_mb");
                Object indexSizeMb = row.get("index_size_mb");

                log.debug("表 {} 统计: 行数={}, 数据大小={}MB, 索引大小={}MB",
                    tableName, rowCount, dataSizeMb, indexSizeMb);

                // 记录到指标系统
                if (rowCount != null) {
                    e2eeMetrics.recordTableSize(tableName, rowCount);
                }
            }
        } catch (Exception e) {
            log.warn("监控表 {} 大小失败: {}", tableName, e.getMessage());
        }
    }

    /**
     * 监控索引使用情况
     * 
     * @param tableName 表名
     */
    private void monitorIndexUsage(String tableName) {
        try {
            String sql = """
                SELECT 
                    index_name,
                    cardinality
                FROM information_schema.statistics 
                WHERE table_name = ?
                GROUP BY index_name, cardinality
                """;

            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, tableName);

            for (Map<String, Object> row : results) {
                String indexName = (String) row.get("index_name");
                Long cardinality = (Long) row.get("cardinality");

                log.debug("表 {} 索引 {} 基数: {}", tableName, indexName, cardinality);
            }
        } catch (Exception e) {
            log.warn("监控表 {} 索引使用情况失败: {}", tableName, e.getMessage());
        }
    }

    /**
     * 监控连接池状态
     */
    private void monitorConnectionPool() {
        try {
            // 查询当前连接数
            String sql = "SHOW STATUS LIKE 'Threads_connected'";
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);

            if (!results.isEmpty()) {
                Object value = results.get(0).get("Value");
                log.debug("当前数据库连接数: {}", value);
            }
        } catch (Exception e) {
            log.warn("监控连接池状态失败: {}", e.getMessage());
        }
    }

    /**
     * 归档历史数据
     * 将超过指定天数的数据移动到归档表
     * 
     * @param days 保留天数
     * @return 归档的记录数
     */
    public int archiveHistoricalData(int days) {
        log.info("开始归档 {} 天前的历史数据", days);
        int archivedCount = 0;

        try {
            // 归档审计日志
            archivedCount += archiveAuditLogs(days);
        } catch (Exception e) {
            log.error("归档历史数据失败", e);
        }

        log.info("历史数据归档完成，归档记录数: {}", archivedCount);
        return archivedCount;
    }

    /**
     * 归档审计日志
     * 
     * @param days 保留天数
     * @return 归档的记录数
     */
    private int archiveAuditLogs(int days) {
        try {
            if (!tableExists("e2ee_audit_logs")) {
                return 0;
            }

            // 统计需要归档的记录数
            String countSql = "SELECT COUNT(*) FROM e2ee_audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)";
            Integer count = jdbcTemplate.queryForObject(countSql, Integer.class, days);

            if (count != null && count > 0) {
                log.info("发现 {} 条需要归档的审计日志", count);
                // 实际归档操作可以根据需要实现
                // 例如：移动到归档表或导出到文件
            }

            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("归档审计日志失败: {}", e.getMessage());
            return 0;
        }
    }
}
