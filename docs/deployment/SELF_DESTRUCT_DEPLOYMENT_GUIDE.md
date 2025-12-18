# 消息自毁功能部署指南

**版本**: 1.0.0
**创建日期**: 2025-12-12
**作者**: HuLa Team

---

## 📋 部署前检查清单

### 前端检查（HuLa-master）

- [x] 类型定义文件已创建 (`src/types/selfDestruct.ts`)
- [x] 自毁管理器已实现 (`src/services/selfDestructManager.ts`)
- [x] UI组件已创建 (`src/components/chat/SelfDestructTimer.vue`)
- [x] PrivateChat已集成 (`src/components/chat/PrivateChat.vue`)
- [x] E2EE Store已更新 (`src/stores/e2ee.ts`)
- [x] API接口已扩展 (`src/services/api/e2ee.ts`)
- [x] 前端文档齐全

### 后端检查（HuLa-Server-master）

- [x] 实体类已扩展 (`MessageEncrypted.java`)
- [x] API端点已实现 (`E2EEChatController.java`)
- [x] 服务层已实现 (`E2EEMessageService.java`)
- [x] 定时任务已实现 (`E2EEScheduledTasks.java`)
- [x] 事件监听器已创建 (`E2EEMessageReadListener.java`, `E2EEMessageDestructListener.java`)
- [x] DTO已创建 (`MessageReadNotificationDTO.java`, `MessageDestructNotificationDTO.java`)
- [x] MQ常量已添加 (`MqConstant.java`)
- [x] 审计日志已实现 (`E2EEAuditService.java`)
- [x] 单元测试已创建 (`MessageSelfDestructTest.java`)
- [x] API文档已编写

### 数据库检查

- [ ] 数据库迁移脚本已准备 (`e2ee_self_destruct_migration.sql`)
- [ ] 回滚脚本已准备 (`e2ee_self_destruct_rollback.sql`)
- [ ] 数据库备份已完成
- [ ] 测试环境已验证

---

## 🚀 部署步骤

### 步骤 1: 数据库迁移

#### 1.1 备份当前数据库

```bash
# 生产环境备份
mysqldump -u root -p hula_db > backup_before_self_destruct_$(date +%Y%m%d_%H%M%S).sql

# 验证备份
ls -lh backup_before_self_destruct_*.sql
```

#### 1.2 执行迁移脚本

```bash
# 连接到数据库
mysql -u root -p hula_db

# 执行迁移脚本
source /path/to/e2ee_self_destruct_migration.sql;

# 验证字段已添加
DESCRIBE im_message_encrypted;

# 验证索引已创建
SHOW INDEX FROM im_message_encrypted;
```

#### 1.3 验证迁移结果

```sql
-- 检查新增字段
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'hula_db'
  AND TABLE_NAME = 'im_message_encrypted'
  AND COLUMN_NAME IN ('self_destruct_timer', 'read_at', 'destruct_at');

-- 应该返回3行数据

-- 检查索引
SELECT
    INDEX_NAME,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'hula_db'
  AND TABLE_NAME = 'im_message_encrypted'
  AND INDEX_NAME LIKE 'idx_%destruct%' OR INDEX_NAME LIKE 'idx_%read%';

-- 应该返回4个索引
```

---

### 步骤 2: 后端部署

#### 2.1 构建后端项目

```bash
cd /path/to/HuLa-Server-master

# 清理并构建
mvn clean install -DskipTests

# 或者只构建IM模块
cd luohuo-cloud/luohuo-im
mvn clean package -DskipTests
```

#### 2.2 部署新版本

```bash
# 停止旧服务
./scripts/stop-im-service.sh

# 备份旧版本
mv luohuo-im.jar luohuo-im.jar.backup_$(date +%Y%m%d)

# 复制新版本
cp target/luohuo-im-1.1.0.jar /path/to/deploy/luohuo-im.jar

# 启动新服务
./scripts/start-im-service.sh

# 检查启动日志
tail -f logs/im-service.log
```

#### 2.3 验证后端服务

```bash
# 健康检查
curl http://localhost:8080/actuator/health

# 检查E2EE端点
curl -H "Authorization: Bearer <token>" \
     http://localhost:8080/chat/e2ee/msg/123456

# 查看定时任务日志
grep "cleanupSelfDestructMessages" logs/im-service.log
```

---

### 步骤 3: 前端部署

