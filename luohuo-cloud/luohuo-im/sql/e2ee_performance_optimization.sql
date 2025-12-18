-- =====================================================
-- HuLa E2EE 性能优化数据库脚本
-- 版本: 1.1.0
-- 创建时间: 2025-12-12
-- 描述: 优化数据库性能，包括索引优化、分区表、数据归档
-- =====================================================

SELECT '开始执行 E2EE 性能优化脚本...' AS message;

-- =====================================================
-- 1. 索引优化
-- =====================================================

-- 为加密消息表添加复合索引，优化常见查询
-- 会话ID + 时间索引（用于消息列表查询）
CREATE INDEX IF NOT EXISTS `idx_conv_time` ON `im_message_encrypted`(`conversation_id`, `create_time` DESC);

-- 发送者 + 时间索引（用于查询用户发送的消息）
CREATE INDEX IF NOT EXISTS `idx_sender_time` ON `im_message_encrypted`(`sender_id`, `create_time` DESC);

-- 接收者 + 阅读状态索引（用于查询未读消息）
CREATE INDEX IF NOT EXISTS `idx_recipient_read` ON `im_message_encrypted`(`recipient_id`, `read_at`);

-- 租户ID索引（多租户优化）
CREATE INDEX IF NOT EXISTS `idx_tenant_id` ON `im_message_encrypted`(`tenant_id`);

-- 组合索引：加密消息查询优化
CREATE INDEX IF NOT EXISTS `idx_conv_sender_time` ON `im_message_encrypted`(`conversation_id`, `sender_id`, `create_time` DESC);

-- 密钥ID索引（用于批量查询）
CREATE INDEX IF NOT EXISTS `idx_key_id` ON `im_message_encrypted`(`key_id`);

-- 内容哈希索引（用于去重）
CREATE INDEX IF NOT EXISTS `idx_content_hash` ON `im_message_encrypted`(`content_hash`);

-- 用户公钥表索引优化
CREATE INDEX IF NOT EXISTS `idx_user_key_status` ON `im_user_public_key`(`user_id`, `valid`, `create_time` DESC);
CREATE INDEX IF NOT EXISTS `idx_fingerprint` ON `im_user_public_key`(`fingerprint`);

-- =====================================================
-- 2. 分区表（适用于大数据量场景）
-- =====================================================

-- 为加密消息表创建分区（按月分区）
-- 注意：需要先备份数据，在生产环境谨慎执行
/*
ALTER TABLE `im_message_encrypted`
PARTITION BY RANGE (YEAR(create_time) * 100 + MONTH(create_time)) (
    PARTITION p202412 VALUES LESS THAN (202501),
    PARTITION p202501 VALUES LESS THAN (202502),
    PARTITION p202502 VALUES LESS THAN (202503),
    PARTITION p202503 VALUES LESS THAN (202504),
    PARTITION p202504 VALUES LESS THAN (202505),
    PARTITION p202505 VALUES LESS THAN (202506),
    PARTITION p202506 VALUES LESS THAN (202507),
    PARTITION p202507 VALUES LESS THAN (202508),
    PARTITION p202508 VALUES LESS THAN (202509),
    PARTITION p202509 VALUES LESS THAN (202510),
    PARTITION p202510 VALUES LESS THAN (202511),
    PARTITION p202511 VALUES LESS THAN (202512),
    PARTITION p202512 VALUES LESS THAN (202601),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
*/

-- =====================================================
-- 3. 数据归档方案
-- =====================================================

