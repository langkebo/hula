-- E2EE密钥恢复相关表结构

USE hula_e2ee;

-- 1. 密钥恢复请求表
CREATE TABLE IF NOT EXISTS im_key_recovery_request (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',

    -- 租户信息
    tenant_id BIGINT NOT NULL DEFAULT 0 COMMENT '租户ID',

    -- 用户信息
    user_id BIGINT NOT NULL COMMENT '用户ID',

    -- 恢复信息
    recovery_type VARCHAR(20) NOT NULL COMMENT '恢复类型(LOST_KEY,CORRUPTED_KEY,DEVICE_CHANGE,ACCOUNT_RECOVERY,EMERGENCY_RECOVERY)',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '恢复状态(PENDING,PENDING_VERIFICATION,VERIFYING,APPROVED,REJECTED,PROCESSING,COMPLETED,CANCELLED,EXPIRED,FAILED)',
    key_id VARCHAR(64) NOT NULL COMMENT '请求的密钥ID',

    -- 验证相关
    backup_verification TEXT COMMENT '备份验证数据(加密的)',
    recovery_token VARCHAR(128) COMMENT '恢复令牌',
    token_expires_at DATETIME COMMENT '令牌过期时间',
    verification_attempts INT NOT NULL DEFAULT 0 COMMENT '验证次数',
    max_attempts INT NOT NULL DEFAULT 3 COMMENT '最大验证次数',

    -- 安全问答
    security_question TEXT COMMENT '验证问题',
    security_answer_hash VARCHAR(128) COMMENT '问题答案哈希',

    -- 备用联系方式
    backup_email VARCHAR(255) COMMENT '备用邮箱',
    backup_phone VARCHAR(50) COMMENT '备用手机号',

    -- 身份验证
    identity_verification TEXT COMMENT '身份验证数据',

    -- 审核信息
    reviewer_id BIGINT COMMENT '审核员ID',
    review_comment TEXT COMMENT '审核意见',
    reviewed_at DATETIME COMMENT '审核时间',

    -- 完成信息
    completed_at DATETIME COMMENT '完成时间',
    recovered_key_data TEXT COMMENT '恢复的密钥数据(加密)',

    -- 审计信息
    ip_address VARCHAR(45) COMMENT 'IP地址',
    user_agent TEXT COMMENT '用户代理',
    failure_reason TEXT COMMENT '失败原因',

    -- 标准字段
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    create_by VARCHAR(64) COMMENT '创建者',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    update_by VARCHAR(64) COMMENT '更新者',
    is_del TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除',

    -- 索引
    INDEX idx_user_id (user_id),
    INDEX idx_key_id (key_id),
    INDEX idx_status (status),
    INDEX idx_recovery_type (recovery_type),
    INDEX idx_create_time (create_time),
    INDEX idx_tenant_user (tenant_id, user_id),
    INDEX idx_token (recovery_token),

    UNIQUE KEY uk_user_key_status (user_id, key_id, status) COMMENT '用户密钥状态唯一约束'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='密钥恢复请求表';

-- 2. 密钥备份表
CREATE TABLE IF NOT EXISTS im_key_backup (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',

    -- 租户信息
    tenant_id BIGINT NOT NULL DEFAULT 0 COMMENT '租户ID',

    -- 用户和密钥信息
    user_id BIGINT NOT NULL COMMENT '用户ID',
    key_id VARCHAR(64) NOT NULL COMMENT '密钥ID',

    -- 备份类型
    backup_type VARCHAR(20) NOT NULL COMMENT '备份类型(FULL,ENCRYPTED_SHARES,SHAMIR_SECRET)',

    -- 备份数据
    backup_data TEXT NOT NULL COMMENT '备份数据(加密)',
    encryption_algorithm VARCHAR(20) DEFAULT 'AES-256-GCM' COMMENT '备份数据加密算法',

    -- 访问控制
    access_code VARCHAR(128) COMMENT '访问代码(哈希)',
    access_code_expires_at DATETIME COMMENT '访问代码过期时间',

    -- 恢复条件
    recovery_threshold INT DEFAULT 1 COMMENT '恢复阈值(用于门限方案)',
    total_shares INT DEFAULT 1 COMMENT '总份额数(用于门限方案)',

    -- 备份元数据
    backup_location VARCHAR(255) COMMENT '备份位置标识',
    backup_version INT DEFAULT 1 COMMENT '备份版本',

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态(ACTIVE,INACTIVE,COMPROMISED)',

    -- 使用记录
    last_accessed_at DATETIME COMMENT '最后访问时间',
    access_count INT DEFAULT 0 COMMENT '访问次数',

    -- 标准字段
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    create_by VARCHAR(64) COMMENT '创建者',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    update_by VARCHAR(64) COMMENT '更新者',
    is_del TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除',

    -- 索引
    INDEX idx_user_id (user_id),
    INDEX idx_key_id (key_id),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time),
    INDEX idx_tenant_user (tenant_id, user_id),
    INDEX idx_backup_type (backup_type),

    UNIQUE KEY uk_user_key (user_id, key_id) COMMENT '用户密钥唯一约束'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='密钥备份表';

-- 3. 密钥恢复审计表
CREATE TABLE IF NOT EXISTS im_key_recovery_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',

    -- 关联信息
    recovery_request_id BIGINT NOT NULL COMMENT '恢复请求ID',

    -- 操作信息
    action VARCHAR(50) NOT NULL COMMENT '操作类型',
    operator_id BIGINT COMMENT '操作者ID',
    operator_type VARCHAR(20) COMMENT '操作者类型(USER,ADMIN,AUTOMATED)',

    -- 操作详情
    action_detail TEXT COMMENT '操作详情',
    previous_status VARCHAR(20) COMMENT '之前状态',
    new_status VARCHAR(20) COMMENT '新状态',

    -- 结果
    success TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否成功',
    failure_reason TEXT COMMENT '失败原因',

    -- 系统信息
    ip_address VARCHAR(45) COMMENT 'IP地址',
    user_agent TEXT COMMENT '用户代理',

    -- 标准字段
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    -- 索引
    INDEX idx_recovery_request_id (recovery_request_id),
    INDEX idx_action (action),
    INDEX idx_operator_id (operator_id),
    INDEX idx_create_time (create_time),

    FOREIGN KEY fk_recovery_request (recovery_request_id) REFERENCES im_key_recovery_request(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='密钥恢复审计表';

-- 4. 插入一些示例配置数据
INSERT IGNORE INTO im_key_backup (
    user_id, key_id, backup_type, backup_data, encryption_algorithm,
    access_code, recovery_threshold, total_shares, status
) VALUES (
    1001, 'demo_key_001', 'ENCRYPTED_SHARES',
    'U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y96Qsv2Lm+31cmzaAILwyt',
    'AES-256-GCM',
    '5f4dcc3b5aa765d61d8327deb882cf99', -- MD5 hash of 'password'
    2, 3, 'ACTIVE'
);

-- 添加外键约束
ALTER TABLE im_key_recovery_request
ADD CONSTRAINT fk_recovery_user FOREIGN KEY (user_id) REFERENCES im_user(id) ON DELETE CASCADE;

-- 创建视图：恢复请求统计
CREATE VIEW v_key_recovery_stats AS
SELECT
    tenant_id,
    DATE(create_time) as recovery_date,
    recovery_type,
    status,
    COUNT(*) as request_count,
    AVG(TIMESTAMPDIFF(HOUR, create_time, COALESCE(completed_at, reviewed_at, NOW()))) as avg_completion_hours
FROM im_key_recovery_request
WHERE is_del = 0
GROUP BY tenant_id, DATE(create_time), recovery_type, status;

-- 创建视图：活跃备份统计
CREATE VIEW v_key_backup_stats AS
SELECT
    tenant_id,
    backup_type,
    status,
    COUNT(*) as backup_count,
    COUNT(CASE WHEN last_accessed_at > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_access_count
FROM im_key_backup
WHERE is_del = 0
GROUP BY tenant_id, backup_type, status;