# 使用 dumpbin 或 PowerShell 列出 DLL 导出函数
$dllPath = 'G:\Lumina-main\resources\wcdb\win32\x64\wcdb_api.dll'

# 方法：解析 PE 文件的导出表
$bytes = [System.IO.File]::ReadAllBytes($dllPath)

# PE header offset at 0x3C
$peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
Write-Host ("PE Offset: 0x{0:X}" -f $peOffset)

# PE signature (should be 'PE\0\0')
$peSig = [System.Text.Encoding]::ASCII.GetString($bytes, $peOffset, 4)
Write-Host "PE Signature: $peSig"

# COFF header (20 bytes after PE sig)
$machine = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
$numberOfSections = [BitConverter]::ToUInt16($bytes, $peOffset + 6)
$sizeOfOptionalHeader = [BitConverter]::ToUInt16($bytes, $peOffset + 20)
Write-Host ("Machine: 0x{0:X} (0x8664 = x64)" -f $machine)
Write-Host "Sections: $numberOfSections"
Write-Host "Optional Header Size: $sizeOfOptionalHeader"

# Optional header starts at peOffset + 24
$optHeaderOffset = $peOffset + 24
$magic = [BitConverter]::ToUInt16($bytes, $optHeaderOffset)
Write-Host ("Optional Header Magic: 0x{0:X} (0x20b = PE32+)" -f $magic)

# Export table directory (for PE32+, at optHeaderOffset + 112)
$exportTableRVA = [BitConverter]::ToUInt32($bytes, $optHeaderOffset + 112)
$exportTableSize = [BitConverter]::ToUInt32($bytes, $optHeaderOffset + 116)
Write-Host ("Export Table RVA: 0x{0:X}" -f $exportTableRVA)
Write-Host "Export Table Size: $exportTableSize"

# 需要将 RVA 转换为文件偏移
# 遍历 section headers (在 optional header 之后)
$sectionOffset = $optHeaderOffset + $sizeOfOptionalHeader
$sections = @()
for ($i = 0; $i -lt $numberOfSections; $i++) {
    $secOff = $sectionOffset + ($i * 40)
    $name = [System.Text.Encoding]::ASCII.GetString($bytes, $secOff, 8).TrimEnd([char]0)
    $virtualSize = [BitConverter]::ToUInt32($bytes, $secOff + 8)
    $virtualAddress = [BitConverter]::ToUInt32($bytes, $secOff + 12)
    $sizeOfRawData = [BitConverter]::ToUInt32($bytes, $secOff + 16)
    $pointerToRawData = [BitConverter]::ToUInt32($bytes, $secOff + 20)
    $sections += [PSCustomObject]@{
        Name = $name
        VirtualSize = $virtualSize
        VirtualAddress = $virtualAddress
        SizeOfRawData = $sizeOfRawData
        PointerToRawData = $pointerToRawData
    }
    Write-Host ("Section {0}: VA=0x{1:X} Size={2} RawOff=0x{3:X}" -f $name, $virtualAddress, $virtualSize, $pointerToRawData)
}

function RvaToOffset($rva) {
    foreach ($sec in $sections) {
        if ($rva -ge $sec.VirtualAddress -and $rva -lt ($sec.VirtualAddress + $sec.VirtualSize)) {
            return $sec.PointerToRawData + ($rva - $sec.VirtualAddress)
        }
    }
    return -1
}

$exportDirOffset = RvaToOffset $exportTableRVA
Write-Host ("Export Dir File Offset: 0x{0:X}" -f $exportDirOffset)

# IMAGE_EXPORT_DIRECTORY
$characteristics = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 0)
$timeDateStamp = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 4)
$nameRva = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 12)
$base = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 16)
$numberOfFunctions = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 20)
$numberOfNames = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 24)
$addressOfFunctions = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 28)
$addressOfNames = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 32)
$addressOfNameOrdinals = [BitConverter]::ToUInt32($bytes, $exportDirOffset + 36)

Write-Host "Number of functions: $numberOfFunctions"
Write-Host "Number of names: $numberOfNames"
Write-Host "Base ordinal: $base"

$nameOffset = RvaToOffset $addressOfNames
$ordinalOffset = RvaToOffset $addressOfNameOrdinals
$funcOffset = RvaToOffset $addressOfFunctions

Write-Host ""
Write-Host "=== Exported Functions ==="
$exports = @()
for ($i = 0; $i -lt $numberOfNames; $i++) {
    $nameRva2 = [BitConverter]::ToUInt32($bytes, $nameOffset + ($i * 4))
    $nameOff2 = RvaToOffset $nameRva2
    # 读取以 null 结尾的字符串
    $end = $nameOff2
    while ($bytes[$end] -ne 0) { $end++ }
    $funcName = [System.Text.Encoding]::ASCII.GetString($bytes, $nameOff2, $end - $nameOff2)
    $exports += $funcName
}
$exports | Sort-Object
