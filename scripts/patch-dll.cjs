// Patch wcdb_api.dll: make InitProtection always return 0
// This bypasses the network authorization check (api.weflow.top)
// that causes -1006 errors when the server is unreachable.
//
// Strategy: Find the InitProtection export, patch its entry point
// with `xor eax, eax; ret` (31 C0 C3) to immediately return 0.

const fs = require('fs')
const path = require('path')

const DLL_PATH = path.join(__dirname, '..', 'resources', 'wcdb', 'win32', 'x64', 'wcdb_api.dll')
const BACKUP_PATH = DLL_PATH + '.bak'

function readUint32(buf, offset) {
  return buf.readUInt32LE(offset)
}

function readUint16(buf, offset) {
  return buf.readUInt16LE(offset)
}

function parsePE(buf) {
  // DOS header
  if (buf[0] !== 0x4D || buf[1] !== 0x5A) {
    throw new Error('Not a valid PE file (missing MZ signature)')
  }
  const e_lfanew = readUint32(buf, 0x3C)

  // PE signature
  if (readUint32(buf, e_lfanew) !== 0x00004550) {
    throw new Error('Not a valid PE file (missing PE signature)')
  }

  const coffOffset = e_lfanew + 4
  const machine = readUint16(buf, coffOffset)
  const numberOfSections = readUint16(buf, coffOffset + 2)
  const sizeOfOptionalHeader = readUint16(buf, coffOffset + 16)

  const optionalOffset = coffOffset + 20
  const magic = readUint16(buf, optionalOffset)

  let exportTableRVA, exportTableSize
  if (magic === 0x20B) {
    // PE32+ (64-bit)
    exportTableRVA = readUint32(buf, optionalOffset + 112)
    exportTableSize = readUint32(buf, optionalOffset + 116)
  } else {
    throw new Error(`Not a 64-bit PE file (magic=0x${magic.toString(16)})`)
  }

  // Section headers
  const sectionsOffset = optionalOffset + sizeOfOptionalHeader
  const sections = []
  for (let i = 0; i < numberOfSections; i++) {
    const secOff = sectionsOffset + i * 40
    const name = buf.toString('ascii', secOff, secOff + 8).replace(/\0+$/, '')
    const virtualSize = readUint32(buf, secOff + 8)
    const virtualAddress = readUint32(buf, secOff + 12)
    const sizeOfRawData = readUint32(buf, secOff + 16)
    const pointerToRawData = readUint32(buf, secOff + 20)
    sections.push({ name, virtualSize, virtualAddress, sizeOfRawData, pointerToRawData })
  }

  return { e_lfanew, coffOffset, numberOfSections, sections, exportTableRVA, exportTableSize }
}

function rvaToFileOffset(sections, rva) {
  for (const sec of sections) {
    if (rva >= sec.virtualAddress && rva < sec.virtualAddress + sec.virtualSize) {
      return sec.pointerToRawData + (rva - sec.virtualAddress)
    }
  }
  return null
}

function findExport(buf, pe, exportName) {
  const exportDirOffset = rvaToFileOffset(pe.sections, pe.exportTableRVA)
  if (exportDirOffset === null) {
    throw new Error('Cannot resolve export table file offset')
  }

  const numberOfNames = readUint32(buf, exportDirOffset + 24)
  const addressOfNames = readUint32(buf, exportDirOffset + 32)
  const addressOfNameOrdinals = readUint32(buf, exportDirOffset + 36)
  const addressOfFunctions = readUint32(buf, exportDirOffset + 28)

  const namesOffset = rvaToFileOffset(pe.sections, addressOfNames)
  const ordinalsOffset = rvaToFileOffset(pe.sections, addressOfNameOrdinals)
  const functionsOffset = rvaToFileOffset(pe.sections, addressOfFunctions)

  for (let i = 0; i < numberOfNames; i++) {
    const nameRVA = readUint32(buf, namesOffset + i * 4)
    const nameOffset = rvaToFileOffset(pe.sections, nameRVA)
    if (nameOffset === null) continue

    // Read null-terminated string
    let name = ''
    let j = nameOffset
    while (j < buf.length && buf[j] !== 0) {
      name += String.fromCharCode(buf[j])
      j++
    }

    if (name === exportName) {
      const ordinal = readUint16(buf, ordinalsOffset + i * 2)
      const funcRVA = readUint32(buf, functionsOffset + ordinal * 4)
      const funcOffset = rvaToFileOffset(pe.sections, funcRVA)
      return { name, funcRVA, funcOffset, ordinal }
    }
  }

  return null
}

