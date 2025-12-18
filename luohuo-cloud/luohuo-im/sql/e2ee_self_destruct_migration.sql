-- =====================================================
-- HuLa E2EE 消息自毁功能数据库迁移脚本
-- 版本: 1.1.0
-- 创建时间: 2025-12-12
-- 描述: 为加密消息表添加自毁功能相关字段
-- =====================================================

-- 检查数据库版本
SELECT '开始执行消息自毁功能迁移脚本...' AS message;

-- =====================================================
-- 1. 为 im_message_encrypted 表添加自毁相关字段
-- =====================================================

-- 添加自毁定时器字段
ALTER TABLE `im_message_encrypted`
ADD COLUMN `self_destruct_timer` BIGINT NULL COMMENT '自毁定时器(毫秒) - 客户端设置的消息存活时间' AFTER `decryption_time_ms`;

-- 添加消息已读时间字段
ALTER TABLE `im_message_encrypted`
ADD COLUMN `read_at` DATETIME NULL COMMENT '消息被读取时间 - 接收方阅读消息时由客户端上报' AFTER `self_destruct_timer`;

-- 添加消息销毁时间字段
ALTER TABLE `im_message_encrypted`
ADD COLUMN `destruct_at` DATETIME NULL COMMENT '消息销毁时间（自动计算） - 计算规则: min(readAt + 5min, sendTime + selfDestructTimer, sendTime + 3days)' AFTER `read_at`;

-- =====================================================
-- 2. 添加索引以优化查询性能
-- =====================================================

-- 为销毁时间添加索引，用于定时任务快速查询到期消息
CREATE INDEX `idx_destruct_at` ON `im_message_encrypted`(`destruct_at`);

-- 为阅读时间添加索引，用于查询未读消息
CREATE INDEX `idx_read_at` ON `im_message_encrypted`(`read_at`);

-- 为自毁定时器添加索引，用于统计分析
CREATE INDEX `idx_self_destruct` ON `im_message_encrypted`(`self_destruct_timer`);

-- 组合索引：用于查询启用自毁且未销毁的消息
CREATE INDEX `idx_destruct_status` ON `im_message_encrypted`(`destruct_at`, `is_del`);

-- =====================================================
-- 3. 数据验证和完整性检查
-- =====================================================

-- 检查字段是否添加成功
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'im_message_encrypted'
  AND COLUMN_NAME IN ('self_destruct_timer', 'read_at', 'destruct_at');

-- 检查索引是否创建成功
SELECT
    INDEX_NAME,
    COLUMN_NAME,
    INDEX_TYPE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'im_message_encrypted'
  AND INDEX_NAME IN ('idx_destruct_at', 'idx_read_at', 'idx_self_destruct', 'idx_destruct_status');

-- =====================================================
-- 4. 更新系统配置（可选）
-- =====================================================

