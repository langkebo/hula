-- ===================================
-- HuLa端到端加密(E2EE)数据库表结构
-- ===================================

-- 1. 用户公钥表
DROP TABLE IF EXISTS `im_user_public_keys`;
CREATE TABLE `im_user_public_keys` (
    `id` BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `user_id` BIGINT(20) NOT NULL COMMENT '用户ID',
    `tenant_id` BIGINT(20) NOT NULL COMMENT '租户ID',
    `key_id` VARCHAR(64) NOT NULL COMMENT '密钥ID',
    `spki` TEXT NOT NULL COMMENT '公钥SPKI(Base64)',
    `algorithm` VARCHAR(32) NOT NULL DEFAULT 'RSA-OAEP' COMMENT '算法',
    `fingerprint` VARCHAR(64) NOT NULL COMMENT '公钥指纹(SHA-256)',
    `status` TINYINT(1) DEFAULT 1 COMMENT '状态:1-激活,0-禁用',
    `is_del` TINYINT(1) DEFAULT 0 COMMENT '逻辑删除:0-未删除,1-已删除',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `create_by` BIGINT(20) DEFAULT NULL COMMENT '创建人ID',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `update_by` BIGINT(20) DEFAULT NULL COMMENT '更新人ID',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_tenant_key` (`user_id`, `tenant_id`, `key_id`),
    KEY `idx_user_tenant` (`user_id`, `tenant_id`),
    KEY `idx_fingerprint` (`fingerprint`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户公钥表';

-- 2. 加密消息表
DROP TABLE IF EXISTS `im_message_encrypted`;
CREATE TABLE `im_message_encrypted` (
    `id` BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `msg_id` BIGINT(20) DEFAULT NULL COMMENT '关联原始消息ID(兼容性)',
    `conversation_id` VARCHAR(64) NOT NULL COMMENT '会话ID',
    `sender_id` BIGINT(20) NOT NULL COMMENT '发送者ID',
    `recipient_id` BIGINT(20) DEFAULT NULL COMMENT '接收者ID(私聊)',
    `room_id` BIGINT(20) DEFAULT NULL COMMENT '群聊ID',
    `tenant_id` BIGINT(20) NOT NULL COMMENT '租户ID',

    -- 加密相关字段
    `key_id` VARCHAR(64) NOT NULL COMMENT '会话密钥ID',
    `algorithm` VARCHAR(32) NOT NULL DEFAULT 'AES-GCM' COMMENT '加密算法',
    `ciphertext` LONGBLOB NOT NULL COMMENT '密文',
    `iv` VARBINARY(12) NOT NULL COMMENT '初始化向量',
    `tag` VARBINARY(16) DEFAULT NULL COMMENT '认证标签(GCM内嵌)',

    -- 验证字段
    `content_hash` VARBINARY(32) DEFAULT NULL COMMENT '内容哈希(SHA-256)',
    `signature` VARBINARY(256) DEFAULT NULL COMMENT '消息签名(RSA-PSS)',

    -- 元数据
    `content_type` VARCHAR(32) NOT NULL COMMENT '内容类型',
    `encrypted_extra` JSON DEFAULT NULL COMMENT '加密的扩展信息',
    `message_size` INT DEFAULT NULL COMMENT '消息大小(字节)',
    `is_signed` TINYINT(1) DEFAULT 0 COMMENT '是否已签名:0-否,1-是',
    `verification_status` VARCHAR(20) DEFAULT NULL COMMENT '验证状态',
    `signature_verified_at` DATETIME DEFAULT NULL COMMENT '签名验证时间',
    `encryption_time_ms` BIGINT DEFAULT NULL COMMENT '加密耗时(毫秒)',
    `decryption_time_ms` BIGINT DEFAULT NULL COMMENT '解密耗时(毫秒)',

    -- 系统字段
    `is_del` TINYINT(1) DEFAULT 0 COMMENT '逻辑删除:0-未删除,1-已删除',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `create_by` BIGINT(20) DEFAULT NULL COMMENT '创建人ID',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `update_by` BIGINT(20) DEFAULT NULL COMMENT '更新人ID',

    PRIMARY KEY (`id`),
    KEY `idx_msg_id` (`msg_id`),
    KEY `idx_conversation` (`conversation_id`, `create_time`),
    KEY `idx_recipient` (`recipient_id`, `create_time`),
    KEY `idx_room` (`room_id`, `create_time`),
    KEY `idx_sender` (`sender_id`, `create_time`),
    KEY `idx_key_id` (`key_id`),
    KEY `idx_tenant` (`tenant_id`),
    INDEX `idx_ct_hash` (`content_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='加密消息表';

-- 3. 会话密钥包表
DROP TABLE IF EXISTS `im_session_key_packages`;
CREATE TABLE `im_session_key_packages` (
    `id` BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `session_id` VARCHAR(64) NOT NULL COMMENT '会话ID',
    `key_id` VARCHAR(64) NOT NULL COMMENT '密钥ID',
    `sender_id` BIGINT(20) NOT NULL COMMENT '发送者ID',
    `recipient_id` BIGINT(20) NOT NULL COMMENT '接收者ID',
    `tenant_id` BIGINT(20) NOT NULL COMMENT '租户ID',

    -- 加密的会话密钥
    `wrapped_key` LONGBLOB NOT NULL COMMENT 'RSA-OAEP包装的会话密钥',
    `algorithm` VARCHAR(32) NOT NULL DEFAULT 'AES-GCM' COMMENT '算法',

    -- 状态管理
    `status` TINYINT(1) DEFAULT 1 COMMENT '状态:1-激活,0-废弃',
    `expires_at` DATETIME DEFAULT NULL COMMENT '过期时间',
    `is_del` TINYINT(1) DEFAULT 0 COMMENT '逻辑删除:0-未删除,1-已删除',

    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `create_by` BIGINT(20) DEFAULT NULL COMMENT '创建人ID',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `update_by` BIGINT(20) DEFAULT NULL COMMENT '更新人ID',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_session_key` (`session_id`, `key_id`, `recipient_id`),
    KEY `idx_recipient` (`recipient_id`, `status`),
    KEY `idx_session_id` (`session_id`),
    KEY `idx_key_id` (`key_id`),
    KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话密钥包表';

-- 4. 修改现有消息表，添加加密支持
ALTER TABLE `im_message`
ADD COLUMN `is_encrypted` TINYINT(1) DEFAULT 0 COMMENT '是否加密:1-是,0-否' AFTER `type`,
ADD COLUMN `encrypted_msg_id` BIGINT(20) DEFAULT NULL COMMENT '关联的加密消息ID' AFTER `is_encrypted`,
ADD INDEX `idx_encrypted_msg_id` (`encrypted_msg_id`),
ADD INDEX `idx_is_encrypted` (`is_encrypted`);

-- 5. 创建E2EE相关的视图
CREATE OR REPLACE VIEW `v_message_with_encryption` AS
SELECT
    m.*,
    e.conversation_id,
    e.key_id,
    e.algorithm as encrypt_algorithm,
    e.iv,
    e.tag,
    e.content_hash,
    e.signature,
    e.content_type,
    e.encrypted_extra
FROM `im_message` m
LEFT JOIN `im_message_encrypted` e ON m.encrypted_msg_id = e.id;

-- 6. 插入初始配置数据
INSERT INTO `im_system_config` (`config_key`, `config_value`, `description`, `created_at`, `updated_at`) VALUES
('e2ee.enabled', 'false', '端到端加密功能开关', NOW(), NOW()),
('e2ee.default_algorithm', 'AES-GCM', '默认加密算法', NOW(), NOW()),
('e2ee.key_size', '256', '密钥长度', NOW(), NOW()),
('e2ee.rsa_key_size', '2048', 'RSA密钥长度', NOW(), NOW()),
('e2ee.session_key_ttl', '604800', '会话密钥有效期(秒)', NOW(), NOW()),
('e2ee.require_signature', 'false', '是否要求消息签名', NOW(), NOW()),
('e2ee.max_message_size', '1048576', '最大消息大小(字节)', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();