// Main
console.log(`=== DLL Patch Tool ===`)
console.log(`DLL: ${DLL_PATH}`)

if (!fs.existsSync(DLL_PATH)) {
  console.error('DLL not found!')
  process.exit(1)
}

// Backup
if (!fs.existsSync(BACKUP_PATH)) {
  fs.copyFileSync(DLL_PATH, BACKUP_PATH)
  console.log(`Backup created: ${BACKUP_PATH}`)
} else {
  console.log(`Backup already exists: ${BACKUP_PATH}`)
}

const buf = fs.readFileSync(DLL_PATH)
console.log(`DLL size: ${buf.length} bytes`)

const pe = parsePE(buf)
console.log(`PE parsed: ${pe.numberOfSections} sections`)
pe.sections.forEach(s => console.log(`  ${s.name}: VA=0x${s.virtualAddress.toString(16)} raw=0x${s.pointerToRawData.toString(16)} size=0x${s.sizeOfRawData.toString(16)}`))

// Find InitProtection
const initProt = findExport(buf, pe, 'InitProtection')
if (!initProt) {
  console.error('InitProtection export not found!')
  // List all exports for debugging
  const exportDirOffset = rvaToFileOffset(pe.sections, pe.exportTableRVA)
  const numberOfNames = readUint32(buf, exportDirOffset + 24)
  const addressOfNames = readUint32(buf, exportDirOffset + 32)
  const namesOffset = rvaToFileOffset(pe.sections, addressOfNames)
  console.log(`\nAll ${numberOfNames} exports:`)
  for (let i = 0; i < numberOfNames; i++) {
    const nameRVA = readUint32(buf, namesOffset + i * 4)
    const nameOffset = rvaToFileOffset(pe.sections, nameRVA)
    if (nameOffset === null) continue
    let name = ''
    let j = nameOffset
    while (j < buf.length && buf[j] !== 0) { name += String.fromCharCode(buf[j]); j++ }
    console.log(`  [${i}] ${name}`)
  }
  process.exit(1)
}

console.log(`\nFound InitProtection:`)
console.log(`  RVA: 0x${initProt.funcRVA.toString(16)}`)
console.log(`  File offset: 0x${initProt.funcOffset.toString(16)}`)
console.log(`  Original bytes: ${Array.from(buf.slice(initProt.funcOffset, initProt.funcOffset + 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)

// Check if already patched
const patch = [0x31, 0xC0, 0xC3] // xor eax, eax; ret
if (buf[initProt.funcOffset] === 0x31 && buf[initProt.funcOffset + 1] === 0xC0 && buf[initProt.funcOffset + 2] === 0xC3) {
  console.log('\nAlready patched! InitProtection returns 0.')
  process.exit(0)
}

// Apply patch
for (let i = 0; i < patch.length; i++) {
  buf[initProt.funcOffset + i] = patch[i]
}

fs.writeFileSync(DLL_PATH, buf)
console.log(`\nPatch applied! InitProtection now returns 0.`)
console.log(`  Patched bytes: ${Array.from(buf.slice(initProt.funcOffset, initProt.funcOffset + 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)

// Also find and check wcdb_init
const wcdbInit = findExport(buf, pe, 'wcdb_init')
if (wcdbInit) {
  console.log(`\nwcdb_init found at file offset 0x${wcdbInit.funcOffset.toString(16)}`)
  console.log(`  Bytes: ${Array.from(buf.slice(wcdbInit.funcOffset, wcdbInit.funcOffset + 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
}

console.log('\nDone! Please restart the application.')