-- 添加自毁功能相关配置
INSERT INTO `im_system_config` (`config_key`, `config_value`, `description`, `created_at`, `updated_at`) VALUES
('e2ee.self_destruct.enabled', 'true', '消息自毁功能开关', NOW(), NOW()),
('e2ee.self_destruct.min_timer', '300000', '最短自毁定时器(毫秒) - 5分钟', NOW(), NOW()),
('e2ee.self_destruct.max_timer', '259200000', '最长自毁定时器(毫秒) - 3天', NOW(), NOW()),
('e2ee.self_destruct.read_delay', '300000', '阅后自毁延迟(毫秒) - 5分钟', NOW(), NOW()),
('e2ee.self_destruct.cleanup_interval', '60000', '清理任务执行间隔(毫秒) - 1分钟', NOW(), NOW()),
('e2ee.self_destruct.cleanup_batch_size', '1000', '每次清理的最大消息数量', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- =====================================================
-- 5. 创建存储过程（可选 - 用于批量计算销毁时间）
-- =====================================================

DELIMITER //

-- 存储过程：为已有消息计算初始销毁时间
CREATE PROCEDURE IF NOT EXISTS `calculate_initial_destruct_time`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_id BIGINT;
    DECLARE v_create_time DATETIME;
    DECLARE v_self_destruct_timer BIGINT;
    DECLARE v_destruct_at DATETIME;

    -- 游标：查询所有启用自毁但未设置销毁时间的消息
    DECLARE cur CURSOR FOR
        SELECT id, created_at, self_destruct_timer
        FROM im_message_encrypted
        WHERE self_destruct_timer IS NOT NULL
          AND self_destruct_timer > 0
          AND destruct_at IS NULL
          AND is_del = 0;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_id, v_create_time, v_self_destruct_timer;
        IF done THEN
            LEAVE read_loop;
        END IF;

        -- 计算销毁时间（未读状态）
        -- 规则：min(createTime + selfDestructTimer, createTime + 3days)
        SET v_destruct_at = DATE_ADD(v_create_time, INTERVAL LEAST(v_self_destruct_timer, 259200000) / 1000 SECOND);

        -- 更新销毁时间
        UPDATE im_message_encrypted
        SET destruct_at = v_destruct_at
        WHERE id = v_id;

    END LOOP;

    CLOSE cur;

    SELECT CONCAT('成功计算 ', ROW_COUNT(), ' 条消息的初始销毁时间') AS message;
END //

DELIMITER ;

-- =====================================================
-- 6. 数据迁移（为现有消息设置销毁时间）
-- =====================================================

-- 可选：为现有启用自毁的消息计算初始销毁时间
-- 注意：这将修改现有数据，请在生产环境谨慎执行
-- CALL calculate_initial_destruct_time();

-- =====================================================
-- 7. 创建视图（用于监控和统计）
-- =====================================================

-- 创建自毁消息统计视图
CREATE OR REPLACE VIEW `v_self_destruct_stats` AS
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS total_messages,
    COUNT(CASE WHEN self_destruct_timer IS NOT NULL THEN 1 END) AS self_destruct_messages,
    COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) AS read_messages,
    COUNT(CASE WHEN destruct_at IS NOT NULL AND destruct_at <= NOW() THEN 1 END) AS expired_messages,
    AVG(CASE WHEN self_destruct_timer IS NOT NULL THEN self_destruct_timer END) AS avg_timer_ms
FROM im_message_encrypted
WHERE is_del = 0
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 创建即将到期消息视图
CREATE OR REPLACE VIEW `v_expiring_messages` AS
SELECT
    id,
    conversation_id,
    sender_id,
    recipient_id,
    room_id,
    self_destruct_timer,
    read_at,
    destruct_at,
    TIMESTAMPDIFF(MINUTE, NOW(), destruct_at) AS minutes_remaining,
    created_at
FROM im_message_encrypted
WHERE destruct_at IS NOT NULL
  AND destruct_at > NOW()
  AND destruct_at <= DATE_ADD(NOW(), INTERVAL 10 MINUTE)
  AND is_del = 0
ORDER BY destruct_at ASC;

-- =====================================================
-- 8. 添加触发器（可选 - 自动更新销毁时间）
-- =====================================================

DELIMITER //

-- 触发器：插入消息时自动计算销毁时间
CREATE TRIGGER IF NOT EXISTS `trg_message_encrypted_insert`
BEFORE INSERT ON `im_message_encrypted`
FOR EACH ROW
BEGIN
    -- 如果设置了自毁定时器，自动计算销毁时间
    IF NEW.self_destruct_timer IS NOT NULL AND NEW.self_destruct_timer > 0 THEN
        -- 计算初始销毁时间（未读状态）
        -- 规则：min(createTime + selfDestructTimer, createTime + 3days)
        SET NEW.destruct_at = DATE_ADD(
            COALESCE(NEW.created_at, NOW()),
            INTERVAL LEAST(NEW.self_destruct_timer, 259200000) / 1000 SECOND
        );
    END IF;
END //

