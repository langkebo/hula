/**
 * HuLa AI Skill - 工具实现 (Node.js 版本)
 *
 * 通过 HTTP API 调用 HuLa 后端服务
 * 后端地址: http://localhost:8000 (可配置)
 */

const http = require('http')
const https = require('https')

// 配置
const HULA_BASE_URL = process.env.HULA_API_URL || 'localhost:8000'
const IS_HTTPS = HULA_BASE_URL.startsWith('https://')
const HTTP_CLIENT = IS_HTTPS ? https : http

/**
 * 发起 HTTP 请求
 */
function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(HULA_BASE_URL + options.path)

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (IS_HTTPS ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }

    const req = HTTP_CLIENT.request(requestOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve(data)
        }
      })
    })

    req.on('error', reject)

    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

/**
 * 发送消息到 HuLa AI
 */
async function hula_send_message({ conversation_id, content, use_context = true, reasoning_enabled = false }) {
  const result = await httpRequest(
    {
      method: 'POST',
      path: '/ai/chat/message/send-stream',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      conversationId: conversation_id || '',
      content,
      useContext: use_context,
      reasoningEnabled: reasoning_enabled
    }
  )

  return result
}

/**
 * 创建新会话
 */
async function hula_create_session({ model_id, role_id }) {
  const result = await httpRequest(
    {
      method: 'POST',
      path: '/ai/conversation/create',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      modelId: model_id,
      roleId: role_id
    }
  )

  return result
}

/**
 * 获取会话历史
 */
async function hula_get_history({ conversation_id, page_no = 1, page_size = 20 }) {
  const result = await httpRequest({
    method: 'GET',
    path: `/ai/conversation/${conversation_id}/messages?pageNo=${page_no}&pageSize=${page_size}`
  })

  return result.list || []
}

/**
 * 获取可用模型列表
 */
async function hula_list_models() {
  const result = await httpRequest({
    method: 'GET',
    path: '/ai/models'
  })

  return result.list || []
}

/**
 * 获取可用角色列表
 */
async function hula_list_roles() {
  const result = await httpRequest({
    method: 'GET',
    path: '/ai/roles'
  })

  return result.list || []
}

module.exports = {
  hula_send_message,
  hula_create_session,
  hula_get_history,
  hula_list_models,
  hula_list_roles
}
