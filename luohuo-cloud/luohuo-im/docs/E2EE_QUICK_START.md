# HuLa E2EE 快速开始指南

## 🚀 5分钟快速部署

本指南帮助您快速部署和测试HuLa E2EE端到端加密系统。

---

## 前置条件

确保以下服务已安装并运行：

- ✅ MySQL 8.0+
- ✅ Redis 6.0+
- ✅ RocketMQ 4.9+
- ✅ Java 21+
- ✅ Maven 3.8+

---

## 第一步: 数据库初始化

### 1.1 创建数据库

```bash
mysql -u root -p
```

```sql
CREATE DATABASE hula_im CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hula'@'%' IDENTIFIED BY 'HuLa2025!';
GRANT ALL PRIVILEGES ON hula_im.* TO 'hula'@'%';
FLUSH PRIVILEGES;
EXIT;
```

### 1.2 执行E2EE迁移脚本

```bash
cd /path/to/HuLa-Server-master/luohuo-cloud/luohuo-im

mysql -u hula -p hula_im < sql/e2ee_migration.sql
```

### 1.3 验证表创建

```bash
mysql -u hula -p hula_im -e "SHOW TABLES LIKE 'im_%';"
```

预期输出:
```
+----------------------------------+
| Tables_in_hula_im (im_%)         |
+----------------------------------+
| im_user_public_keys              |
| im_session_key_packages          |
| im_message_encrypted             |
| im_key_backup                    |
| im_key_recovery_request          |
+----------------------------------+
```

---

## 第二步: 配置应用

### 2.1 配置application.yml

编辑 `luohuo-im-biz/src/main/resources/application.yml`:

```yaml
spring:
  profiles:
    active: dev,e2ee  # 启用E2EE配置

  datasource:
    url: jdbc:mysql://localhost:3306/hula_im?useSSL=false&serverTimezone=Asia/Shanghai
    username: hula
    password: HuLa2025!

  redis:
    host: localhost
    port: 6379
    password:  # 如果Redis有密码，在此填写
    database: 0

rocketmq:
  name-server: localhost:9876
  producer:
    group: e2ee-producer-group
```

### 2.2 验证E2EE配置

检查 `application-e2ee.yml` 配置是否正确:

```bash
cat luohuo-im-biz/src/main/resources/application-e2ee.yml | grep enabled
```

确保 `e2ee.enabled: true`

---

## 第三步: 编译和启动

### 3.1 编译项目

```bash
cd /path/to/HuLa-Server-master

# 跳过测试编译（首次快速启动）
mvn clean package -DskipTests

# 或包含测试
# mvn clean install
```

### 3.2 启动应用

```bash
cd luohuo-cloud/luohuo-im/luohuo-im-biz/target

java -jar -Xms2g -Xmx4g \
  -Dspring.profiles.active=dev,e2ee \
  luohuo-im-biz-1.0.0.jar
```

### 3.3 验证启动

等待应用启动完成（约30秒），然后执行:

```bash
# 检查健康状态
curl http://localhost:8080/actuator/health

# 检查E2EE健康状态
curl http://localhost:8080/e2ee/health
```

预期响应:
```json
{
  "enabled": true,
  "status": "UP",
  "activeUsers": 0,
  "activeSessions": 0,
  "services": {
    "keyService": "UP",
    "messageService": "UP",
    "cacheService": "UP"
  }
}
```

---

## 第四步: 功能测试

### 4.1 生成测试密钥对（客户端）

使用Node.js或浏览器控制台生成RSA密钥对:

