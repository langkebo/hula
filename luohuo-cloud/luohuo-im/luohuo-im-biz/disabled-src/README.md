# 临时禁用的源文件

这些文件由于第三方库 API 变更导致编译错误，已被临时移出编译目录。

## 禁用原因

### 推送服务 (Push)
- `ApnsPushProvider.java` - Pushy APNS 库 API 变更 (0.15.x → 0.16.x)
- `FcmPushProvider.java` - Firebase Admin SDK API 变更
- `HuaweiPushProvider.java` - 华为推送配置方法缺失

### 搜索服务 (Search)
- `MessageSearchServiceImpl.java` - Elasticsearch Java Client API 变更 (8.x)
- `MessageSearchSyncListener.java` - 依赖 MessageService 方法不存在
- `MessageDocument.java` - 缺少 Objects 导入
- `SearchHistoryServiceImpl.java` - 类型不匹配

### 邮件服务 (Mail)
- `MailService.java` - Spring Boot 3.x JavaMailSender API 变更
- `MailController.java` - 依赖 MailService

## 修复建议

1. **推送服务**: 升级 Pushy 依赖到最新版本，并按照新 API 重写
2. **搜索服务**: 按照 Elasticsearch Java Client 8.x API 重写
3. **邮件服务**: 使用 JavaMailSenderImpl 替代 JavaMailSender

## 恢复步骤

修复后，将文件移回 `src/main/java/com/luohuo/flex/im/` 对应目录即可。
