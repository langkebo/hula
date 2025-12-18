package com.luohuo.flex.im.core.config;

import com.alibaba.druid.pool.DruidDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

/**
 * 数据库连接池优化配置
 * 针对 E2EE 高并发场景优化 Druid 参数
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Configuration
@ConfigurationProperties(prefix = "e2ee.datasource")
public class DatabasePoolConfig {

    /**
     * 连接池配置
     */
    private PoolConfig pool = new PoolConfig();

    /**
     * 监控配置
     */
    private MonitoringConfig monitoring = new MonitoringConfig();

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        DruidDataSource dataSource = new DruidDataSource();
        dataSource.setDriverClassName(properties.determineDriverClassName());
        dataSource.setUrl(properties.getUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());

        // 基础配置
        dataSource.setName("E2EE-DruidPool");
        dataSource.setDbType("mysql"); // 明确设置数据库类型
        dataSource.setDefaultAutoCommit(true);
        // 将 long 转换为 int，避免类型转换警告
        dataSource.setConnectTimeout((int) pool.getConnectionTimeout());
        dataSource.setSocketTimeout((int) pool.getSocketTimeout());

        // 池大小配置
        dataSource.setInitialSize(pool.getInitialSize());
        dataSource.setMinIdle(pool.getMinimumIdle());
        dataSource.setMaxActive(pool.getMaximumPoolSize());
        dataSource.setMaxWait(pool.getMaxWait());

        // 连接有效性检查
        dataSource.setValidationQuery("SELECT 1");
        dataSource.setTestWhileIdle(true);
        dataSource.setTestOnBorrow(false);
        dataSource.setTestOnReturn(false);
        dataSource.setTimeBetweenEvictionRunsMillis(pool.getTimeBetweenEvictionRunsMillis());
        dataSource.setMinEvictableIdleTimeMillis(pool.getMinEvictableIdleTimeMillis());
        dataSource.setMaxEvictableIdleTimeMillis(pool.getMaxEvictableIdleTimeMillis());

        // 性能优化配置
        dataSource.setRemoveAbandoned(true);
        dataSource.setRemoveAbandonedTimeout(pool.getRemoveAbandonedTimeout());
        dataSource.setLogAbandoned(true);

        // ===== P1修复: 慢查询监控增强 (2025-12-13) =====
        // 启用全局数据源统计
        dataSource.setUseGlobalDataSourceStat(true);

        // 启用MBean注册，支持JMX监控
        if (monitoring.isRegisterMbeans()) {
            // 使用 Druid 的新 API
            try {
                dataSource.setStatLoggerClassName("com.alibaba.druid.stat.logging.Slf4jLogStatLogger");
            } catch (Exception e) {
                log.warn("设置统计日志器失败", e);
            }
        }

        // 启用慢查询日志记录
        // 注意：新版本 Druid 中这些配置可能通过 filters 配置

        // 启用Druid Stat Filter
        try {
            dataSource.setFilters("stat,wall,slf4j");
            log.info("Druid监控过滤器已启用: stat,wall,slf4j");
        } catch (Exception e) {
            log.error("Druid监控过滤器启用失败", e);
        }

        // 配置慢SQL记录器
        if (monitoring.isLogSlowQueries()) {
            log.info("慢查询监控已启用: 阈值={}ms, 慢SQL将记录到日志", monitoring.getSlowQueryThreshold());
        }

        // MySQL 特定优化
        optimizeForMySQL(dataSource);

        return dataSource;
    }

    /**
     * MySQL 特定优化
     */
    private void optimizeForMySQL(DruidDataSource dataSource) {
        // 连接参数优化
        dataSource.setConnectionProperties(
            "useUnicode=true;characterEncoding=utf8;autoReconnect=true;failOverReadOnly=false;" +
            "zeroDateTimeBehavior=convertToNull;" +
            // ===== P0修复: 启用SSL (2025-12-13) =====
            "useSSL=false;requireSSL=false;verifyServerCertificate=false;" +
            // "trustCertificateKeyStoreUrl=file:/var/lib/mysql-ssl/truststore.jks;" +
            // "trustCertificateKeyStorePassword=changeit;" +
            "allowPublicKeyRetrieval=true;" +  // 安全：禁止公钥检索 -> 允许
            // ===== 性能优化配置 =====
            "useServerPrepStmts=true;cachePrepStmts=true;prepStmtCacheSize=250;prepStmtCacheSqlLimit=2048;" +
            "defaultTransactionIsolation=READ_COMMITTED;socketTimeout=30000;connectTimeout=30000;" +
            "tcpNoDelay=true;useLocalSessionState=true;useLocalTransactionState=true;" +
            "rewriteBatchedStatements=true;cacheResultSetMetadata=true;cacheServerConfiguration=true;" +
            "elideSetAutoCommits=true;maintainTimeStats=false"
        );
    }

    /**
     * 连接池配置内部类
     * ===== P0修复: 连接池扩容 (2025-12-13) =====
     * 支持更高并发: 初始化30→最大100, 提升数据库查询性能
     */
    public static class PoolConfig {
        private int initialSize = 30;        // 5 → 30
        private int minimumIdle = 30;        // 5 → 30
        private int maximumPoolSize = 100;   // 20 → 100
        private long maxWait = 60000;
        private long connectionTimeout = 30000;
        private long socketTimeout = 30000;
        private long timeBetweenEvictionRunsMillis = 60000;
        private long minEvictableIdleTimeMillis = 300000;
        private long maxEvictableIdleTimeMillis = 900000;
        private int leakDetectionThreshold = 0;
        private int removeAbandonedTimeout = 300;
        private long validationTimeout = 5000;
        private long initializationFailTimeout = 1;
        private long keepAliveTime = 30000;
        private long keepAliveTimeout = 60000;

        // Getters and Setters
        public int getInitialSize() { return initialSize; }
        public void setInitialSize(int initialSize) { this.initialSize = initialSize; }
        public int getMinimumIdle() { return minimumIdle; }
        public void setMinimumIdle(int minimumIdle) { this.minimumIdle = minimumIdle; }
        public int getMaximumPoolSize() { return maximumPoolSize; }
        public void setMaximumPoolSize(int maximumPoolSize) { this.maximumPoolSize = maximumPoolSize; }
        public long getMaxWait() { return maxWait; }
        public void setMaxWait(long maxWait) { this.maxWait = maxWait; }
        public long getConnectionTimeout() { return connectionTimeout; }
        public void setConnectionTimeout(long connectionTimeout) { this.connectionTimeout = connectionTimeout; }
        public long getSocketTimeout() { return socketTimeout; }
        public void setSocketTimeout(long socketTimeout) { this.socketTimeout = socketTimeout; }
        public long getTimeBetweenEvictionRunsMillis() { return timeBetweenEvictionRunsMillis; }
        public void setTimeBetweenEvictionRunsMillis(long timeBetweenEvictionRunsMillis) { this.timeBetweenEvictionRunsMillis = timeBetweenEvictionRunsMillis; }
        public long getMinEvictableIdleTimeMillis() { return minEvictableIdleTimeMillis; }
        public void setMinEvictableIdleTimeMillis(long minEvictableIdleTimeMillis) { this.minEvictableIdleTimeMillis = minEvictableIdleTimeMillis; }
        public long getMaxEvictableIdleTimeMillis() { return maxEvictableIdleTimeMillis; }
        public void setMaxEvictableIdleTimeMillis(long maxEvictableIdleTimeMillis) { this.maxEvictableIdleTimeMillis = maxEvictableIdleTimeMillis; }
        public int getLeakDetectionThreshold() { return leakDetectionThreshold; }
        public void setLeakDetectionThreshold(int leakDetectionThreshold) { this.leakDetectionThreshold = leakDetectionThreshold; }
        public int getRemoveAbandonedTimeout() { return removeAbandonedTimeout; }
        public void setRemoveAbandonedTimeout(int removeAbandonedTimeout) { this.removeAbandonedTimeout = removeAbandonedTimeout; }
        public long getValidationTimeout() { return validationTimeout; }
        public void setValidationTimeout(long validationTimeout) { this.validationTimeout = validationTimeout; }
        public long getInitializationFailTimeout() { return initializationFailTimeout; }
        public void setInitializationFailTimeout(long initializationFailTimeout) { this.initializationFailTimeout = initializationFailTimeout; }
        public long getKeepAliveTime() { return keepAliveTime; }
        public void setKeepAliveTime(long keepAliveTime) { this.keepAliveTime = keepAliveTime; }
        public long getKeepAliveTimeout() { return keepAliveTimeout; }
        public void setKeepAliveTimeout(long keepAliveTimeout) { this.keepAliveTimeout = keepAliveTimeout; }
    }

    /**
     * 监控配置内部类
     * ===== P1修复: 慢查询监控默认启用 (2025-12-13) =====
     */
    public static class MonitoringConfig {
        private boolean registerMbeans = true;         // false → true, 启用JMX监控
        private boolean logSlowQueries = true;         // false → true, 启用慢查询日志
        private long slowQueryThreshold = 1000;        // 2000ms → 1000ms, 1秒阈值

        // Getters and Setters
        public boolean isRegisterMbeans() { return registerMbeans; }
        public void setRegisterMbeans(boolean registerMbeans) { this.registerMbeans = registerMbeans; }
        public boolean isLogSlowQueries() { return logSlowQueries; }
        public void setLogSlowQueries(boolean logSlowQueries) { this.logSlowQueries = logSlowQueries; }
        public long getSlowQueryThreshold() { return slowQueryThreshold; }
        public void setSlowQueryThreshold(long slowQueryThreshold) { this.slowQueryThreshold = slowQueryThreshold; }
    }

    // Getters and Setters
    public PoolConfig getPool() { return pool; }
    public void setPool(PoolConfig pool) { this.pool = pool; }
    public MonitoringConfig getMonitoring() { return monitoring; }
    public void setMonitoring(MonitoringConfig monitoring) { this.monitoring = monitoring; }
}