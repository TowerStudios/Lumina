// 使用正确的 RVA 计算搜索字符串引用
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

// PE header
const peOffset = bytes.readUInt32LE(0x3c)
const numSections = bytes.readUInt16LE(peOffset + 6)
const optHeaderSize = bytes.readUInt16LE(peOffset + 20)
const sectionsStart = peOffset + 24 + optHeaderSize
const imageBase = bytes.readUInt32LE(peOffset + 24 + 24) // ImageBase (PE32+ 是 8 字节，但低 4 字节通常足够)

console.log(`PE offset: 0x${peOffset.toString(16)}`)
console.log(`Sections: ${numSections}`)
console.log(`ImageBase: 0x${imageBase.toString(16)}`)

// 读取 section headers
const sections = []
for (let i = 0; i < numSections; i++) {
  const off = sectionsStart + i * 40
  const name = bytes.toString('ascii', off, off + 8).replace(/\0+$/, '')
  const vSize = bytes.readUInt32LE(off + 8)
  const vAddr = bytes.readUInt32LE(off + 12)
  const rawSize = bytes.readUInt32LE(off + 16)
  const rawAddr = bytes.readUInt32LE(off + 20)
  sections.push({ name, vSize, vAddr, rawSize, rawAddr })
  console.log(`  Section ${name}: VA=0x${vAddr.toString(16)}, VSize=0x${vSize.toString(16)}, Raw=0x${rawAddr.toString(16)}, RawSize=0x${rawSize.toString(16)}`)
}

// RVA -> File offset
function rvaToOffset(rva) {
  for (const s of sections) {
    if (rva >= s.vAddr && rva < s.vAddr + s.vSize) {
      return rva - s.vAddr + s.rawAddr
    }
  }
  return rva
}

// File offset -> RVA
function offsetToRva(offset) {
  for (const s of sections) {
    if (offset >= s.rawAddr && offset < s.rawAddr + s.rawSize) {
      return offset - s.rawAddr + s.vAddr
    }
  }
  return offset
}

// 查找字符串的 RVA
function findStringRva(str) {
  const buf = Buffer.from(str, 'ascii')
  for (let i = 0; i < bytes.length - buf.length; i++) {
    let match = true
    for (let j = 0; j < buf.length; j++) {
      if (bytes[i + j] !== buf[j]) { match = false; break }
    }
    if (match && bytes[i + buf.length] === 0) { // null terminated
      const rva = offsetToRva(i)
      return { offset: i, rva }
    }
  }
  return null
}

// 查找所有引用某个 RVA 的 LEA 指令
function findLeaReferences(targetRva) {
  const refs = []
  for (let i = 0; i < bytes.length - 7; i++) {
    // 48 8d xx [rip+disp32]  或  4c 8d xx [rip+disp32]
    if ((bytes[i] === 0x48 || bytes[i] === 0x4c) && bytes[i + 1] === 0x8d) {
      const modrm = bytes[i + 2]
      if ((modrm & 0xc7) === 0x05) { // RIP-relative
        const disp = bytes.readInt32LE(i + 3)
        const codeRva = offsetToRva(i)
        const target = codeRva + 7 + disp // RIP = next instruction
        if (target === targetRva) {
          refs.push({ offset: i, rva: codeRva, reg: (modrm >> 3) & 7 })
        }
      }
    }
  }
  return refs
}

// 1. 查找 SecurityStatus 字符串的 RVA 和引用
console.log('\n=== SecurityStatus ===')
// 搜索 "SecurityStatus:" (包含冒号)
const secStr = Buffer.from('SecurityStatus:', 'ascii')
for (let i = 0; i < bytes.length - secStr.length; i++) {
  let match = true
  for (let j = 0; j < secStr.length; j++) {
    if (bytes[i + j] !== secStr[j]) { match = false; break }
  }
  if (match) {
    const rva = offsetToRva(i)
    console.log(`  String at file offset 0x${i.toString(16)}, RVA 0x${rva.toString(16)}`)
    const refs = findLeaReferences(rva)
    for (const ref of refs) {
      const regNames = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi']
      const regIdx = ref.reg + (bytes[ref.offset] === 0x4c ? 8 : 0)
      console.log(`  LEA ${regNames[regIdx] || `r${regIdx}`}, [SecurityStatus] at file offset 0x${ref.offset.toString(16)}, RVA 0x${ref.rva.toString(16)}`)
    }
  }
}

// 2. 查找 "Security validation failed" 的 RVA 和引用
console.log('\n=== "Security validation failed" ===')
const failStr = Buffer.from('Security validation failed', 'ascii')
for (let i = 0; i < bytes.length - failStr.length; i++) {
  let match = true
  for (let j = 0; j < failStr.length; j++) {
    if (bytes[i + j] !== failStr[j]) { match = false; break }
  }
  if (match) {
    const rva = offsetToRva(i)
    console.log(`  String at file offset 0x${i.toString(16)}, RVA 0x${rva.toString(16)}`)
    const refs = findLeaReferences(rva)
    for (const ref of refs) {
      console.log(`  LEA at file offset 0x${ref.offset.toString(16)}`)
    }
  }
}

