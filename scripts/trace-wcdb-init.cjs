// 追踪 wcdb_init 函数的完整调用链和安全检查
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

const peOffset = bytes.readUInt32LE(0x3c)
const numSections = bytes.readUInt16LE(peOffset + 6)
const optHeaderSize = bytes.readUInt16LE(peOffset + 20)
const sectionsStart = peOffset + 24 + optHeaderSize
const sections = []
for (let i = 0; i < numSections; i++) {
  const off = sectionsStart + i * 40
  sections.push({
    vAddr: bytes.readUInt32LE(off + 12),
    vSize: bytes.readUInt32LE(off + 8),
    rawAddr: bytes.readUInt32LE(off + 20),
    rawSize: bytes.readUInt32LE(off + 16),
  })
}

function offsetToRva(offset) {
  for (const s of sections) {
    if (offset >= s.rawAddr && offset < s.rawAddr + s.rawSize)
      return offset - s.rawAddr + s.vAddr
  }
  return offset
}

function rvaToOffset(rva) {
  for (const s of sections) {
    if (rva >= s.vAddr && rva < s.vAddr + s.vSize)
      return rva - s.vAddr + s.rawAddr
  }
  return rva
}

// 1. 查看 WEFLOW_SNAPSHOT_V1 检查的两个分支
// LEA at 0x7fc42, CALL at 0x7fc49, TEST at 0x7fc4e, JNE at 0x7fc50
// JNE target: 0x7fc50 + 6 + 0xf51 = 0x80ba7 (approximately)
console.log('=== WEFLOW_SNAPSHOT_V1 检查 (0x7fc42) ===')
// 计算 JNE 目标
const jneOffset = 0x7fc50
const jneDisp = bytes.readInt32LE(jneOffset + 2)
const jneTarget = jneOffset + 6 + jneDisp
console.log(`JNE at 0x${jneOffset.toString(16)}, disp=${jneDisp}, target=0x${jneTarget.toString(16)}`)

// 打印 JNE 目标处的代码（env var 已设置的分支）
console.log('\n--- WEFLOW_SNAPSHOT_V1 已设置的分支 (0x' + jneTarget.toString(16) + ') ---')
for (let i = jneTarget; i < jneTarget + 64; i++) {
  process.stdout.write(bytes[i].toString(16).padStart(2, '0') + ' ')
  if ((i - jneTarget + 1) % 16 === 0) {
    process.stdout.write(' ')
    process.stdout.write(bytes.toString('ascii', i - 15, i + 1).replace(/[^\x20-\x7e]/g, '.'))
    process.stdout.write('\n')
  }
}

// 打印 JNE 之后的代码（env var 未设置的分支）
console.log('\n--- WEFLOW_SNAPSHOT_V1 未设置的分支 (fall-through) ---')
const fallThrough = jneOffset + 6
for (let i = fallThrough; i < fallThrough + 64; i++) {
  process.stdout.write(bytes[i].toString(16).padStart(2, '0') + ' ')
  if ((i - fallThrough + 1) % 16 === 0) {
    process.stdout.write(' ')
    process.stdout.write(bytes.toString('ascii', i - 15, i + 1).replace(/[^\x20-\x7e]/g, '.'))
    process.stdout.write('\n')
  }
}

// 2. 追踪 wcdb_init 函数内的 CALL 指令（使用正确的 RVA 计算）
console.log('\n=== wcdb_init 函数 CALL 指令（前 30 个）===')
const funcStart = 0xe8270
const funcEnd = funcStart + 4096
let callCount = 0
for (let i = funcStart; i < funcEnd && i < bytes.length - 5; i++) {
  if (bytes[i] === 0xe8) {
    // 确保这不是误判（前一个字节不应是指令前缀）
    const rel = bytes.readInt32LE(i + 1)
    const codeRva = offsetToRva(i)
    const targetRva = codeRva + 5 + rel
    const targetOffset = rvaToOffset(targetRva)
    if (targetOffset > 0 && targetOffset < bytes.length) {
      if (callCount < 30) {
        console.log(`  CALL at 0x${i.toString(16)} (RVA 0x${codeRva.toString(16)}) -> 0x${targetOffset.toString(16)} (RVA 0x${targetRva.toString(16)})`)
      }
      callCount++
    }
  }
}
console.log(`  Total CALLs: ${callCount}`)

// 3. 追踪 wcdb_init 函数内的条件跳转
console.log('\n=== wcdb_init 函数条件跳转（前 20 个）===')
let jmpCount = 0
for (let i = funcStart; i < funcEnd && i < bytes.length - 6; i++) {
  // 0f 8x xx xx xx xx (长条件跳转)
  if (bytes[i] === 0x0f && (bytes[i+1] >= 0x80 && bytes[i+1] <= 0x8f)) {
    const rel = bytes.readInt32LE(i + 2)
    const codeRva = offsetToRva(i)
    const targetRva = codeRva + 6 + rel
    const targetOffset = rvaToOffset(targetRva)
    const condNames = ['jo','jno','jb','jae','je','jne','jbe','ja','js','jns','jp','jnp','jl','jge','jle','jg']
    const cond = condNames[bytes[i+1] - 0x80]
    if (jmpCount < 20) {
      console.log(`  ${cond} at 0x${i.toString(16)} -> 0x${targetOffset.toString(16)}`)
    }
    jmpCount++
  }
  // 7x xx (短条件跳转)
  else if (bytes[i] >= 0x70 && bytes[i] <= 0x7f) {
    const rel = bytes.readInt8(i + 1)
    const codeRva = offsetToRva(i)
    const targetRva = codeRva + 2 + rel
    const targetOffset = rvaToOffset(targetRva)
    const condNames = ['jo','jno','jb','jae','je','jne','jbe','ja','js','jns','jp','jnp','jl','jge','jle','jg']
    const cond = condNames[bytes[i] - 0x70]
    if (jmpCount < 20) {
      console.log(`  ${cond} (short) at 0x${i.toString(16)} -> 0x${targetOffset.toString(16)}`)
    }
    jmpCount++
  }
}
console.log(`  Total conditional jumps: ${jmpCount}`)

// 4. 查找 wcdb_init 函数中的 RET 指令
console.log('\n=== wcdb_init 函数 RET 指令 ===')
for (let i = funcStart; i < funcEnd && i < bytes.length; i++) {
  if (bytes[i] === 0xc3) {
    // 检查是否是真正的 RET（不是其他指令的一部分）
    console.log(`  RET at 0x${i.toString(16)}`)
  }
}

// 5. 查看 wcdb_init 函数的前 256 字节的反汇编
console.log('\n=== wcdb_init 前 256 字节（hex+ascii）===')
for (let i = 0; i < 256; i++) {
  const off = funcStart + i
  process.stdout.write(bytes[off].toString(16).padStart(2, '0') + ' ')
  if ((i + 1) % 16 === 0) {
    process.stdout.write(' ')
    process.stdout.write(bytes.toString('ascii', off - 15, off + 1).replace(/[^\x20-\x7e]/g, '.'))
    process.stdout.write('\n')
  }
}
