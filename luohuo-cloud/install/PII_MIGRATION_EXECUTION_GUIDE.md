# PII数据迁移执行指南

**版本**: 1.0
**日期**: 2025-12-13
**适用范围**: HuLa即时通讯系统 - 生产环境PII数据加密迁移

---

## 📋 迁移概述

### 目标

将 `def_user` 表中的以下敏感字段从明文转换为AES-256-GCM加密存储：
- `email` (邮箱)
- `mobile` (手机号)
- `id_card` (身份证号)

### 迁移方式

- **在线迁移**: 使用应用程序API批量加密
- **停机时间**: 无需停机（建议在业务低峰期执行）
- **数据一致性**: 分批迁移，确保数据完整性

---

## ⚠️ 前置条件检查清单

在开始迁移前，请确认以下条件已满足：

- [ ] ✅ 已完成数据库完整备份
- [ ] ✅ 已在测试环境完整验证迁移流程
- [ ] ✅ 已配置Nacos PII加密密钥
- [ ] ✅ 应用服务已重启并成功初始化PII加密器
- [ ] ✅ 已执行字段扩容脚本（`pii-field-expand.sql`）
- [ ] ✅ 已执行迁移前验证脚本（`pii-migration-verify.sql`）
- [ ] ✅ 已准备回滚方案
- [ ] ✅ 已通知相关团队（DBA、运维、测试）

---

## 📝 详细执行步骤

### 第一步：数据库备份（必须执行）

```bash
# 1. 全量备份数据库
mysqldump -u root -p \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  luohuo_dev > backup_before_pii_migration_$(date +%Y%m%d_%H%M%S).sql

# 2. 验证备份文件
ls -lh backup_before_pii_migration_*.sql

# 3. 测试备份文件可用性（可选，在测试库验证）
mysql -u root -p luohuo_test < backup_before_pii_migration_*.sql
```

**⏱️ 预计耗时**: 5-30分钟（取决于数据库大小）

---

### 第二步：字段扩容

```bash
# 执行字段扩容脚本
mysql -u root -p luohuo_dev < install/sql/pii-field-expand.sql
```

**重要说明**:
- 此步骤会将 `email`、`mobile`、`id_card` 字段从 `VARCHAR(20-255)` 扩展到 `VARCHAR(500)`
- 操作会锁表，但通常很快（秒级完成）
- 在业务低峰期执行

**⏱️ 预计耗时**: < 1分钟

---

### 第三步：迁移前验证

```bash
# 执行迁移前验证脚本
mysql -u root -p luohuo_dev < install/sql/pii-migration-verify.sql

# 记录输出结果，特别是：
# - 总用户数
# - 有PII数据的用户数
# - 预计迁移时间
```

**⏱️ 预计耗时**: < 1分钟

---

### 第四步：配置Nacos密钥

1. 登录Nacos控制台: `http://localhost:8848/nacos`
2. 进入 **配置管理** → **配置列表**
3. 找到 `common.yml` (Data ID)
4. 点击 **编辑**
5. 添加以下配置：

```yaml
# ===== PII字段加密配置 =====
pii:
  encryption:
    key: "2mytgAeCvw38o8R1NLHDb11hrh9+9vqvq4WplIW9Ld4="
    enabled: true
```

6. 点击 **发布**

**⏱️ 预计耗时**: 5分钟

---

### 第五步：重启应用服务

```bash
# 方式1: 使用systemd（推荐）
sudo systemctl restart luohuo-oauth-server
sudo systemctl restart luohuo-im-server

# 方式2: 使用脚本
cd /path/to/luohuo-oauth-server
./shutdown.sh
./startup.sh

# 检查启动日志
tail -f logs/application.log | grep "PII"
```

**期望日志输出**:
```
INFO  PII加密器初始化成功 (AES-256-GCM)
INFO  PII加密密钥已加载, 长度: 32字节
```

**⏱️ 预计耗时**: 2-5分钟

---

### 第六步：执行数据迁移

#### 方式1：使用API接口（推荐）

```bash
# 1. 启动迁移（每批1000条）
curl -X POST "http://localhost:18760/admin/migration/encrypt-pii?batchSize=1000" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 响应示例:
# {
#   "code": 200,
#   "message": "迁移已启动",
#   "data": {
#     "totalRecords": 5000,
#     "batchSize": 1000,
#     "estimatedTime": "10分钟"
#   }
# }

# 2. 查询迁移进度
curl -X GET "http://localhost:18760/admin/migration/status" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 响应示例:
# {
#   "code": 200,
#   "data": {
#     "status": "RUNNING",
#     "progress": "60%",
#     "processedRecords": 3000,
#     "totalRecords": 5000,
#     "currentBatch": 3,
#     "totalBatches": 5
#   }
# }
```

#### 方式2：后台任务自动执行

如果配置了自动迁移（`pii.encryption.auto-migrate=true`），应用启动时会自动执行迁移。

查看日志：
```bash
tail -f logs/application.log | grep "PII迁移"
```

**⏱️ 预计耗时**:
- 1000条记录: ~2分钟
- 10000条记录: ~20分钟
- 100000条记录: ~3小时

---

### 第七步：验证迁移结果

```bash
# 1. 执行验证SQL
mysql -u root -p luohuo_dev < install/sql/pii-migration-post-verify.sql

# 2. 调用验证API
curl -X GET "http://localhost:18760/admin/migration/verify-pii" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 期望响应:
# {
#   "code": 200,
#   "message": "验证通过",
#   "data": {
#     "totalRecords": 5000,
#     "encryptedRecords": 5000,
#     "plaintextRecords": 0,
#     "verificationPassed": true
#   }
# }
```

