// 分析 wcdb_api.dll，查找 wcdb_init 函数和 -1006 错误码
const fs = require('fs')
const path = require('path')

const dllPath = 'G:\\Lumina-main\\resources\\wcdb\\win32\\x64\\wcdb_api.dll'
const bytes = fs.readFileSync(dllPath)
console.log(`DLL size: ${bytes.length} bytes`)

// PE header offset at 0x3C
const peOffset = bytes.readInt32LE(0x3C)
console.log(`PE Offset: 0x${peOffset.toString(16)}`)

const numberOfSections = bytes.readUInt16LE(peOffset + 6)
const sizeOfOptionalHeader = bytes.readUInt16LE(peOffset + 20)
const optHeaderOffset = peOffset + 24

// Export table directory (for PE32+, at optHeaderOffset + 112)
const exportTableRVA = bytes.readUInt32LE(optHeaderOffset + 112)

// Section headers
const sectionOffset = optHeaderOffset + sizeOfOptionalHeader
const sections = []
for (let i = 0; i < numberOfSections; i++) {
  const secOff = sectionOffset + i * 40
  const name = bytes.slice(secOff, secOff + 8).toString('ascii').replace(/\0/g, '')
  sections.push({
    name,
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

// 获取导出表
const exportDirOffset = rvaToOffset(exportTableRVA)
const numberOfNames = bytes.readUInt32LE(exportDirOffset + 24)
const addressOfNames = bytes.readUInt32LE(exportDirOffset + 32)
const addressOfNameOrdinals = bytes.readUInt32LE(exportDirOffset + 36)
const addressOfFunctions = bytes.readUInt32LE(exportDirOffset + 28)

const nameOffset = rvaToOffset(addressOfNames)
const ordinalOffset = rvaToOffset(addressOfNameOrdinals)
const funcOffset = rvaToOffset(addressOfFunctions)

// 查找 wcdb_init 的导出地址
let wcdbInitRva = -1
let wcdbInitOffset = -1
for (let i = 0; i < numberOfNames; i++) {
  const nameRva2 = bytes.readUInt32LE(nameOffset + i * 4)
  const nameOff2 = rvaToOffset(nameRva2)
  let end = nameOff2
  while (bytes[end] !== 0) end++
  const funcName = bytes.slice(nameOff2, end).toString('ascii')
  if (funcName === 'wcdb_init') {
    const ordinal = bytes.readUInt16LE(ordinalOffset + i * 2)
    wcdbInitRva = bytes.readUInt32LE(funcOffset + ordinal * 4)
    wcdbInitOffset = rvaToOffset(wcdbInitRva)
    console.log(`\nwcdb_init RVA: 0x${wcdbInitRva.toString(16)}, FileOffset: 0x${wcdbInitOffset.toString(16)}`)
    break
  }
}

if (wcdbInitOffset < 0) {
  console.log('未找到 wcdb_init')
  process.exit(1)
}

// 读取 wcdb_init 函数的字节（前 512 字节）
console.log('\n=== wcdb_init 前 512 字节 ===')
const funcBytes = bytes.slice(wcdbInitOffset, wcdbInitOffset + 512)
const hex = Array.from(funcBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
console.log(hex)

// 搜索 -1006 (0xFFFFFC0E) 的位置
// 在 x64 中，mov eax, -1006 通常是 B8 0E FC FF FF
console.log('\n=== 搜索 -1006 (B8 0E FC FF FF) ===')
const pattern1 = [0xB8, 0x0E, 0xFC, 0xFF, 0xFF]
const found1 = []
for (let i = 0; i < bytes.length - 5; i++) {
  let match = true
  for (let j = 0; j < 5; j++) {
    if (bytes[i + j] !== pattern1[j]) { match = false; break }
  }
  if (match) found1.push(i)
}
console.log(`找到 ${found1.length} 处 B8 0E FC FF FF (mov eax, -1006)`)
for (const pos of found1) {
  let rva = -1
  for (const sec of sections) {
    if (pos >= sec.pointerToRawData && pos < sec.pointerToRawData + sec.virtualSize) {
      rva = sec.virtualAddress + (pos - sec.pointerToRawData)
      break
    }
  }
  const startByte = Math.max(0, pos - 8)
  const endByte = Math.min(bytes.length - 1, pos + 12)
  const context = Array.from(bytes.slice(startByte, endByte + 1)).map(b => b.toString(16).padStart(2, '0')).join(' ')
  console.log(`  位置: FileOffset=0x${pos.toString(16)}, RVA=0x${rva.toString(16)}`)
  console.log(`  上下文: ${context}`)
}

// 也搜索 -1005 (0xFFFFFC0B)
console.log('\n=== 搜索 -1005 (B8 0B FC FF FF) ===')
const pattern2 = [0xB8, 0x0B, 0xFC, 0xFF, 0xFF]
const found2 = []
for (let i = 0; i < bytes.length - 5; i++) {
  let match = true
  for (let j = 0; j < 5; j++) {
    if (bytes[i + j] !== pattern2[j]) { match = false; break }
  }
  if (match) found2.push(i)
}
console.log(`找到 ${found2.length} 处 B8 0B FC FF FF (mov eax, -1005)`)
for (const pos of found2) {
  let rva = -1
  for (const sec of sections) {
    if (pos >= sec.pointerToRawData && pos < sec.pointerToRawData + sec.virtualSize) {
      rva = sec.virtualAddress + (pos - sec.pointerToRawData)
      break
    }
  }
  console.log(`  位置: FileOffset=0x${pos.toString(16)}, RVA=0x${rva.toString(16)}`)
}

// 检查 -1006 是否在 wcdb_init 函数范围内
console.log('\n=== 检查 -1006 是否在 wcdb_init 函数内 ===')
// 假设 wcdb_init 函数长度不超过 2048 字节
const funcEndOffset = wcdbInitOffset + 2048
for (const pos of found1) {
  if (pos >= wcdbInitOffset && pos < funcEndOffset) {
    console.log(`  找到！位置: FileOffset=0x${pos.toString(16)}, 相对偏移: 0x${(pos - wcdbInitOffset).toString(16)}`)
  }
}
