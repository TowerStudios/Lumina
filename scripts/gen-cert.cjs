// 生成 api.weflow.top 的自签名证书
const { generateKeyPairSync, createSign, X509Certificate } = require('crypto')
const fs = require('fs')
const path = require('path')

const certDir = path.join(__dirname, '..', 'resources', 'cert')
if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true })

// 生成 RSA 密钥对
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
})

// 创建自签名证书
// 有效期 1 年
const notBefore = new Date()
notBefore.setDate(notBefore.getDate() - 1)
const notAfter = new Date()
notAfter.setFullYear(notAfter.getFullYear() + 1)

// 简单的 X.509 证书生成（使用 Node.js 内置 API）
const certPem = require('crypto').certExportSync
  ? null
  : (() => {
      // 使用 selfsigned-style 手动构造
      // 实际上 Node.js 没有内置证书生成，使用 child_process 调用 PowerShell 或直接用已有工具
      return null
    })()

// 输出密钥
fs.writeFileSync(path.join(certDir, 'key.pem'), privateKey)
fs.writeFileSync(path.join(certDir, 'pub.pem'), publicKey)

console.log('密钥已生成，但需要使用 openssl 或 mkcert 生成证书')
console.log('请安装 mkcert 或使用以下命令生成自签名证书：')
console.log('openssl req -x509 -new -key key.pem -out cert.pem -days 365 -subj "/CN=api.weflow.top"')
