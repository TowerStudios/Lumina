/**
 * AI 对话服务（方案 A）
 *
 * 职责：
 * 1. 基于会话+时间范围组装上下文，调用 OpenAI 兼容 API 进行多轮对话
 * 2. 流式输出（SSE），通过回调逐 chunk 推送给主进程
 * 3. 分层记忆：每 N 轮触发画像生成/更新，保留最近 M 轮原文，超 X 天未活跃清理
 * 4. 多厂商支持（DeepSeek/智谱/OpenAI/Claude/kimi），复用 insightService 的配置体系
 *
 * 架构约束：
 * - 不引入第三方 SDK，使用 Node 原生 https/http 模块（与 insightService 一致）
 * - 配置复用 getSharedAiModelConfig()，新增 aiProvider 字段记录当前厂商
 * - 对话历史持久化到 electron-store，按 sessionId 分桶
 */

import http from 'node:http'
import https from 'node:https'
import { ConfigService } from './config'
import { chatService } from './chatService'

// ─── 常量配置 ──────────────────────────────────────────────────────────────────

const API_TIMEOUT_MS = 120_000 // 流式对话放宽到 2 分钟
const API_TEMPERATURE = 0.7
const API_MAX_TOKENS_DEFAULT = 2048

/** 分层记忆阈值 */
const PROFILE_TRIGGER_ROUNDS = 10 // 每 10 轮触发画像更新
const KEEP_RECENT_ROUNDS = 4      // 触发画像后只保留最近 4 轮原文
const PROFILE_TTL_DAYS = 90       // 90 天未活跃清理
const PROFILE_TTL_MS = PROFILE_TTL_DAYS * 24 * 60 * 60 * 1000

/** 单次上下文消息条数上限 */
const CONTEXT_MESSAGE_LIMIT = 500

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

export interface AiChatContext {
  sessionId: string
  displayName?: string
  startTime?: number
  endTime?: number
  /** 精准选择的消息（用户在消息选择器中手动挑选），存在时优先于时间范围 */
  selectedMessages?: SelectedMessageItem[]
}

/** 精准选择的消息条目（由渲染进程传入，避免主进程二次查库） */
export interface SelectedMessageItem {
  isSend: boolean
  content: string
  createTime: number
  senderName?: string
  /** WeChat 消息类型（1=文本 3=图片 34=语音 43=视频 47=表情 48=位置 49=链接/文件 10000=系统） */
  localType: number
}

export interface AiChatSession {
  sessionId: string
  displayName?: string
  messages: AiChatMessage[]
  profileSummary?: string
  lastActiveAt: number
  totalRounds: number
}

export interface AiProviderPreset {
  id: string
  label: string
  baseUrl: string
  defaultModel: string
  /** 是否需要特殊 headers（如 Anthropic 的 x-api-key） */
  extraHeaders?: Record<string, string>
}

/** 厂商预设表 */
export const AI_PROVIDER_PRESETS: Record<string, AiProviderPreset> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat'
  },
  zhipu: {
    id: 'zhipu',
    label: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash'
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini'
  },
  claude: {
    id: 'claude',
    label: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-latest',
    extraHeaders: {
      'anthropic-version': '2023-06-01'
    }
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k'
  }
}

/** 默认厂商 */
export const DEFAULT_PROVIDER_ID = 'deepseek'