// 3. 查找 "weflow_read_opt" 的 RVA 和引用
console.log('\n=== "weflow_read_opt" ===')
const readOptInfo = findStringRva('weflow_read_opt')
if (readOptInfo) {
  console.log(`  String at file offset 0x${readOptInfo.offset.toString(16)}, RVA 0x${readOptInfo.rva.toString(16)}`)
  const refs = findLeaReferences(readOptInfo.rva)
  for (const ref of refs) {
    const regNames = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi']
    const regIdx = ref.reg + (bytes[ref.offset] === 0x4c ? 8 : 0)
    console.log(`  LEA ${regNames[regIdx] || `r${regIdx}`} at file offset 0x${ref.offset.toString(16)}, RVA 0x${ref.rva.toString(16)}`)

    // 打印附近的代码
    const s = Math.max(0, ref.offset - 32)
    const e = Math.min(bytes.length, ref.offset + 48)
    let hexStr = ''
    for (let j = s; j < e; j++) hexStr += bytes[j].toString(16).padStart(2, '0') + ' '
    console.log(`    Context: ${hexStr}`)
  }
}

// 4. 查找 "WEFLOW_SNAPSHOT_V1" 的 RVA 和引用
console.log('\n=== "WEFLOW_SNAPSHOT_V1" ===')
const snapshotInfo = findStringRva('WEFLOW_SNAPSHOT_V1')
if (snapshotInfo) {
  console.log(`  String at file offset 0x${snapshotInfo.offset.toString(16)}, RVA 0x${snapshotInfo.rva.toString(16)}`)
  const refs = findLeaReferences(snapshotInfo.rva)
  for (const ref of refs) {
    console.log(`  LEA at file offset 0x${ref.offset.toString(16)}`)
  }
} else {
  console.log('  String NOT found (null-terminated)')
  // 尝试不要求 null 终止
  const buf = Buffer.from('WEFLOW_SNAPSHOT_V1', 'ascii')
  for (let i = 0; i < bytes.length - buf.length; i++) {
    let match = true
    for (let j = 0; j < buf.length; j++) {
      if (bytes[i + j] !== buf[j]) { match = false; break }
    }
    if (match) {
      const rva = offsetToRva(i)
      console.log(`  Found at file offset 0x${i.toString(16)}, RVA 0x${rva.toString(16)} (next byte: 0x${bytes[i + buf.length].toString(16)})`)
      const refs = findLeaReferences(rva)
      for (const ref of refs) {
        console.log(`  LEA at file offset 0x${ref.offset.toString(16)}`)
      }
    }
  }
}

// 5. 查找 "https://api.weflow.top/api/token" 的 RVA 和引用
console.log('\n=== "https://api.weflow.top/api/token" ===')
const tokenUrl = 'https://api.weflow.top/api/token'
const tokenBuf = Buffer.from(tokenUrl, 'ascii')
for (let i = 0; i < bytes.length - tokenBuf.length; i++) {
  let match = true
  for (let j = 0; j < tokenBuf.length; j++) {
    if (bytes[i + j] !== tokenBuf[j]) { match = false; break }
  }
  if (match) {
    const rva = offsetToRva(i)
    console.log(`  String at file offset 0x${i.toString(16)}, RVA 0x${rva.toString(16)}`)
    const refs = findLeaReferences(rva)
    for (const ref of refs) {
      console.log(`  LEA at file offset 0x${ref.offset.toString(16)}, RVA 0x${ref.rva.toString(16)}`)
    }
  }
}

// 6. 查找 wcdb_init 函数的 RVA（用于确认调用链）
console.log('\n=== wcdb_init 函数 ===')
const wcdbInitOffset = 0xe8270
const wcdbInitRva = offsetToRva(wcdbInitOffset)
console.log(`  wcdb_init at file offset 0x${wcdbInitOffset.toString(16)}, RVA 0x${wcdbInitRva.toString(16)}`)

// 7. 查找 "weflow.e" 立即数比较附近的 RVA
console.log('\n=== "weflow.e" 立即数比较 ===')
const weflowImm = [0x48, 0xba, 0x77, 0x65, 0x66, 0x6c, 0x6f, 0x77, 0x2e, 0x65]
for (let i = 0; i < bytes.length - weflowImm.length; i++) {
  let match = true
  for (let j = 0; j < weflowImm.length; j++) {
    if (bytes[i + j] !== weflowImm[j]) { match = false; break }
  }
  if (match) {
    const rva = offsetToRva(i)
    console.log(`  mov rdx, 'weflow.e' at file offset 0x${i.toString(16)}, RVA 0x${rva.toString(16)}`)
  }
}