**验证标准**:
- ✅ 所有PII字段长度 > 50字符
- ✅ 无明文数据残留
- ✅ 数据量与迁移前一致
- ✅ 所有数据符合Base64格式

**⏱️ 预计耗时**: 2-5分钟

---

### 第八步：功能测试

**测试用例**:

1. **查询用户信息**
   ```bash
   curl -X GET "http://localhost:18760/api/user/12345" \
     -H "Authorization: Bearer USER_TOKEN"
   ```
   验证: 返回的email、mobile、id_card应该是解密后的明文

2. **更新用户信息**
   ```bash
   curl -X PUT "http://localhost:18760/api/user/12345" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "newemail@example.com",
       "mobile": "13900139000"
     }'
   ```
   验证: 更新成功，数据库中应该存储加密后的密文

3. **搜索功能测试**
   ```bash
   # 注意: 加密字段无法进行模糊搜索
   # 只能进行精确匹配
   curl -X GET "http://localhost:18760/api/user/search?mobile=13800138000"
   ```

**⏱️ 预计耗时**: 10-15分钟

---

## 📊 监控指标

### 迁移过程监控

```bash
# 查看迁移日志
tail -f logs/application.log | grep -i "migration\|pii\|encrypt"

# 监控数据库连接数
mysql -u root -p -e "SHOW PROCESSLIST;"

# 监控CPU/内存使用率
top -p $(pgrep -f luohuo-oauth-server)
```

### 性能监控

关注以下指标：
- **迁移速度**: 每批处理时间应在1-3秒
- **CPU使用率**: 应在50%以下
- **内存使用**: 应无明显增长
- **数据库锁等待**: 应为0

---

## 🔧 故障排查

### 问题1: 迁移速度过慢

**可能原因**:
- 批次大小过大
- 数据库性能瓶颈
- 网络延迟

**解决方案**:
```bash
# 调整批次大小为500
curl -X POST "http://localhost:18760/admin/migration/encrypt-pii?batchSize=500"

# 检查数据库慢查询日志
mysql -u root -p -e "SHOW PROCESSLIST WHERE Time > 5;"
```

### 问题2: 出现加密失败

**可能原因**:
- 密钥配置错误
- 加密器未初始化

**解决方案**:
```bash
# 1. 检查Nacos配置
curl http://localhost:8848/nacos/v1/cs/configs?dataId=common.yml&group=DEFAULT_GROUP

# 2. 重启应用
sudo systemctl restart luohuo-oauth-server

# 3. 查看错误日志
tail -50 logs/error.log
```

### 问题3: 解密失败

**可能原因**:
- 密钥不一致
- 数据已损坏

**解决方案**:
```bash
# 验证密钥一致性
# 检查应用日志中的密钥长度
grep "PII加密密钥已加载" logs/application.log

# 尝试手动解密测试
curl -X POST "http://localhost:18760/admin/crypto/decrypt-test" \
  -H "Content-Type: application/json" \
  -d '{"encrypted": "YOUR_ENCRYPTED_STRING"}'
```

---

## ⏮️ 回滚方案

如果迁移失败，需要回滚：

### 方案1：恢复数据库备份（完全回滚）

```bash
# 1. 停止应用
sudo systemctl stop luohuo-oauth-server

# 2. 恢复数据库
mysql -u root -p luohuo_dev < backup_before_pii_migration_YYYYMMDD_HHMMSS.sql

# 3. 恢复字段长度（如果需要）
mysql -u root -p luohuo_dev << EOF
ALTER TABLE def_user MODIFY COLUMN email VARCHAR(255);
ALTER TABLE def_user MODIFY COLUMN mobile VARCHAR(20);
ALTER TABLE def_user MODIFY COLUMN id_card VARCHAR(18);
EOF

# 4. 禁用加密功能
# 在Nacos中设置: pii.encryption.enabled=false

# 5. 重启应用
sudo systemctl start luohuo-oauth-server
```

### 方案2：部分回滚（回滚未完成的批次）

```bash
# 如果只是部分批次失败，可以：

# 1. 停止迁移
curl -X POST "http://localhost:18760/admin/migration/stop"

# 2. 回滚未完成的记录（从备份恢复特定ID范围）
# 需要根据实际情况编写SQL
```

---

## ✅ 迁移后检查清单

- [ ] 所有PII数据已加密（验证SQL通过）
- [ ] 无明文数据残留
- [ ] 应用功能测试通过
- [ ] 性能指标正常（无明显下降）
- [ ] 监控告警正常
- [ ] 备份文件已归档保存
- [ ] 更新运维文档
- [ ] 通知相关团队迁移完成

---

## 📚 相关文档

- [PII加密设置指南](../../docs/PII_ENCRYPTION_SETUP_GUIDE.md)
- [综合部署指南](../../docs/COMPREHENSIVE_DEPLOYMENT_GUIDE.md)
- [Nacos配置模板](./nacos/common-pii-encryption.yml)

---

## 🆘 紧急联系

如遇到严重问题，请联系：

- **技术负责人**: [姓名] [电话]
- **DBA**: [姓名] [电话]
- **运维负责人**: [姓名] [电话]

---

**免责声明**: 本文档为标准操作指南，实际执行时应根据具体环境调整。任何生产环境操作前务必在测试环境完整验证。