-- 触发器：更新read_at时重新计算销毁时间
CREATE TRIGGER IF NOT EXISTS `trg_message_encrypted_update_read`
BEFORE UPDATE ON `im_message_encrypted`
FOR EACH ROW
BEGIN
    -- 如果read_at被更新且启用了自毁功能
    IF NEW.read_at IS NOT NULL
       AND OLD.read_at IS NULL
       AND NEW.self_destruct_timer IS NOT NULL
       AND NEW.self_destruct_timer > 0 THEN

        -- 重新计算销毁时间（已读状态）
        -- 规则：min(readAt + 5min, createTime + selfDestructTimer, createTime + 3days)
        DECLARE destruct_after_read DATETIME;
        DECLARE destruct_by_timer DATETIME;
        DECLARE max_destruct_time DATETIME;

        -- 阅后5分钟
        SET destruct_after_read = DATE_ADD(NEW.read_at, INTERVAL 5 MINUTE);

        -- 发送时间 + 定时器
        SET destruct_by_timer = DATE_ADD(
            COALESCE(NEW.created_at, NOW()),
            INTERVAL NEW.self_destruct_timer / 1000 SECOND
        );

        -- 最长保留期：3天
        SET max_destruct_time = DATE_ADD(
            COALESCE(NEW.created_at, NOW()),
            INTERVAL 3 DAY
        );

        -- 取最小值
        SET NEW.destruct_at = LEAST(destruct_after_read, destruct_by_timer, max_destruct_time);
    END IF;
END //

DELIMITER ;

-- =====================================================
-- 9. 权限设置（根据实际需要调整）
-- =====================================================

-- 确保应用用户有足够权限访问新字段和视图
-- GRANT SELECT, INSERT, UPDATE ON im_message_encrypted TO 'app_user'@'%';
-- GRANT SELECT ON v_self_destruct_stats TO 'app_user'@'%';
-- GRANT SELECT ON v_expiring_messages TO 'app_user'@'%';

-- =====================================================
-- 10. 回滚脚本（保存在单独文件中）
-- =====================================================

-- 如需回滚，执行以下命令：
-- DROP TRIGGER IF EXISTS trg_message_encrypted_insert;
-- DROP TRIGGER IF EXISTS trg_message_encrypted_update_read;
-- DROP VIEW IF EXISTS v_self_destruct_stats;
-- DROP VIEW IF EXISTS v_expiring_messages;
-- DROP PROCEDURE IF EXISTS calculate_initial_destruct_time;
-- DROP INDEX idx_destruct_at ON im_message_encrypted;
-- DROP INDEX idx_read_at ON im_message_encrypted;
-- DROP INDEX idx_self_destruct ON im_message_encrypted;
-- DROP INDEX idx_destruct_status ON im_message_encrypted;
-- ALTER TABLE im_message_encrypted DROP COLUMN destruct_at;
-- ALTER TABLE im_message_encrypted DROP COLUMN read_at;
-- ALTER TABLE im_message_encrypted DROP COLUMN self_destruct_timer;

-- =====================================================
-- 迁移脚本执行完成
-- =====================================================

SELECT '========================================' AS '';
SELECT '消息自毁功能数据库迁移完成！' AS message;
SELECT '========================================' AS '';
SELECT '已添加字段：' AS '';
SELECT '  - self_destruct_timer (BIGINT)' AS '';
SELECT '  - read_at (DATETIME)' AS '';
SELECT '  - destruct_at (DATETIME)' AS '';
SELECT '========================================' AS '';
SELECT '已创建索引：' AS '';
SELECT '  - idx_destruct_at' AS '';
SELECT '  - idx_read_at' AS '';
SELECT '  - idx_self_destruct' AS '';
SELECT '  - idx_destruct_status' AS '';
SELECT '========================================' AS '';
SELECT '已创建视图：' AS '';
SELECT '  - v_self_destruct_stats (统计视图)' AS '';
SELECT '  - v_expiring_messages (即将到期消息)' AS '';
SELECT '========================================' AS '';
SELECT '已创建触发器：' AS '';
SELECT '  - trg_message_encrypted_insert (自动计算销毁时间)' AS '';
SELECT '  - trg_message_encrypted_update_read (更新销毁时间)' AS '';
SELECT '========================================' AS '';
SELECT '已创建存储过程：' AS '';
SELECT '  - calculate_initial_destruct_time (批量计算)' AS '';
SELECT '========================================' AS '';
SELECT '请检查以上对象是否创建成功！' AS notice;
SELECT '========================================' AS '';
