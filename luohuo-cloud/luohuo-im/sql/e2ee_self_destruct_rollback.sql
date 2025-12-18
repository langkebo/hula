-- =====================================================
-- HuLa E2EE 消息自毁功能回滚脚本
-- 版本: 1.1.0
-- 创建时间: 2025-12-12
-- 描述: 回滚消息自毁功能的数据库变更
-- ⚠️  警告：此脚本将删除所有自毁功能相关的字段和数据！
-- =====================================================

SELECT '⚠️  警告：即将回滚消息自毁功能，所有相关数据将被删除！' AS warning;
SELECT '如果您确定要继续，请在30秒内执行后续命令...' AS notice;

-- 暂停30秒（可选 - 给操作员时间取消）
-- DO SLEEP(30);

-- =====================================================
-- 1. 删除触发器
-- =====================================================

SELECT '正在删除触发器...' AS message;

DROP TRIGGER IF EXISTS `trg_message_encrypted_insert`;
DROP TRIGGER IF EXISTS `trg_message_encrypted_update_read`;

SELECT '触发器已删除' AS message;

-- =====================================================
-- 2. 删除视图
-- =====================================================

SELECT '正在删除视图...' AS message;

DROP VIEW IF EXISTS `v_self_destruct_stats`;
DROP VIEW IF EXISTS `v_expiring_messages`;

SELECT '视图已删除' AS message;

-- =====================================================
-- 3. 删除存储过程
-- =====================================================

SELECT '正在删除存储过程...' AS message;

DROP PROCEDURE IF EXISTS `calculate_initial_destruct_time`;

SELECT '存储过程已删除' AS message;

-- =====================================================
-- 4. 删除索引
-- =====================================================

SELECT '正在删除索引...' AS message;

-- 注意：MySQL语法，如果索引不存在会报错，但不影响执行
ALTER TABLE `im_message_encrypted` DROP INDEX `idx_destruct_status`;
ALTER TABLE `im_message_encrypted` DROP INDEX `idx_self_destruct`;
ALTER TABLE `im_message_encrypted` DROP INDEX `idx_read_at`;
ALTER TABLE `im_message_encrypted` DROP INDEX `idx_destruct_at`;

SELECT '索引已删除' AS message;

-- =====================================================
-- 5. 备份数据（可选 - 在删除字段前备份）
-- =====================================================

-- 可选：创建备份表保存自毁消息数据
/*
CREATE TABLE IF NOT EXISTS `im_message_encrypted_self_destruct_backup` AS
SELECT
    id,
    conversation_id,
    self_destruct_timer,
    read_at,
    destruct_at,
    created_at
FROM im_message_encrypted
WHERE self_destruct_timer IS NOT NULL;

SELECT CONCAT('已备份 ', ROW_COUNT(), ' 条自毁消息数据到 im_message_encrypted_self_destruct_backup') AS message;
*/

-- =====================================================
-- 6. 删除字段
-- =====================================================

SELECT '正在删除字段...' AS message;

-- 删除销毁时间字段
ALTER TABLE `im_message_encrypted` DROP COLUMN IF EXISTS `destruct_at`;

-- 删除已读时间字段
ALTER TABLE `im_message_encrypted` DROP COLUMN IF EXISTS `read_at`;

-- 删除自毁定时器字段
ALTER TABLE `im_message_encrypted` DROP COLUMN IF EXISTS `self_destruct_timer`;

SELECT '字段已删除' AS message;

-- =====================================================
-- 7. 删除系统配置（可选）
-- =====================================================

SELECT '正在删除系统配置...' AS message;

DELETE FROM `im_system_config`
WHERE `config_key` IN (
    'e2ee.self_destruct.enabled',
    'e2ee.self_destruct.min_timer',
    'e2ee.self_destruct.max_timer',
    'e2ee.self_destruct.read_delay',
    'e2ee.self_destruct.cleanup_interval',
    'e2ee.self_destruct.cleanup_batch_size'
);

SELECT '系统配置已删除' AS message;

-- =====================================================
-- 8. 验证回滚结果
-- =====================================================

-- 检查字段是否已删除
SELECT '验证回滚结果...' AS message;

SELECT
    COUNT(*) AS remaining_columns
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'im_message_encrypted'
  AND COLUMN_NAME IN ('self_destruct_timer', 'read_at', 'destruct_at');

-- 检查索引是否已删除
SELECT
    COUNT(*) AS remaining_indexes
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'im_message_encrypted'
  AND INDEX_NAME IN ('idx_destruct_at', 'idx_read_at', 'idx_self_destruct', 'idx_destruct_status');

-- 检查触发器是否已删除
SELECT
    COUNT(*) AS remaining_triggers
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
  AND TRIGGER_NAME IN ('trg_message_encrypted_insert', 'trg_message_encrypted_update_read');

-- 检查视图是否已删除
SELECT
    COUNT(*) AS remaining_views
FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('v_self_destruct_stats', 'v_expiring_messages');

-- =====================================================
-- 9. 清理备份表（可选 - 如果不需要备份数据）
-- =====================================================

-- 如果不需要备份数据，可以删除备份表
-- DROP TABLE IF EXISTS `im_message_encrypted_self_destruct_backup`;

-- =====================================================
-- 回滚脚本执行完成
-- =====================================================

SELECT '========================================' AS '';
SELECT '消息自毁功能回滚完成！' AS message;
SELECT '========================================' AS '';
SELECT '已删除的对象：' AS '';
SELECT '  ✓ 触发器: trg_message_encrypted_insert' AS '';
SELECT '  ✓ 触发器: trg_message_encrypted_update_read' AS '';
SELECT '  ✓ 视图: v_self_destruct_stats' AS '';
SELECT '  ✓ 视图: v_expiring_messages' AS '';
SELECT '  ✓ 存储过程: calculate_initial_destruct_time' AS '';
SELECT '  ✓ 索引: idx_destruct_at' AS '';
SELECT '  ✓ 索引: idx_read_at' AS '';
SELECT '  ✓ 索引: idx_self_destruct' AS '';
SELECT '  ✓ 索引: idx_destruct_status' AS '';
SELECT '  ✓ 字段: self_destruct_timer' AS '';
SELECT '  ✓ 字段: read_at' AS '';
SELECT '  ✓ 字段: destruct_at' AS '';
SELECT '========================================' AS '';
SELECT '⚠️  注意：' AS '';
SELECT '  1. 如果需要恢复，请重新执行迁移脚本' AS '';
SELECT '  2. 备份表 im_message_encrypted_self_destruct_backup 已保留（如果创建）' AS '';
SELECT '  3. 请通知应用团队更新代码以移除自毁功能相关逻辑' AS '';
SELECT '========================================' AS '';
