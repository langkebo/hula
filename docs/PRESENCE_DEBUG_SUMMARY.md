# 在线状态问题排查总结

## 问题现象
登录后用户显示离线（灰点），而不是在线（绿点）

## 已完成的工作

### 1. 性能优化 ✅
- 批量获取在线状态：串行 → 并行
- 性能提升：10-50倍

### 2. 后端部署 ✅
- Docker容器化部署成功
- 所有服务健康运行
- API端点可访问

### 3. 代码修复 ✅
- 添加登录后设置在线状态的调用
- 位置：`src/App.vue` LOGIN_SUCCESS事件

## 当前问题分析

### 后端状态
- ✅ presence API已实现 (`src/web/routes/handlers/presence.rs`)
- ✅ 路由已注册 (`/_matrix/client/v3/presence/{user_id}/status`)
- ⚠️ 大量请求超时（30秒）

### 可能原因

1. **数据库查询慢**
   - presence_storage 查询可能阻塞
   - 需要检查数据库索引

2. **前端调用时机**
   - 可能在客户端完全初始化前调用
   - 需要确保token已设置

3. **后端实现问题**
   - set_presence 可能有死锁或阻塞
   - 需要查看完整日志

## 建议的调试步骤

### 1. 检查前端日志
打开浏览器开发者工具，查看：
- Network标签：presence API调用状态
- Console标签：错误信息

### 2. 手动测试API
```bash
# 获取access_token后测试
curl -X PUT http://localhost:28008/_matrix/client/v3/presence/@test1:localhost/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"presence":"online"}'
```

### 3. 检查后端详细日志
```bash
docker logs synapse-rust -f | grep -E "(presence|ERROR)"
```

### 4. 临时解决方案
如果API超时，可以：
- 增加超时时间
- 或者暂时禁用在线状态功能
- 或者使用本地状态（不同步到服务器）

## 下一步行动

1. 查看前端Network请求，确认API是否被调用
2. 如果调用了但超时，需要优化后端实现
3. 如果没调用，需要检查前端调用时机