#### 3.1 构建前端项目

```bash
cd /path/to/HuLa-master

# 安装依赖
pnpm install

# 构建桌面端
pnpm run tauri:build

# 或构建Web版
pnpm run build
```

#### 3.2 部署前端资源

**桌面应用**:
```bash
# 生成的安装包在 src-tauri/target/release/bundle/ 目录
# Windows: .msi 或 .exe
# macOS: .dmg 或 .app
# Linux: .deb 或 .AppImage

# 上传到发布渠道
aws s3 cp src-tauri/target/release/bundle/msi/HuLa_1.1.0_x64.msi s3://releases/
```

**Web应用**:
```bash
# 部署到Nginx
cp -r dist/* /var/www/hula/

# 重启Nginx
sudo nginx -s reload
```

---

### 步骤 4: 配置MQ

#### 4.1 创建新的Topic

```bash
# 连接到RocketMQ控制台
# 或使用命令行工具

# 创建消息已读Topic
sh mqadmin updateTopic -n localhost:9876 -t e2ee_message_read -c DefaultCluster

# 创建消息销毁Topic
sh mqadmin updateTopic -n localhost:9876 -t e2ee_message_destruct -c DefaultCluster
```

#### 4.2 验证Topic创建

```bash
# 查看Topic列表
sh mqadmin topicList -n localhost:9876 | grep e2ee_message

# 应该看到:
# e2ee_message_read
# e2ee_message_destruct
```

---

### 步骤 5: 验证功能

#### 5.1 功能测试

**测试场景 1: 发送自毁消息**
```bash
# 使用Postman或curl测试
curl -X POST http://localhost:8080/chat/e2ee/msg \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": 1001,
    "encryptedMessage": {
      "conversationId": "conv_test",
      "recipientId": 10002,
      "keyId": "session_key_001",
      "algorithm": "AES_GCM",
      "ciphertext": "...",
      "iv": "...",
      "contentType": "text",
      "selfDestructTimer": 300000
    }
  }'
```

**测试场景 2: 标记消息已读**
```bash
curl -X POST http://localhost:8080/chat/e2ee/msg/123456/read?readAt=1702368000000 \
  -H "Authorization: Bearer <token>"
```

**测试场景 3: 验证定时清理**
```sql
-- 查询即将到期的消息
SELECT * FROM v_expiring_messages;

-- 等待1分钟后再次查询，验证消息是否被删除
```

#### 5.2 前端测试

1. 打开聊天应用
2. 进入私密聊天
3. 点击自毁定时器选择器
4. 选择"5分钟"
5. 发送测试消息
6. 验证消息显示自毁图标
7. 对方阅读消息
8. 验证倒计时开始
9. 等待5分钟后验证消息自动删除

---

## 🔍 监控与告警

### 日志监控

#### 后端日志关键字

```bash
# 监控自毁消息创建
tail -f logs/im-service.log | grep "消息设置自毁定时器"

# 监控消息已读
tail -f logs/im-service.log | grep "标记消息为已读"

# 监控消息清理
tail -f logs/im-service.log | grep "清理自毁消息"

# 监控错误
tail -f logs/im-service.log | grep "ERROR.*[Ss]elf.*[Dd]estruct"
```

#### 前端日志关键字

```bash
# 浏览器控制台
# 监控自毁管理器
[SelfDestruct] Registered message
[SelfDestruct] Message marked as read
[SelfDestruct] Message destructed
```

### 数据库监控

```sql
-- 监控自毁消息统计
SELECT * FROM v_self_destruct_stats
WHERE date >= CURDATE() - INTERVAL 7 DAY
ORDER BY date DESC;

-- 监控即将到期消息
SELECT
    COUNT(*) as expiring_count,
    MIN(minutes_remaining) as min_minutes,
    MAX(minutes_remaining) as max_minutes
FROM v_expiring_messages;

-- 监控异常消息（超过3天未销毁）
SELECT COUNT(*) as overdue_count
FROM im_message_encrypted
WHERE self_destruct_timer IS NOT NULL
  AND destruct_at IS NOT NULL
  AND destruct_at < NOW() - INTERVAL 1 HOUR
  AND is_del = 0;
```

### 性能监控