interface CallApiStreamOptions {
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

interface SharedAiModelConfig {
  apiBaseUrl: string
  apiKey: string
  model: string
  maxTokens: number
}

// ─── 辅助函数（复用 insightService 风格） ─────────────────────────────────────

function buildApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

function normalizeApiMaxTokens(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return API_MAX_TOKENS_DEFAULT
  return Math.min(Math.floor(n), 128_000)
}

// ─── 系统提示词 ────────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `你是一个微信聊天分析助手，专注于帮助用户理解对话背后的思想、情绪、关系和行为模式。

你的能力：
1. 思想分析：推测对话者的价值观、思维模式、关注点
2. 情绪解读：识别情绪状态、情绪变化轨迹、潜在情绪需求
3. 关系洞察：判断关系亲疏、权力动态、互动模式
4. 行为预测：基于历史对话推测可能的后续行为
5. 话题拆解：梳理讨论的核心话题、分歧点、共识点
6. 应答建议：给出合适的回复建议（用户询问时）

回答原则：
- 基于提供的真实聊天记录分析，不臆测
- 区分"观察到的"和"推测的"，推测需标注
- 直接回答用户问题，不绕弯子
- 中文回答，自然口语化，不要分点过度
- 涉及隐私判断时保持中立，不替用户做道德判断`

/**
 * 构建带上下文的系统提示词
 */
function buildSystemPrompt(context: AiChatContext | null, profileSummary?: string): string {
  let prompt = BASE_SYSTEM_PROMPT

  if (context?.displayName) {
    prompt += `\n\n当前分析对象：${context.displayName}`
  }

  if (profileSummary) {
    prompt += `\n\n已积累的用户画像（基于历史对话总结）：
${profileSummary}

请在回答时参考此画像，但以最新上下文为准。`
  }

  return prompt
}

/**
 * 根据消息类型将内容转为 AI 可读文本。
 * 非文本消息（图片/表情/语音/视频等）转为占位符，兼容无多模态能力的模型。
 */
function formatMessageContent(localType: number, content: string): string {
  switch (localType) {
    case 1: // 文本
      return content || ''
    case 3: // 图片
      return '[图片]'
    case 34: // 语音
      return '[语音]'
    case 43: // 视频
      return '[视频]'
    case 47: // 表情包
      return '[表情]'
    case 48: // 位置
      return '[位置]'
    case 49: { // 链接/文件/小程序/转账等
      const titleMatch = content?.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)
      if (titleMatch?.[1]) return `[链接/文件] ${titleMatch[1]}`
      return '[链接/文件]'
    }
    case 10000: // 系统消息
      return content ? `[系统] ${content}` : '[系统消息]'
    case 10002: // 撤回
      return '[撤回消息]'
    default:
      return content || `[消息(类型${localType})]`
  }
}

/**
 * 将聊天记录格式化为上下文文本
 */
function formatChatContext(
  messages: Array<{ isSend: boolean; content: string; createTime: number; senderName?: string; localType?: number }>,
  displayName?: string
): string {
  if (!messages || messages.length === 0) {
    return ''
  }

  const lines: string[] = []
  for (const msg of messages) {
    // chatService 返回的 createTime 是秒，转毫秒
    const ms = msg.createTime > 1e12 ? msg.createTime : msg.createTime * 1000
    const time = new Date(ms).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    const sender = msg.isSend ? '我' : (msg.senderName || displayName || '对方')
    const text = formatMessageContent(msg.localType ?? 1, msg.content)
    lines.push(`[${time}] ${sender}: ${text}`)
  }
  return lines.join('\n')
}

/**
 * 将用户精准选择的消息格式化为上下文文本
 */
function buildSelectedMessageContext(
  messages: SelectedMessageItem[],
  displayName?: string
): string {
  if (!messages || messages.length === 0) {
    return ''
  }
  const lines: string[] = []
  for (const msg of messages) {
    // createTime 可能是秒或毫秒，统一转毫秒
    const ms = msg.createTime > 1e12 ? msg.createTime : msg.createTime * 1000
    const time = new Date(ms).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    const sender = msg.isSend ? '我' : (msg.senderName || displayName || '对方')
    const text = formatMessageContent(msg.localType, msg.content)
    lines.push(`[${time}] ${sender}: ${text}`)
  }
  return lines.join('\n')
}

// ─── 流式 API 调用 ────────────────────────────────────────────────────────────

/**
 * 调用 OpenAI 兼容 API（流式），逐 chunk 回调。
 * 使用 Node 原生 https/http 模块，SSE 解析 data: 行。
 */
function callApiStream(
  apiBaseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
  options: CallApiStreamOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const endpoint = buildApiUrl(apiBaseUrl, '/chat/completions')
    let urlObj: URL
    try {
      urlObj = new URL(endpoint)
    } catch (e) {
      reject(new Error(`无效的 API URL: ${endpoint}`))
      return
    }

    const normalizedMaxTokens = normalizeApiMaxTokens(options.maxTokens ?? API_MAX_TOKENS_DEFAULT)
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? API_TEMPERATURE,
      stream: true,
      max_tokens: normalizedMaxTokens
    }

    const body = JSON.stringify(payload)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body).toString(),
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream'
    }

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST' as const,
      headers
    }

    const isHttps = urlObj.protocol === 'https:'
    const requestFn = isHttps ? https.request : http.request
    const req = requestFn(requestOptions, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errBody = ''
        res.on('data', (c) => { errBody += c })
        res.on('end', () => {
          reject(new Error(`API 请求失败 (${res.statusCode}): ${errBody.slice(0, 200)}`))
        })
        return
      }

      let fullContent = ''
      let buffer = ''

      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8')
        // SSE 以 \n\n 分隔事件，每事件含 data: 行
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // 保留未完成的部分

        for (const evt of events) {
          const dataLines = evt
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())

          for (const dataStr of dataLines) {
            if (dataStr === '[DONE]') {
              resolve(fullContent)
              return
            }
            try {
              const parsed = JSON.parse(dataStr)
              const delta = parsed?.choices?.[0]?.delta?.content
              if (typeof delta === 'string' && delta.length > 0) {
                fullContent += delta
                onChunk(delta)
              }
            } catch {
              // 忽略解析错误的行（如心跳/注释）
            }
          }
        }
      })

      res.on('end', () => {
        // 处理缓冲区剩余
        if (buffer.trim()) {
          const dataLines = buffer
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
          for (const dataStr of dataLines) {
            if (dataStr === '[DONE]') break
            try {
              const parsed = JSON.parse(dataStr)
              const delta = parsed?.choices?.[0]?.delta?.content
              if (typeof delta === 'string' && delta.length > 0) {
                fullContent += delta
                onChunk(delta)
              }
            } catch {
              // ignore
            }
          }
        }
        resolve(fullContent)
      })
    })

    req.setTimeout(API_TIMEOUT_MS, () => {
      req.destroy()
      reject(new Error('API 请求超时'))
    })

    req.on('error', (e) => reject(e))

    // 支持 AbortSignal
    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy()
        reject(new Error('请求已取消'))
        return
      }
      options.signal.addEventListener('abort', () => {
        req.destroy()
        reject(new Error('请求已取消'))
      }, { once: true })
    }

    req.write(body)
    req.end()
  })
}

// ─── 非流式调用（用于画像生成） ────────────────────────────────────────────────

function callApi(
  apiBaseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  timeoutMs: number = API_TIMEOUT_MS,
  maxTokens: number = API_MAX_TOKENS_DEFAULT
): Promise<string> {
  return new Promise((resolve, reject) => {
    const endpoint = buildApiUrl(apiBaseUrl, '/chat/completions')
    let urlObj: URL
    try {
      urlObj = new URL(endpoint)
    } catch (e) {
      reject(new Error(`无效的 API URL: ${endpoint}`))
      return
    }

    const normalizedMaxTokens = normalizeApiMaxTokens(maxTokens)
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3,
      stream: false,
      max_tokens: Math.min(normalizedMaxTokens, 800)
    }
    const body = JSON.stringify(payload)

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST' as const,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
        Authorization: `Bearer ${apiKey}`
      }
    }

    const isHttps = urlObj.protocol === 'https:'
    const requestFn = isHttps ? https.request : http.request
    const req = requestFn(requestOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`API 请求失败 (${res.statusCode}): ${data.slice(0, 200)}`))
            return
          }
          const parsed = JSON.parse(data)
          const content = parsed?.choices?.[0]?.message?.content
          if (typeof content === 'string' && content.trim()) {
            resolve(content.trim())
          } else {
            reject(new Error('API 返回格式异常'))
          }
        } catch (e) {
          reject(new Error(`JSON 解析失败: ${data.slice(0, 200)}`))
        }
      })
    })

    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error('API 请求超时'))
    })

    req.on('error', (e) => reject(e))
    req.write(body)
    req.end()
  })
}

// ─── 主服务类 ──────────────────────────────────────────────────────────────────

class AiChatService {
  private readonly config: ConfigService
  /** 进行中的请求 AbortController，按 requestId 索引 */
  private readonly activeRequests = new Map<string, AbortController>()

  constructor() {
    this.config = new ConfigService()
  }

  /**
   * 获取 AI 模型配置（复用 insightService 的配置，保持一致性）
   */
  private getSharedAiModelConfig(): SharedAiModelConfig {
    const apiBaseUrl = String(
      this.config.get('aiModelApiBaseUrl')
      || this.config.get('aiInsightApiBaseUrl')
      || ''
    ).trim()
    const apiKey = String(
      this.config.get('aiModelApiKey')
      || this.config.get('aiInsightApiKey')
      || ''
    ).trim()
    const model = String(
      this.config.get('aiModelApiModel')
      || this.config.get('aiInsightApiModel')
      || 'deepseek-chat'
    ).trim() || 'deepseek-chat'
    const maxTokens = normalizeApiMaxTokens(this.config.get('aiModelApiMaxTokens'))
    return { apiBaseUrl, apiKey, model, maxTokens }
  }

  /**
   * 获取当前厂商预设
   */
  getProviderPreset(): AiProviderPreset {
    const providerId = String(this.config.get('aiProvider') || DEFAULT_PROVIDER_ID)
    return AI_PROVIDER_PRESETS[providerId] || AI_PROVIDER_PRESETS[DEFAULT_PROVIDER_ID]
  }

  /**
   * 应用厂商预设到配置
   */
  applyProviderPreset(providerId: string): { success: boolean; error?: string } {
    const preset = AI_PROVIDER_PRESETS[providerId]
    if (!preset) {
      return { success: false, error: `未知的厂商: ${providerId}` }
    }
    this.config.set('aiProvider', providerId)
    this.config.set('aiModelApiBaseUrl', preset.baseUrl)
    this.config.set('aiModelApiModel', preset.defaultModel)
    return { success: true }
  }

  /**
   * 列出所有厂商预设
   */
  listProviderPresets(): Array<AiProviderPreset & { isCurrent: boolean }> {
    const currentId = String(this.config.get('aiProvider') || DEFAULT_PROVIDER_ID)
    return Object.values(AI_PROVIDER_PRESETS).map((preset) => ({
      ...preset,
      isCurrent: preset.id === currentId
    }))
  }

  // ─── 对话历史管理 ────────────────────────────────────────────────────────────

  private getSessionsKey(): string {
    return 'aiChatSessions'
  }

  /**
   * 读取所有对话会话
   */
  private getAllSessions(): Record<string, AiChatSession> {
    const raw = this.config.get(this.getSessionsKey())
    if (!raw || typeof raw !== 'object') return {}
    return raw as Record<string, AiChatSession>
  }

  /**
   * 保存所有对话会话
   */
  private saveAllSessions(sessions: Record<string, AiChatSession>): void {
    this.config.set(this.getSessionsKey(), sessions)
  }

  /**
   * 获取单个会话（不存在则创建）
   */
  getSession(sessionId: string, displayName?: string): AiChatSession {
    const all = this.getAllSessions()
    const existing = all[sessionId]
    if (existing) {
      return existing
    }
    const session: AiChatSession = {
      sessionId,
      displayName,
      messages: [],
      lastActiveAt: Date.now(),
      totalRounds: 0
    }
    all[sessionId] = session
    this.saveAllSessions(all)
    return session
  }

  /**
   * 列出所有会话（用于侧边栏历史列表）
   */
  listSessions(): Array<AiChatSession> {
    const all = this.getAllSessions()
    return Object.values(all).sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  }

  /**
   * 清理过期会话（TTL = 90 天）
   */
  cleanupExpiredSessions(): { cleaned: number } {
    const all = this.getAllSessions()
    const now = Date.now()
    let cleaned = 0
    const next: Record<string, AiChatSession> = {}
    for (const [id, session] of Object.entries(all)) {
      if (now - session.lastActiveAt < PROFILE_TTL_MS) {
        next[id] = session
      } else {
        cleaned += 1
      }
    }
    if (cleaned > 0) {
      this.saveAllSessions(next)
    }
    return { cleaned }
  }

  /**
   * 清空指定会话的对话历史（保留画像）
   */
  clearSessionMessages(sessionId: string): { success: boolean } {
    const all = this.getAllSessions()
    if (!all[sessionId]) return { success: true }
    all[sessionId].messages = []
    all[sessionId].totalRounds = 0
    all[sessionId].lastActiveAt = Date.now()
    this.saveAllSessions(all)
    return { success: true }
  }

  /**
   * 删除整个会话（含画像）
   */
  deleteSession(sessionId: string): { success: boolean } {
    const all = this.getAllSessions()
    delete all[sessionId]
    this.saveAllSessions(all)
    return { success: true }
  }

  // ─── 画像管理 ────────────────────────────────────────────────────────────────

  /**
   * 触发画像生成/更新
   * 基于 session.messages 和已有 profileSummary 让 AI 总结
   */
  private async generateProfileSummary(
    session: AiChatSession,
    apiBaseUrl: string,
    apiKey: string,
    model: string,
    maxTokens: number
  ): Promise<string | null> {
    if (session.messages.length === 0) return null

    const recentMessages = session.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20) // 最近 20 条用于总结

    const promptMessages = [
      {
        role: 'system' as const,
        content: '你是用户画像总结器。基于对话历史，生成/更新当前会话分析对象的画像摘要。输出 ≤200 字的中文，包含：基础特征、兴趣话题、情绪模式、沟通风格、行为倾向。只输出正文，不要标题/列表/JSON。'
      },
      {
        role: 'user' as const,
        content: `已有画像：
${session.profileSummary || '（首次生成）'}

最近对话：
${recentMessages.map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.slice(0, 200)}`).join('\n')}

请输出更新后的画像摘要：`
      }
    ]

    try {
      const result = await callApi(
        apiBaseUrl,
        apiKey,
        model,
        promptMessages,
        API_TIMEOUT_MS,
        Math.min(maxTokens, 800)
      )
      return result.trim()
    } catch (e) {
      console.error('[AiChatService] 画像生成失败:', e)
      return session.profileSummary || null
    }
  }

  // ─── 核心对话方法 ────────────────────────────────────────────────────────────

  /**
   * 带上下文的多轮对话（流式）
   *
   * @param requestId 用于中断的请求 ID
   * @param context 会话+时间范围上下文（可选，不选则纯闲聊）
   * @param userMessage 用户本次提问
   * @param onChunk 流式回调
   * @returns AI 完整回复
   */
  async chatWithContext(
    requestId: string,
    context: AiChatContext | null,
    userMessage: string,
    onChunk: (chunk: string) => void
  ): Promise<{ success: boolean; reply?: string; error?: string; profileUpdated?: boolean }> {
    const { apiBaseUrl, apiKey, model, maxTokens } = this.getSharedAiModelConfig()

    if (!apiBaseUrl || !apiKey) {
      return { success: false, error: '请先在设置页配置 AI 厂商和 API Key' }
    }

    // 1. 组装系统提示词
    let session: AiChatSession | null = null
    let systemPrompt: string

    if (context?.sessionId) {
      session = this.getSession(context.sessionId, context.displayName)
      // 清理过期的（懒清理）
      this.cleanupExpiredSessions()
      systemPrompt = buildSystemPrompt(context, session.profileSummary)
    } else {
      systemPrompt = buildSystemPrompt(null)
    }

    // 2. 组装聊天上下文
    //    优先级：精准选择的消息 > 时间范围拉取
    let contextText = ''
    let contextLabel = ''

    if (context?.selectedMessages && context.selectedMessages.length > 0) {
      // 用户在消息选择器中手动挑选的消息
      contextText = buildSelectedMessageContext(context.selectedMessages, context.displayName)
      contextLabel = `用户精选的 ${context.selectedMessages.length} 条消息`
    } else if (context?.sessionId) {
      try {
        const result = await chatService.getMessages(
          context.sessionId,
          0,
          CONTEXT_MESSAGE_LIMIT,
          context.startTime || 0,
          context.endTime || 0,
          true // 升序，从早到晚
        )
        if (result.success && result.messages && result.messages.length > 0) {
          contextText = formatChatContext(
            result.messages.map((m) => ({
              isSend: m.isSend === true || m.isSend === 1,
              content: m.parsedContent || m.content || '',
              createTime: m.createTime || 0,
              senderName: m.senderName,
              localType: m.localType
            })),
            context.displayName
          )
        }
      } catch (e) {
        console.warn('[AiChatService] 拉取上下文失败，继续无上下文对话:', e)
      }

      if (context.startTime && context.endTime) {
        contextLabel = `${new Date(context.startTime).toLocaleDateString('zh-CN')} 至 ${new Date(context.endTime).toLocaleDateString('zh-CN')}`
      }
    }

    // 3. 构建 messages 数组
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ]

    if (contextText) {
      const labelPart = contextLabel ? `（${contextLabel}）` : ''
      messages.push({
        role: 'system',
        content: `以下是真实聊天记录${labelPart}，作为分析依据：\n\n${contextText}`
      })
    }

    // 加入历史对话（最多最近 10 条，避免 token 膨胀）
    if (session && session.messages.length > 0) {
      const recent = session.messages.slice(-10)
      for (const m of recent) {
        messages.push({ role: m.role, content: m.content })
      }
    }

    // 本次用户提问
    messages.push({ role: 'user', content: userMessage })

    // 4. 流式调用
    const abortController = new AbortController()
    this.activeRequests.set(requestId, abortController)

    try {
      const fullReply = await callApiStream(
        apiBaseUrl,
        apiKey,
        model,
        messages,
        onChunk,
        {
          maxTokens,
          signal: abortController.signal
        }
      )

      // 5. 保存对话历史 + 触发画像更新
      let profileUpdated = false
      if (session) {
        session.messages.push({ role: 'user', content: userMessage, timestamp: Date.now() })
        session.messages.push({ role: 'assistant', content: fullReply, timestamp: Date.now() })
        session.totalRounds += 1
        session.lastActiveAt = Date.now()

        // 每 N 轮触发画像更新
        if (session.totalRounds % PROFILE_TRIGGER_ROUNDS === 0) {
          try {
            const newProfile = await this.generateProfileSummary(
              session,
              apiBaseUrl,
              apiKey,
              model,
              maxTokens
            )
            if (newProfile) {
              session.profileSummary = newProfile
              profileUpdated = true
            }
          } catch (e) {
            console.warn('[AiChatService] 画像更新失败:', e)
          }
        }

        // 触发画像后只保留最近 M 轮原文
        if (session.totalRounds > PROFILE_TRIGGER_ROUNDS && session.messages.length > KEEP_RECENT_ROUNDS * 2) {
          session.messages = session.messages.slice(-KEEP_RECENT_ROUNDS * 2)
        }

        // 保存
        const all = this.getAllSessions()
        all[session.sessionId] = session
        this.saveAllSessions(all)
      }

      return { success: true, reply: fullReply, profileUpdated }
    } catch (e) {
      const errMsg = (e as Error)?.message || String(e)
      if (errMsg.includes('取消')) {
        return { success: false, error: '已取消' }
      }
      return { success: false, error: errMsg }
    } finally {
      this.activeRequests.delete(requestId)
    }
  }

  /**
   * 中断进行中的请求
   */
  abortRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(requestId)
    }
  }
}

// ─── 导出单例 ──────────────────────────────────────────────────────────────────

export const aiChatService = new AiChatService()