```javascript
// 在浏览器控制台运行
async function generateTestKeys() {
  // 生成RSA密钥对
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  // 导出公钥
  const publicKeySpki = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );
  const publicKeyBase64 = btoa(
    String.fromCharCode(...new Uint8Array(publicKeySpki))
  );

  // 生成指纹
  const hash = await window.crypto.subtle.digest(
    "SHA-256",
    publicKeySpki
  );
  const fingerprint = btoa(
    String.fromCharCode(...new Uint8Array(hash))
  );

  // 生成密钥ID
  const keyId = fingerprint.substring(0, 8) + "_" + Date.now();

  console.log("Public Key (SPKI):", publicKeyBase64);
  console.log("Fingerprint:", fingerprint);
  console.log("Key ID:", keyId);

  return {
    keyPair,
    publicKey: publicKeyBase64,
    fingerprint,
    keyId
  };
}

// 执行生成
const keys = await generateTestKeys();
```

### 4.2 上传公钥

```bash
# 替换为实际生成的值
export KEY_ID="abc12345_1704729600000"
export PUBLIC_KEY="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
export FINGERPRINT="sha256_fingerprint_here"

curl -X POST http://localhost:8080/e2ee/keys/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d "{
    \"keyId\": \"$KEY_ID\",
    \"algorithm\": \"RSA_OAEP\",
    \"spki\": \"$PUBLIC_KEY\",
    \"fingerprint\": \"$FINGERPRINT\"
  }"
```

预期响应:
```json
{
  "code": 200,
  "message": "success"
}
```

### 4.3 查询公钥

```bash
curl http://localhost:8080/e2ee/keys/10001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4.4 发送加密消息

```bash
curl -X POST http://localhost:8080/e2ee/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "conversationId": "conv_12345",
    "recipientId": 10002,
    "keyId": "'"$KEY_ID"'",
    "algorithm": "AES_GCM",
    "ciphertext": "SGVsbG8gV29ybGQ=",
    "iv": "cmFuZG9tX2l2XzEyMw==",
    "tag": "YXV0aF90YWdfMTIz",
    "contentType": "text/plain",
    "messageSize": 256
  }'
```

---

## 第五步: 灰度发布

### 5.1 查看当前灰度状态

```bash
curl http://localhost:8080/e2ee/admin/feature-toggle/status \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 5.2 启用全局E2EE

```bash
curl -X POST 'http://localhost:8080/e2ee/admin/feature-toggle/global?enabled=true' \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 5.3 设置灰度百分比

```bash
# 为10%的用户开启E2EE
curl -X POST 'http://localhost:8080/e2ee/admin/feature-toggle/rollout?percentage=10' \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 为50%的用户开启
curl -X POST 'http://localhost:8080/e2ee/admin/feature-toggle/rollout?percentage=50' \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 全量开启
curl -X POST 'http://localhost:8080/e2ee/admin/feature-toggle/rollout?percentage=100' \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 5.4 添加白名单用户

```bash
# 为特定用户立即启用E2EE
curl -X POST http://localhost:8080/e2ee/admin/feature-toggle/whitelist/10001 \
  -H "Authorization: Bearer ADMIN_TOKEN"

curl -X POST http://localhost:8080/e2ee/admin/feature-toggle/whitelist/10002 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 5.5 检查用户E2EE状态

```bash
curl http://localhost:8080/e2ee/admin/feature-toggle/check/10001 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

预期响应:
```json
{
  "userId": 10001,
  "e2eeEnabled": true,
  "globalEnabled": true,
  "inWhitelist": true,
  "inBlacklist": false,
  "rolloutPercentage": 50
}
```

---

## 第六步: 监控检查

### 6.1 查看Prometheus指标

```bash
curl http://localhost:8080/actuator/prometheus | grep e2ee
```

### 6.2 查看关键指标

```bash
# 加密消息总数
curl http://localhost:8080/actuator/metrics/e2ee.messages.encrypted

# 缓存命中率
curl http://localhost:8080/actuator/metrics/e2ee.cache.hit

# 活跃用户数
curl http://localhost:8080/actuator/metrics/e2ee.active.users
```

### 6.3 查看定时任务日志

```bash
tail -f logs/e2ee.log | grep "E2EEScheduledTasks"
```

---

## 常见问题快速修复

### Q1: 应用启动失败

