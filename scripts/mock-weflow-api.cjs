// Mock api.weflow.top HTTPS server
// 拦截 DLL 的 /api/token 请求，返回有效 token，使 wcdb_init() 返回 0
const https = require('https')
const fs = require('fs')
const path = require('path')

const PORT = 443
const HOST = '0.0.0.0'
const CERT_DIR = path.join(__dirname, 'cert')
const PFX_PATH = path.join(CERT_DIR, 'cert.pfx')
const PFX_PASSWORD = 'lumina123'

if (!fs.existsSync(PFX_PATH)) {
  console.error(`PFX not found: ${PFX_PATH}`)
  process.exit(1)
}

const pfx = fs.readFileSync(PFX_PATH)

const server = https.createServer({
  pfx,
  passphrase: PFX_PASSWORD,
})

// 生成一个足够长的 token（DLL 可能验证长度或格式）
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

server.on('request', (req, res) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.url}`)
  console.log(`  Headers: ${JSON.stringify(req.headers, null, 2)}`)

  let body = ''
  req.on('data', (chunk) => { body += chunk.toString() })
  req.on('end', () => {
    if (body) console.log(`  Body: ${body}`)

    // /api/token — 授权 token 端点
    if (req.url === '/api/token' || req.url.startsWith('/api/token')) {
      // 尝试多种可能的响应格式
      const token = generateToken()
      const response = {
        success: true,
        token: token,
        expiresIn: 999999999, // 约 31 年（秒）
        code: 0,
        msg: 'ok',
      }
      const json = JSON.stringify(response)
      console.log(`  Response: ${json}`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(json)
      return
    }

    // /api/report — 上报端点
    if (req.url === '/api/report' || req.url.startsWith('/api/report')) {
      const response = { success: true, code: 0, msg: 'ok' }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
      return
    }

    // /api/reports/batch — 批量上报端点
    if (req.url === '/api/reports/batch' || req.url.startsWith('/api/reports/batch')) {
      const response = { success: true, code: 0, msg: 'ok' }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
      return
    }

    // 默认响应
    console.log(`  Default 200 response`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true, code: 0, msg: 'ok' }))
  })
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: netstat -ano | findstr :${PORT}`)
  } else {
    console.error(`Server error: ${e.message}`)
  }
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  console.log(`=== Mock api.weflow.top HTTPS server ===`)
  console.log(`Listening on https://${HOST}:${PORT}`)
  console.log(`PFX: ${PFX_PATH}`)
  console.log(`Waiting for /api/token requests...`)
  console.log(`(Press Ctrl+C to stop)`)
})
