# PII（个人身份信息）加密配置指南

## 1. 什么是PII加密？

PII（Personally Identifiable Information）指的是可以用于识别个人身份的信息，例如：
- 邮箱地址
- 手机号码
- 身份证号
- 银行卡号
- 真实姓名
- 家庭住址等

Hula-IM系统内置了PII字段加密功能，使用AES-256-GCM算法对这些敏感信息进行加密存储，保护用户隐私。

## 2. 配置前准备清单

### 2.1 环境要求
- ✅ JDK 21+
- ✅ OpenSSL工具（用于生成密钥）
- ✅ Nacos配置中心（推荐1.4.0+）
- ✅ 数据库访问权限

### 2.2 所需工具和服务
1. **OpenSSL** - 生成加密密钥
2. **Base64编码工具** - 密钥编码
3. **Nacos控制台** - 配置管理
4. **文本编辑器** - 编辑配置文件

## 3. 生成加密密钥

### 3.1 使用OpenSSL生成密钥（推荐）
```bash
# 生成32字节（256位）的随机密钥，并Base64编码
openssl rand -base64 32
```

### 3.2 使用Python生成密钥
```python
import secrets
import base64

# 生成32字节随机密钥
key = secrets.token_bytes(32)
key_b64 = base64.b64encode(key).decode('utf-8')
print(f"生成的密钥: {key_b64}")
```

### 3.3 在线生成器（仅开发测试）
⚠️ **注意**: 生产环境不要使用在线生成器，存在安全风险！

## 4. 配置步骤

### 4.1 方法一：通过环境变量配置（推荐生产环境）

1. **设置环境变量**
   ```bash
   # Linux/Mac
   export PII_ENCRYPTION_KEY="your_base64_encoded_key_here"

   # Windows
   set PII_ENCRYPTION_KEY=your_base64_encoded_key_here

   # 在Docker中
   docker run -e PII_ENCRYPTION_KEY="your_base64_encoded_key_here" your-app
   ```

2. **更新Nacos配置**
   在Nacos控制台添加/更新配置 `common-pii-encryption.yml`:
   ```yaml
   pii:
     encryption:
       key: ${PII_ENCRYPTION_KEY}
       enabled: true
   ```

### 4.2 方法二：通过Nacos直接配置

1. **登录Nacos控制台**
   - 地址: http://localhost:8848/nacos
   - 用户名/密码: nacos/nacos

2. **创建/更新配置**
   - Data ID: `common-pii-encryption.yml`
   - Group: `DEFAULT_GROUP`
   - 配置格式: `YAML`
   - 配置内容见下面的示例

### 4.3 完整配置示例

```yaml
# common-pii-encryption.yml
pii:
  encryption:
    # 您的Base64编码的密钥（32字节）
    key: "2mytgAeCvw38o8R1NLHDb11hrh9+9vqvq4WplIW9Ld4="

    # 启用PII加密
    enabled: true

    # 加密算法（默认）
    algorithm: "AES/GCM/NoPadding"

    # IV长度（GCM推荐12字节）
    iv-length: 12

    # 认证标签长度
    tag-length: 128

    # 密钥长度
    key-length: 256
```

## 5. 验证配置

### 5.1 查看启动日志
```bash
# 查看应用日志，确认加密器初始化成功
tail -f logs/application.log | grep "PII"

# 应该看到类似输出：
# [INFO ] PII加密器初始化成功
# [INFO ] PII加密已启用
```

### 5.2 测试加密功能
```java
// 创建测试用户
User user = new User();
user.setEmail("test@example.com");
user.setMobile("13800138000");

// 保存后，查看数据库中的数据应该是加密的
userRepository.save(user);
```

## 6. 密钥管理最佳实践

### 6.1 密钥安全要求
- ✅ 使用32字节（256位）的随机密钥
- ✅ 使用加密算法生成器（如OpenSSL）
- ✅ 通过安全的方式传递密钥
- ❌ 不要使用简单密码作为密钥
- ❌ 不要在代码中硬编码密钥
- ❌ 不要将密钥提交到版本控制

### 6.2 密钥轮换
建议每90-180天更换一次密钥：

```yaml
# 配置历史密钥用于解密旧数据
pii:
  encryption:
    # 当前密钥
    key: "new_key_here"

    # 历史密钥列表
    legacy-keys:
      - "old_key_1_here"
      - "old_key_2_here"

    # 密钥轮换间隔（天）
    rotation-days: 90
```

### 6.3 密钥备份
- 将密钥存储在安全的密码管理器中
- 使用密钥管理服务（如AWS KMS、HashiCorp Vault）
- 制定密钥恢复流程

## 7. 常见问题排查

### 7.1 错误：PII加密密钥未配置
**原因**: 未设置环境变量或Nacos配置错误
**解决方案**:
1. 检查环境变量是否正确设置: `echo $PII_ENCRYPTION_KEY`
2. 确认Nacos配置已发布并生效
3. 重启应用服务

### 7.2 错误：密钥长度错误
**原因**: 密钥不是32字节
**解决方案**:
```bash
# 重新生成32字节密钥
openssl rand -base64 32
```

### 7.3 错误：解密失败
**原因**: 使用了错误的密钥解密数据
**解决方案**:
1. 确认使用正确的密钥
2. 检查是否进行了密钥轮换
3. 使用legacy-keys配置旧密钥

## 8. 安全建议

1. **密钥隔离**: 不同环境使用不同的密钥
2. **访问控制**: 限制密钥的访问权限
3. **审计日志**: 记录密钥的访问和使用
4. **定期轮换**: 建立密钥轮换机制
5. **应急响应**: 制定密钥泄露的应急流程

## 9. 配置清单

在完成配置后，请逐项检查：

- [ ] 已生成32字节的随机密钥
- [ ] 密钥已安全存储
- [ ] 环境变量已正确设置
- [ ] Nacos配置已更新
- [ ] 应用服务已重启
- [ ] 查看日志确认初始化成功
- [ ] 测试加密/解密功能正常
- [ ] 数据迁移（如需要）
- [ ] 备份密钥到安全位置

## 10. 联系支持

如遇到问题，请：
1. 查看应用日志获取详细错误信息
2. 检查Nacos配置是否正确
3. 联系技术支持: 656042408@qq.com

---

**⚠️ 重要提醒**:
- 生产环境必须配置PII加密！
- 请妥善保管加密密钥！
- 定期检查加密功能是否正常工作！