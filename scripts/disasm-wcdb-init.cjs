// 反汇编 wcdb_init 函数，查找 SecurityStatus 检查流程
const fs = require('fs')
const path = require('path')

const dllPath = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const bytes = fs.readFileSync(dllPath)

// wcdb_init at FileOffset 0xe8270
const funcOffset = 0xe8270

// 1. Dump 前 512 字节的 hex 和 ASCII
console.log('=== wcdb_init 函数前 512 字节 ===')
for (let i = 0; i < 512; i++) {
  const b = bytes[funcOffset + i]
  process.stdout.write(b.toString(16).padStart(2, '0') + ' ')
  if ((i + 1) % 16 === 0) {
    process.stdout.write(' ')
    const ascii = bytes.toString('ascii', funcOffset + i - 15, funcOffset + i + 1).replace(/[^\x20-\x7e]/g, '.')
    process.stdout.write(ascii)
    process.stdout.write('\n')
  }
}

// 2. 查找 wcdb_init 函数中对 SecurityStatus 字符串的引用
// SecurityStatus 字符串在 0x1160e4
// 在 x64 中，LEA 指令通常用 RIP-relative 寻址：48 8d xx [rip + offset]
// 查找所有引用 SecurityStatus 字符串的位置
console.log('\n=== 查找引用 SecurityStatus 字符串的代码 ===')
const secStatusOffset = 0x1160e4
for (let i = 0; i < bytes.length - 7; i++) {
  // LEA rXX, [rip + offset]: 48 8d xx yy yy yy yy (或 4c 8d xx yy yy yy yy)
  if ((bytes[i] === 0x48 || bytes[i] === 0x4c) && bytes[i+1] === 0x8d) {
    const modrm = bytes[i+2]
    if ((modrm & 0xc7) === 0x05) { // RIP-relative
      const disp = bytes.readInt32LE(i + 3)
      const target = i + 7 + disp // RIP + disp (RIP = next instruction = i + 7)
      if (target === secStatusOffset) {
        console.log(`  LEA at 0x${i.toString(16)} -> SecurityStatus (0x${secStatusOffset.toString(16)})`)
      }
    }
  }
}

// 3. 查找对 "Security validation failed" 字符串的引用
console.log('\n=== 查找引用 "Security validation failed" 的代码 ===')
const secFailOffset = 0x11b798
for (let i = 0; i < bytes.length - 7; i++) {
  if ((bytes[i] === 0x48 || bytes[i] === 0x4c) && bytes[i+1] === 0x8d) {
    const modrm = bytes[i+2]
    if ((modrm & 0xc7) === 0x05) {
      const disp = bytes.readInt32LE(i + 3)
      const target = i + 7 + disp
      if (target === secFailOffset) {
        console.log(`  LEA at 0x${i.toString(16)} -> "Security validation failed" (0x${secFailOffset.toString(16)})`)
      }
    }
  }
}

// 4. 查找对 WEFLOW_SNAPSHOT_V1 环境变量的引用
console.log('\n=== 查找引用 WEFLOW_SNAPSHOT_V1 的代码 ===')
const weflowSnapshotOffset = 0x114170
for (let i = 0; i < bytes.length - 7; i++) {
  if ((bytes[i] === 0x48 || bytes[i] === 0x4c) && bytes[i+1] === 0x8d) {
    const modrm = bytes[i+2]
    if ((modrm & 0xc7) === 0x05) {
      const disp = bytes.readInt32LE(i + 3)
      const target = i + 7 + disp
      if (target === weflowSnapshotOffset) {
        console.log(`  LEA at 0x${i.toString(16)} -> WEFLOW_SNAPSHOT_V1 (0x${weflowSnapshotOffset.toString(16)})`)
      }
    }
  }
}

// 5. 查找对 weflow_read_opt 环境变量的引用
console.log('\n=== 查找引用 weflow_read_opt 的代码 ===')
const weflowReadOptOffset = 0x115288
for (let i = 0; i < bytes.length - 7; i++) {
  if ((bytes[i] === 0x48 || bytes[i] === 0x4c) && bytes[i+1] === 0x8d) {
    const modrm = bytes[i+2]
    if ((modrm & 0xc7) === 0x05) {
      const disp = bytes.readInt32LE(i + 3)
      const target = i + 7 + disp
      if (target === weflowReadOptOffset) {
        console.log(`  LEA at 0x${i.toString(16)} -> weflow_read_opt (0x${weflowReadOptOffset.toString(16)})`)
      }
    }
  }
}

// 6. 查找对 "weflow.e" 立即数比较的代码（mov rdx, 'weflow.e' = 48 ba 77 65 66 6c 6f 77 2e 65）
console.log('\n=== 查找 "weflow.e" 立即数比较 ===')
const weflowImm = [0x48, 0xba, 0x77, 0x65, 0x66, 0x6c, 0x6f, 0x77, 0x2e, 0x65]
for (let i = 0; i < bytes.length - weflowImm.length; i++) {
  let match = true
  for (let j = 0; j < weflowImm.length; j++) {
    if (bytes[i + j] !== weflowImm[j]) { match = false; break }
  }
  if (match) {
    console.log(`  mov rdx, 'weflow.e' at 0x${i.toString(16)}`)
    // 打印前后 32 字节上下文
    const start = Math.max(0, i - 16)
    const end = Math.min(bytes.length, i + weflowImm.length + 16)
    console.log(`    Context: ${bytes.toString('ascii', start, end).replace(/[^\x20-\x7e]/g, '.')}`)
  }
}

// 7. 查找对 "https://api.weflow.top/api/token" 字符串的引用
console.log('\n=== 查找引用 api.weflow.top/api/token 的代码 ===')
const tokenUrlStr = 'https://api.weflow.top/api/token'
const tokenUrlBuf = Buffer.from(tokenUrlStr, 'ascii')
for (let i = 0; i < bytes.length - tokenUrlBuf.length; i++) {
  let match = true
  for (let j = 0; j < tokenUrlBuf.length; j++) {
    if (bytes[i + j] !== tokenUrlBuf[j]) { match = false; break }
  }
  if (match) {
    console.log(`  String at 0x${i.toString(16)}`)
    // 查找对此地址的 LEA 引用
    for (let j = 0; j < bytes.length - 7; j++) {
      if ((bytes[j] === 0x48 || bytes[j] === 0x4c) && bytes[j+1] === 0x8d) {
        const modrm = bytes[j+2]
        if ((modrm & 0xc7) === 0x05) {
          const disp = bytes.readInt32LE(j + 3)
          const target = j + 7 + disp
          if (target === i) {
            console.log(`    LEA at 0x${j.toString(16)} -> token URL`)
          }
        }
      }
    }
  }
}
