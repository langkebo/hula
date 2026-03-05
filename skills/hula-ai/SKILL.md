---
name: hula-ai
description: "HuLa AI 对接技能 - 通过 OpenClaw 调用 HuLa 后端 AI 服务进行对话。支持发送消息、创建会话、管理角色、模型切换等操作。适用于用户想要通过飞书/Telegram/Discord/WhatsApp 等渠道与 HuLa AI 对话的场"
---

# HuLa AI 助手技能

## 概述

本技能用于通过 OpenClaw 网关调用 HuLa 后端 AI 服务，实现跨平台 AI 对话功能。

## 激活条件

当用户提到以下内容时激活：
- "HuLa AI"、"HuLa 对话"、"和 HuLa 聊天"
- "使用 HuLa 机器人"
- "从 飞书/Telegram/Discord/WhatsApp 调用 HuLa AI"

## 前置配置

### 1. 配置后端地址

设置环境变量：
```bash
export HULA_API_URL=http://your-backend:8000
export HULA_USERNAME=luohuo_web_pro
export HULA_PASSWORD=your_password
export HULA_TOKEN=your_token  # 可选，登录后自动获取
```

### 2. 后端 API 接口

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

## 可用工具

### 1. hula_send_message

发送消息到 HuLa AI。

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversation_id | string | 否 | 会话 ID，留空创建新会话 |
| content | string | 是 | 用户消息内容 |
| use_context | boolean | 否 | 是否使用上下文（默认 true） |
| reasoning_enabled | boolean | 否 | 是否启用推理（默认 false） |

**返回值：**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "会话ID",
    "content": "AI回复内容",
    "reasoningContent": "推理过程（可选）"
  }
}
```

### 2. hula_create_session

创建新的 AI 对话会话。

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model_id | string | 否 | 模型 ID |
| role_id | string | 否 | 角色 ID |

**返回值：**
```json
{
  "code": 0,
  "data": {
    "id": "新会话ID",
    "title": "会话标题"
  }
}
```

### 3. hula_get_history

获取会话历史消息。

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversation_id | string | 是 | 会话 ID |
| page_no | number | 否 | 页码（默认 1） |
| page_size | number | 否 | 每页数量（默认 20） |

**返回值：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "消息ID",
        "type": "user/assistant",
        "content": "消息内容",
        "createTime": 1234567890
      }
    ]
  }
}
```

### 4. hula_delete_session

删除会话。

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversation_id | string | 是 | 会话 ID |

### 5. hula_list_models

获取可用 AI 模型列表。

**返回值：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "模型ID",
        "name": "模型名称",
        "type": 1,
        "status": 0,
        "description": "模型描述"
      }
    ]
  }
}
```

**模型类型 (type)：**
- `1` - 文字对话
- `2` - 图片生成
- `3` - 音频生成
- `4` / `7` / `8` - 视频生成

### 6. hula_list_roles

获取可用角色列表。

**返回值：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "角色ID",
        "name": "角色名称",
        "description": "角色描述",
        "avatar": "头像URL"
      }
    ]
  }
}
```

### 7. hula_model_usage

获取模型剩余使用次数。

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model_id | string | 是 | 模型 ID |

**返回值：**
```json
{
  "code": 0,
  "data": {
    "remainingUsage": 100
  }
}
```

## 对话流程

### 首次对话

```
用户: 和 HuLa 聊聊天
助手: 好的，让我先创建一个新会话...
助手: 会话已创建，请问你想聊什么话题？
用户: 给我讲个笑话
助手: [AI 返回的笑话]
```

### 继续对话

```
用户: 再讲一个
助手: [AI 返回的另一个笑话]
```

### 切换模型

```
用户: 换一个模型试试
助手: 当前可用模型：
1. GPT-4 (文字)
2. Midjourney (图片)
3. Stable Diffusion (图片)
请选择你想要的模型。
用户: 1
助手: 已切换到 GPT-4 模型
```

## 响应格式

AI 响应支持多种内容类型：

| 类型 | 说明 |
|------|------|
| type: 1 | 文本消息 |
| type: 2 | 图片消息 |
| type: 3 | 音频消息 |
| type: 4 | 视频消息 |

## 错误处理

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| 401 | 未登录/Token 过期 | 提示登录 |
| 403 | 无权限 | 检查权限设置 |
| 404 | 资源不存在 | 检查会话/模型 ID |
| 500 | 服务器错误 | 重试或反馈 |
| -1 | 网络错误 | 检查网络连接 |

## 消息示例

### 用户登录

```javascript
// 先登录获取 token
const { login } = require('./scripts/hula-api');
await login('your@email.com', 'your_password');
```

### 完整对话流程

```javascript
const {
  hula_send_message,
  hula_create_session,
  hula_list_models,
  hula_list_roles
} = require('./scripts/hula-api');

// 1. 查看可用模型
const models = await hula_list_models();
console.log('可用模型:', models);

// 2. 查看可用角色
const roles = await hula_list_roles();
console.log('可用角色:', roles);

// 3. 创建新会话
const session = await hula_create_session({
  model_id: models[0].id,
  role_id: roles[0].id
});
console.log('会话ID:', session.data.id);

// 4. 发送消息
const response = await hula_send_message({
  conversation_id: session.data.id,
  content: '你好！'
});
console.log('AI回复:', response.data.content);
```

## 注意事项

1. **保持会话上下文** - 使用同一 conversation_id 可以获得更好的对话体验
2. **支持推理模型** - 设置 reasoning_enabled: true 可以启用深度思考
3. **模型类型区分** - 不同类型模型返回不同 msgType
4. **认证** - 部分接口需要登录后使用
