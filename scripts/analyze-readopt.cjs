// 分析 weflow_read_opt 检查逻辑和 wcdb_init 中的 SecurityStatus
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

// 1. 查看 weflow_read_opt 引用 (0x49202) 附近的代码
console.log('=== weflow_read_opt 引用 (0x49202) 附近代码 ===')
const readOptRef = 0x49202
const start1 = Math.max(0, readOptRef - 64)
const end1 = Math.min(bytes.length, readOptRef + 128)
for (let i = start1; i < end1; i++) {
  process.stdout.write(bytes[i].toString(16).padStart(2, '0') + ' ')
  if ((i - start1 + 1) % 16 === 0) {
    process.stdout.write(' ')
    const ascii = bytes.toString('ascii', i - 15, i + 1).replace(/[^\x20-\x7e]/g, '.')
    process.stdout.write(ascii)
    process.stdout.write('\n')
  }
}

// 2. 查找 getenv 函数引用
// 在 CRT 中，getenv 通常是 call getenv 或 call qword ptr [rip+offset]
console.log('\n=== 查找 getenv 调用 ===')
const getenvStr = 'getenv'
const getenvLower = Buffer.from('getenv', 'ascii')
for (let i = 0; i < bytes.length - 6; i++) {
  let match = true
  for (let j = 0; j < 6; j++) {
    if (bytes[i + j] !== getenvLower[j]) { match = false; break }
  }
  if (match) {
    let start = i
    while (start > 0 && bytes[start - 1] >= 0x20 && bytes[start - 1] < 0x7f) start--
    let end = i + 6
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
    console.log(`  "getenv" at 0x${i.toString(16)}: "${bytes.toString('ascii', start, end)}"`)
  }
}

// 3. 查找 _wgetenv 和 GetEnvironmentVariableW (wide char 版本)
console.log('\n=== 查找环境变量函数（wide char） ===')
const wideFuncs = ['_wgetenv', 'GetEnvironmentVariableW', '_dupenv_s', '_wdupenv_s']
for (const func of wideFuncs) {
  const buf = Buffer.from(func, 'ascii')
  for (let i = 0; i < bytes.length - buf.length; i++) {
    let match = true
    for (let j = 0; j < buf.length; j++) {
      if (bytes[i + j] !== buf[j]) { match = false; break }
    }
    if (match) {
      console.log(`  "${func}" at 0x${i.toString(16)}`)
    }
  }
}

// 4. 查找 SecurityStatus 字符串的所有引用方式
// 可能用 MOV reg, [rip+offset] (8b 05 / 48 8b 05) 或 LEA (48 8d 05)
console.log('\n=== 查找 SecurityStatus 所有引用 ===')
const secStatusOffset = 0x1160e4
const patterns = [
  // LEA r64, [rip+off]: 48 8d 05 xx xx xx xx (rax), 48 8d 0d (rcx), 48 8d 15 (rdx), etc.
  { name: 'LEA r64', bytes: [0x48, 0x8d], modrmMask: 0xc7, modrmVal: 0x05 },
  // MOV r64, [rip+off]: 48 8b 05 xx xx xx xx
  { name: 'MOV r64,[rip+off]', bytes: [0x48, 0x8b], modrmMask: 0xc7, modrmVal: 0x05 },
  // MOV r32, [rip+off]: 8b 05 xx xx xx xx
  { name: 'MOV r32,[rip+off]', bytes: [0x8b], modrmMask: 0xc7, modrmVal: 0x05, skipPrefix: true },
  // LEA r32, [rip+off]: 8d 05 xx xx xx xx
  { name: 'LEA r32,[rip+off]', bytes: [0x8d], modrmMask: 0xc7, modrmVal: 0x05, skipPrefix: true },
]

for (const pat of patterns) {
  for (let i = 0; i < bytes.length - 7; i++) {
    let match = true
    for (let j = 0; j < pat.bytes.length; j++) {
      if (bytes[i + j] !== pat.bytes[j]) { match = false; break }
    }
    if (!match) continue

    const modrmIdx = pat.skipPrefix ? i + 1 : i + 2
    if ((bytes[modrmIdx] & pat.modrmMask) === pat.modrmVal) {
      const disp = bytes.readInt32LE(modrmIdx + 1)
      const target = modrmIdx + 5 + disp
      if (target === secStatusOffset) {
        console.log(`  ${pat.name} at 0x${i.toString(16)} -> SecurityStatus`)
      }
    }
  }
}

// 5. 在 wcdb_init 函数范围内查找 call 指令和条件跳转
console.log('\n=== wcdb_init 函数内的 CALL 和条件跳转 ===')
const funcStart = 0xe8270
const funcEnd = funcStart + 2048 // 查看 2KB
let callCount = 0
for (let i = funcStart; i < funcEnd && i < bytes.length - 5; i++) {
  // E8 xx xx xx xx (near call)
  if (bytes[i] === 0xe8) {
    const rel = bytes.readInt32LE(i + 1)
    const target = i + 5 + rel
    if (callCount < 20) {
      console.log(`  CALL at 0x${i.toString(16)} -> 0x${target.toString(16)}`)
    }
    callCount++
  }
}
console.log(`  Total CALLs in range: ${callCount}`)

// 6. 查找 mov eax, -1006 (B8 0E FC FF FF) 在整个 DLL 中的位置
console.log('\n=== mov eax, -1006 (B8 0E FC FF FF) ===')
const mov1006 = [0xB8, 0x0E, 0xFC, 0xFF, 0xFF]
for (let i = 0; i < bytes.length - 5; i++) {
  let match = true
  for (let j = 0; j < 5; j++) {
    if (bytes[i + j] !== mov1006[j]) { match = false; break }
  }
  if (match) {
    console.log(`  mov eax, -1006 at 0x${i.toString(16)}`)
    // 打印前后上下文
    const s = Math.max(0, i - 8)
    const e = Math.min(bytes.length, i + 13)
    let hexStr = ''
    for (let j = s; j < e; j++) hexStr += bytes[j].toString(16).padStart(2, '0') + ' '
    console.log(`    Context: ${hexStr}`)
  }
}

// 7. 查找 mov eax, 2 (用于 SecurityStatus 赋值)
// B8 02 00 00 00
console.log('\n=== mov eax, 2 (B8 02 00 00 00) 前 50 个 ===')
const mov2 = [0xB8, 0x02, 0x00, 0x00, 0x00]
let count2 = 0
for (let i = 0; i < bytes.length - 5 && count2 < 50; i++) {
  let match = true
  for (let j = 0; j < 5; j++) {
    if (bytes[i + j] !== mov2[j]) { match = false; break }
  }
  if (match) {
    console.log(`  mov eax, 2 at 0x${i.toString(16)}`)
    count2++
  }
}
