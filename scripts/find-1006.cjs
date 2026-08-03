// 搜索 -1006 的所有设置方式和 SecurityStatus 引用
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

// -1006 = 0xFFFFFC0E (32-bit signed)
// little-endian: 0E FC FF FF

// 1. 搜索所有包含 0E FC FF FF 的位置（可能是 -1006 的任何用法）
console.log('=== 搜索 0E FC FF FF (-1006 little-endian) ===')
const target = [0x0E, 0xFC, 0xFF, 0xFF]
const found1006 = []
for (let i = 0; i < bytes.length - 4; i++) {
  if (bytes[i] === 0x0E && bytes[i+1] === 0xFC && bytes[i+2] === 0xFF && bytes[i+3] === 0xFF) {
    found1006.push(i)
  }
}
console.log(`找到 ${found1006.length} 处`)
for (const off of found1006) {
  // 检查前一个字节，判断指令类型
  const prev = bytes[off - 1]
  let instr = 'unknown'
  if (prev === 0xB8) instr = 'mov eax, -1006'
  else if (prev === 0xB9) instr = 'mov ecx, -1006'
  else if (prev === 0xBA) instr = 'mov edx, -1006'
  else if (prev === 0xBB) instr = 'mov ebx, -1006'
  else if (prev === 0x68) instr = 'push -1006'
  else if (prev === 0x41) {
    const prev2 = bytes[off - 2]
    if (prev2 === 0xB8) instr = 'mov r8d, -1006'
    else if (prev2 === 0xB9) instr = 'mov r9d, -1006'
  }
  // 打印上下文
  const s = Math.max(0, off - 4)
  const e = Math.min(bytes.length, off + 8)
  let hexStr = ''
  for (let j = s; j < e; j++) hexStr += bytes[j].toString(16).padStart(2, '0') + ' '
  console.log(`  0x${off.toString(16)}: ${instr} (prev=0x${prev.toString(16)}) context: ${hexStr}`)
}

// 2. 搜索 "wcdb_init" 字符串（用于日志格式 "wcdb_init [SecurityStatus:N]"）
console.log('\n=== 搜索 "wcdb_init" 字符串 ===')
const wcdbInitStr = Buffer.from('wcdb_init', 'ascii')
for (let i = 0; i < bytes.length - 10; i++) {
  let match = true
  for (let j = 0; j < 10; j++) {
    if (bytes[i + j] !== wcdbInitStr[j]) { match = false; break }
  }
  if (match) {
    // 读取完整字符串
    let end = i + 10
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
    console.log(`  0x${i.toString(16)}: "${bytes.toString('ascii', i, end)}"`)
  }
}

// 3. 搜索 "SecurityStatus" 的 WIDE 字符串（UTF-16LE）
console.log('\n=== 搜索 "SecurityStatus" UTF-16LE ===')
const secWide = Buffer.alloc('SecurityStatus'.length * 2)
for (let i = 0; i < 'SecurityStatus'.length; i++) {
  secWide.writeUInt16LE('SecurityStatus'.charCodeAt(i), i * 2)
}
for (let i = 0; i < bytes.length - secWide.length; i++) {
  let match = true
  for (let j = 0; j < secWide.length; j++) {
    if (bytes[i + j] !== secWide[j]) { match = false; break }
  }
  if (match) {
    console.log(`  0x${i.toString(16)}`)
  }
}

// 4. 搜索 "SecurityStatus" ASCII 的所有引用（包括非 LEA 方式）
// 可能通过指针表引用
console.log('\n=== 搜索指向 SecurityStatus 的指针 ===')
const secStatusOffset = 0x1160e4
// 在 .rdata 中搜索指向此地址的 4 字节指针
for (let i = 0; i < bytes.length - 4; i++) {
  const val = bytes.readUInt32LE(i)
  if (val === secStatusOffset) {
    console.log(`  Pointer at 0x${i.toString(16)} -> 0x${secStatusOffset.toString(16)}`)
  }
}

// 5. 搜索 "weflow_read_opt" 的引用（包括非 LEA 方式）
console.log('\n=== 搜索指向 weflow_read_opt 的指针 ===')
const weflowReadOptOffset = 0x115288
for (let i = 0; i < bytes.length - 4; i++) {
  const val = bytes.readUInt32LE(i)
  if (val === weflowReadOptOffset) {
    console.log(`  Pointer at 0x${i.toString(16)} -> 0x${weflowReadOptOffset.toString(16)}`)
  }
}

// 6. 搜索 "WEFLOW_SNAPSHOT_V1" 的引用（包括非 LEA 方式）
console.log('\n=== 搜索指向 WEFLOW_SNAPSHOT_V1 的指针 ===')
const weflowSnapshotOffset = 0x114170
for (let i = 0; i < bytes.length - 4; i++) {
  const val = bytes.readUInt32LE(i)
  if (val === weflowSnapshotOffset) {
    console.log(`  Pointer at 0x${i.toString(16)} -> 0x${weflowSnapshotOffset.toString(16)}`)
  }
}

// 7. 搜索 "weflow_read_opt" UTF-16LE
console.log('\n=== 搜索 "weflow_read_opt" UTF-16LE ===')
const readOptWide = Buffer.alloc('weflow_read_opt'.length * 2)
for (let i = 0; i < 'weflow_read_opt'.length; i++) {
  readOptWide.writeUInt16LE('weflow_read_opt'.charCodeAt(i), i * 2)
}
for (let i = 0; i < bytes.length - readOptWide.length; i++) {
  let match = true
  for (let j = 0; j < readOptWide.length; j++) {
    if (bytes[i + j] !== readOptWide[j]) { match = false; break }
  }
  if (match) {
    console.log(`  0x${i.toString(16)}`)
  }
}

// 8. 搜索 "WEFLOW_SNAPSHOT_V1" UTF-16LE
console.log('\n=== 搜索 "WEFLOW_SNAPSHOT_V1" UTF-16LE ===')
const snapshotWide = Buffer.alloc('WEFLOW_SNAPSHOT_V1'.length * 2)
for (let i = 0; i < 'WEFLOW_SNAPSHOT_V1'.length; i++) {
  snapshotWide.writeUInt16LE('WEFLOW_SNAPSHOT_V1'.charCodeAt(i), i * 2)
}
for (let i = 0; i < bytes.length - snapshotWide.length; i++) {
  let match = true
  for (let j = 0; j < snapshotWide.length; j++) {
    if (bytes[i + j] !== snapshotWide[j]) { match = false; break }
  }
  if (match) {
    console.log(`  0x${i.toString(16)}`)
  }
}
