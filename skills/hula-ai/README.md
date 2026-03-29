# HuLa AI Skill

## 概述

本技能用于将 HuLa AI 服务集成到 OpenClaw 中，实现跨平台 AI 对话功能。

## 目录结构

```
hula-ai/
├── SKILL.md              # 技能定义文件
├── README.md             # 使用说明
└── scripts/
    ├── hula-api.js       # API 实现
    └── hula-api-node.js  # Node.js 版本 API
```

## 前置要求

1. **HuLa 后端服务运行中**
   - 确保 synapse-rust 后端已启动
   - 默认地址: `http://localhost:8000`
   - 可通过环境变量 `HULA_API_URL` 自定义

2. **OpenClaw 已配置**
   - 安装 OpenClaw
   - 启动 Gateway

## 安装

### 方式一：复制到 OpenClaw skills 目录

```bash
cp -r hula-ai/ ~/.openclaw/skills/
```

### 方式二：复制到项目 skills 目录

```bash
cp -r hula-ai/ /path/to/hula/skills/
```

并在 `openclaw.json` 中配置：

```json
{
  "skills": {
    "load": {
      "extraDirs": ["/path/to/hula/skills"]
    }
  }
}
```

## 配置

### 1. 配置后端地址

在环境变量中设置：

```bash
# 必填
export HULA_API_URL=http://your-backend:8000
export HULA_USERNAME=luohuo_web_pro
export HULA_PASSWORD=your_password

# 可选（登录后自动获取）
export HULA_TOKEN=your_token
```

### 2. 验证配置

```bash
# 测试后端连接
curl http://localhost:8000/health
```

## 使用方法

### 基本对话

```
用户: 和 HuLa 聊聊天
助手: 好的！请问你想聊什么话题？
用户: 给我讲个笑话
助手: [HuLa AI 返回的笑话]
```

### 切换模型

```
用户: 使用 GPT-4 模型
助手: 已切换到 GPT-4 模型
```

### 切换角色

```
用户: 换一个程序员角色
助手: 已切换到程序员角色
```

## API 接口

后端需要实现以下接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/oauth/anyTenant/login` | POST | 用户登录 |
| `/ai/chat/message/send` | POST | 发送消息 |
| `/ai/chat/message/send-stream` | POST | 发送消息（流式） |
| `/ai/conversation/create` | POST | 创建会话 |
| `/ai/conversation/{id}/messages` | GET | 获取历史 |
| `/ai/conversation/{id}` | DELETE | 删除会话 |
| `/ai/model/page` | GET | 模型列表 |
| `/ai/model/{id}/usage` | GET | 模型剩余次数 |
| `/ai/chat/role/my-page` | GET | 角色列表 |
| `/ai/chat/role/get-my` | GET | 当前角色 |

## 响应格式

### 发送消息

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "会话ID",
    "content": "AI回复内容",
    "reasoningContent": "推理过程（可选）",
    "msgType": 1
  }
}
```

### 消息类型

| msgType | 说明 |
|---------|------|
| 1 | 文本 |
| 2 | 图片 |
| 3 | 音频 |
| 4 | 视频 |

## 故障排除

### 连接失败

```
Error: connect ECONNREFUSED
```

**解决方案：**
1. 确认后端服务已启动：`systemctl status synapse-rust`
2. 检查端口是否正确（默认 8000）
3. 检查防火墙设置

### 认证失败

```
Error: 401 Unauthorized
```

**解决方案：**
1. 检查用户名和密码是否正确
2. 检查 Token 是否过期
3. 重新登录获取新 Token

### 超时

```
Error: ETIMEDOUT
```

**解决方案：**
1. 检查网络连接
2. 增加请求超时时间
3. 确认后端性能

## 开发指南

### 添加新功能

修改 `scripts/hula-api.js` 文件，添加新的 API 方法：

```javascript
/**
 * 新功能
 */
async function hula_new_feature(params) {
  const result = await httpRequest({
    method: 'POST',
    path: '/api/new-feature',
  }, params);
  return result;
}
```

然后在 `SKILL.md` 中添加对应的工具说明。

## 相关文档

- [HuLa 前端项目](https://gitee.com/llangkebo/hula/)
- [HuLa 后端 synapse-rust](https://gitee.com/llangkebo/hula)
- [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)
- [OpenClaw 文档](https://docs.openclaw.ai)
