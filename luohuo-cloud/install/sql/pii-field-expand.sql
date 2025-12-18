-- =================================================================
-- PII字段扩容脚本
-- =================================================================
-- 用途: 扩展email、mobile、id_card字段长度，以容纳加密后的数据
-- 执行: mysql -u root -p luohuo_dev < pii-field-expand.sql
-- 重要: 在测试环境验证后再在生产环境执行
-- =================================================================

USE luohuo_dev;

-- 显示当前字段信息
SELECT '======== 扩容前字段信息 ========' AS '';
SHOW FULL COLUMNS FROM def_user WHERE Field IN ('email', 'mobile', 'id_card');

-- 开始事务
START TRANSACTION;

-- 1. 备份当前表结构
CREATE TABLE IF NOT EXISTS def_user_structure_backup_20251213
SELECT * FROM def_user WHERE 1=0;

-- 2. 扩容email字段
-- 原因: 加密后的Base64字符串需要更多空间
-- 原长度: VARCHAR(255)
-- 新长度: VARCHAR(500) - 足以容纳加密后的数据 + 余量
ALTER TABLE def_user
MODIFY COLUMN email VARCHAR(500) COMMENT '邮箱 (AES-256-GCM加密)';

-- 3. 扩容mobile字段
-- 原长度: VARCHAR(20)
-- 新长度: VARCHAR(500)
ALTER TABLE def_user
MODIFY COLUMN mobile VARCHAR(500) COMMENT '手机号 (AES-256-GCM加密)';

-- 4. 扩容id_card字段
-- 原长度: VARCHAR(18)
-- 新长度: VARCHAR(500)
ALTER TABLE def_user
MODIFY COLUMN id_card VARCHAR(500) COMMENT '身份证号 (AES-256-GCM加密)';

-- 显示扩容后字段信息
SELECT '======== 扩容后字段信息 ========' AS '';
SHOW FULL COLUMNS FROM def_user WHERE Field IN ('email', 'mobile', 'id_card');

-- 提交事务
COMMIT;

-- 验证扩容结果
SELECT
    COLUMN_NAME AS 字段名,
    COLUMN_TYPE AS 新类型,
    CHARACTER_MAXIMUM_LENGTH AS 新长度,
    COLUMN_COMMENT AS 注释
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'luohuo_dev'
  AND TABLE_NAME = 'def_user'
  AND COLUMN_NAME IN ('email', 'mobile', 'id_card');

SELECT '✅ 字段扩容完成！' AS 状态;
SELECT '⚠️ 注意: 请备份此脚本执行前的数据库状态' AS 提示;

-- =================================================================
-- 回滚脚本（如果需要）:
-- =================================================================
-- ALTER TABLE def_user MODIFY COLUMN email VARCHAR(255) COMMENT '邮箱';
-- ALTER TABLE def_user MODIFY COLUMN mobile VARCHAR(20) COMMENT '手机号';
-- ALTER TABLE def_user MODIFY COLUMN id_card VARCHAR(18) COMMENT '身份证号';
-- =================================================================
