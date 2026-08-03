// 查找 wcdb_api.dll 中与 token 缓存、注册表、文件路径相关的字符串
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

// 提取 ASCII 字符串（长度 >= 4）
const strings = []
let current = ''
for (let i = 0; i < bytes.length; i++) {
  const b = bytes[i]
  if (b >= 0x20 && b < 0x7f) {
    current += String.fromCharCode(b)
  } else {
    if (current.length >= 4) strings.push(current)
    current = ''
  }
}
if (current.length >= 4) strings.push(current)

// 过滤相关字符串
const patterns = [
  /token/i,
  /license/i,
  /cache/i,
  /registry|regkey|hkey|currentuser|localmachine/i,
  /weflow/i,
  /\.dat|\.bin|\.json|\.cfg|\.conf|\.tmp/i,
  /appdata|roaming|local/i,
  /Software\\/i,
  /api\.weflow/i,
  /authorization|auth/i,
  /expire|valid|period/i,
  /SecurityStatus/i,
  /wcdb_/i,
  /welive|wedecrypt/i,
]

console.log('=== 相关字符串 ===')
const matched = new Set()
for (const s of strings) {
  for (const p of patterns) {
    if (p.test(s)) {
      matched.add(s)
      break
    }
  }
}

for (const s of [...matched].sort()) {
  console.log(s)
}

console.log('\n=== 包含路径分隔符的字符串 ===')
for (const s of strings) {
  if (s.includes('\\') && s.length > 8 && s.length < 200) {
    console.log(s)
  }
}