```bash
# 检查MySQL连接
mysql -u hula -p -e "SELECT 1"

# 检查Redis连接
redis-cli ping

# 检查RocketMQ
telnet localhost 9876

# 查看详细错误日志
tail -f logs/error.log
```

### Q2: 无法上传公钥

```bash
# 检查用户认证
curl http://localhost:8080/actuator/health

# 检查E2EE是否启用
grep "e2ee.enabled" application-e2ee.yml

# 检查数据库表是否存在
mysql -u hula -p hula_im -e "DESC im_user_public_keys"
```

### Q3: Redis缓存问题

```bash
# 连接Redis
redis-cli

# 查看E2EE缓存
KEYS e2ee:*

# 清理缓存
redis-cli --scan --pattern 'e2ee:*' | xargs redis-cli DEL

# 退出
EXIT
```

### Q4: 性能问题

```bash
# 检查JVM内存使用
jstat -gcutil <PID> 1000 10

# 检查数据库慢查询
mysql -u hula -p -e "SHOW FULL PROCESSLIST;"

# 检查Redis响应时间
redis-cli --latency

# 增加JVM内存
java -jar -Xms4g -Xmx8g luohuo-im-biz.jar
```

---

## 集成测试脚本

创建完整的测试脚本:

```bash
cat > test-e2ee.sh << 'EOF'
#!/bin/bash

BASE_URL="http://localhost:8080"
TOKEN="YOUR_JWT_TOKEN"

echo "=== E2EE Integration Test ==="

# 1. 健康检查
echo "1. Health Check..."
HEALTH=$(curl -s $BASE_URL/e2ee/health)
echo $HEALTH | jq .

# 2. 上传公钥
echo "2. Upload Public Key..."
UPLOAD_RESULT=$(curl -s -X POST $BASE_URL/e2ee/keys/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "keyId": "test_'$(date +%s)'",
    "algorithm": "RSA_OAEP",
    "spki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
    "fingerprint": "test_fingerprint"
  }')
echo $UPLOAD_RESULT | jq .

# 3. 查询公钥
echo "3. Get Public Key..."
GET_KEY=$(curl -s $BASE_URL/e2ee/keys/10001 \
  -H "Authorization: Bearer $TOKEN")
echo $GET_KEY | jq .

# 4. 检查指标
echo "4. Check Metrics..."
METRICS=$(curl -s $BASE_URL/actuator/prometheus | grep e2ee | head -10)
echo "$METRICS"

echo "=== Test Complete ==="
EOF

chmod +x test-e2ee.sh
./test-e2ee.sh
```

---

## 下一步

### 生产部署

1. ✅ 阅读完整的 [运维手册](./E2EE_OPERATIONS_MANUAL.md)
2. ✅ 部署 [监控系统](./E2EE_MONITORING_DEPLOYMENT_GUIDE.md)
3. ✅ 配置数据库主从复制
4. ✅ 配置Redis集群
5. ✅ 设置定期备份

### 性能优化

1. ✅ 启用缓存预热
2. ✅ 调整线程池大小
3. ✅ 优化数据库索引
4. ✅ 配置Redis持久化

### 安全加固

1. ✅ 启用HTTPS
2. ✅ 配置IP白名单
3. ✅ 启用审计日志
4. ✅ 定期密钥轮换

---

## 参考文档

- [API使用指南](./E2EE_API_GUIDE.md) - 完整的API接口文档
- [运维手册](./E2EE_OPERATIONS_MANUAL.md) - 日常运维和故障处理
- [监控部署指南](./E2EE_MONITORING_DEPLOYMENT_GUIDE.md) - Prometheus + Grafana部署
- [开发完成报告](./E2EE_README.md) - 功能清单和架构说明

---

## 技术支持

如有问题，请联系：

- 📧 Email: support@hula.com
- 📚 文档: https://docs.hula.com/e2ee
- 🐛 Issue: https://github.com/hula/issues

---

**文档版本**: v1.0.0
**最后更新**: 2025-01-01
**预计完成时间**: 5-10分钟
