# HuLa-Server 数据库安全配置指南

## 概述

本文档详细说明了HuLa-Server项目的数据库安全配置最佳实践，包括用户权限管理、数据加密、审计日志和安全加固措施。

## 1. 数据库用户权限设计

### 1.1 用户分类

| 用户类型 | 用户名 | 权限范围 | 用途 |
|---------|--------|---------|------|
| 管理员 | root | 所有权限 | 初始化和紧急维护 |
| IM服务 | luohuo_im | luohuo_im库的CRUD | IM业务数据 |
| Base服务 | luohuo_base | luohuo_base库的CRUD | 基础服务数据 |
| OAuth服务 | luohuo_oauth | luohuo_oauth库的CRUD | 认证授权数据 |
| System服务 | luohuo_system | luohuo_system库的CRUD | 系统管理数据 |
| Nacos | nacos | nacos库的CRUD | 配置中心数据 |
| 只读用户 | luohuo_readonly | 所有数据库的SELECT | 报表和查询 |
| 备份用户 | luohuo_backup | SELECT, LOCK TABLES, RELOAD | 数据备份 |
| 监控用户 | monitor | SELECT, REPLICATION CLIENT | 性能监控 |

### 1.2 权限最小化原则

每个服务只拥有其业务所需的最低权限：

- **只读权限**：报表、数据分析
- **CRUD权限**：业务服务，仅限自己的数据库
- **特殊权限**：备份用户有LOCK TABLES权限，监控用户有REPLICATION CLIENT权限

### 1.3 密码策略

- 长度至少12位
- 包含大小写字母、数字和特殊字符
- 定期更换（建议每季度）
- 使用密码管理器存储

## 2. 数据库初始化

### 2.1 快速部署

```bash
# 1. 安装MySQL
bash scripts/deploy-database.sh

# 2. 初始化用户和权限
bash scripts/db-manager.sh init

# 3. 检查状态
bash scripts/db-manager.sh check
```

### 2.2 手动部署

```sql
-- 执行初始化脚本
mysql -u root -p < scripts/db-init.sql
```

## 3. 安全配置

### 3.1 网络安全

```ini
# /etc/mysql/mysql.conf.d/hula.cnf
[mysqld]
# 只监听内网地址
bind-address = 10.0.0.10

# 禁用DNS解析
skip-name-resolve

# 限制最大连接数
max_connections = 1000

# 设置连接错误阈值
max_connect_errors = 100
```

### 3.2 SSL加密

```bash
# 生成SSL证书
openssl genrsa 2048 > ca-key.pem
openssl req -new -x509 -nodes -days 3600 \
    -key ca-key.pem -out ca.pem

# 生成服务器证书
openssl req -newkey rsa:2048 -days 3600 \
    -nodes -keyout server-key.pem -out server-req.pem

openssl rsa -in server-key.pem -out server-key.pem

openssl x509 -req -in server-req.pem -days 3600 \
    -CA ca.pem -CAkey ca-key.pem -set_serial 01 -out server-cert.pem
```

### 3.3 审计日志

```sql
-- 启用审计日志插件
INSTALL PLUGIN audit_log SONAME 'audit_log.so';

-- 配置审计日志
SET GLOBAL audit_log_format=JSON;
SET GLOBAL audit_log_policy=ALL;
SET GLOBAL audit_log_exclude_users='monitor,luohuo_readonly';
```

## 4. 数据备份策略

### 4.1 自动备份

```bash
# 每日凌晨2点全量备份
0 2 * * * /usr/local/bin/mysql-backup.sh

# 每小时增量备份（binlog）
0 * * * * mysql -uroot -p$PASS -e "FLUSH LOGS;"
```

### 4.2 备份脚本

```bash
#!/bin/bash
# /usr/local/bin/mysql-backup.sh

BACKUP_DIR="/opt/hula/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# 全量备份
mysqldump --single-transaction \
    --routines --triggers --events \
    --all-databases | gzip > "$BACKUP_DIR/all_${DATE}.sql.gz"

# 清理旧备份
find "$BACKUP_DIR" -name "all_*.sql.gz" -mtime +$RETENTION_DAYS -delete
```

### 4.3 恢复数据

```bash
# 恢复所有数据库
gunzip < all_20251220_020000.sql.gz | mysql -uroot -p

# 恢复单个数据库
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS luohuo_im"
mysql -uroot -p luohuo_im < luohuo_im_backup.sql
```

## 5. 监控和告警

### 5.1 性能监控

```sql
-- 慢查询监控
SELECT * FROM mysql.slow_log
WHERE start_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- 连接数监控
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';

-- 查询缓存命中率
SHOW STATUS LIKE 'Qcache_hits';
SHOW STATUS LIKE 'Qcache_inserts';
```

### 5.2 Prometheus监控

```yaml
# prometheus.yml
- job_name: mysql
  static_configs:
    - targets: ['mysql-exporter:9104']
```

### 5.3 告警规则

```yaml
# alerts.yml
- alert: MySQLDown
  expr: up{job="mysql"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "MySQL实例宕机"

- alert: MySQLSlowQueries
  expr: mysql_global_status_slow_queries > 10
  for: 5m
  labels:
    severity: warning
```

## 6. 安全检查清单

### 6.1 部署前检查

- [ ] 已删除匿名用户
- [ ] 已删除test数据库
- [ ] Root用户已设置强密码
- [ ] 已创建应用专用用户
- [ ] 已配置网络访问限制
- [ ] 已启用SSL加密
- [ ] 已设置审计日志

### 6.2 定期检查（每月）

- [ ] 检查用户权限变更
- [ ] 查看慢查询日志
- [ ] 检查异常登录
- [ ] 验证备份完整性
- [ ] 更新密码策略
- [ ] 检查SSL证书有效期

### 6.3 应急响应

1. **数据泄露**
   - 立即禁用相关用户
   - 更改所有密码
   - 分析访问日志
   - 通知相关人员

2. **服务异常**
   - 检查错误日志
   - 验证磁盘空间
   - 检查连接数
   - 必要时重启服务

3. **性能问题**
   - 查看慢查询
   - 检查索引使用
   - 分析锁等待
   - 优化SQL语句

## 7. 常见问题

### Q: 如何修改用户密码？

```bash
# 使用管理脚本
bash scripts/db-manager.sh user modify username password

# 或直接修改
mysql -uroot -p -e "ALTER USER 'username'@'%' IDENTIFIED BY 'new_password';"
```

### Q: 如何查看用户权限？

```sql
SHOW GRANTS FOR 'luohuo_im'@'%';
```

### Q: 如何撤销权限？

```sql
REVOKE INSERT ON luohuo_im.* FROM 'luohuo_im'@'%';
```

### Q: 如何启用SSL？

```ini
[mysqld]
ssl-ca=/etc/mysql/ssl/ca.pem
ssl-cert=/etc/mysql/ssl/server-cert.pem
ssl-key=/etc/mysql/ssl/server-key.pem
require_secure_transport=ON
```

## 8. 参考资源

- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)
- [MySQL Security Guide](https://dev.mysql.com/doc/refman/8.0/en/general-security-issues.html)
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)

---

**更新日期：2025-12-20**
**版本：1.0**