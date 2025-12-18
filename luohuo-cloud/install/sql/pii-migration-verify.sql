-- =================================================================
-- PII数据迁移前验证脚本
-- =================================================================
-- 用途: 在执行数据迁移前，检查数据状态和准备情况
-- 执行: mysql -u root -p luohuo_dev < pii-migration-verify.sql
-- =================================================================

USE luohuo_dev;

-- 1. 检查需要加密的数据量
SELECT '======== 数据量统计 ========' AS '';

SELECT
    '总用户数' AS 项目,
    COUNT(*) AS 数量
FROM def_user;

SELECT
    '有邮箱的用户' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE email IS NOT NULL AND email != '';

SELECT
    '有手机号的用户' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE mobile IS NOT NULL AND mobile != '';

SELECT
    '有身份证号的用户' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE id_card IS NOT NULL AND id_card != '';

-- 2. 检查字段长度（确保能容纳加密后的数据）
SELECT '======== 字段长度检查 ========' AS '';

SELECT
    COLUMN_NAME AS 字段名,
    COLUMN_TYPE AS 当前类型,
    CHARACTER_MAXIMUM_LENGTH AS 最大长度,
    CASE
        WHEN CHARACTER_MAXIMUM_LENGTH < 200 THEN '⚠️ 警告: 长度可能不足，建议VARCHAR(500)'
        ELSE '✅ 长度充足'
    END AS 状态
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'luohuo_dev'
  AND TABLE_NAME = 'def_user'
  AND COLUMN_NAME IN ('email', 'mobile', 'id_card');

-- 3. 检查数据完整性
SELECT '======== 数据完整性检查 ========' AS '';

-- 检查是否有异常长度的数据
SELECT
    '邮箱超长数据' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE LENGTH(email) > 100;

SELECT
    '手机号超长数据' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE LENGTH(mobile) > 20;

SELECT
    '身份证号超长数据' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE LENGTH(id_card) > 20;

-- 4. 采样查看数据示例（前10条）
SELECT '======== 数据采样（前10条）========' AS '';

SELECT
    id,
    username,
    LEFT(email, 3) AS email_prefix,
    LEFT(mobile, 3) AS mobile_prefix,
    LEFT(id_card, 3) AS id_card_prefix,
    create_time
FROM def_user
WHERE email IS NOT NULL OR mobile IS NOT NULL OR id_card IS NOT NULL
LIMIT 10;

-- 5. 检查索引（加密字段上的索引需要特别注意）
SELECT '======== 索引检查 ========' AS '';

SELECT
    INDEX_NAME AS 索引名,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS 索引字段,
    INDEX_TYPE AS 索引类型
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'luohuo_dev'
  AND TABLE_NAME = 'def_user'
  AND COLUMN_NAME IN ('email', 'mobile', 'id_card')
GROUP BY INDEX_NAME, INDEX_TYPE;

-- 6. 数据库备份建议
SELECT '======== 备份建议 ========' AS '';
SELECT '⚠️ 重要提示:' AS 提示,
       '1. 请在迁移前执行完整数据库备份' AS 步骤1,
       '2. 备份命令: mysqldump -u root -p luohuo_dev > backup_before_pii_migration.sql' AS 步骤2,
       '3. 建议在测试环境先执行一次完整迁移流程' AS 步骤3;

-- 7. 预计迁移时间估算
SELECT '======== 迁移时间估算 ========' AS '';

SELECT
    COUNT(*) AS 总记录数,
    CONCAT(CEILING(COUNT(*) / 1000), ' 批次') AS 预计批次数_每批1000条,
    CONCAT(CEILING(COUNT(*) / 1000 * 2), ' 分钟') AS 预计耗时_假设每批2分钟
FROM def_user
WHERE email IS NOT NULL OR mobile IS NOT NULL OR id_card IS NOT NULL;

-- =================================================================
-- 执行结果说明:
-- - 如果字段长度不足，需要先扩容字段
-- - 如果有索引，加密后索引将失效，需要评估影响
-- - 根据数据量规划迁移时间窗口
-- =================================================================
