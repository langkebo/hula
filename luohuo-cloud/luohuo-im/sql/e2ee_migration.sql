-- =====================================================
-- HuLa E2EE (端到端加密) 数据库迁移脚本
-- 版本: 1.0.0
-- 创建时间: 2025-01-01
-- 描述: 创建端到端加密所需的所有数据库表
-- =====================================================

-- 1. 用户公钥表
-- 用途: 存储用户的RSA-OAEP公钥，用于密钥交换和消息加密
CREATE TABLE IF NOT EXISTS `im_user_public_keys` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id` BIGINT NOT NULL COMMENT '租户ID',
    `user_id` BIGINT NOT NULL COMMENT '用户ID',
    `key_id` VARCHAR(64) NOT NULL COMMENT '密钥ID（唯一标识）',
    `spki` TEXT NOT NULL COMMENT '公钥SPKI格式（Base64编码）',
    `algorithm` VARCHAR(32) NOT NULL DEFAULT 'RSA-OAEP' COMMENT '算法类型',
    `fingerprint` VARCHAR(64) NOT NULL COMMENT '公钥指纹（SHA-256哈希）',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-激活, 0-禁用, 2-已过期, 3-已废弃',
    `last_used_at` DATETIME NULL COMMENT '最后使用时间',
    `expires_at` DATETIME NULL COMMENT '过期时间',
    `key_usage` VARCHAR(100) NULL COMMENT '密钥用途描述',
    `created_by` BIGINT NULL COMMENT '创建人',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_by` BIGINT NULL COMMENT '更新人',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_key_id` (`key_id`),
    UNIQUE KEY `uk_fingerprint` (`fingerprint`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_tenant_user` (`tenant_id`, `user_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户公钥表';

-- 2. 会话密钥包表
-- 用途: 存储用RSA-OAEP包装的AES会话密钥
CREATE TABLE IF NOT EXISTS `im_session_key_packages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id` BIGINT NOT NULL COMMENT '租户ID',
    `session_id` VARCHAR(64) NOT NULL COMMENT '会话ID',
    `key_id` VARCHAR(64) NOT NULL COMMENT '密钥ID',
    `sender_id` BIGINT NOT NULL COMMENT '发送者ID',
    `recipient_id` BIGINT NOT NULL COMMENT '接收者ID',
    `wrapped_key` BLOB NOT NULL COMMENT 'RSA-OAEP包装的会话密钥',
    `algorithm` VARCHAR(32) NOT NULL DEFAULT 'AES-GCM' COMMENT '加密算法',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-待消费, 2-已消费, 3-已过期, 4-已废弃',
    `expires_at` DATETIME NULL COMMENT '过期时间',
    `used_at` DATETIME NULL COMMENT '使用时间',
    `rotation_count` INT NOT NULL DEFAULT 0 COMMENT '密钥轮换次数',
    `forward_secret` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否使用前向安全',
    `ephemeral_public_key` TEXT NULL COMMENT 'Ephemeral公钥（用于ECDH）',
    `kdf_algorithm` VARCHAR(32) NULL COMMENT '密钥派生算法',
    `kdf_info` VARCHAR(255) NULL COMMENT '密钥派生信息',
    `created_by` BIGINT NULL COMMENT '创建人',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_by` BIGINT NULL COMMENT '更新人',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_session_key` (`session_id`, `key_id`),
    KEY `idx_sender` (`sender_id`),
    KEY `idx_recipient` (`recipient_id`),
    KEY `idx_status` (`status`),
    KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话密钥包表';

-- 3. 加密消息表
-- 用途: 存储端到端加密的消息内容
CREATE TABLE IF NOT EXISTS `im_message_encrypted` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id` BIGINT NOT NULL COMMENT '租户ID',
    `msg_id` BIGINT NULL COMMENT '关联原始消息ID（兼容性）',
    `conversation_id` VARCHAR(64) NOT NULL COMMENT '会话ID',
    `sender_id` BIGINT NOT NULL COMMENT '发送者ID',
    `recipient_id` BIGINT NULL COMMENT '接收者ID（私聊）',
    `room_id` BIGINT NULL COMMENT '群聊ID',
    `key_id` VARCHAR(64) NOT NULL COMMENT '会话密钥ID',
    `algorithm` VARCHAR(32) NOT NULL DEFAULT 'AES-GCM' COMMENT '加密算法',
    `ciphertext` MEDIUMBLOB NOT NULL COMMENT '密文',
    `iv` BLOB NOT NULL COMMENT '初始化向量（IV）',
    `tag` BLOB NULL COMMENT '认证标签（GCM）',
    `content_hash` BINARY(32) NULL COMMENT '内容哈希（SHA-256）',
    `signature` BLOB NULL COMMENT '消息签名（RSA-PSS）',
    `content_type` VARCHAR(32) NOT NULL DEFAULT 'text' COMMENT '内容类型',
    `encrypted_extra` TEXT NULL COMMENT '加密的扩展信息（JSON格式）',
    `message_size` INT NULL COMMENT '消息大小（字节）',
    `is_signed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已签名',
    `verification_status` VARCHAR(20) NULL COMMENT '验证状态',
    `signature_verified_at` DATETIME NULL COMMENT '签名验证时间',
    `encryption_time_ms` BIGINT NULL COMMENT '加密耗时（毫秒）',
    `decryption_time_ms` BIGINT NULL COMMENT '解密耗时（毫秒）',
    `created_by` BIGINT NULL COMMENT '创建人',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_by` BIGINT NULL COMMENT '更新人',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_msg_id` (`msg_id`),
    KEY `idx_conversation` (`conversation_id`),
    KEY `idx_sender` (`sender_id`),
    KEY `idx_recipient` (`recipient_id`),
    KEY `idx_room` (`room_id`),
    KEY `idx_key_id` (`key_id`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='加密消息表';

-- 4. 密钥备份表
-- 用途: 存储用户密钥的安全备份（使用门限方案）
CREATE TABLE IF NOT EXISTS `im_key_backup` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id` BIGINT NOT NULL COMMENT '租户ID',
    `user_id` BIGINT NOT NULL COMMENT '用户ID',
    `key_id` VARCHAR(64) NOT NULL COMMENT '密钥ID',
    `backup_type` VARCHAR(32) NOT NULL DEFAULT 'ENCRYPTED_SHARES' COMMENT '备份类型',
    `backup_data` MEDIUMTEXT NOT NULL COMMENT '备份数据（加密）',
    `encryption_algorithm` VARCHAR(32) NOT NULL DEFAULT 'AES-256-GCM' COMMENT '加密算法',
    `access_code` VARCHAR(128) NULL COMMENT '访问代码（哈希）',
    `access_code_expires_at` DATETIME NULL COMMENT '访问代码过期时间',
    `recovery_threshold` INT NOT NULL DEFAULT 1 COMMENT '恢复阈值（门限方案）',
    `total_shares` INT NOT NULL DEFAULT 1 COMMENT '总份额数（门限方案）',
    `backup_location` VARCHAR(100) NULL COMMENT '备份位置标识',
    `backup_version` INT NOT NULL DEFAULT 1 COMMENT '备份版本',
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态',
    `last_accessed_at` DATETIME NULL COMMENT '最后访问时间',
    `access_count` INT NOT NULL DEFAULT 0 COMMENT '访问次数',
    `created_by` BIGINT NULL COMMENT '创建人',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_by` BIGINT NULL COMMENT '更新人',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_key` (`user_id`, `key_id`),
    KEY `idx_status` (`status`),
    KEY `idx_tenant_user` (`tenant_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='密钥备份表';

-- 5. 密钥恢复请求表
-- 用途: 管理用户密钥恢复流程
CREATE TABLE IF NOT EXISTS `im_key_recovery_request` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id` BIGINT NOT NULL COMMENT '租户ID',
    `user_id` BIGINT NOT NULL COMMENT '用户ID',
    `recovery_type` VARCHAR(32) NOT NULL COMMENT '恢复类型: PASSWORD/SECURITY_QUESTION/EMAIL/PHONE/ADMIN',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-待审核, 2-审核通过, 3-审核拒绝, 4-恢复成功, 5-恢复失败',
    `key_id` VARCHAR(64) NOT NULL COMMENT '请求的密钥ID',
    `backup_verification` TEXT NULL COMMENT '备份验证数据（加密）',
    `recovery_token` VARCHAR(128) NULL COMMENT '恢复令牌',
    `token_expires_at` DATETIME NULL COMMENT '令牌过期时间',
    `verification_attempts` INT NOT NULL DEFAULT 0 COMMENT '验证次数',
    `max_attempts` INT NOT NULL DEFAULT 3 COMMENT '最大验证次数',
    `security_question` TEXT NULL COMMENT '验证问题',
    `security_answer_hash` VARCHAR(128) NULL COMMENT '问题答案（哈希）',
    `backup_email` VARCHAR(100) NULL COMMENT '备用邮箱',
    `backup_phone` VARCHAR(20) NULL COMMENT '备用手机号',
    `identity_verification` TEXT NULL COMMENT '身份验证数据',
    `reviewer_id` BIGINT NULL COMMENT '审核员ID',
    `review_comment` TEXT NULL COMMENT '审核意见',
    `reviewed_at` DATETIME NULL COMMENT '审核时间',
    `completed_at` DATETIME NULL COMMENT '完成时间',
    `recovered_key_data` MEDIUMTEXT NULL COMMENT '恢复的密钥数据（加密）',
    `ip_address` VARCHAR(45) NULL COMMENT 'IP地址',
    `user_agent` VARCHAR(255) NULL COMMENT '用户代理',
    `failure_reason` TEXT NULL COMMENT '失败原因',
    `created_by` BIGINT NULL COMMENT '创建人',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_by` BIGINT NULL COMMENT '更新人',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_tenant_user` (`tenant_id`, `user_id`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='密钥恢复请求表';

-- =====================================================
-- 初始化数据（可选）
-- =====================================================

-- 插入示例数据（仅用于开发环境测试）
-- INSERT INTO im_user_public_keys ... (根据需要添加测试数据)

-- =====================================================
-- 索引优化建议
-- =====================================================
-- 1. 根据实际查询模式调整索引
-- 2. 定期分析慢查询日志
-- 3. 考虑对大表进行分区（按时间或用户ID）
-- 4. 监控索引使用情况: SHOW INDEX FROM table_name

-- =====================================================
-- 安全建议
-- =====================================================
-- 1. 定期备份这些表的数据
-- 2. 启用binlog进行增量备份
-- 3. 考虑对敏感字段（ciphertext, wrapped_key等）进行透明数据加密(TDE)
-- 4. 定期审计访问日志
-- 5. 设置适当的数据库用户权限

-- =====================================================
-- 性能优化建议
-- =====================================================
-- 1. im_message_encrypted表可能会快速增长，考虑按月分区
-- 2. 定期归档历史消息数据
-- 3. 对BLOB字段考虑使用压缩
-- 4. 监控表大小和查询性能

-- 脚本执行完成
SELECT 'E2EE数据库迁移脚本执行完成！' AS message;
