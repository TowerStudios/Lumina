// 搜索 -1006 的所有字节序列
const fs = require('fs')
const dllPath = 'G:\\Lumina-main\\resources\\wcdb\\win32\\x64\\wcdb_api.dll'
const bytes = fs.readFileSync(dllPath)

// -1006 = 0xFFFFFC0E (32-bit signed)
// little-endian: 0E FC FF FF
const target = [0x0E, 0xFC, 0xFF, 0xFF]
const found = []
for (let i = 0; i < bytes.length - 4; i++) {
  if (bytes[i] === 0x0E && bytes[i+1] === 0xFC && bytes[i+2] === 0xFF && bytes[i+3] === 0xFF) {
    found.push(i)
  }
}
console.log(`找到 ${found.length} 处 0E FC FF FF (-1006 little-endian)`)
for (const pos of found) {
  const startByte = Math.max(0, pos - 12)
  const endByte = Math.min(bytes.length - 1, pos + 8)
  const context = Array.from(bytes.slice(startByte, endByte + 1)).map(b => b.toString(16).padStart(2, '0')).join(' ')
  console.log(`  位置: 0x${pos.toString(16)}, 上下文: ${context}`)
}

// -1005 = 0xFFFFFC0B
console.log('\n=== 搜索 -1005 (0B FC FF FF) ===')
const target2 = [0x0B, 0xFC, 0xFF, 0xFF]
const found2 = []
for (let i = 0; i < bytes.length - 4; i++) {
  if (bytes[i] === 0x0B && bytes[i+1] === 0xFC && bytes[i+2] === 0xFF && bytes[i+3] === 0xFF) {
    found2.push(i)
  }
}
console.log(`找到 ${found2.length} 处 0B FC FF FF (-1005 little-endian)`)
for (const pos of found2) {
  const startByte = Math.max(0, pos - 12)
  const endByte = Math.min(bytes.length - 1, pos + 8)
  const context = Array.from(bytes.slice(startByte, endByte + 1)).map(b => b.toString(16).padStart(2, '0')).join(' ')
  console.log(`  位置: 0x${pos.toString(16)}, 上下文: ${context}`)
}

// 搜索 wcdb_init 函数中的所有 ret 指令 (C3)
console.log('\n=== wcdb_init 函数中的 ret 指令 ===')
const peOffset = bytes.readInt32LE(0x3C)
const optHeaderOffset = peOffset + 24
const sizeOfOptionalHeader = bytes.readUInt16LE(peOffset + 20)
const numberOfSections = bytes.readUInt16LE(peOffset + 6)
const exportTableRVA = bytes.readUInt32LE(optHeaderOffset + 112)
const sectionOffset = optHeaderOffset + sizeOfOptionalHeader
const sections = []
for (let i = 0; i < numberOfSections; i++) {
  const secOff = sectionOffset + i * 40
  sections.push({
    virtualAddress: bytes.readUInt32LE(secOff + 12),
    virtualSize: bytes.readUInt32LE(secOff + 8),
    pointerToRawData: bytes.readUInt32LE(secOff + 20)
  })
}
function rvaToOffset(rva) {
  for (const sec of sections) {
    if (rva >= sec.virtualAddress && rva < sec.virtualAddress + sec.virtualSize) {
      return sec.pointerToRawData + (rva - sec.virtualAddress)
    }
  }
  return -1
}
const exportDirOffset = rvaToOffset(exportTableRVA)
const numberOfNames = bytes.readUInt32LE(exportDirOffset + 24)
const addressOfNames = bytes.readUInt32LE(exportDirOffset + 32)
const addressOfNameOrdinals = bytes.readUInt32LE(exportDirOffset + 36)
const addressOfFunctions = bytes.readUInt32LE(exportDirOffset + 28)
const nameOffset = rvaToOffset(addressOfNames)
const ordinalOffset = rvaToOffset(addressOfNameOrdinals)
const funcOffset = rvaToOffset(addressOfFunctions)

let wcdbInitOffset = -1
for (let i = 0; i < numberOfNames; i++) {
  const nameRva2 = bytes.readUInt32LE(nameOffset + i * 4)
  const nameOff2 = rvaToOffset(nameRva2)
  let end = nameOff2
  while (bytes[end] !== 0) end++
  const funcName = bytes.slice(nameOff2, end).toString('ascii')
  if (funcName === 'wcdb_init') {
    const ordinal = bytes.readUInt16LE(ordinalOffset + i * 2)
    const wcdbInitRva = bytes.readUInt32LE(funcOffset + ordinal * 4)
    wcdbInitOffset = rvaToOffset(wcdbInitRva)
    break
  }
}

if (wcdbInitOffset >= 0) {
  // 搜索 wcdb_init 前 4096 字节中的 ret 指令
  for (let i = 0; i < 4096 && wcdbInitOffset + i < bytes.length; i++) {
    if (bytes[wcdbInitOffset + i] === 0xC3) {
      // 显示 ret 前面的几条指令
      const startByte = Math.max(wcdbInitOffset, wcdbInitOffset + i - 16)
      const context = Array.from(bytes.slice(startByte, wcdbInitOffset + i + 1)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      console.log(`  ret at offset 0x${(wcdbInitOffset + i).toString(16)} (相对 +0x${i.toString(16)}): ${context}`)
    }
  }
}
