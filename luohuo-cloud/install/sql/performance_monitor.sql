-- 性能监控相关表

-- 慢查询日志表
CREATE TABLE IF NOT EXISTS `im_slow_query_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `sql_text` text NOT NULL COMMENT 'SQL语句',
  `parameters` json DEFAULT NULL COMMENT '参数',
  `execution_time` int NOT NULL COMMENT '执行时间（毫秒）',
  `result_count` int DEFAULT 0 COMMENT '结果数量',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  PRIMARY KEY (`id`),
  KEY `idx_create_time` (`create_time`),
  KEY `idx_execution_time` (`execution_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='慢查询日志表';

-- 性能报告表
CREATE TABLE IF NOT EXISTS `im_performance_report` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `report_data` json NOT NULL COMMENT '报告数据',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  PRIMARY KEY (`id`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='性能报告表';

-- 搜索历史表（创建时间修正）
ALTER TABLE `im_search_history`
MODIFY COLUMN `searched_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '搜索时间';

-- 推送记录表索引优化
CREATE INDEX IF NOT EXISTS `idx_push_record_device_type` ON `im_push_record`(device_token, push_type, create_time DESC);

-- 搜索历史表索引
CREATE INDEX IF NOT EXISTS `idx_search_history_keyword_time` ON `im_search_history`(keyword, searched_at DESC);

-- 消息表优化索引（补充）
CREATE INDEX IF NOT EXISTS `idx_message_deleted_time` ON `im_message`(deleted, send_time DESC);
CREATE INDEX IF NOT EXISTS `idx_message_sender_deleted` ON `im_message`(sender_id, deleted, send_time DESC);
CREATE INDEX IF NOT EXISTS `idx_message_receiver_deleted` ON `im_message`(receiver_id, deleted, send_time DESC);

-- 群组表索引
CREATE INDEX IF NOT EXISTS `idx_group_owner_time` ON `im_group`(owner_id, create_time DESC);
CREATE INDEX IF NOT EXISTS `idx_group_type_status` ON `im_group`(group_type, status, create_time DESC);

-- 用户表索引
CREATE INDEX IF NOT EXISTS `idx_user_status_time` ON `im_user`(status, create_time DESC);
CREATE INDEX IF NOT EXISTS `idx_user_last_active` ON `im_user`(last_active_time DESC);

-- 文件表索引
CREATE INDEX IF NOT EXISTS `idx_file_user_type` ON `im_file`(user_id, file_type, create_time DESC);
CREATE INDEX IF NOT EXISTS `idx_file_status` ON `im_file`(status, create_time DESC);

-- 添加分区表示例（月分区）
/*
-- 消息表分区（适用于大数据量场景）
-- 注意：执行前请备份原表数据
ALTER TABLE im_message
PARTITION BY RANGE (YEAR(send_time) * 100 + MONTH(send_time)) (
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

-- 自动管理分区存储过程
DELIMITER $$
CREATE PROCEDURE manage_message_partitions()
BEGIN
    DECLARE current_month INT;
    DECLARE max_month INT;

    -- 获取当前年月
    SET current_month = YEAR(NOW()) * 100 + MONTH(NOW());

    -- 获取最大分区
    SELECT MAX(PARTITION_DESCRIPTION) INTO max_month
    FROM information_schema.PARTITIONS
    WHERE TABLE_NAME = 'im_message'
    AND PARTITION_NAME IS NOT NULL;

    -- 如果需要添加新分区
    IF max_month < current_month + 1 THEN
        SET @sql = CONCAT('ALTER TABLE im_message ADD PARTITION (PARTITION p',
                        current_month + 1, ' VALUES LESS THAN (',
                        current_month + 2, '))');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;

    -- 删除6个月前的分区
    SET @sql = CONCAT('ALTER TABLE im_message DROP PARTITION p',
                    current_month - 600);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END$$
DELIMITER ;

-- 创建事件每月执行
CREATE EVENT IF NOT EXISTS manage_message_partitions_event
ON SCHEDULE EVERY 1 MONTH
STARTS '2025-01-01 00:00:00'
DO CALL manage_message_partitions();
*/