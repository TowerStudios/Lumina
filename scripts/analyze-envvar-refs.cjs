// 分析 WEFLOW_SNAPSHOT_V1 和 weflow_read_opt 的检查逻辑
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

// PE sections
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
    if (offset >= s.rawAddr && offset < s.rawAddr + s.rawSize) {
      return offset - s.rawAddr + s.vAddr
    }
  }
  return offset
}

function rvaToOffset(rva) {
  for (const s of sections) {
    if (rva >= s.vAddr && rva < s.vAddr + s.vSize) {
      return rva - s.vAddr + s.rawAddr
    }
  }
  return rva
}

// 打印某偏移附近的 hex dump（带标注）
function dumpRegion(label, offset, before, after) {
  console.log(`\n=== ${label} (offset 0x${offset.toString(16)}) ===`)
  const start = Math.max(0, offset - before)
  const end = Math.min(bytes.length, offset + after)
  for (let i = start; i < end; i++) {
    process.stdout.write(bytes[i].toString(16).padStart(2, '0') + ' ')
    if ((i - start + 1) % 16 === 0) {
      process.stdout.write(' ')
      const ascii = bytes.toString('ascii', i - 15, i + 1).replace(/[^\x20-\x7e]/g, '.')
      process.stdout.write(ascii)
      // 标注当前偏移
      if (offset >= i - 15 && offset <= i) {
        const pos = (offset - (i - 15)) * 3 + 1
        process.stdout.write('\n' + ' '.repeat(pos) + '^^')
      }
      process.stdout.write('\n')
    }
  }
  if ((end - start) % 16 !== 0) {
    process.stdout.write('\n')
  }
}

// 1. WEFLOW_SNAPSHOT_V1 引用 #1: file offset 0x7fc42
dumpRegion('WEFLOW_SNAPSHOT_V1 ref #1', 0x7fc42, 48, 96)

// 2. WEFLOW_SNAPSHOT_V1 引用 #2: file offset 0x9149e
dumpRegion('WEFLOW_SNAPSHOT_V1 ref #2', 0x9149e, 48, 96)

// 3. weflow_read_opt 引用: file offset 0x3faac
dumpRegion('weflow_read_opt ref', 0x3faac, 48, 96)

// 4. 查找 "wcdb_init [SecurityStatus:" 完整字符串
console.log('\n=== "wcdb_init [SecurityStatus:" 完整字符串 ===')
const fullStr = 'wcdb_init [SecurityStatus:'
const fullBuf = Buffer.from(fullStr, 'ascii')
for (let i = 0; i < bytes.length - fullBuf.length; i++) {
  let match = true
  for (let j = 0; j < fullBuf.length; j++) {
    if (bytes[i + j] !== fullBuf[j]) { match = false; break }
  }
  if (match) {
    let end = i + fullBuf.length
    while (end < bytes.length && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++
    const fullString = bytes.toString('ascii', i, end)
    const rva = offsetToRva(i)
    console.log(`  String at 0x${i.toString(16)} (RVA 0x${rva.toString(16)}): "${fullString}"`)

    // 查找对此 RVA 的 LEA 引用
    for (let j = 0; j < bytes.length - 7; j++) {
      if ((bytes[j] === 0x48 || bytes[j] === 0x4c) && bytes[j + 1] === 0x8d) {
        const modrm = bytes[j + 2]
        if ((modrm & 0xc7) === 0x05) {
          const disp = bytes.readInt32LE(j + 3)
          const codeRva = offsetToRva(j)
          const target = codeRva + 7 + disp
          if (target === rva) {
            console.log(`  LEA at file offset 0x${j.toString(16)} (RVA 0x${codeRva.toString(16)})`)
          }
        }
      }
    }
  }
}

// 5. 查看 weflow.e 比较 (0x6cad6) 附近的更大范围
dumpRegion('weflow.e 比较 (进程名检查)', 0x6cad6, 80, 80)

// 6. 查找 "wechatdataanalysis.exe" 的 RVA 和引用
console.log('\n=== "wechatdataanalysis.exe" 引用 ===')
const wdaBuf = Buffer.from('wechatdataanalysis.exe', 'ascii')
for (let i = 0; i < bytes.length - wdaBuf.length; i++) {
  let match = true
  for (let j = 0; j < wdaBuf.length; j++) {
    if (bytes[i + j] !== wdaBuf[j]) { match = false; break }
  }
  if (match) {
    const rva = offsetToRva(i)
    console.log(`  String at 0x${i.toString(16)} (RVA 0x${rva.toString(16)})`)
    // 查找 LEA 引用
    for (let j = 0; j < bytes.length - 7; j++) {
      if ((bytes[j] === 0x48 || bytes[j] === 0x4c) && bytes[j + 1] === 0x8d) {
        const modrm = bytes[j + 2]
        if ((modrm & 0xc7) === 0x05) {
          const disp = bytes.readInt32LE(j + 3)
          const codeRva = offsetToRva(j)
          const target = codeRva + 7 + disp
          if (target === rva) {
            console.log(`  LEA at file offset 0x${j.toString(16)}`)
          }
        }
      }
    }
  }
}
