-- 添加QQ邮箱SMTP配置
-- QQ邮箱：656042408@qq.com
-- 授权码：ydpzvwmnqcpkbeie

-- 首先删除旧的邮件配置（如果存在）
DELETE FROM `base_config` WHERE `config_key` IN ('mailHost', 'mailPort', 'mailUsername', 'mailPassword', 'mailProtocol', 'mailSmtpAuth', 'mailSmtpStarttls', 'mailFrom');

-- 插入QQ邮箱SMTP配置
INSERT INTO `base_config` (`type`, `config_name`, `config_key`, `config_value`, `is_del`, `create_time`, `update_time`, `create_by`, `update_by`, `tenant_id`) VALUES
-- SMTP服务器配置
('mail_config', '{"title":"SMTP服务器","componentType":"text","value":"smtp.qq.com","configKey":"mailHost","type":"mail_config"}', 'mailHost', 'smtp.qq.com', 0, NOW(), NOW(), 3, NULL, 0),

-- SMTP端口配置
('mail_config', '{"title":"SMTP端口","componentType":"text","value":"587","configKey":"mailPort","type":"mail_config"}', 'mailPort', '587', 0, NOW(), NOW(), 3, NULL, 0),

-- 邮箱账号配置
('mail_config', '{"title":"邮箱账号","componentType":"text","value":"656042408@qq.com","configKey":"mailUsername","type":"mail_config"}', 'mailUsername', '656042408@qq.com', 0, NOW(), NOW(), 3, NULL, 0),

-- 邮箱授权码配置（注意：这里存储的是加密后的值，实际应用中应该加密存储）
('mail_config', '{"title":"邮箱授权码","componentType":"password","value":"ydpzvwmnqcpkbeie","configKey":"mailPassword","type":"mail_config"}', 'mailPassword', 'ydpzvwmnqcpkbeie', 0, NOW(), NOW(), 3, NULL, 0),

-- 邮件协议配置
('mail_config', '{"title":"邮件协议","componentType":"select","value":"smtp","configKey":"mailProtocol","type":"mail_config"}', 'mailProtocol', 'smtp', 0, NOW(), NOW(), 3, NULL, 0),

-- SMTP认证配置
('mail_config', '{"title":"SMTP认证","componentType":"switch","value":true,"configKey":"mailSmtpAuth","type":"mail_config"}', 'mailSmtpAuth', 'true', 0, NOW(), NOW(), 3, NULL, 0),

-- SMTP StartTLS配置
('mail_config', '{"title":"StartTLS加密","componentType":"switch","value":true,"configKey":"mailSmtpStarttls","type":"mail_config"}', 'mailSmtpStarttls', 'true', 0, NOW(), NOW(), 3, NULL, 0),

-- 发件人邮箱配置
('mail_config', '{"title":"发件人邮箱","componentType":"text","value":"656042408@qq.com","configKey":"mailFrom","type":"mail_config"}', 'mailFrom', '656042408@qq.com', 0, NOW(), NOW(), 3, NULL, 0);

-- 更新系统管理员邮箱为QQ邮箱
UPDATE `base_config`
SET `config_value` = '656042408@qq.com',
    `update_time` = NOW()
WHERE `config_key` = 'masterEmail';

-- 创建邮件发送日志表（如果不存在）
CREATE TABLE IF NOT EXISTS `mail_send_log` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `to_email` varchar(255) NOT NULL COMMENT '收件人邮箱',
    `subject` varchar(500) DEFAULT NULL COMMENT '邮件主题',
    `content` text COMMENT '邮件内容',
    `send_status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '发送状态：0-待发送，1-发送成功，2-发送失败',
    `send_time` datetime(3) DEFAULT NULL COMMENT '发送时间',
    `error_message` text COMMENT '错误信息',
    `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `update_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    `create_by` bigint DEFAULT NULL COMMENT '创建人',
    `tenant_id` bigint NOT NULL DEFAULT 1 COMMENT '租户ID',
    PRIMARY KEY (`id`),
    INDEX `idx_to_email` (`to_email`),
    INDEX `idx_send_status` (`send_status`),
    INDEX `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮件发送日志表';

-- 创建邮件模板表（如果不存在）
CREATE TABLE IF NOT EXISTS `mail_template` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `template_code` varchar(100) NOT NULL COMMENT '模板编码',
    `template_name` varchar(200) NOT NULL COMMENT '模板名称',
    `subject` varchar(500) NOT NULL COMMENT '邮件主题模板',
    `content` text NOT NULL COMMENT '邮件内容模板',
    `template_type` varchar(50) DEFAULT NULL COMMENT '模板类型：register-注册，reset-重置密码，notice-通知',
    `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
    `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `update_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    `create_by` bigint DEFAULT NULL COMMENT '创建人',
    `update_by` bigint DEFAULT NULL COMMENT '更新人',
    `tenant_id` bigint NOT NULL DEFAULT 1 COMMENT '租户ID',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_template_code` (`template_code`),
    INDEX `idx_template_type` (`template_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮件模板表';

-- 插入默认邮件模板
INSERT INTO `mail_template` (`template_code`, `template_name`, `subject`, `content`, `template_type`, `create_by`, `tenant_id`) VALUES
-- 注册验证邮件模板
('register_verify', '注册验证邮件', '欢迎使用Hula-IM，请验证您的邮箱',
'<div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #333;">欢迎使用Hula-IM</h2>
    <p>您好！</p>
    <p>感谢您注册Hula-IM即时通讯系统。请点击下面的链接验证您的邮箱：</p>
    <p style="margin: 20px 0;">
        <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">验证邮箱</a>
    </p>
    <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：<br>${verifyUrl}</p>
    <p>该链接有效期24小时，请及时验证。</p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
    <p style="color: #666; font-size: 12px;">
        此邮件由系统自动发送，请勿回复。<br>
        如有问题，请联系客服：656042408@qq.com
    </p>
</div>', 'register', 3, 1),

-- 密码重置邮件模板
('password_reset', '密码重置邮件', 'Hula-IM密码重置通知',
'<div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #333;">密码重置通知</h2>
    <p>您好！</p>
    <p>我们收到了您的密码重置请求。请点击下面的链接重置您的密码：</p>
    <p style="margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">重置密码</a>
    </p>
    <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：<br>${resetUrl}</p>
    <p>该链接有效期30分钟，请及时操作。</p>
    <p style="color: #999; font-size: 14px;">如果您没有请求重置密码，请忽略此邮件。</p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
    <p style="color: #666; font-size: 12px;">
        此邮件由系统自动发送，请勿回复。<br>
        如有问题，请联系客服：656042408@qq.com
    </p>
</div>', 'reset', 3, 1),

-- 系统通知邮件模板
('system_notice', '系统通知邮件', 'Hula-IM系统通知',
'<div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #333;">系统通知</h2>
    <p>尊敬的用户：</p>
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        ${noticeContent}
    </div>
    <p>如有任何疑问，请及时联系我们。</p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
    <p style="color: #666; font-size: 12px;">
        此邮件由系统自动发送，请勿回复。<br>
        Hula-IM团队<br>
        客服邮箱：656042408@qq.com
    </p>
</div>', 'notice', 3, 1);

-- 查询验证
SELECT '邮件配置添加完成！' AS message;
SELECT * FROM `base_config` WHERE `type` = 'mail_config' ORDER BY `id`;