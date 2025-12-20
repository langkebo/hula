-- HuLa-Server 数据库初始化脚本
-- 创建专用数据库用户和权限设置
-- 执行命令: mysql -u root -p < scripts/db-init.sql

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS `luohuo_im`
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `luohuo_base`
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `luohuo_oauth`
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `luohuo_system`
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

-- 创建Nacos专用数据库
CREATE DATABASE IF NOT EXISTS `nacos`
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

-- ==================== 创建应用用户 ====================

-- IM服务用户（仅访问IM相关表）
CREATE USER IF NOT EXISTS 'luohuo_im'@'%' IDENTIFIED BY '${IM_PASSWORD:Im@2025#Secure}';
CREATE USER IF NOT EXISTS 'luohuo_im'@'localhost' IDENTIFIED BY '${IM_PASSWORD:Im@2025#Secure}';

-- Base服务用户（仅访问Base相关表）
CREATE USER IF NOT EXISTS 'luohuo_base'@'%' IDENTIFIED BY '${BASE_PASSWORD:Base@2025#Secure}';
CREATE USER IF NOT EXISTS 'luohuo_base'@'localhost' IDENTIFIED BY '${BASE_PASSWORD:Base@2025#Secure}';

-- OAuth服务用户（仅访问OAuth相关表）
CREATE USER IF NOT EXISTS 'luohuo_oauth'@'%' IDENTIFIED BY '${OAUTH_PASSWORD:Oauth@2025#Secure}';
CREATE USER IF NOT EXISTS 'luohuo_oauth'@'localhost' IDENTIFIED BY '${OAUTH_PASSWORD:Oauth@2025#Secure}';

-- System服务用户（仅访问System相关表）
CREATE USER IF NOT EXISTS 'luohuo_system'@'%' IDENTIFIED BY '${SYSTEM_PASSWORD:System@2025#Secure}';
CREATE USER IF NOT EXISTS 'luohuo_system'@'localhost' IDENTIFIED BY '${SYSTEM_PASSWORD:System@2025#Secure}';

-- Nacos用户（仅访问Nacos配置）
CREATE USER IF NOT EXISTS 'nacos'@'%' IDENTIFIED BY '${NACOS_PASSWORD:nacos@2025#Secure}';
CREATE USER IF NOT EXISTS 'nacos'@'localhost' IDENTIFIED BY '${NACOS_PASSWORD:nacos@2025#Secure}';

-- 只读用户（用于报表和备份）
CREATE USER IF NOT EXISTS 'luohuo_readonly'@'%' IDENTIFIED BY '${READONLY_PASSWORD:Read@2025#Secure}';
CREATE USER IF NOT EXISTS 'luohuo_readonly'@'localhost' IDENTIFIED BY '${READONLY_PASSWORD:Read@2025#Secure}';

-- 备份用户（用于数据备份）
CREATE USER IF NOT EXISTS 'luohuo_backup'@'%' IDENTIFIED BY '${BACKUP_PASSWORD:Backup@2025#Secure}';
CREATE USER IF NOT EXISTS 'luohuo_backup'@'localhost' IDENTIFIED BY '${BACKUP_PASSWORD:Backup@2025#Secure}';

-- ==================== 授予权限 ====================

-- IM服务权限
GRANT SELECT, INSERT, UPDATE, DELETE ON luohuo_im.* TO 'luohuo_im'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON luohuo_im.* TO 'luohuo_im'@'localhost';
GRANT SHOW VIEW ON luohuo_im.* TO 'luohuo_im'@'%';
GRANT SHOW VIEW ON luohuo_im.* TO 'luohuo_im'@'localhost';

-- Base服务权限
GRANT SELECT, INSERT, UPDATE, DELETE ON luohuo_base.* TO 'luohuo_base'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON luohuo_base.* TO 'luohuo_base'@'localhost';
GRANT SHOW VIEW ON luohuo_base.* TO 'luohuo_base'@'%';
GRANT SHOW VIEW ON luohuo_base.* TO 'luohuo_base'@'localhost';

