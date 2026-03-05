/**
 * HuLa AI Skill - 工具实现
 *
 * 通过 HTTP API 调用 HuLa 后端服务
 * 后端地址: http://localhost:8000 (可配置)
 *
 * 认证方式: Basic Auth + Token
 */

const http = require('http')
const https = require('https')

// ============ 配置 ============
const HULA_BASE_URL = process.env.HULA_API_URL || 'http://localhost:8000'
const HULA_USERNAME = process.env.HULA_USERNAME || 'luohuo_web_pro'
const HULA_PASSWORD = process.env.HULA_PASSWORD || 'luohuo_web_pro_secret'

// 使用环境变量中的 token
let authToken = process.env.HULA_TOKEN || null

const IS_HTTPS = HULA_BASE_URL.startsWith('https://')
const HTTP_CLIENT = IS_HTTPS ? https : http

// ============ 工具函数 ============

/**
 * Base64 编码
 */
function base64Encode(str) {
  return Buffer.from(str).toString('base64')
}

/**
 * 发起 HTTP 请求
 */
function httpRequest(options, body = null, useAuth = true) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(HULA_BASE_URL + options.path)

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (IS_HTTPS ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers
      }
    }

    // 添加 Basic Auth
    if (useAuth) {
      const basicAuth = base64Encode(`${HULA_USERNAME}:${HULA_PASSWORD}`)
      requestOptions.headers['Authorization'] = `Basic ${basicAuth}`

      // 添加 token（如果已登录）
      if (authToken) {
        requestOptions.headers['token'] = authToken
      }
    }

    const req = HTTP_CLIENT.request(requestOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)

          // 如果返回 token，保存下来
          if (parsed.data?.token) {
            authToken = parsed.data.token
          }

          resolve(parsed)
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

// ============ 登录 ============

/**
 * 登录获取 token
 */
async function login(username, password) {
  const result = await httpRequest(
    {
      method: 'POST',
      path: '/oauth/anyTenant/login'
    },
    {
      email: username,
      password: password
    },
    false
  ) // 登录时不使用 Basic Auth

  return result
}

// ============ AI 对话 ============

/**
 * 发送消息到 HuLa AI (流式)
 *
 * @param {Object} params - 参数
 * @param {string} params.conversation_id - 会话 ID（可选）
 * @param {string} params.content - 消息内容
 * @param {boolean} params.use_context - 是否使用上下文（默认 true）
 * @param {boolean} params.reasoning_enabled - 是否启用推理（默认 false）
 * @returns {Promise<Object>} AI 响应
 */
async function hula_send_message({ conversation_id, content, use_context = true, reasoning_enabled = false }) {
  const result = await httpRequest(
    {
      method: 'POST',
      path: '/ai/chat/message/send',
      headers: {
        Accept: 'application/json'
      }
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
 * 发送消息到 HuLa AI (非流式)
 * @param {Object} params - 参数
 * @param {string} params.conversation_id - 会话 ID
 * @param {string} params.content - 消息内容
 * @param {boolean} params.use_context - 是否使用上下文
 * @param {boolean} params.reasoning_enabled - 是否启用推理
 * @returns {Promise<Object>}
 */
async function hula_send_message_simple({ conversation_id, content, use_context = true, reasoning_enabled = false }) {
  return hula_send_message({ conversation_id, content, use_context, reasoning_enabled })
}

// ============ 会话管理 ============

/**
 * 创建新会话
 * @param {Object} params - 参数
 * @param {string} params.model_id - 模型 ID（可选）
 * @param {string} params.role_id - 角色 ID（可选）
 * @returns {Promise<Object>} 会话信息
 */
async function hula_create_session({ model_id, role_id }) {
  const result = await httpRequest(
    {
      method: 'POST',
      path: '/ai/conversation/create'
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
 * @param {Object} params - 参数
 * @param {string} params.conversation_id - 会话 ID
 * @param {number} params.page_no - 页码
 * @param {number} params.page_size - 每页数量
 * @returns {Promise<Array>} 消息列表
 */
async function hula_get_history({ conversation_id, page_no = 1, page_size = 20 }) {
  const result = await httpRequest({
    method: 'GET',
    path: `/ai/conversation/${conversation_id}/messages?pageNo=${page_no}&pageSize=${page_size}`
  })

  return result.data?.list || []
}

/**
 * 删除会话
 * @param {string} conversation_id - 会话 ID
 * @returns {Promise<Object>}
 */
async function hula_delete_session(conversation_id) {
  const result = await httpRequest({
    method: 'DELETE',
    path: `/ai/conversation/${conversation_id}`
  })

  return result
}

// ============ 模型管理 ============

/**
 * 获取可用模型列表
 * @returns {Promise<Array>} 模型列表
 */
async function hula_list_models() {
  const result = await httpRequest({
    method: 'GET',
    path: '/ai/model/page?pageNo=1&pageSize=100'
  })

  return result.data?.list || []
}

/**
 * 获取模型剩余使用次数
 * @param {string} model_id - 模型 ID
 * @returns {Promise<number>} 剩余次数
 */
async function hula_model_usage(model_id) {
  const result = await httpRequest({
    method: 'GET',
    path: `/ai/model/${model_id}/usage`
  })

  return result.data?.remainingUsage
}

// ============ 角色管理 ============

/**
 * 获取可用角色列表
 * @returns {Promise<Array>} 角色列表
 */
async function hula_list_roles() {
  const result = await httpRequest({
    method: 'GET',
    path: '/ai/chat/role/my-page?pageNo=1&pageSize=100'
  })

  return result.data?.list || []
}

/**
 * 获取当前选中的角色
 * @returns {Promise<Object>} 角色信息
 */
async function hula_get_current_role() {
  const result = await httpRequest({
    method: 'GET',
    path: '/ai/chat/role/get-my'
  })

  return result.data
}

// ============ 导出 ============

module.exports = {
  // 登录
  login,

  // 对话
  hula_send_message,
  hula_send_message_simple,

  // 会话
  hula_create_session,
  hula_get_history,
  hula_delete_session,

  // 模型
  hula_list_models,
  hula_model_usage,

  // 角色
  hula_list_roles,
  hula_get_current_role
}