-- 创建归档表（存储历史数据）
CREATE TABLE IF NOT EXISTS `im_message_encrypted_archive` (
    -- 继承原表结构
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `conversation_id` VARCHAR(255) NOT NULL,
    `sender_id` BIGINT NOT NULL,
    `recipient_id` BIGINT,
    `room_id` BIGINT,
    `tenant_id` BIGINT,
    `key_id` VARCHAR(255),
    `algorithm` VARCHAR(50),
    `ciphertext` LONGBLOB,
    `iv` BLOB,
    `tag` BLOB,
    `content_hash` BLOB,
    `signature` BLOB,
    `content_type` VARCHAR(100),
    `encrypted_extra` TEXT,
    `message_size` INT,
    `is_signed` BOOLEAN DEFAULT FALSE,
    `verification_status` VARCHAR(50),
    `encryption_time_ms` BIGINT,
    `self_destruct_timer` BIGINT,
    `read_at` DATETIME,
    `destruct_at` DATETIME,
    `signature_verified_at` DATETIME,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `create_by` VARCHAR(100),
    `update_by` VARCHAR(100),
    `is_del` BOOLEAN DEFAULT FALSE,
    `del_time` DATETIME,

    -- 归档专用字段
    `archive_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '归档时间',
    `archive_reason` VARCHAR(100) COMMENT '归档原因',

    PRIMARY KEY (`id`),
    INDEX `idx_archive_time` (`archive_time`),
    INDEX `idx_conv_archive_time` (`conversation_id`, `archive_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='加密消息归档表';

-- 创建数据归档存储过程
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `archive_encrypted_messages`(
    IN p_days_to_keep INT DEFAULT 90,
    IN p_batch_size INT DEFAULT 1000,
    IN p_dry_run BOOLEAN DEFAULT FALSE
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_total_archived INT DEFAULT 0;
    DECLARE v_batch_count INT DEFAULT 0;

    -- 计算归档截止日期
    DECLARE v_archive_date DATETIME DEFAULT DATE_SUB(NOW(), INTERVAL p_days_to_keep DAY);

    -- 显示归档信息
    SELECT CONCAT('开始归档 ', v_archive_date, ' 之前的消息') AS message;

    -- 统计需要归档的消息数量
    SELECT COUNT(*) INTO v_total_archived
    FROM im_message_encrypted
    WHERE created_at < v_archive_date
      AND is_del = 1;

    SELECT CONCAT('需要归档的消息数量: ', v_total_archived) AS message;

    -- 如果是演练模式，只统计不执行
    IF p_dry_run THEN
        SELECT '演练模式：未实际执行归档' AS message;
        LEAVE;
    END IF;

    -- 禁用外键检查
    SET FOREIGN_KEY_CHECKS = 0;

    -- 循环归档数据
    WHILE v_total_archived > 0 DO
        -- 开始事务
        START TRANSACTION;

        -- 批量迁移数据到归档表
        INSERT INTO im_message_encrypted_archive (
            -- 列出所有字段（除了归档专用字段）
            id, conversation_id, sender_id, recipient_id, room_id, tenant_id,
            key_id, algorithm, ciphertext, iv, tag, content_hash, signature,
            content_type, encrypted_extra, message_size, is_signed, verification_status,
            encryption_time_ms, self_destruct_timer, read_at, destruct_at,
            signature_verified_at, created_at, updated_at, create_by, update_by,
            is_del, del_time, archive_reason
        )
        SELECT
            id, conversation_id, sender_id, recipient_id, room_id, tenant_id,
            key_id, algorithm, ciphertext, iv, tag, content_hash, signature,
            content_type, encrypted_extra, message_size, is_signed, verification_status,
            encryption_time_ms, self_destruct_timer, read_at, destruct_at,
            signature_verified_at, created_at, updated_at, create_by, update_by,
            is_del, del_time, 'DATA_RETENTION_POLICY'
        FROM im_message_encrypted
        WHERE created_at < v_archive_date
          AND is_del = 1
        LIMIT p_batch_size;

        -- 获取影响行数
        SET v_batch_count = ROW_COUNT();

        -- 删除已归档的数据
        DELETE FROM im_message_encrypted
        WHERE id IN (
            SELECT id FROM (
                SELECT id FROM im_message_encrypted_archive
                WHERE archive_reason = 'DATA_RETENTION_POLICY'
                  AND archive_time = CURRENT_TIMESTAMP
                LIMIT p_batch_size
            ) AS temp
        );

        -- 提交事务
        COMMIT;

        -- 更新计数器
        SET v_total_archived = v_total_archived - v_batch_count;

        -- 显示进度
        SELECT CONCAT('已归档批次: ', v_batch_count, ', 剩余: ', v_total_archived) AS message;

        -- 避免长时间锁定
        DO SLEEP(0.1);
    END WHILE;

    -- 恢复外键检查
    SET FOREIGN_KEY_CHECKS = 1;

    SELECT '数据归档完成' AS message;
END //
DELIMITER ;

-- =====================================================
-- 4. 性能监控视图
-- =====================================================

-- 创建表大小监控视图
CREATE OR REPLACE VIEW `v_table_sizes` AS
SELECT
    TABLE_NAME,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size(MB)',
    TABLE_ROWS,
    ROUND((DATA_LENGTH / 1024 / 1024), 2) AS 'Data(MB)',
    ROUND((INDEX_LENGTH / 1024 / 1024), 2) AS 'Index(MB)',
    ROUND((INDEX_LENGTH / DATA_LENGTH), 2) AS 'Index/Data Ratio'
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME LIKE '%message%'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- 创建慢查询统计视图
CREATE OR REPLACE VIEW `v_message_query_stats` AS
SELECT
    DATE(create_time) AS query_date,
    COUNT(*) AS total_queries,
    COUNT(CASE WHEN recipient_id IS NOT NULL THEN 1 END) AS direct_messages,
    COUNT(CASE WHEN room_id IS NOT NULL THEN 1 END) AS group_messages,
    COUNT(CASE WHEN self_destruct_timer IS NOT NULL THEN 1 END) AS self_destruct_messages,
    AVG(message_size) AS avg_message_size,
    MAX(message_size) AS max_message_size
FROM im_message_encrypted
WHERE create_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(create_time)
ORDER BY query_date DESC;

-- =====================================================
-- 5. 定期维护任务（事件调度器）
-- =====================================================

-- 启用事件调度器
SET GLOBAL event_scheduler = ON;

-- 创建定期归档事件（每天凌晨2点执行）
DELIMITER //
CREATE EVENT IF NOT EXISTS `evt_daily_archive`
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURRENT_DATE, '02:00:00')
DO
BEGIN
    -- 归档90天前的数据
    CALL archive_encrypted_messages(90, 1000, FALSE);

    -- 记录归档日志
    INSERT INTO im_system_log (module, operation, description, created_at)
    VALUES ('ARCHIVE', 'DAILY_ARCHIVE', '执行每日数据归档', NOW());
END //
DELIMITER ;

-- 创建每周维护事件（每周日凌晨3点执行）
DELIMITER //
CREATE EVENT IF NOT EXISTS `evt_weekly_maintenance`
ON SCHEDULE EVERY 1 WEEK
STARTS TIMESTAMP(DATE_ADD(CURRENT_DATE, INTERVAL 1 - WEEKDAY(CURRENT_DATE) DAY), '03:00:00')
DO
BEGIN
    -- 分析表以更新统计信息
    ANALYZE TABLE im_message_encrypted;
    ANALYZE TABLE im_user_public_key;

    -- 优化表（谨慎使用，会锁定表）
    -- OPTIMIZE TABLE im_message_encrypted;

    -- 记录维护日志
    INSERT INTO im_system_log (module, operation, description, created_at)
    VALUES ('MAINTENANCE', 'WEEKLY_MAINTENANCE', '执行每周数据库维护', NOW());
END //
DELIMITER ;

-- =====================================================
-- 6. 性能建议配置
-- =====================================================

-- 设置数据库配置参数（需要 DBA 权限）
-- 注意：这些参数需要在 MySQL 配置文件中永久设置
/*
-- InnoDB 缓冲池大小（建议设置为物理内存的 70-80%）
SET GLOBAL innodb_buffer_pool_size = 4294967296; -- 4GB

-- 日志缓冲区大小
SET GLOBAL innodb_log_buffer_size = 67108864; -- 64MB

-- 日志文件大小
SET GLOBAL innodb_log_file_size = 1073741824; -- 1GB

-- 刷新日志方式
SET GLOBAL innodb_flush_log_at_trx_commit = 2;

-- 查询缓存（MySQL 8.0 已移除，其他版本可用）
-- SET GLOBAL query_cache_size = 134217728; -- 128MB
-- SET GLOBAL query_cache_type = ON;

-- 临时表大小
SET GLOBAL tmp_table_size = 134217728; -- 128MB
SET GLOBAL max_heap_table_size = 134217728; -- 128MB

-- 连接数
SET GLOBAL max_connections = 1000;
*/

-- =====================================================
-- 7. 验证和监控
-- =====================================================

-- 检查索引是否创建成功
SELECT
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    INDEX_TYPE,
    CARDINALITY
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'im_message_encrypted'
  AND INDEX_NAME LIKE 'idx_%'
ORDER BY INDEX_NAME;

-- 显示表分区信息（如果启用了分区）
SELECT
    TABLE_NAME,
    PARTITION_NAME,
    PARTITION_DESCRIPTION,
    TABLE_ROWS
FROM INFORMATION_SCHEMA.PARTITIONS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'im_message_encrypted'
  AND PARTITION_NAME IS NOT NULL;

-- =====================================================
-- 8. 使用说明
-- =====================================================

-- 手动执行归档
-- CALL archive_encrypted_messages(90, 1000, TRUE);  -- 演练模式
-- CALL archive_encrypted_messages(90, 1000, FALSE); -- 正式执行

-- 查看归档进度
-- SELECT COUNT(*) FROM im_message_encrypted WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- 查看归档数据量
-- SELECT archive_reason, COUNT(*) FROM im_message_encrypted_archive GROUP BY archive_reason;

-- =====================================================
-- 完成信息
-- =====================================================

SELECT '========================================' AS '';
SELECT 'E2EE 性能优化脚本执行完成！' AS message;
SELECT '========================================' AS '';
SELECT '已完成的优化：' AS '';
SELECT '  1. 添加了复合索引以优化常见查询' AS '';
SELECT '  2. 提供了分区表方案（需手动启用）' AS '';
SELECT '  3. 创建了数据归档机制' AS '';
SELECT '  4. 设置了定期维护任务' AS '';
SELECT '  5. 创建了性能监控视图' AS '';
SELECT '========================================' AS '';
SELECT '注意事项：' AS '';
SELECT '  - 分区表功能需要生产环境评估后手动启用' AS '';
SELECT '  - 数据归档前请确保有完整备份' AS '';
SELECT '  - 建议在低峰期执行维护任务' AS '';
SELECT '  - 定期监控表大小和查询性能' AS '';
SELECT '========================================' AS '';