-- OAuth服务权限
GRANT SELECT, INSERT, UPDATE, DELETE ON luohuo_oauth.* TO 'luohuo_oauth'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON luohuo_oauth.* TO 'luohuo_oauth'@'localhost';
GRANT SHOW VIEW ON luohuo_oauth.* TO 'luohuo_oauth'@'%';
GRANT SHOW VIEW ON luohuo_oauth.* TO 'luohuo_oauth'@'localhost';

-- System服务权限
GRANT SELECT, INSERT, UPDATE, DELETE ON luohuo_system.* TO 'luohuo_system'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON luohuo_system.* TO 'luohuo_system'@'localhost';
GRANT SHOW VIEW ON luohuo_system.* TO 'luohuo_system'@'%';
GRANT SHOW VIEW ON luohuo_system.* TO 'luohuo_system'@'localhost';

-- Nacos权限
GRANT SELECT, INSERT, UPDATE, DELETE ON nacos.* TO 'nacos'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON nacos.* TO 'nacos'@'localhost';

-- 只读用户权限（所有数据库）
GRANT SELECT ON luohuo_im.* TO 'luohuo_readonly'@'%';
GRANT SELECT ON luohuo_base.* TO 'luohuo_readonly'@'%';
GRANT SELECT ON luohuo_oauth.* TO 'luohuo_readonly'@'%';
GRANT SELECT ON luohuo_system.* TO 'luohuo_readonly'@'%';
GRANT SELECT ON nacos.* TO 'luohuo_readonly'@'%';

-- 备份用户权限（SELECT和LOCK TABLES）
GRANT SELECT, LOCK TABLES, SHOW VIEW ON *.* TO 'luohuo_backup'@'%';
GRANT RELOAD ON *.* TO 'luohuo_backup'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- ==================== 创建审计表 ====================
USE luohuo_base;

CREATE TABLE IF NOT EXISTS `db_audit_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_name` varchar(50) NOT NULL COMMENT '数据库用户名',
  `host` varchar(100) NOT NULL COMMENT '访问主机',
  `database_name` varchar(50) DEFAULT NULL COMMENT '数据库名',
  `table_name` varchar(50) DEFAULT NULL COMMENT '表名',
  `operation_type` varchar(20) NOT NULL COMMENT '操作类型(SELECT/INSERT/UPDATE/DELETE)',
  `sql_text` text COMMENT '执行的SQL',
  `affected_rows` int(11) DEFAULT 0 COMMENT '影响的行数',
  `execution_time` int(11) DEFAULT 0 COMMENT '执行时间(毫秒)',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_name` (`user_name`),
  KEY `idx_database_name` (`database_name`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据库操作审计日志';

-- 创建性能监控表
CREATE TABLE IF NOT EXISTS `db_performance_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `database_name` varchar(50) NOT NULL COMMENT '数据库名',
  `table_name` varchar(50) DEFAULT NULL COMMENT '表名',
  `sql_type` varchar(20) NOT NULL COMMENT 'SQL类型',
  `sql_text` text COMMENT 'SQL语句',
  `execution_time` int(11) NOT NULL COMMENT '执行时间(毫秒)',
  `rows_examined` int(11) DEFAULT 0 COMMENT '扫描的行数',
  `rows_sent` int(11) DEFAULT 0 COMMENT '返回的行数',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_database_name` (`database_name`),
  KEY `idx_execution_time` (`execution_time`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据库性能监控日志';

-- ==================== 输出结果 ====================
SELECT 'Database initialization completed!' as status;
SELECT 'IM user: luohuo_im' as info;
SELECT 'Base user: luohuo_base' as info;
SELECT 'OAuth user: luohuo_oauth' as info;
SELECT 'System user: luohuo_system' as info;
SELECT 'Nacos user: nacos' as info;
SELECT 'Readonly user: luohuo_readonly' as info;
SELECT 'Backup user: luohuo_backup' as info;

SET FOREIGN_KEY_CHECKS = 1;