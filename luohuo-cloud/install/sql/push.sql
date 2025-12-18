-- 推送设备表
CREATE TABLE IF NOT EXISTS `im_push_device` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `device_type` varchar(20) NOT NULL COMMENT '设备类型：ios/android',
  `device_token` varchar(255) NOT NULL COMMENT '设备Token',
  `app_version` varchar(50) DEFAULT NULL COMMENT 'App版本',
  `os_version` varchar(50) DEFAULT NULL COMMENT '系统版本',
  `device_model` varchar(100) DEFAULT NULL COMMENT '设备型号',
  `active` tinyint(1) DEFAULT '1' COMMENT '是否活跃',
  `last_active_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_device` (`user_id`, `device_token`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_device_token` (`device_token`),
  KEY `idx_active_time` (`active`, `last_active_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推送设备表';

-- 推送记录表
CREATE TABLE IF NOT EXISTS `im_push_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `device_token` varchar(255) NOT NULL COMMENT '设备Token',
  `push_type` varchar(20) NOT NULL COMMENT '推送类型：apns/fcm/huawei/xiaomi/oppo/vivo',
  `title` varchar(255) NOT NULL COMMENT '标题',
  `content` text NOT NULL COMMENT '内容',
  `extra` json DEFAULT NULL COMMENT '扩展信息',
  `status` varchar(20) NOT NULL COMMENT '状态：pending/success/failed',
  `error_message` text COMMENT '错误信息',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_create_time` (`create_time`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推送记录表';

-- 推送统计表
CREATE TABLE IF NOT EXISTS `im_push_statistics` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `push_type` varchar(20) NOT NULL COMMENT '推送类型：apns/fcm/huawei/xiaomi/oppo/vivo',
  `total_count` int DEFAULT '0' COMMENT '总推送数',
  `success_count` int DEFAULT '0' COMMENT '成功推送数',
  `failure_count` int DEFAULT '0' COMMENT '失败推送数',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_type` (`stat_date`, `push_type`),
  KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推送统计表';