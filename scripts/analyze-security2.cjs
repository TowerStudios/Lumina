// 深入分析 wcdb_init 的安全检查逻辑
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

// 1. 查看 weflow.eH+ 附近的原始字节
console.log('=== weflow.eH+ 附近字节 (0x6cad8) ===')
const offset1 = 0x6cad8 - 32
for (let i = offset1; i < offset1 + 80; i++) {
  process.stdout.write(bytes[i].toString(16).padStart(2, '0') + ' ')
  if ((i - offset1 + 1) % 16 === 0) process.stdout.write('\n')
}
process.stdout.write('\n')
// 打印 ASCII
console.log('ASCII:', bytes.toString('ascii', offset1, offset1 + 80).replace(/[^\x20-\x7e]/g, '.'))

// 2. 查找 "weflow.exe" 完整字符串
console.log('\n=== 查找 weflow.exe 完整字符串 ===')
const weflowExe = Buffer.from('weflow.exe', 'ascii')
for (let i = 0; i < bytes.length - weflowExe.length; i++) {
  let match = true
  for (let j = 0; j < weflowExe.length; j++) {
    if (bytes[i + j] !== weflowExe[j]) { match = false; break }
  }
  if (match) {
    let start = i
    while (start > 0 && bytes[start - 1] >= 0x20 && bytes[start - 1] < 0x7f) start--
    let end = i + weflowExe.length
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
    console.log(`  0x${i.toString(16)}: "${bytes.toString('ascii', start, end)}"`)
  }
}

// 3. 查找 .exe 相关的所有字符串
console.log('\n=== .exe 相关字符串 ===')
const exeStr = '.exe'
const found = new Set()
for (let i = 0; i < bytes.length - 4; i++) {
  if (bytes[i] === 0x2e && bytes[i+1] === 0x65 && bytes[i+2] === 0x78 && bytes[i+3] === 0x65) {
    let start = i
    while (start > 0 && bytes[start - 1] >= 0x20 && bytes[start - 1] < 0x7f) start--
    let end = i + 4
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
    const s = bytes.toString('ascii', start, end)
    if (s.length > 4 && !found.has(s)) {
      found.add(s)
      console.log(`  0x${start.toString(16)}: "${s}"`)
    }
  }
}

// 4. 查找 "wcdb_init" 函数地址（导出表）
console.log('\n=== PE 导出表 ===')
// PE header
const peOffset = bytes.readUInt32LE(0x3c)
const exportDirRva = bytes.readUInt32LE(peOffset + 0x88)
const exportDirSize = bytes.readUInt32LE(peOffset + 0x8c)
console.log(`  PE offset: 0x${peOffset.toString(16)}`)
console.log(`  Export dir RVA: 0x${exportDirRva.toString(16)}, size: ${exportDirSize}`)

// 将 RVA 转为文件偏移（简化版：搜索 section headers）
const numSections = bytes.readUInt16LE(peOffset + 6)
const optHeaderSize = bytes.readUInt16LE(peOffset + 20)
const sectionsStart = peOffset + 24 + optHeaderSize

function rvaToOffset(rva) {
  for (let i = 0; i < numSections; i++) {
    const secOff = sectionsStart + i * 40
    const vAddr = bytes.readUInt32LE(secOff + 12)
    const vSize = bytes.readUInt32LE(secOff + 8)
    const rawAddr = bytes.readUInt32LE(secOff + 20)
    if (rva >= vAddr && rva < vAddr + vSize) {
      return rva - vAddr + rawAddr
    }
  }
  return rva
}

if (exportDirRva > 0) {
  const exportOff = rvaToOffset(exportDirRva)
  const numNames = bytes.readUInt32LE(exportOff + 24)
  const namesRva = bytes.readUInt32LE(exportOff + 32)
  const namesOff = rvaToOffset(namesRva)

  console.log(`  Number of named exports: ${numNames}`)

  // 查找 wcdb_init 导出
  for (let i = 0; i < numNames; i++) {
    const nameRva = bytes.readUInt32LE(namesOff + i * 4)
    const nameOff = rvaToOffset(nameRva)
    let end = nameOff
    while (bytes[end] !== 0) end++
    const name = bytes.toString('ascii', nameOff, end)

    if (name === 'wcdb_init' || name === 'InitProtection') {
      // 查找函数地址
      const ordsRva = bytes.readUInt32LE(exportOff + 36)
      const funcsRva = bytes.readUInt32LE(exportOff + 28)
      const ord = bytes.readUInt16LE(rvaToOffset(ordsRva) + i * 2)
      const funcRva = bytes.readUInt32LE(rvaToOffset(funcsRva) + ord * 4)
      const funcOff = rvaToOffset(funcRva)
      console.log(`  Export "${name}": RVA=0x${funcRva.toString(16)}, FileOffset=0x${funcOff.toString(16)}`)
    }
  }
}

// 5. 查找 winhttp 导入的函数
console.log('\n=== WinHTTP 导入函数 ===')
const winhttpFuncs = ['WinHttpOpen', 'WinHttpConnect', 'WinHttpOpenRequest', 'WinHttpSendRequest', 'WinHttpReceiveResponse', 'WinHttpReadData', 'WinHttpCloseHandle', 'WinHttpSetOption', 'WinHttpQueryHeaders']
for (const func of winhttpFuncs) {
  const lower = bytes.toString('ascii').toLowerCase()
  const idx = lower.indexOf(func.toLowerCase())
  if (idx >= 0) {
    console.log(`  Found: ${func} at 0x${idx.toString(16)}`)
  }
}

// 6. 查找 GetEnvironmentVariableA/W
console.log('\n=== 环境变量函数 ===')
const envFuncs = ['GetEnvironmentVariableA', 'GetEnvironmentVariableW', 'GetEnvironmentVariable']
for (const func of envFuncs) {
  const lower = bytes.toString('ascii').toLowerCase()
  const idx = lower.indexOf(func.toLowerCase())
  if (idx >= 0) {
    console.log(`  Found: ${func} at 0x${idx.toString(16)}`)
  }
}
