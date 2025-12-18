-- =================================================================
-- PII数据迁移后验证脚本
-- =================================================================
-- 用途: 验证数据迁移是否成功完成
-- 执行: mysql -u root -p luohuo_dev < pii-migration-post-verify.sql
-- =================================================================

USE luohuo_dev;

-- 1. 检查加密后的数据特征
SELECT '======== 加密数据特征检查 ========' AS '';

-- 加密后的数据应该是Base64编码，长度应该明显增加
SELECT
    '已加密的邮箱数量' AS 项目,
    COUNT(*) AS 数量,
    AVG(LENGTH(email)) AS 平均长度,
    MIN(LENGTH(email)) AS 最小长度,
    MAX(LENGTH(email)) AS 最大长度
FROM def_user
WHERE email IS NOT NULL
  AND email != ''
  AND LENGTH(email) > 50;  -- 加密后长度应该大于50

SELECT
    '已加密的手机号数量' AS 项目,
    COUNT(*) AS 数量,
    AVG(LENGTH(mobile)) AS 平均长度,
    MIN(LENGTH(mobile)) AS 最小长度,
    MAX(LENGTH(mobile)) AS 最大长度
FROM def_user
WHERE mobile IS NOT NULL
  AND mobile != ''
  AND LENGTH(mobile) > 50;

SELECT
    '已加密的身份证号数量' AS 项目,
    COUNT(*) AS 数量,
    AVG(LENGTH(id_card)) AS 平均长度,
    MIN(LENGTH(id_card)) AS 最小长度,
    MAX(LENGTH(id_card)) AS 最大长度
FROM def_user
WHERE id_card IS NOT NULL
  AND id_card != ''
  AND LENGTH(id_card) > 50;

-- 2. 检查是否有明文数据残留
SELECT '======== 明文数据残留检查 ========' AS '';

-- 检查是否还有看起来像邮箱的明文
SELECT
    '疑似明文邮箱' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE email LIKE '%@%'
  AND email NOT LIKE '%==%'  -- Base64通常包含=
  AND LENGTH(email) < 100;

-- 检查是否还有看起来像手机号的明文
SELECT
    '疑似明文手机号' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE mobile REGEXP '^1[3-9][0-9]{9}$'
  AND LENGTH(mobile) = 11;

-- 检查是否还有看起来像身份证号的明文
SELECT
    '疑似明文身份证号' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE id_card REGEXP '^[0-9]{15}$|^[0-9]{17}[0-9Xx]$'
  AND LENGTH(id_card) IN (15, 18);

-- 3. Base64格式验证
SELECT '======== Base64格式验证 ========' AS '';

-- Base64编码应该只包含 A-Z, a-z, 0-9, +, /, =
SELECT
    '格式正确的加密邮箱' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE email IS NOT NULL
  AND email != ''
  AND email REGEXP '^[A-Za-z0-9+/]+={0,2}$';

SELECT
    '格式正确的加密手机号' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE mobile IS NOT NULL
  AND mobile != ''
  AND mobile REGEXP '^[A-Za-z0-9+/]+={0,2}$';

SELECT
    '格式正确的加密身份证号' AS 项目,
    COUNT(*) AS 数量
FROM def_user
WHERE id_card IS NOT NULL
  AND id_card != ''
  AND id_card REGEXP '^[A-Za-z0-9+/]+={0,2}$';

-- 4. 数据采样查看（加密后）
SELECT '======== 加密数据采样（前5条）========' AS '';

SELECT
    id,
    username,
    CONCAT(SUBSTRING(email, 1, 20), '...') AS email_sample,
    CONCAT(SUBSTRING(mobile, 1, 20), '...') AS mobile_sample,
    CONCAT(SUBSTRING(id_card, 1, 20), '...') AS id_card_sample,
    LENGTH(email) AS email_len,
    LENGTH(mobile) AS mobile_len,
    LENGTH(id_card) AS id_card_len
FROM def_user
WHERE email IS NOT NULL OR mobile IS NOT NULL OR id_card IS NOT NULL
LIMIT 5;

-- 5. 迁移完整性检查
SELECT '======== 迁移完整性检查 ========' AS '';

SELECT
    '迁移前记录数' AS 项目,
    '请填入迁移前统计的数量' AS 数值,
    '需手动核对' AS 状态;

SELECT
    '迁移后记录数' AS 项目,
    COUNT(*) AS 数值,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ 有数据'
        ELSE '❌ 无数据'
    END AS 状态
FROM def_user
WHERE email IS NOT NULL OR mobile IS NOT NULL OR id_card IS NOT NULL;

-- 6. 字段使用空间检查
SELECT '======== 字段空间使用检查 ========' AS '';

SELECT
    COLUMN_NAME AS 字段名,
    CHARACTER_MAXIMUM_LENGTH AS 最大长度,
    (SELECT MAX(LENGTH(email)) FROM def_user WHERE email IS NOT NULL) AS 实际最大使用,
    CASE
        WHEN (SELECT MAX(LENGTH(email)) FROM def_user WHERE email IS NOT NULL) * 1.2 < CHARACTER_MAXIMUM_LENGTH
        THEN '✅ 空间充足'
        ELSE '⚠️ 空间紧张'
    END AS 状态
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'luohuo_dev'
  AND TABLE_NAME = 'def_user'
  AND COLUMN_NAME = 'email';

-- 7. 迁移状态总结
SELECT '======== 迁移状态总结 ========' AS '';

SELECT
    (SELECT COUNT(*) FROM def_user WHERE email IS NOT NULL AND LENGTH(email) > 50) AS 已加密邮箱数,
    (SELECT COUNT(*) FROM def_user WHERE mobile IS NOT NULL AND LENGTH(mobile) > 50) AS 已加密手机号数,
    (SELECT COUNT(*) FROM def_user WHERE id_card IS NOT NULL AND LENGTH(id_card) > 50) AS 已加密身份证号数,
    (SELECT COUNT(*) FROM def_user WHERE email LIKE '%@%' AND LENGTH(email) < 100) AS 疑似明文邮箱数,
    (SELECT COUNT(*) FROM def_user WHERE mobile REGEXP '^1[3-9][0-9]{9}$') AS 疑似明文手机号数,
    (SELECT COUNT(*) FROM def_user WHERE id_card REGEXP '^[0-9]{15}$|^[0-9]{17}[0-9Xx]$') AS 疑似明文身份证号数;

-- 8. 最终验证建议
SELECT '======== 最终验证建议 ========' AS '';
SELECT
    '1. 检查应用日志，确认PII加密器初始化成功' AS 步骤1,
    '2. 尝试通过应用查询用户信息，验证解密功能' AS 步骤2,
    '3. 比对迁移前后的数据量，确保无数据丢失' AS 步骤3,
    '4. 进行小范围功能测试，验证业务流程正常' AS 步骤4,
    '5. 监控应用性能，关注解密操作耗时' AS 步骤5;

-- =================================================================
-- 验证标准:
-- - 所有PII字段长度应大于50字符（加密后）
-- - 不应有明文数据残留（疑似明文数应为0）
-- - 所有加密数据应符合Base64格式
-- - 数据量应与迁移前一致
-- =================================================================