```bash
# Prometheus指标
curl http://localhost:8080/actuator/prometheus | grep e2ee_self_destruct

# 关键指标:
# e2ee_self_destruct_messages_total - 自毁消息总数
# e2ee_self_destruct_cleanup_total - 清理次数
# e2ee_self_destruct_cleanup_duration - 清理耗时
```

---

## ⚠️ 故障排查

### 问题 1: 消息未按时销毁

**症状**: 消息超过销毁时间但未删除

**排查步骤**:
```bash
# 1. 检查定时任务是否正常运行
grep "cleanupSelfDestructMessages" logs/im-service.log | tail -20

# 2. 检查数据库中的消息状态
SELECT id, destruct_at, is_del, NOW() as current_time
FROM im_message_encrypted
WHERE destruct_at < NOW() AND is_del = 0
LIMIT 10;

# 3. 手动触发清理
curl -X POST http://localhost:8080/admin/e2ee/cleanup/self-destruct \
  -H "Authorization: Bearer <admin-token>"
```

**解决方案**:
- 检查定时任务配置
- 验证数据库时间是否正确
- 重启应用服务

---

### 问题 2: WebSocket通知未收到

**症状**: 前端未收到已读/销毁通知

**排查步骤**:
```bash
# 1. 检查MQ消息是否发送
tail -f logs/im-service.log | grep "e2ee_message_read\|e2ee_message_destruct"

# 2. 检查WebSocket连接状态
# 在浏览器控制台执行:
websocket.readyState  // 应该返回 1 (OPEN)

# 3. 检查MQ消费者
sh mqadmin consumerProgress -n localhost:9876 -g e2ee_message_read_group
```

**解决方案**:
- 重新连接WebSocket
- 检查MQ服务状态
- 验证Topic配置

---

### 问题 3: 已读状态未更新

**症状**: 调用已读API成功，但销毁时间未更新

**排查步骤**:
```sql
-- 检查消息状态
SELECT
    id,
    self_destruct_timer,
    read_at,
    destruct_at,
    create_time
FROM im_message_encrypted
WHERE id = 123456;
```

**解决方案**:
```java
// 检查实体类的calculateDestructTime方法是否正确调用
// 检查数据库触发器是否正常工作
```

---

## 🔄 回滚方案

### 紧急回滚

如果部署后出现严重问题，执行以下步骤：

#### 1. 回滚后端

```bash
# 停止新版本
./scripts/stop-im-service.sh

# 恢复旧版本
mv luohuo-im.jar.backup_20251212 luohuo-im.jar

# 启动旧版本
./scripts/start-im-service.sh

# 验证服务
curl http://localhost:8080/actuator/health
```

#### 2. 回滚数据库（谨慎！）

```bash
# ⚠️ 警告：此操作将删除所有自毁功能相关数据！
mysql -u root -p hula_db < /path/to/e2ee_self_destruct_rollback.sql

# 或手动执行：
mysql -u root -p hula_db
source /path/to/e2ee_self_destruct_rollback.sql;
```

#### 3. 回滚前端

```bash
# 桌面应用：通知用户不要升级
# Web应用：恢复旧版本静态文件
cp -r dist.backup/* /var/www/hula/
sudo nginx -s reload
```

---

## 📊 上线后观察

### 第一天

- [ ] 监控API响应时间
- [ ] 检查数据库插入性能
- [ ] 观察MQ消息积压
- [ ] 收集用户反馈

### 第一周

- [ ] 分析自毁消息使用率
- [ ] 优化定时任务频率
- [ ] 调整数据库索引
- [ ] 性能调优

### 第一个月

- [ ] 评估存储空间节省
- [ ] 分析用户行为模式
- [ ] 规划功能迭代
- [ ] 准备移动端集成

---

## 📞 支持联系

**技术支持**: tech@hula.im
**紧急联系**: +86-xxx-xxxx-xxxx
**文档地址**: https://docs.hula.im

---

## 📝 部署记录

| 日期 | 环境 | 版本 | 执行人 | 状态 | 备注 |
|------|------|------|--------|------|------|
| 2025-12-12 | 测试环境 | 1.1.0 | Admin | ✅ 成功 | 初次部署 |
| YYYY-MM-DD | 预发布环境 | 1.1.0 | Admin | ⏳ 待执行 | 计划部署 |
| YYYY-MM-DD | 生产环境 | 1.1.0 | Admin | ⏳ 待执行 | 计划部署 |

---

**文档维护**: HuLa Team
**最后更新**: 2025-12-12
