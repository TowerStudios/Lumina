// 分析 wcdb_api.dll 的导入表和安全检查逻辑
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

// 1. 查找导入的 DLL 名称
console.log('=== 导入的 DLL ===')
const dllNames = ['winhttp', 'wininet', 'ws2_32', 'crypt32', 'bcrypt', 'schannel', 'secur32', 'advapi32', 'kernel32', 'user32', 'iphlpapi']
for (const name of dllNames) {
  const lower = bytes.toString('ascii').toLowerCase()
  if (lower.includes(name)) {
    console.log(`  Found: ${name}`)
  }
}

// 2. 查找 SecurityStatus 相关的字节序列
console.log('\n=== SecurityStatus 字符串位置 ===')
const secStatusStr = 'SecurityStatus:'
const secStatusBuf = Buffer.from(secStatusStr, 'ascii')
const positions = []
for (let i = 0; i < bytes.length - secStatusBuf.length; i++) {
  let match = true
  for (let j = 0; j < secStatusBuf.length; j++) {
    if (bytes[i + j] !== secStatusBuf[j]) { match = false; break }
  }
  if (match) {
    positions.push(i)
    // 读取完整字符串
    let end = i + secStatusBuf.length
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
    console.log(`  Offset 0x${i.toString(16)}: ${bytes.toString('ascii', i, end)}`)
  }
}

// 3. 查找 "Security validation failed" 字符串
console.log('\n=== Security validation failed 位置 ===')
const secFailStr = 'Security validation failed'
const secFailBuf = Buffer.from(secFailStr, 'ascii')
for (let i = 0; i < bytes.length - secFailBuf.length; i++) {
  let match = true
  for (let j = 0; j < secFailBuf.length; j++) {
    if (bytes[i + j] !== secFailBuf[j]) { match = false; break }
  }
  if (match) {
    console.log(`  Offset 0x${i.toString(16)}`)
  }
}

// 4. 查找 GetEnvironmentVariable 相关字符串
console.log('\n=== 环境变量检查 ===')
const envVars = ['WEFLOW_SNAPSHOT_V1', 'weflow_read_opt', 'WEFLOW_', 'weflow_']
for (const env of envVars) {
  const buf = Buffer.from(env, 'ascii')
  for (let i = 0; i < bytes.length - buf.length; i++) {
    let match = true
    for (let j = 0; j < buf.length; j++) {
      if (bytes[i + j] !== buf[j]) { match = false; break }
    }
    if (match) {
      let end = i + buf.length
      while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
      let start = i
      while (start > 0 && bytes[start - 1] >= 0x20 && bytes[start - 1] < 0x7f) start--
      console.log(`  Offset 0x${i.toString(16)}: ${bytes.toString('ascii', start, end)}`)
      break
    }
  }
}

// 5. 查找进程名检查相关字符串
console.log('\n=== 进程名检查 ===')
const procNames = ['weflow.exe', 'WeFlow', 'weflow', 'electron.exe', 'GetModuleFileName', 'CreateToolhelp32Snapshot', 'Process32First']
for (const proc of procNames) {
  const lower = bytes.toString('ascii').toLowerCase()
  const procLower = proc.toLowerCase()
  const idx = lower.indexOf(procLower)
  if (idx >= 0) {
    let end = idx + proc.length
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
    let start = idx
    while (start > 0 && bytes[start - 1] >= 0x20 && bytes[start - 1] < 0x7f) start--
    console.log(`  Found "${proc}" at 0x${idx.toString(16)}: ${bytes.toString('ascii', start, end)}`)
  }
}

// 6. 查找 manifest/signature 相关文件
console.log('\n=== Manifest/Signature 文件 ===')
const manifestStrs = ['.manifest', '.sig', '.sign', '.cert', '.pem', 'signature', 'manifest', 'digest', 'hash']
for (const s of manifestStrs) {
  const lower = bytes.toString('ascii').toLowerCase()
  const idx = lower.indexOf(s.toLowerCase())
  if (idx >= 0) {
    let end = idx + s.length
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
    let start = idx
    while (start > 0 && bytes[start - 1] >= 0x20 && bytes[start - 1] < 0x7f) start--
    console.log(`  Found "${s}" at 0x${idx.toString(16)}: ${bytes.toString('ascii', start, end)}`)
  }
}
