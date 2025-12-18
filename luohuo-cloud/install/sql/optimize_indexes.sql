-- 数据库索引优化SQL
-- 建议在低峰期执行，大表索引创建可能需要较长时间

USE luohuo_im_01;

DELIMITER //
DROP PROCEDURE IF EXISTS add_index_if_not_exists//
CREATE PROCEDURE add_index_if_not_exists(
    IN p_table VARCHAR(64),
    IN p_index VARCHAR(64),
    IN p_columns TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table
          AND index_name = p_index
    ) THEN
        SET @ddl = CONCAT('CREATE INDEX ', p_index, ' ON ', p_table, ' ', p_columns);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//
DELIMITER ;

-- 1. 消息表索引优化
-- 发送者索引
CALL add_index_if_not_exists('im_message', 'idx_message_sender_time', '(sender_id, send_time DESC)');

-- 接收者索引
CALL add_index_if_not_exists('im_message', 'idx_message_receiver_time', '(receiver_id, send_time DESC)');

-- 群组消息索引
CALL add_index_if_not_exists('im_message', 'idx_message_group_time', '(group_id, send_time DESC)');

-- 复合索引：用户消息查询（私聊）
CALL add_index_if_not_exists('im_message', 'idx_message_user_chat', '(sender_id, receiver_id, send_time DESC)');

-- 复合索引：群组消息查询
CALL add_index_if_not_exists('im_message', 'idx_message_group_chat', '(group_id, send_time DESC, deleted)');

-- 状态索引
CALL add_index_if_not_exists('im_message', 'idx_message_status', '(status, send_time DESC)');

-- 2. 群组成员表索引优化
-- 群组成员查询
CALL add_index_if_not_exists('im_group_member', 'idx_group_member_group_user', '(group_id, user_id)');

-- 用户群组查询
CALL add_index_if_not_exists('im_group_member', 'idx_group_member_user_time', '(user_id, join_time DESC)');

-- 角色索引
CALL add_index_if_not_exists('im_group_member', 'idx_group_member_role', '(group_id, role, join_time DESC)');

-- 3. 用户关系表索引优化
-- 用户好友关系
CALL add_index_if_not_exists('im_user_relation', 'idx_user_relation_users', '(user_id, friend_id)');

-- 双向关系查询
CALL add_index_if_not_exists('im_user_relation', 'idx_user_relation_friend_status', '(friend_id, user_id, status)');

-- 状态索引
CALL add_index_if_not_exists('im_user_relation', 'idx_user_relation_status', '(status, create_time DESC)');

-- 4. 消息已读状态表索引优化
-- 用户消息已读状态
CALL add_index_if_not_exists('im_message_read', 'idx_message_read_user', '(user_id, message_id)');

-- 消息已读状态查询
CALL add_index_if_not_exists('im_message_read', 'idx_message_read_status', '(message_id, read_time DESC)');

-- 5. 推送设备表索引优化
-- 用户设备查询
CALL add_index_if_not_exists('im_push_device', 'idx_push_device_user_active', '(user_id, active, last_active_time DESC)');

-- 设备Token查询
CALL add_index_if_not_exists('im_push_device', 'idx_push_device_token', '(device_token, active)');

-- 设备类型索引
CALL add_index_if_not_exists('im_push_device', 'idx_push_device_type', '(device_type, last_active_time DESC)');

-- 6. 搜索历史表索引优化
-- 用户搜索历史
CALL add_index_if_not_exists('im_search_history', 'idx_search_history_user_type', '(user_id, search_type, searched_at DESC)');

-- 关键词搜索统计
CALL add_index_if_not_exists('im_search_history', 'idx_search_history_keyword', '(keyword, search_type, searched_at DESC)');

-- 7. 推送记录表索引优化
-- 用户推送记录
CALL add_index_if_not_exists('im_push_record', 'idx_push_record_user_time', '(user_id, create_time DESC)');

-- 推送状态查询
CALL add_index_if_not_exists('im_push_record', 'idx_push_record_status', '(status, create_time DESC)');

-- 推送类型统计
CALL add_index_if_not_exists('im_push_record', 'idx_push_record_type', '(push_type, create_time DESC)');

-- 8. 统计表索引优化
-- 消息统计索引
CALL add_index_if_not_exists('im_message_statistics', 'idx_message_stats_date', '(stat_date, user_id)');

-- 活跃度统计索引
CALL add_index_if_not_exists('im_user_activity_statistics', 'idx_activity_stats_date_type', '(stat_date, activity_type)');

-- 9. 分区表优化（针对大数据量场景）
-- 消息表按月分区（需要重新创建表）
/*
CREATE TABLE im_message_partitioned (
    -- 与原表相同的字段结构
    id bigint NOT NULL AUTO_INCREMENT,
    -- ... 其他字段
    PRIMARY KEY (id, send_time)
) PARTITION BY RANGE (YEAR(send_time) * 100 + MONTH(send_time)) (
    PARTITION p202501 VALUES LESS THAN (202502),
    PARTITION p202502 VALUES LESS THAN (202503),
    PARTITION p202503 VALUES LESS THAN (202504),
    -- ... 更多分区
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
*/

-- 10. 定期清理和优化建议
-- 分析表统计信息（建议每周执行一次）
ANALYZE TABLE im_message;
ANALYZE TABLE im_group_member;
ANALYZE TABLE im_user_relation;
ANALYZE TABLE im_push_device;

-- 查看索引使用情况
/*
SELECT
    TABLE_NAME,
    INDEX_NAME,
    CARDINALITY,
    SUB_PART,
    NULLABLE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'luohuo_im_01'
ORDER BY TABLE_NAME, SEQ_IN_INDEX;
*/

-- 查看慢查询
/*
SELECT
    query_time,
    lock_time,
    rows_sent,
    rows_examined,
    sql_text
FROM mysql.slow_log
WHERE start_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)
ORDER BY query_time DESC
LIMIT 10;
*/

DROP PROCEDURE IF EXISTS add_index_if_not_exists;
